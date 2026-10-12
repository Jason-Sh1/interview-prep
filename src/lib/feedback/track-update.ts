// How a mock interview's feedback feeds back into the learning track (spec
// 4.2 "Mock feedback loop"). Pure, so it can be tested; src/lib/track.ts
// applies the result.
import { solveProbability, updateSkill, type SkillState } from "../engine/rating";
import type { PatternId, Problem } from "../problems/types";
import { mockScore, type FeedbackReport, type RubricKey } from "./analyze";

/** Mocks move ratings a bit less than a full practice attempt. */
const MOCK_WEIGHT = 0.75;

export type TrackChange =
  | { kind: "rating"; pattern: PatternId; before: number; after: number }
  | { kind: "review"; slug: string; title: string }
  | { kind: "drill"; slug: string; title: string; problemTitle: string };

/** A focus area from a mock, turned into a practice problem in the plan (spec 4.4). */
export interface DrillPlan {
  area: RubricKey;
  title: string;
  drill: string;
  problemSlug: string;
}

/** Drills leave the plan after this long, done or not, so old advice doesn't pile up. */
export const DRILL_DAYS = 14;

export interface MockTrackPlan {
  /** The lowered skill, or null when the mock went as well as the rating predicts. */
  skill: SkillState | null;
  /** Put the problem back in today's plan as a re-solve. */
  resolve: boolean;
}

/**
 * Weaknesses only lower the rating; a strong mock leaves it alone, since
 * practice attempts are where ratings go up. A failed or shaky solve also
 * brings the problem back as a review due today.
 */
export function planMockUpdate(report: FeedbackReport, skill: SkillState, problemRating: number): MockTrackPlan {
  const after = updateSkill(skill, problemRating, mockScore(report), { weight: MOCK_WEIGHT });
  const lowered = after.rating < skill.rating ? after : null;
  const resolve = !report.outcome.accepted || report.rubric.correctness.score <= 2 || report.rubric.approach.score <= 2;
  return { skill: lowered, resolve };
}

/**
 * Pairs each focus area with a problem to practice it on: another problem in
 * the mock's pattern, in the stretch zone for the user's rating, preferring
 * ones they haven't solved, and a different problem per drill. The mock's own
 * problem is left out; it comes back as a re-solve when it needs to.
 */
export function planDrills(report: FeedbackReport, mock: Problem, rating: number, solved: Set<string>, problems: Problem[]): DrillPlan[] {
  const pool = problems
    .filter((p) => p.pattern === mock.pattern && p.slug !== mock.slug)
    .map((p) => ({ p, fit: Math.abs(solveProbability(rating, p.rating) - 0.7) + (solved.has(p.slug) ? 0.5 : 0) }))
    .sort((a, b) => a.fit - b.fit);
  const used = new Set<string>();
  const out: DrillPlan[] = [];
  for (const f of report.focus.slice(0, 3)) {
    const pick = pool.find((x) => !used.has(x.p.slug));
    if (!pick) break;
    used.add(pick.p.slug);
    out.push({ area: f.area, title: f.title, drill: f.drill, problemSlug: pick.p.slug });
  }
  return out;
}
