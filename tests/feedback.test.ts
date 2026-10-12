import { describe, expect, it } from "vitest";
import {
  analyzeSession,
  barShift,
  communicationMetrics,
  hireSignal,
  mockScore,
  outcomeOf,
  type FeedbackReport,
} from "@/lib/feedback/analyze";
import { planDrills, planMockUpdate } from "@/lib/feedback/track-update";
import { buildPlan } from "@/lib/engine/planner";
import type { SessionEvent } from "@/lib/interview/types";
import { PROBLEM_BY_SLUG, PROBLEMS } from "@/lib/problems";
import { starterCode } from "@/lib/runner/drivers";

const twoSum = PROBLEM_BY_SLUG.get("pair-with-target-sum")!;
const starter = starterCode(twoSum.signature, "python");
const MIN = 60_000;

const say = (t: number, text: string, startT?: number): SessionEvent => ({
  type: "transcript",
  t,
  payload: { speaker: "candidate", text, source: "browser-stt", ...(startT !== undefined ? { startT } : {}) },
});
const ask = (t: number, text: string): SessionEvent => ({ type: "transcript", t, payload: { speaker: "interviewer", text, source: "interviewer" } });
const edit = (t: number): SessionEvent => ({ type: "edit", t, payload: { ops: [{ offset: starter.length, length: 0, text: "\n# x" }] } });
const run = (t: number, scope: "sample" | "all", passed: number, total: number, labels: string[] = []): SessionEvent => ({
  type: "run",
  t,
  payload: { scope, verdict: passed === total ? "accepted" : "wrong_answer", passed, total, failingLabels: labels },
});

/** A strong interview: questions, approach, narration, complexity, a clean solve. */
const strong: SessionEvent[] = [
  { type: "snapshot", t: 0, payload: { code: starter, language: "python" } },
  ask(2_000, "Let's start. Here's the problem."),
  say(40_000, "Can the array be empty, and can there be duplicate values?", 36_000),
  ask(45_000, "It won't be empty; duplicates are possible."),
  say(70_000, "Are the numbers ever negative?", 67_000),
  say(120_000, "My approach is a hash map from value to index, so for each number I check whether the complement is already in the map.", 110_000),
  edit(130_000),
  say(160_000, "Now I'm writing the loop and storing each index as I go.", 155_000),
  edit(170_000),
  say(195_000, "Running the samples now to check the basic case.", 191_000),
  run(200_000, "sample", 2, 2),
  say(230_000, "Samples pass. Edge case with duplicates works because I check before inserting.", 222_000),
  run(260_000, "all", 10, 10),
  say(290_000, "That's O(n) time and O(n) space.", 286_000),
];

/** A weak one: silent coding, a failed submit, no complexity, never solved. */
const weak: SessionEvent[] = [
  { type: "snapshot", t: 0, payload: { code: starter, language: "python" } },
  ask(2_000, "Let's start."),
  say(20_000, "Okay um I'll just start.", 18_000),
  edit(25_000),
  edit(4 * MIN),
  run(6 * MIN, "all", 3, 10, ["empty input", "duplicates"]),
  edit(8 * MIN),
  run(10 * MIN, "all", 4, 10, ["duplicates"]),
  say(12 * MIN, "Uh I'm stuck, can I get a hint?", 12 * MIN - 3_000),
];

const base = { problem: twoSum, company: null, level: "mid" };

describe("communication metrics", () => {
  it("finds questions, the approach and complexity before and during coding", () => {
    const m = communicationMetrics(strong, twoSum, 5 * MIN);
    expect(m.firstQuestionMs).toBe(40_000);
    expect(m.questionsBeforeCoding).toBe(2);
    expect(m.approachBeforeCoding).toBe(true);
    expect(m.approachStatedMs).toBe(120_000);
    expect(m.complexityStated).toBe("O(n)");
    expect(m.complexityVerdict).toBe(0);
    expect(m.edgeCasesMentioned).toEqual(expect.arrayContaining(["empty input", "duplicates", "negative numbers"]));
    expect(m.narratedDebugging).toBeNull();
    expect(m.silentStretches.filter((s) => s.coding || s.afterFailedRun)).toEqual([]);
    expect(m.wordsPerMinute).toBeGreaterThan(50);
  });

  it("flags silence after a failed run, fillers and hint requests", () => {
    const m = communicationMetrics(weak, twoSum, 14 * MIN);
    expect(m.questionsBeforeCoding).toBe(0);
    expect(m.approachBeforeCoding).toBe(false);
    expect(m.narratedDebugging).toBe(false);
    expect(m.hintRequests).toBe(1);
    expect(m.fillerCount).toBe(2);
    expect(m.longestSilenceMs).toBeGreaterThan(10 * MIN);
    expect(m.silentStretches.some((s) => s.coding && s.afterFailedRun)).toBe(true);
    expect(m.complexityStated).toBeNull();
  });

  it("doesn't report pace or fillers as spoken when everything was typed", () => {
    const typed: SessionEvent[] = [{ type: "transcript", t: 10_000, payload: { speaker: "candidate", text: "um hello", source: "typed" } }];
    const m = communicationMetrics(typed, twoSum, MIN);
    expect(m.spoken).toBe(false);
    expect(m.wordsPerMinute).toBeNull();
  });
});

describe("feedback report", () => {
  it("rates a strong interview as a hire with nothing major to fix", () => {
    const r = analyzeSession({ ...base, events: strong, durationMs: 5 * MIN });
    expect(r.outcome.accepted).toBe(true);
    expect(r.rubric.correctness.score).toBe(4);
    expect(r.rubric.complexity.score).toBe(4);
    expect(r.rubric.understanding.score).toBe(4);
    expect(["hire", "strong-hire"]).toContain(r.hire.signal);
    expect(r.moments.some((m) => m.text === "All tests passed.")).toBe(true);
  });

  it("rates a weak interview as a no and names the focus areas", () => {
    const r = analyzeSession({ ...base, events: weak, durationMs: 14 * MIN });
    expect(r.outcome).toMatchObject({ accepted: false, passed: 4, total: 10, failedSubmits: 2 });
    expect(["no", "strong-no"]).toContain(r.hire.signal);
    expect(r.focus).toHaveLength(3);
    expect(r.focus.map((f) => f.area)).toContain("correctness");
    expect(r.moments.some((m) => m.tone === "warn" && /silent/i.test(m.text))).toBe(true);
    expect(r.summary).toMatch(/4 of 10/);
  });

  it("caps the hire signal when the problem wasn't solved, and raises the bar by company and level", () => {
    const unsolved = outcomeOf(weak, 14 * MIN);
    expect(hireSignal(4, unsolved, 0)).toBe("no");
    const solved = outcomeOf(strong, 5 * MIN);
    expect(hireSignal(3.3, solved, 0)).toBe("hire");
    expect(hireSignal(3.3, solved, barShift("google", "senior"))).toBe("lean-hire");
    expect(barShift("startup", "new-grad")).toBeLessThan(0);
  });
});

describe("mock feedback into the track", () => {
  const skill = { rating: 1300, uncertainty: 150 };

  it("lowers the rating and schedules a re-solve after a weak mock", () => {
    const r = analyzeSession({ ...base, events: weak, durationMs: 14 * MIN });
    const plan = planMockUpdate(r, skill, twoSum.rating);
    expect(plan.skill).not.toBeNull();
    expect(plan.skill!.rating).toBeLessThan(skill.rating);
    expect(plan.resolve).toBe(true);
  });

  it("never raises the rating, even after a strong mock", () => {
    const r = analyzeSession({ ...base, events: strong, durationMs: 5 * MIN });
    expect(mockScore(r)).toBeGreaterThan(0.8);
    const plan = planMockUpdate(r, { rating: 900, uncertainty: 300 }, twoSum.rating);
    expect(plan.skill).toBeNull();
    expect(plan.resolve).toBe(false);
  });

  it("re-solves when the approach was weak even if the code passed", () => {
    const r = analyzeSession({ ...base, events: strong, durationMs: 5 * MIN });
    const shaky: FeedbackReport = { ...r, rubric: { ...r.rubric, approach: { score: 2, evidence: "" } } };
    expect(planMockUpdate(shaky, skill, twoSum.rating).resolve).toBe(true);
  });

  it("turns focus areas into drills on other problems in the pattern", () => {
    const r = analyzeSession({ ...base, events: weak, durationMs: 14 * MIN });
    expect(r.focus.length).toBeGreaterThan(0);
    const drills = planDrills(r, twoSum, 1200, new Set(), PROBLEMS);
    expect(drills.length).toBe(Math.min(r.focus.length, PROBLEMS.filter((p) => p.pattern === twoSum.pattern).length - 1));
    expect(new Set(drills.map((d) => d.problemSlug)).size).toBe(drills.length);
    for (const d of drills) {
      expect(d.problemSlug).not.toBe(twoSum.slug);
      expect(PROBLEM_BY_SLUG.get(d.problemSlug)!.pattern).toBe(twoSum.pattern);
    }
    expect(drills[0]).toMatchObject({ area: r.focus[0].area, drill: r.focus[0].drill });
  });

  it("puts drills in the plan with the drill as the reason", () => {
    const target = PROBLEMS.find((p) => p.pattern === "trees")!;
    const plan = buildPlan({
      now: new Date("2026-10-12T12:00:00Z"),
      goals: { targetCompanies: [], interviewDate: null, hoursPerWeek: 7 },
      skills: {},
      attempts: [],
      cards: [],
      problems: PROBLEMS,
      drills: [{ problemSlug: target.slug, title: "Keep talking under pressure", drill: "Narrate every failed run." }],
    });
    expect(plan.items[0]).toMatchObject({ slug: target.slug, kind: "drill" });
    expect(plan.items[0].reason).toContain("Narrate every failed run.");
  });
});
