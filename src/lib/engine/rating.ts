import type { Difficulty } from "../problems/types";

// Elo-style skill model (spec 4.2 "Mastery gating"). Each pattern has a rating
// and an uncertainty; problems have fixed difficulty ratings. The update is
// Glicko-flavored: high uncertainty means bigger moves, and every attempt
// shrinks the uncertainty.

export const INITIAL_RATING = 1000;
export const INITIAL_UNCERTAINTY = 300;
export const MIN_UNCERTAINTY = 60;

/** Target minutes to an accepted answer by difficulty, as in a real round. */
export const TARGET_MINUTES: Record<Difficulty, number> = { easy: 15, medium: 25, hard: 40 };

/** Probability the user solves a problem cleanly, given pattern rating and problem rating. */
export function solveProbability(rating: number, problemRating: number): number {
  return 1 / (1 + Math.pow(10, (problemRating - rating) / 400));
}

export interface AttemptSignals {
  solved: boolean;
  difficulty: Difficulty;
  hintsUsed: number;
  failedRuns: number;
  secondsToAccepted: number | null;
  complexityCorrect: boolean | null;
}

/** Hint cost is cumulative by tier: nudge, approach, pseudocode. */
const HINT_PENALTY = [0, 0.1, 0.3, 0.6];

/** Performance in [0, 1] for one attempt. */
export function attemptScore(s: AttemptSignals): number {
  if (!s.solved) return 0;
  let score = 1;
  score -= HINT_PENALTY[Math.min(s.hintsUsed, 3)];
  score -= Math.min(0.2, 0.05 * Math.max(0, s.failedRuns - 1));
  if (s.complexityCorrect === false) score -= 0.1;
  if (s.secondsToAccepted !== null) {
    const target = TARGET_MINUTES[s.difficulty] * 60;
    if (s.secondsToAccepted > target) {
      score -= Math.min(0.15, (0.15 * (s.secondsToAccepted - target)) / target);
    }
  }
  return Math.max(0.05, Math.min(1, score));
}

/** A quick, clean, first-try solve: skip ahead and lengthen reviews (spec "Fast-track"). */
export function isFastTrack(s: AttemptSignals): boolean {
  return (
    s.solved &&
    s.hintsUsed === 0 &&
    s.failedRuns === 0 &&
    s.secondsToAccepted !== null &&
    s.secondsToAccepted <= TARGET_MINUTES[s.difficulty] * 60 * 0.5 &&
    s.complexityCorrect !== false
  );
}

export interface SkillState {
  rating: number;
  uncertainty: number;
}

export function updateSkill(
  skill: SkillState,
  problemRating: number,
  score: number,
  opts: { fastTrack?: boolean; weight?: number } = {},
): SkillState {
  const expected = solveProbability(skill.rating, problemRating);
  const k = Math.min(104, Math.max(16, 16 + 0.3 * skill.uncertainty)) * (opts.fastTrack ? 1.5 : 1) * (opts.weight ?? 1);
  return {
    rating: Math.round((skill.rating + k * (score - expected)) * 10) / 10,
    uncertainty: Math.max(MIN_UNCERTAINTY, Math.round(skill.uncertainty * 0.88)),
  };
}
