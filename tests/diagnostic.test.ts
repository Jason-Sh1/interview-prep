import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DIAGNOSTIC_MOCK, DIAGNOSTIC_STEPS, pickDiagnostic, untestedPriors } from "@/lib/diagnostic/plan";
import { PROBLEM_BY_SLUG, PROBLEMS } from "@/lib/problems";
import { PATTERNS } from "@/lib/problems/patterns";

describe("diagnostic picks", () => {
  it("takes one problem per step pattern near its target, and the mock from binary search", () => {
    const pick = pickDiagnostic(PROBLEMS, new Set());
    expect(pick.problems.map((s) => PROBLEM_BY_SLUG.get(s)!.pattern)).toEqual(DIAGNOSTIC_STEPS.map((s) => s.pattern));
    for (const [i, slug] of pick.problems.entries()) {
      expect(Math.abs(PROBLEM_BY_SLUG.get(slug)!.rating - DIAGNOSTIC_STEPS[i].rating)).toBeLessThan(250);
    }
    expect(PROBLEM_BY_SLUG.get(pick.mock)!.pattern).toBe(DIAGNOSTIC_MOCK.pattern);
  });

  it("avoids problems already solved", () => {
    const first = pickDiagnostic(PROBLEMS, new Set());
    const again = pickDiagnostic(PROBLEMS, new Set([...first.problems, first.mock]));
    for (const s of again.problems) expect(first.problems).not.toContain(s);
    expect(again.mock).not.toBe(first.mock);
  });
});

describe("priors for untested patterns", () => {
  it("carries half the average move, capped, to patterns nobody tested", () => {
    const tested = new Set(["arrays-hashing", "two-pointers"] as const);
    const priors = untestedPriors([400, 400], { stack: { rating: 900, uncertainty: 200, attempts: 1, solved: 0, failStreak: 1 } }, new Set(tested));
    expect(priors.every((p) => p.rating === 1150)).toBe(true);
    const names = priors.map((p) => p.pattern);
    expect(names).not.toContain("arrays-hashing");
    expect(names).not.toContain("stack");
    expect(names).toHaveLength(PATTERNS.length - 3);
    expect(untestedPriors([-60, -40], {}, new Set())[0].rating).toBe(975);
  });

  it("changes nothing without moves", () => {
    expect(untestedPriors([], {}, new Set())).toEqual([]);
    expect(untestedPriors([1, -1], {}, new Set())).toEqual([]);
  });
});

describe("diagnostic flow", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "diagnostic-db-"));
  });

  const attempt = (slug: string, solved: boolean) => ({
    slug,
    mode: "learn" as const,
    language: "python" as const,
    solved,
    gaveUp: !solved,
    startedAt: new Date(Date.now() - 300_000).toISOString(),
    secondsToFirstRun: 60,
    secondsToAccepted: solved ? 240 : null,
    runCount: 2,
    failedRuns: 0,
    failingLabels: [],
    hintsUsed: 0,
    confidence: solved ? (4 as const) : null,
    complexityChoice: null,
    code: null,
  });

  it("tracks progress, sets starting estimates on finish, and can be retaken after a skip", async () => {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const diag = await import("@/lib/diagnostic");
    const track = await import("@/lib/track");
    await ensureMigrated();
    const userId = "u-diag";
    await db.insert(schema.user).values({ id: userId, name: "T", email: "diag@x.dev" });

    expect(await diag.diagnosticPending(userId)).toBe("new");
    expect(await diag.getDiagnostic(userId)).toBeNull();
    await diag.startDiagnostic(userId);
    expect(await diag.diagnosticPending(userId)).toBe("started");
    let d = (await diag.getDiagnostic(userId))!;
    expect(d.steps).toHaveLength(3);
    expect(d.steps.every((s) => !s.attempt)).toBe(true);

    // The mock records a transcript, so it needs consent first.
    await expect(diag.startDiagnosticMock(userId, "python")).rejects.toThrow(/agree to recording/);
    await (await import("@/lib/privacy")).setRecordingConsent(userId, true);
    const mockId = await diag.startDiagnosticMock(userId, "python");
    expect(await diag.startDiagnosticMock(userId, "python")).toBe(mockId);
    expect(await diag.isDiagnosticMock(userId, mockId)).toBe(true);
    const [session] = await db.select().from(schema.mockSessions).where((await import("drizzle-orm")).eq(schema.mockSessions.id, mockId));
    expect((session.config as { minutes: number }).minutes).toBe(15);

    // Finishing needs all three problems.
    await track.recordAttempt(userId, attempt(d.steps[0].slug, true));
    await diag.finishDiagnostic(userId);
    expect((await diag.getDiagnostic(userId))!.completedAt).toBeNull();

    for (const s of d.steps.slice(1)) await track.recordAttempt(userId, attempt(s.slug, true));
    d = (await diag.getDiagnostic(userId))!;
    expect(d.steps.every((s) => s.attempt?.solved)).toBe(true);
    expect(d.mock).toMatchObject({ ended: false, reported: false });

    // Finished without the mock: three strong solves lift the untested patterns.
    await diag.finishDiagnostic(userId);
    d = (await diag.getDiagnostic(userId))!;
    expect(d.completedAt).not.toBeNull();
    expect(d.result!.problems).toHaveLength(3);
    expect(d.result!.communication).toBeNull();
    const skills = await track.getSkills(userId);
    expect(skills.graphs!.rating).toBeGreaterThan(1000);
    expect(skills.graphs!.attempts).toBe(0);
    expect(skills["arrays-hashing"]!.attempts).toBe(1);
    expect(d.result!.priors.every((p) => !d.steps.some((s) => s.pattern === p.pattern))).toBe(true);
    expect(await diag.diagnosticPending(userId)).toBeNull();

    // Finishing again is a no-op; starting again or a stale "skip" doesn't reset a finished one.
    await diag.finishDiagnostic(userId);
    await diag.startDiagnostic(userId);
    await diag.skipDiagnostic(userId);
    const again = (await diag.getDiagnostic(userId))!;
    expect(again.completedAt).toEqual(d.completedAt);
    expect(again.skipped).toBe(false);
    await expect(diag.startDiagnosticMock(userId, "python")).resolves.toBe(mockId);
  });

  it("keeps one mock session when the start is clicked twice at once", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const diag = await import("@/lib/diagnostic");
    const userId = "u-diag-race";
    await db.insert(schema.user).values({ id: userId, name: "T", email: "diag-race@x.dev" });
    await diag.startDiagnostic(userId);
    await (await import("@/lib/privacy")).setRecordingConsent(userId, true);
    const [a, b] = await Promise.all([diag.startDiagnosticMock(userId, "python"), diag.startDiagnosticMock(userId, "python")]);
    expect(a).toBe(b);
    expect(await diag.isDiagnosticMock(userId, a)).toBe(true);
    const sessions = await db.select().from(schema.mockSessions).where(eq(schema.mockSessions.userId, userId));
    expect(sessions.map((s) => s.id)).toEqual([a]);
  });

  it("lists only the starting estimates it actually wrote", async () => {
    const { db, schema } = await import("@/lib/db");
    const diag = await import("@/lib/diagnostic");
    const track = await import("@/lib/track");
    const userId = "u-diag-priors";
    await db.insert(schema.user).values({ id: userId, name: "T", email: "diag-priors@x.dev" });
    // A row with no attempts, as an earlier mock's feedback leaves behind.
    await db.insert(schema.patternSkill).values({ userId, pattern: "graphs", rating: 940, uncertainty: 300 });
    await diag.startDiagnostic(userId);
    const d = (await diag.getDiagnostic(userId))!;
    for (const s of d.steps) await track.recordAttempt(userId, attempt(s.slug, true));
    await diag.finishDiagnostic(userId);
    const { result } = (await diag.getDiagnostic(userId))!;
    expect(result!.priors.length).toBeGreaterThan(0);
    expect(result!.priors.map((p) => p.pattern)).not.toContain("graphs");
    expect((await track.getSkills(userId)).graphs!.rating).toBe(940);
  });

  it("skips, then restarts fresh", async () => {
    const { db, schema } = await import("@/lib/db");
    const diag = await import("@/lib/diagnostic");
    const userId = "u-diag-skip";
    await db.insert(schema.user).values({ id: userId, name: "T", email: "diag-skip@x.dev" });
    await diag.skipDiagnostic(userId);
    expect(await diag.diagnosticPending(userId)).toBeNull();
    expect((await diag.getDiagnostic(userId))!.skipped).toBe(true);
    await diag.startDiagnostic(userId);
    const d = (await diag.getDiagnostic(userId))!;
    expect(d.skipped).toBe(false);
    expect(d.completedAt).toBeNull();
    expect(d.steps).toHaveLength(3);
    expect(await diag.diagnosticPending(userId)).toBe("started");
  });
});
