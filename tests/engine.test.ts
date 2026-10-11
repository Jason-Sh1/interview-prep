import { describe, expect, it } from "vitest";
import { cardFromJson, cardToJson, gradeFor, newCard, reviewCard } from "@/lib/engine/fsrs";
import { isProblemOpen, isUnlocked, unlockedPatterns, type SkillMap } from "@/lib/engine/mastery";
import { buildPlan, dailyMinutes, phaseFor, type PlannerInput } from "@/lib/engine/planner";
import { attemptScore, isFastTrack, solveProbability, updateSkill } from "@/lib/engine/rating";
import { PROBLEM_BY_SLUG, PROBLEMS } from "@/lib/problems";
import { Rating } from "ts-fsrs";

const NOW = new Date("2026-10-11T12:00:00");
const DAY = 86_400_000;

function input(over: Partial<PlannerInput> = {}): PlannerInput {
  return {
    now: NOW,
    goals: { targetCompanies: ["google"], interviewDate: null, hoursPerWeek: 10 },
    skills: {},
    attempts: [],
    cards: [],
    problems: PROBLEMS,
    ...over,
  };
}

describe("rating", () => {
  it("gives a 50% solve chance at equal ratings and more when stronger", () => {
    expect(solveProbability(1200, 1200)).toBeCloseTo(0.5);
    expect(solveProbability(1400, 1200)).toBeGreaterThan(0.7);
  });

  it("penalizes hints, failed runs, wrong complexity and slow solves", () => {
    const clean = { solved: true, difficulty: "medium" as const, hintsUsed: 0, failedRuns: 0, secondsToAccepted: 600, complexityCorrect: true };
    expect(attemptScore(clean)).toBe(1);
    expect(attemptScore({ ...clean, hintsUsed: 2 })).toBeCloseTo(0.7);
    expect(attemptScore({ ...clean, failedRuns: 3 })).toBeCloseTo(0.9);
    expect(attemptScore({ ...clean, complexityCorrect: false })).toBeCloseTo(0.9);
    expect(attemptScore({ ...clean, secondsToAccepted: 50 * 60 })).toBeCloseTo(0.85);
    expect(attemptScore({ ...clean, solved: false })).toBe(0);
  });

  it("detects fast-track solves", () => {
    const s = { solved: true, difficulty: "easy" as const, hintsUsed: 0, failedRuns: 0, secondsToAccepted: 300, complexityCorrect: true };
    expect(isFastTrack(s)).toBe(true);
    expect(isFastTrack({ ...s, hintsUsed: 1 })).toBe(false);
    expect(isFastTrack({ ...s, secondsToAccepted: 600 })).toBe(false);
  });

  it("moves the rating toward the result and shrinks uncertainty", () => {
    const s = { rating: 1000, uncertainty: 300 };
    const up = updateSkill(s, 1300, 1);
    const down = updateSkill(s, 900, 0);
    expect(up.rating).toBeGreaterThan(1000);
    expect(down.rating).toBeLessThan(1000);
    expect(up.uncertainty).toBeLessThan(300);
    expect(updateSkill(s, 1300, 1, { fastTrack: true }).rating).toBeGreaterThan(up.rating);
  });
});

describe("fsrs", () => {
  it("caps the grade when hints were used and fails unsolved attempts", () => {
    expect(gradeFor({ solved: false, confidence: 4, hintsUsed: 0, fastTrack: false })).toBe(Rating.Again);
    expect(gradeFor({ solved: true, confidence: 4, hintsUsed: 2, fastTrack: false })).toBe(Rating.Hard);
    expect(gradeFor({ solved: true, confidence: 4, hintsUsed: 1, fastTrack: false })).toBe(Rating.Good);
    expect(gradeFor({ solved: true, confidence: 3, hintsUsed: 0, fastTrack: true })).toBe(Rating.Easy);
  });

  it("schedules further out for easier grades and survives JSON storage", () => {
    const c = newCard(NOW);
    const hard = reviewCard(c, Rating.Hard, NOW);
    const easy = reviewCard(c, Rating.Easy, NOW);
    expect(easy.due.getTime()).toBeGreaterThan(hard.due.getTime());
    expect(hard.due.getTime()).toBeGreaterThan(NOW.getTime());
    const back = cardFromJson(cardToJson(easy));
    expect(back.due).toBeInstanceOf(Date);
    expect(back.due.getTime()).toBe(easy.due.getTime());
  });
});

describe("mastery", () => {
  it("starts with only the foundational patterns open", () => {
    expect(unlockedPatterns({})).toEqual(["arrays-hashing", "two-pointers", "stack", "binary-search", "recursion"]);
    expect(isUnlocked("trees", {})).toBe(false);
    const skills: SkillMap = { recursion: { rating: 1100, uncertainty: 200, attempts: 2, solved: 2, failStreak: 0 } };
    expect(isUnlocked("trees", skills)).toBe(true);
  });

  it("gates hard problems until the pattern rating rises", () => {
    const hard = PROBLEMS.find((p) => p.pattern === "two-pointers" && p.difficulty === "hard")!;
    expect(isProblemOpen(hard, {}, new Set(), PROBLEMS)).toBe(false);
    const skills: SkillMap = { "two-pointers": { rating: 1450, uncertainty: 150, attempts: 3, solved: 2, failStreak: 0 } };
    expect(isProblemOpen(hard, skills, new Set(), PROBLEMS)).toBe(true);
  });
});

describe("planner", () => {
  it("fills the daily budget with a mix of patterns for a new user", () => {
    const plan = buildPlan(input());
    expect(plan.phase).toBe("breadth");
    expect(plan.items.length).toBeGreaterThanOrEqual(3);
    const minutes = plan.items.reduce((m, i) => m + i.minutes, 0);
    expect(minutes).toBeLessThanOrEqual(dailyMinutes(10));
    expect(new Set(plan.items.map((i) => i.pattern)).size).toBeGreaterThanOrEqual(3);
    for (const i of plan.items) expect(i.reason.length).toBeGreaterThan(10);
  });

  it("picks phases from the interview date", () => {
    expect(phaseFor(60, {})).toBe("breadth");
    expect(phaseFor(30, {})).toBe("strengthen");
    expect(phaseFor(10, {})).toBe("final");
  });

  it("puts overdue reviews first and leaves future ones out", () => {
    const solved = PROBLEM_BY_SLUG.get("pair-with-target-sum")!;
    const plan = buildPlan(
      input({
        attempts: [{ problemSlug: solved.slug, pattern: solved.pattern, solved: true, mode: "learn", finishedAt: new Date(NOW.getTime() - 10 * DAY) }],
        cards: [
          { problemSlug: solved.slug, due: new Date(NOW.getTime() - 3 * DAY) },
          { problemSlug: "balanced-brackets", due: new Date(NOW.getTime() + 3 * DAY) },
        ],
      }),
    );
    expect(plan.items[0].slug).toBe(solved.slug);
    expect(plan.items[0].kind).toBe("review");
    expect(plan.items[0].reason).toMatch(/overdue by 3 days/);
    expect(plan.items.some((i) => i.slug === "balanced-brackets")).toBe(false);
  });

  it("drops to a bridge problem after two misses in a pattern", () => {
    const medium = PROBLEMS.filter((p) => p.pattern === "two-pointers").sort((a, b) => b.rating - a.rating)[1];
    const skills: SkillMap = { "two-pointers": { rating: 980, uncertainty: 250, attempts: 2, solved: 0, failStreak: 2 } };
    const failed = [1, 2].map((h) => ({
      problemSlug: medium.slug,
      pattern: medium.pattern,
      solved: false,
      mode: "learn" as const,
      finishedAt: new Date(NOW.getTime() - h * DAY),
    }));
    const plan = buildPlan(input({ skills, attempts: failed }));
    expect(plan.stuck).toContain("two-pointers");
    const bridge = plan.items.find((i) => i.pattern === "two-pointers")!;
    expect(bridge.kind).toBe("bridge");
    expect(PROBLEM_BY_SLUG.get(bridge.slug)!.rating).toBeLessThan(medium.rating);
  });

  it("hides the pattern for learned patterns once past the breadth phase", () => {
    const skills: SkillMap = { "arrays-hashing": { rating: 1300, uncertainty: 100, attempts: 3, solved: 2, failStreak: 0 } };
    const solvedSlugs = PROBLEMS.filter((p) => p.pattern === "arrays-hashing").slice(0, 2).map((p) => p.slug);
    const date = new Date(NOW.getTime() + 30 * DAY).toISOString().slice(0, 10);
    const plan = buildPlan(
      input({
        skills,
        goals: { targetCompanies: ["meta"], interviewDate: date, hoursPerWeek: 30 },
        attempts: solvedSlugs.map((s) => ({ problemSlug: s, pattern: "arrays-hashing" as const, solved: true, mode: "learn" as const, finishedAt: new Date(NOW.getTime() - 5 * DAY) })),
      }),
    );
    expect(plan.phase).toBe("strengthen");
    const ah = plan.items.filter((i) => i.pattern === "arrays-hashing");
    expect(ah.length).toBeGreaterThan(0);
    expect(ah.every((i) => i.kind === "mixed" && i.hidePattern)).toBe(true);
  });

  it("doesn't re-offer what was done today and counts it against the budget", () => {
    const first = buildPlan(input()).items[0];
    const p = PROBLEM_BY_SLUG.get(first.slug)!;
    const plan = buildPlan(input({ attempts: [{ problemSlug: p.slug, pattern: p.pattern, solved: true, mode: "learn", finishedAt: NOW }] }));
    expect(plan.doneToday).toEqual([p.slug]);
    expect(plan.items.some((i) => i.slug === p.slug)).toBe(false);
  });
});
