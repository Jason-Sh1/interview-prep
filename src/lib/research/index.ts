import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { cache } from "react";
import { db, ensureMigrated, schema } from "../db";
import { COMPANIES, COMPANY_BY_ID, type CompanyMap } from "../engine/companies";
import { researchCompany } from "./claude";
import { diffProfiles, profileFromEstimate, toCompanyProfile, type ProfileData, type Source } from "./profiles";

// The research job (spec 4.6): versioned company profiles with sources, a
// review queue, and the live profiles the planner uses. A run researches each
// company; a version that changes something waits for a person to approve it,
// and one that changes nothing just marks the current version as verified.

export const researchEnabled = () => !!process.env.ANTHROPIC_API_KEY;

type Row = typeof schema.companyProfiles.$inferSelect;

export interface ProfileVersion {
  id: number;
  companyId: string;
  version: number;
  status: "pending" | "approved" | "rejected";
  generator: "seed" | "claude";
  data: ProfileData;
  changes: string[];
  sources: Source[];
  createdAt: Date;
  verifiedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

const toVersion = (r: Row): ProfileVersion => ({ ...r, data: r.data as unknown as ProfileData }) as ProfileVersion;

/** Writes version 1 (the built-in estimate) for any company that has no versions yet. */
export async function seedProfiles(): Promise<void> {
  await ensureMigrated();
  const have = await db.selectDistinct({ companyId: schema.companyProfiles.companyId }).from(schema.companyProfiles);
  const known = new Set(have.map((r) => r.companyId));
  const missing = COMPANIES.filter((c) => !known.has(c.id));
  if (!missing.length) return;
  await db
    .insert(schema.companyProfiles)
    .values(
      missing.map((c) => ({
        companyId: c.id,
        version: 1,
        status: "approved",
        generator: "seed",
        data: profileFromEstimate(c) as unknown as Record<string, unknown>,
      })),
    )
    .onConflictDoNothing();
}

/** Each company's latest approved version. */
export const getApprovedProfiles = cache(async (): Promise<Map<string, ProfileVersion>> => {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(schema.companyProfiles)
    .where(eq(schema.companyProfiles.status, "approved"))
    .orderBy(desc(schema.companyProfiles.version));
  const out = new Map<string, ProfileVersion>();
  for (const r of rows) if (!out.has(r.companyId)) out.set(r.companyId, toVersion(r));
  return out;
});

/** The profiles the planner uses: approved research where there is some, the estimates elsewhere. */
export const getLiveCompanies = cache(async (): Promise<CompanyMap> => {
  const approved = await getApprovedProfiles().catch(() => new Map<string, ProfileVersion>());
  const out: CompanyMap = { ...COMPANY_BY_ID };
  for (const [id, v] of approved) if (COMPANY_BY_ID[id]) out[id] = toCompanyProfile(id, v.data);
  return out;
});

export interface QueueItem {
  pending: ProfileVersion;
  current: ProfileVersion | null;
}

export async function getReviewQueue(): Promise<QueueItem[]> {
  await ensureMigrated();
  const [pending, approved] = await Promise.all([
    db.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.status, "pending")).orderBy(desc(schema.companyProfiles.createdAt)),
    getApprovedProfiles(),
  ]);
  return pending.map((r) => ({ pending: toVersion(r), current: approved.get(r.companyId) ?? null }));
}

/** Approves or rejects a pending version. Approving also rejects older pending versions of that company. */
export async function reviewProfile(id: number, decision: "approved" | "rejected", reviewer: string): Promise<void> {
  await ensureMigrated();
  const [row] = await db.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.id, id));
  if (!row || row.status !== "pending") throw new Error("That version isn't waiting for review");
  const now = new Date();
  await db.update(schema.companyProfiles).set({ status: decision, reviewedAt: now, reviewedBy: reviewer }).where(eq(schema.companyProfiles.id, id));
  if (decision === "approved") {
    await db
      .update(schema.companyProfiles)
      .set({ status: "rejected", reviewedAt: now, reviewedBy: reviewer })
      .where(
        and(
          eq(schema.companyProfiles.companyId, row.companyId),
          eq(schema.companyProfiles.status, "pending"),
          lt(schema.companyProfiles.version, row.version),
        ),
      );
  }
}

export async function getProfileHistory(companyId: string): Promise<ProfileVersion[]> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(schema.companyProfiles)
    .where(eq(schema.companyProfiles.companyId, companyId))
    .orderBy(desc(schema.companyProfiles.version));
  return rows.map(toVersion);
}

export interface WhatsNewItem {
  companyId: string;
  name: string;
  changes: string[];
  sources: Source[];
  approvedAt: Date;
}

/** Research changes approved in the last `days` days, the user's target companies first. */
export async function getWhatsNew(targets: string[], days = 45, now = new Date()): Promise<WhatsNewItem[]> {
  await ensureMigrated();
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db
    .select()
    .from(schema.companyProfiles)
    .where(
      and(
        eq(schema.companyProfiles.status, "approved"),
        eq(schema.companyProfiles.generator, "claude"),
        gte(schema.companyProfiles.reviewedAt, since),
      ),
    )
    .orderBy(desc(schema.companyProfiles.reviewedAt));
  const seen = new Set<string>();
  const items: WhatsNewItem[] = [];
  for (const r of rows) {
    if (seen.has(r.companyId) || !r.changes.length || !COMPANY_BY_ID[r.companyId]) continue;
    seen.add(r.companyId);
    items.push({
      companyId: r.companyId,
      name: (r.data as unknown as ProfileData).name,
      changes: r.changes,
      sources: r.sources,
      approvedAt: r.reviewedAt!,
    });
  }
  const t = new Set(targets);
  return items.sort((a, b) => Number(t.has(b.companyId)) - Number(t.has(a.companyId)));
}

export type ResearchRun = typeof schema.researchRuns.$inferSelect;

export async function listRuns(limit = 10): Promise<ResearchRun[]> {
  await ensureMigrated();
  return db.select().from(schema.researchRuns).orderBy(desc(schema.researchRuns.startedAt)).limit(limit);
}

/** A run that started in the last hour and hasn't finished; older ones are treated as dead. */
async function activeRun(): Promise<ResearchRun | null> {
  const [r] = await db
    .select()
    .from(schema.researchRuns)
    .where(and(eq(schema.researchRuns.status, "running"), gte(schema.researchRuns.startedAt, new Date(Date.now() - 3_600_000))))
    .limit(1);
  return r ?? null;
}

/** Creates a run row, or returns null when one is already running. Skipped (and recorded) without an API key. */
export async function startRun(trigger: "cron" | "manual" | "cli"): Promise<ResearchRun | null> {
  await ensureMigrated();
  if (await activeRun()) return null;
  const enabled = researchEnabled();
  const [run] = await db
    .insert(schema.researchRuns)
    .values({
      trigger,
      status: enabled ? "running" : "skipped",
      ...(enabled ? {} : { finishedAt: new Date(), error: "ANTHROPIC_API_KEY is not set, so there is nothing to research with." }),
    })
    .returning();
  return run;
}

const PARALLEL = 3;

/** Researches every company (or the given ones) for a run created by startRun. */
export async function executeRun(runId: number, companyIds?: string[]): Promise<ResearchRun> {
  await seedProfiles();
  const approved = await freshApproved();
  const ids = (companyIds?.length ? companyIds : COMPANIES.map((c) => c.id)).filter((id) => COMPANY_BY_ID[id]);
  const results: ResearchRun["results"] = [];
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        results.push({ companyId: id, result: await researchOne(runId, id, approved.get(id)) });
      } catch (e) {
        results.push({ companyId: id, result: "failed", error: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL, ids.length) }, worker));
    const failed = results.every((r) => r.result === "failed") && results.length > 0;
    const [run] = await db
      .update(schema.researchRuns)
      .set({ status: failed ? "failed" : "done", finishedAt: new Date(), results, ...(failed ? { error: "Every company failed" } : {}) })
      .where(eq(schema.researchRuns.id, runId))
      .returning();
    return run;
  } catch (e) {
    const [run] = await db
      .update(schema.researchRuns)
      .set({ status: "failed", finishedAt: new Date(), results, error: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.researchRuns.id, runId))
      .returning();
    return run;
  }
}

/** Not cached per request: a run can outlive the request that started it. */
async function freshApproved(): Promise<Map<string, ProfileVersion>> {
  const rows = await db
    .select()
    .from(schema.companyProfiles)
    .where(eq(schema.companyProfiles.status, "approved"))
    .orderBy(desc(schema.companyProfiles.version));
  const out = new Map<string, ProfileVersion>();
  for (const r of rows) if (!out.has(r.companyId)) out.set(r.companyId, toVersion(r));
  return out;
}

async function researchOne(runId: number, companyId: string, current: ProfileVersion | undefined): Promise<string> {
  const base = current?.data ?? profileFromEstimate(COMPANY_BY_ID[companyId]);
  const found = await researchCompany(companyId, base);
  const changes = diffProfiles(base, found.data);
  const now = new Date();
  if (!changes.length && current) {
    // Nothing new: the current version is confirmed as of today.
    await db.update(schema.companyProfiles).set({ verifiedAt: now, sources: found.sources }).where(eq(schema.companyProfiles.id, current.id));
    return "unchanged";
  }
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.companyProfiles.version}), 0)` })
    .from(schema.companyProfiles)
    .where(eq(schema.companyProfiles.companyId, companyId));
  await db.insert(schema.companyProfiles).values({
    companyId,
    version: Number(max) + 1,
    status: "pending",
    generator: "claude",
    data: found.data as unknown as Record<string, unknown>,
    changes: found.confidence === "low" ? [...changes, "Low confidence: the sources were thin."] : changes,
    sources: found.sources,
    runId,
    verifiedAt: now,
  });
  return "queued";
}

/** Starts and finishes a run in one call (the CLI and cron). */
export async function runResearch(trigger: "cron" | "manual" | "cli", companyIds?: string[]): Promise<ResearchRun | null> {
  const run = await startRun(trigger);
  if (!run || run.status !== "running") return run;
  return executeRun(run.id, companyIds);
}

export async function pendingCount(): Promise<number> {
  await ensureMigrated();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.companyProfiles).where(eq(schema.companyProfiles.status, "pending"));
  return Number(n);
}
