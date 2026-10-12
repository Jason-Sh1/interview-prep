import "server-only";
// The onboarding diagnostic (spec 4.1): picks its problems, tracks progress
// through them, and on finishing sets starting estimates for the rest of the
// track and stores the communication baseline.

import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { getReport } from "../feedback";
import { createMockSession, getMockSession } from "../mock";
import { PROBLEM_BY_SLUG, PROBLEMS } from "../problems";
import type { PatternId } from "../problems/types";
import type { Language } from "../runner/drivers";
import { getSkills } from "../track";
import { communicationBaseline, DIAGNOSTIC_MOCK, pickDiagnostic, untestedPriors, type DiagnosticResult } from "./plan";

export interface DiagnosticStep {
  slug: string;
  title: string;
  pattern: PatternId;
  /** The first attempt made since the diagnostic started, if any. */
  attempt: { solved: boolean; before: number; after: number } | null;
}

export interface Diagnostic {
  startedAt: Date;
  completedAt: Date | null;
  skipped: boolean;
  steps: DiagnosticStep[];
  mock: { slug: string; title: string; sessionId: string | null; ended: boolean; reported: boolean };
  result: DiagnosticResult | null;
}

/** The user's diagnostic with progress, or null if they never started or skipped it. */
export async function getDiagnostic(userId: string): Promise<Diagnostic | null> {
  await ensureMigrated();
  const [row] = await db.select().from(schema.diagnostics).where(eq(schema.diagnostics.userId, userId));
  if (!row) return null;
  const attempts = row.problems.length
    ? await db
        .select()
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.userId, userId),
            inArray(schema.attempts.problemSlug, row.problems),
            gte(schema.attempts.finishedAt, row.startedAt),
          ),
        )
        .orderBy(asc(schema.attempts.finishedAt))
    : [];
  const steps = row.problems.flatMap((slug) => {
    const p = PROBLEM_BY_SLUG.get(slug);
    if (!p) return [];
    const a = attempts.find((x) => x.problemSlug === slug);
    return [{ slug, title: p.title, pattern: p.pattern, attempt: a ? { solved: a.solved, before: a.ratingBefore, after: a.ratingAfter } : null }];
  });
  const session = row.mockSessionId ? await getMockSession(row.mockSessionId, userId) : null;
  const report = session?.endedAt ? await getReport(session.id) : null;
  return {
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    skipped: row.skipped,
    steps,
    mock: {
      slug: row.mockSlug,
      title: PROBLEM_BY_SLUG.get(row.mockSlug)?.title ?? row.mockSlug,
      sessionId: session?.id ?? null,
      ended: !!session?.endedAt,
      reported: !!report,
    },
    result: (row.result as unknown as DiagnosticResult) ?? null,
  };
}

/**
 * Whether to steer the user to the diagnostic: "started" when it's under way,
 * "new" when they never opened it, null once it's finished or skipped.
 */
export async function diagnosticPending(userId: string): Promise<"started" | "new" | null> {
  await ensureMigrated();
  const [row] = await db
    .select({ completedAt: schema.diagnostics.completedAt })
    .from(schema.diagnostics)
    .where(eq(schema.diagnostics.userId, userId));
  if (!row) return "new";
  return row.completedAt ? null : "started";
}

async function solvedSlugs(userId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ slug: schema.attempts.problemSlug })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.solved, true)));
  return new Set(rows.map((r) => r.slug));
}

/** Starts the diagnostic, choosing its problems. Restarts a skipped one; leaves any other alone. */
export async function startDiagnostic(userId: string, now = new Date()): Promise<void> {
  await ensureMigrated();
  const pick = pickDiagnostic(PROBLEMS, await solvedSlugs(userId));
  const fresh = { problems: pick.problems, mockSlug: pick.mock, startedAt: now };
  await db
    .insert(schema.diagnostics)
    .values({ userId, ...fresh })
    .onConflictDoUpdate({
      target: schema.diagnostics.userId,
      set: { ...fresh, mockSessionId: null, completedAt: null, skipped: false, result: null },
      setWhere: eq(schema.diagnostics.skipped, true),
    });
}

/** The diagnostic's voice mock: a friendly, short interview. Reuses the one already started. */
export async function startDiagnosticMock(userId: string, language: Language): Promise<string> {
  await ensureMigrated();
  const [row] = await db.select().from(schema.diagnostics).where(eq(schema.diagnostics.userId, userId));
  if (row?.mockSessionId) return row.mockSessionId;
  if (!row || row.completedAt) throw new Error("Start the diagnostic first");
  const id = await createMockSession(userId, {
    slug: row.mockSlug,
    language,
    config: { persona: "friendly", minutes: DIAGNOSTIC_MOCK.minutes, hintsAllowed: true, company: null },
  });
  // Only the first of two racing clicks is kept, so the user and the diagnostic agree on the session.
  const [won] = await db
    .update(schema.diagnostics)
    .set({ mockSessionId: id })
    .where(and(eq(schema.diagnostics.userId, userId), isNull(schema.diagnostics.mockSessionId)))
    .returning({ id: schema.diagnostics.mockSessionId });
  if (won) return id;
  await db.delete(schema.mockSessions).where(and(eq(schema.mockSessions.id, id), eq(schema.mockSessions.userId, userId)));
  const [kept] = await db
    .select({ id: schema.diagnostics.mockSessionId })
    .from(schema.diagnostics)
    .where(eq(schema.diagnostics.userId, userId));
  if (!kept?.id) throw new Error("The diagnostic mock could not be started");
  return kept.id;
}

/** Whether a mock session is this user's diagnostic mock. */
export async function isDiagnosticMock(userId: string, sessionId: string): Promise<boolean> {
  await ensureMigrated();
  const [row] = await db
    .select({ id: schema.diagnostics.mockSessionId })
    .from(schema.diagnostics)
    .where(eq(schema.diagnostics.userId, userId));
  return row?.id === sessionId;
}

/**
 * Finishes the diagnostic: patterns it didn't test get a starting estimate
 * from the ones it did, and the mock's report becomes the communication
 * baseline. The mock is optional; the three problems are not.
 */
export async function finishDiagnostic(userId: string, now = new Date()): Promise<void> {
  const d = await getDiagnostic(userId);
  if (!d || d.completedAt || !d.steps.every((s) => s.attempt)) return;
  const stored = d.mock.reported && d.mock.sessionId ? await getReport(d.mock.sessionId) : null;

  // Only the solo problems feed the average: a mock can only ever lower a
  // rating, so counting it would pull every prior down after a good mock.
  const moves = d.steps.flatMap((s) => (s.attempt ? [s.attempt.after - s.attempt.before] : []));
  const tested = new Set<PatternId>(d.steps.filter((s) => s.attempt).map((s) => s.pattern));
  // The mock's pattern counts as tested only when the mock actually set its rating.
  const mockPattern = PROBLEM_BY_SLUG.get(d.mock.slug)?.pattern;
  if (mockPattern && stored?.trackChanges.some((c) => c.kind === "rating")) tested.add(mockPattern);

  const priors = untestedPriors(moves, await getSkills(userId), tested);
  const written: typeof priors = [];
  for (const p of priors) {
    // Only where the user still has no row of their own, so nothing real is overwritten.
    const rows = await db
      .insert(schema.patternSkill)
      .values({ userId, pattern: p.pattern, rating: p.rating, uncertainty: p.uncertainty })
      .onConflictDoNothing()
      .returning({ pattern: schema.patternSkill.pattern });
    if (rows.length) written.push(p);
  }

  const result: DiagnosticResult = {
    problems: d.steps.flatMap((s) => (s.attempt ? [{ slug: s.slug, pattern: s.pattern, ...s.attempt }] : [])),
    priors: written.map((p) => ({ pattern: p.pattern, rating: p.rating })),
    communication: stored ? communicationBaseline(stored.report) : null,
  };
  await db
    .update(schema.diagnostics)
    .set({ completedAt: now, result: result as unknown as Record<string, unknown> })
    .where(eq(schema.diagnostics.userId, userId));
}

/** Skips the diagnostic; the track starts from the default estimates. */
export async function skipDiagnostic(userId: string, now = new Date()): Promise<void> {
  await ensureMigrated();
  await db
    .insert(schema.diagnostics)
    .values({ userId, problems: [], mockSlug: "", completedAt: now, skipped: true })
    .onConflictDoUpdate({
      target: schema.diagnostics.userId,
      set: { completedAt: now, skipped: true },
      // A stale tab can't turn a finished diagnostic into a skipped one.
      setWhere: isNull(schema.diagnostics.completedAt),
    });
}
