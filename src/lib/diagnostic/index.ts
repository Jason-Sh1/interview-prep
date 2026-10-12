import "server-only";
// The onboarding diagnostic (spec 4.1): picks its problems, tracks progress
// through them, and on finishing sets starting estimates for the rest of the
// track and stores the communication baseline.

import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { getReport } from "../feedback";
import type { TrackChange } from "../feedback/track-update";
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

/** Whether to steer the user to the diagnostic: they haven't finished or skipped it. */
export async function diagnosticPending(userId: string): Promise<boolean> {
  await ensureMigrated();
  const [row] = await db
    .select({ completedAt: schema.diagnostics.completedAt })
    .from(schema.diagnostics)
    .where(eq(schema.diagnostics.userId, userId));
  return !row?.completedAt;
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
  if (!row) throw new Error("Start the diagnostic first");
  if (row.mockSessionId) return row.mockSessionId;
  const id = await createMockSession(userId, {
    slug: row.mockSlug,
    language,
    config: { persona: "friendly", minutes: DIAGNOSTIC_MOCK.minutes, hintsAllowed: true, company: null },
  });
  await db.update(schema.diagnostics).set({ mockSessionId: id }).where(eq(schema.diagnostics.userId, userId));
  return id;
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
 * baseline. Problems or a mock left undone are simply not counted.
 */
export async function finishDiagnostic(userId: string, now = new Date()): Promise<void> {
  const d = await getDiagnostic(userId);
  if (!d || d.completedAt) return;
  const stored = d.mock.reported && d.mock.sessionId ? await getReport(d.mock.sessionId) : null;

  const moves = d.steps.flatMap((s) => (s.attempt ? [s.attempt.after - s.attempt.before] : []));
  const tested = new Set<PatternId>(d.steps.filter((s) => s.attempt).map((s) => s.pattern));
  if (stored) {
    const mockPattern = PROBLEM_BY_SLUG.get(d.mock.slug)?.pattern;
    if (mockPattern) tested.add(mockPattern);
    const change = stored.trackChanges.find((c): c is Extract<TrackChange, { kind: "rating" }> => c.kind === "rating");
    if (change) moves.push(change.after - change.before);
  }

  const priors = untestedPriors(moves, await getSkills(userId), tested);
  for (const p of priors) {
    // Only where the user still has no row of their own, so nothing real is overwritten.
    await db
      .insert(schema.patternSkill)
      .values({ userId, pattern: p.pattern, rating: p.rating, uncertainty: p.uncertainty })
      .onConflictDoNothing();
  }

  const result: DiagnosticResult = {
    problems: d.steps.flatMap((s) => (s.attempt ? [{ slug: s.slug, pattern: s.pattern, ...s.attempt }] : [])),
    priors: priors.map((p) => ({ pattern: p.pattern, rating: p.rating })),
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
    .onConflictDoUpdate({ target: schema.diagnostics.userId, set: { completedAt: now, skipped: true } });
}
