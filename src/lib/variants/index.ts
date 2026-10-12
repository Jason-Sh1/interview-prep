import "server-only";
// Review variants (spec 4.2): stored, checked, and handed out so each review
// of a solved problem can be a fresh twist on it. Claude drafts a variant in
// the background after a solve; a draft is kept only when its reference
// solution passes every one of its own tests.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { PROBLEM_BY_SLUG } from "../problems";
import type { Problem } from "../problems/types";
import { gradeOutput, type RunOutcome } from "../runner/compare";
import { buildProgram } from "../runner/drivers";
import { VARIANT_MODEL, draftVariant } from "./claude";
import { draftToVariant, variantProblem, type VariantData } from "./shape";

export const variantsEnabled = () => !!process.env.ANTHROPIC_API_KEY;

/** Variants kept per problem; enough that reviews rarely repeat one. */
export const MAX_VARIANTS = 3;
const DRAFT_TRIES = 2;

export interface Variant {
  id: number;
  baseSlug: string;
  data: VariantData;
}

const toVariant = (r: typeof schema.problemVariants.$inferSelect): Variant => ({ id: r.id, baseSlug: r.baseSlug, data: r.data as unknown as VariantData });

/**
 * Runs a variant's reference solution against its tests in a separate Node
 * process with the permission model on (no file writes, child processes or
 * workers) and a time limit. The code is ours, written by our own model call,
 * but it still never runs inside the server process.
 */
export function checkReference(v: VariantData, timeoutMs = 10_000): RunOutcome {
  const dir = mkdtempSync(join(tmpdir(), "ip-variant-"));
  try {
    const file = join(dir, "main.js");
    writeFileSync(file, buildProgram(v.signature, "javascript", v.reference, v.tests));
    const major = Number(process.versions.node.split(".")[0]);
    const res = spawnSync(
      process.execPath,
      [major >= 23 ? "--permission" : "--experimental-permission", `--allow-fs-read=${file}`, "--no-warnings", "--max-old-space-size=256", file],
      { timeout: timeoutMs, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { NODE_ENV: "production" } },
    );
    const timedOut = res.error?.message.includes("ETIMEDOUT") ?? false;
    return gradeOutput(v.signature, v.tests, res.stdout ?? "", res.stderr ?? "", "local", { timedOut });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function listVariants(slug: string): Promise<Variant[]> {
  await ensureMigrated();
  const rows = await db.select().from(schema.problemVariants).where(eq(schema.problemVariants.baseSlug, slug)).orderBy(desc(schema.problemVariants.id));
  return rows.map(toVariant);
}

export async function getVariant(id: number): Promise<Variant | null> {
  await ensureMigrated();
  const [r] = await db.select().from(schema.problemVariants).where(eq(schema.problemVariants.id, id));
  return r ? toVariant(r) : null;
}

/** The base problem with a variant's content, or null if the variant doesn't belong to it. */
export async function variantFor(slug: string, id: number): Promise<{ variant: Variant; problem: Problem } | null> {
  const base = PROBLEM_BY_SLUG.get(slug);
  const variant = await getVariant(id);
  if (!base || !variant || variant.baseSlug !== slug) return null;
  return { variant, problem: variantProblem(base, variant.data) };
}

async function seenVariantIds(userId: string, slugs?: string[]): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ id: schema.attempts.variantId })
    .from(schema.attempts)
    .where(
      and(
        eq(schema.attempts.userId, userId),
        isNotNull(schema.attempts.variantId),
        ...(slugs ? [inArray(schema.attempts.problemSlug, slugs)] : []),
      ),
    );
  return new Set(rows.map((r) => r.id as number));
}

/** The newest variant of a problem this user hasn't attempted yet. */
export async function pickVariant(userId: string, slug: string): Promise<Variant | null> {
  const [all, seen] = await Promise.all([listVariants(slug), seenVariantIds(userId, [slug])]);
  return all.find((v) => !seen.has(v.id)) ?? null;
}

/** Which of these problems have a variant the user hasn't done (for Today's reasons). */
export async function variantsWaiting(userId: string, slugs: string[]): Promise<Map<string, Variant>> {
  if (!slugs.length) return new Map();
  await ensureMigrated();
  const [rows, seen] = await Promise.all([
    db.select().from(schema.problemVariants).where(inArray(schema.problemVariants.baseSlug, slugs)).orderBy(desc(schema.problemVariants.id)),
    seenVariantIds(userId, slugs),
  ]);
  const out = new Map<string, Variant>();
  for (const r of rows) if (!seen.has(r.id) && !out.has(r.baseSlug)) out.set(r.baseSlug, toVariant(r));
  return out;
}

/** Drafts, checks and stores one new variant. Returns null if no draft passed its own tests. */
export async function createVariant(slug: string, draft = draftVariant): Promise<Variant | null> {
  const base = PROBLEM_BY_SLUG.get(slug);
  if (!base || base.signature.kind !== "function") return null;
  const existing = await listVariants(slug);
  for (let i = 0; i < DRAFT_TRIES; i++) {
    try {
      const data = draftToVariant(await draft(base, existing.map((v) => `${v.data.title}: ${v.data.twist}`)));
      const check = checkReference(data);
      if (check.verdict !== "accepted") throw new Error(`Reference ${check.verdict}: ${check.passed}/${check.total} tests`);
      const [row] = await db
        .insert(schema.problemVariants)
        .values({ baseSlug: slug, data: data as unknown as Record<string, unknown>, model: VARIANT_MODEL })
        .returning();
      return toVariant(row);
    } catch (e) {
      console.error(`Variant draft for ${slug} rejected`, e);
    }
  }
  return null;
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Makes sure the user has a variant waiting for their next review of this
 * problem, drafting one if every existing variant has been used and there's
 * room for another. Meant to run in the background after a solve.
 */
export async function ensureVariant(userId: string, slug: string): Promise<void> {
  if (!variantsEnabled()) return;
  const base = PROBLEM_BY_SLUG.get(slug);
  if (!base || base.signature.kind !== "function") return;
  if (await pickVariant(userId, slug)) return;
  if ((await listVariants(slug)).length >= MAX_VARIANTS) return;
  const running = inFlight.get(slug);
  if (running) return void (await running);
  const p = createVariant(slug).finally(() => inFlight.delete(slug));
  inFlight.set(slug, p);
  await p;
}
