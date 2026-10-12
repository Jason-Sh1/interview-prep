import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { FeedbackReport } from "@/lib/feedback/analyze";
import { PROBLEM_BY_SLUG } from "@/lib/problems";

// Mock focus areas pushed into the plan, against an embedded database.
describe("focus-area drills", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "drills-db-"));
  });

  it("adds drills from a mock and completes them on the next attempt", async () => {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const track = await import("@/lib/track");
    await ensureMigrated();
    const userId = "u-drills";
    await db.insert(schema.user).values({ id: userId, name: "T", email: "drills@x.dev" });
    const problem = PROBLEM_BY_SLUG.get("pair-with-target-sum")!;
    const report = {
      outcome: { accepted: true },
      rubric: { correctness: { score: 3 }, approach: { score: 3 } },
      focus: [{ area: "communication", title: "Keep talking under pressure", why: "", drill: "Narrate every failed run." }],
      overall: 3,
    } as unknown as FeedbackReport;

    const changes = await track.applyMockFeedback(userId, problem, report);
    const drill = changes.find((c) => c.kind === "drill");
    expect(drill).toBeDefined();
    const open = await track.getOpenDrills(userId);
    expect(open).toHaveLength(1);
    expect(open[0].problemSlug).toBe(drill!.slug);

    const goals = { targetCompanies: [], level: "mid", interviewDate: null, hoursPerWeek: 7, language: "python" as const, timeZone: null };
    const state = await track.getTrackState(userId, goals);
    expect(state.plan.items.find((i) => i.slug === drill!.slug)?.kind).toBe("drill");

    await track.recordAttempt(userId, {
      slug: drill!.slug,
      mode: "learn",
      language: "python",
      solved: false,
      gaveUp: true,
      startedAt: new Date().toISOString(),
      secondsToFirstRun: null,
      secondsToAccepted: null,
      runCount: 0,
      failedRuns: 0,
      failingLabels: [],
      hintsUsed: 0,
      confidence: null,
      complexityChoice: null,
      code: null,
    });
    expect(await track.getOpenDrills(userId)).toHaveLength(0);
  });
});
