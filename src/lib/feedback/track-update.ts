// How a mock interview's feedback feeds back into the learning track (spec
// 4.2 "Mock feedback loop"). Pure, so it can be tested; src/lib/track.ts
// applies the result.
import { updateSkill, type SkillState } from "../engine/rating";
import type { PatternId } from "../problems/types";
import { mockScore, type FeedbackReport } from "./analyze";

/** Mocks move ratings a bit less than a full practice attempt. */
const MOCK_WEIGHT = 0.75;

export type TrackChange =
  | { kind: "rating"; pattern: PatternId; before: number; after: number }
  | { kind: "review"; slug: string; title: string };

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
