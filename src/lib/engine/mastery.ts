import { PATTERN_BY_ID, PATTERNS } from "../problems/patterns";
import type { PatternId, Problem } from "../problems/types";
import { INITIAL_RATING, INITIAL_UNCERTAINTY, solveProbability } from "./rating";

export interface PatternSkill {
  rating: number;
  uncertainty: number;
  attempts: number;
  solved: number;
  failStreak: number;
}

export type SkillMap = Partial<Record<PatternId, PatternSkill>>;

/** Rating a prerequisite needs before the patterns that depend on it unlock. */
export const UNLOCK_RATING = 1050;
/** Rating (with at least two solves) at which a pattern counts as learned and joins mixed practice. */
export const LEARNED_RATING = 1150;
/** How far above the pattern rating a problem may be and still be offered. */
export const GATE_MARGIN = 300;

export function skillOf(skills: SkillMap, p: PatternId): PatternSkill {
  return (
    skills[p] ?? {
      rating: INITIAL_RATING,
      uncertainty: INITIAL_UNCERTAINTY,
      attempts: 0,
      solved: 0,
      failStreak: 0,
    }
  );
}

export function isUnlocked(p: PatternId, skills: SkillMap): boolean {
  return PATTERN_BY_ID[p].prerequisites.every((pre) => skillOf(skills, pre).rating >= UNLOCK_RATING);
}

export function isLearned(p: PatternId, skills: SkillMap): boolean {
  const s = skillOf(skills, p);
  return s.solved >= 2 && s.rating >= LEARNED_RATING;
}

/** Two failed attempts in a row in one pattern (spec "Stuck detection"). */
export function isStuck(p: PatternId, skills: SkillMap): boolean {
  return skillOf(skills, p).failStreak >= 2;
}

export type PatternStatus = "locked" | "unlocked" | "learning" | "learned";

export function patternStatus(p: PatternId, skills: SkillMap): PatternStatus {
  if (!isUnlocked(p, skills)) return "locked";
  if (isLearned(p, skills)) return "learned";
  return skillOf(skills, p).attempts > 0 ? "learning" : "unlocked";
}

/**
 * Whether a problem is open to the user: its pattern is unlocked and its
 * difficulty is within reach of the pattern rating. The easiest unsolved
 * problem of an unlocked pattern is always open, so a pattern never dead-ends.
 */
export function isProblemOpen(
  problem: Problem,
  skills: SkillMap,
  solved: Set<string>,
  bank: Problem[],
): boolean {
  if (!isUnlocked(problem.pattern, skills)) return false;
  if (solved.has(problem.slug)) return true;
  const s = skillOf(skills, problem.pattern);
  if (problem.rating <= s.rating + GATE_MARGIN) return true;
  const easiestUnsolved = bank
    .filter((p) => p.pattern === problem.pattern && !solved.has(p.slug))
    .sort((a, b) => a.rating - b.rating)[0];
  return easiestUnsolved?.slug === problem.slug;
}

/** Patterns whose prerequisites are all met, in curriculum order. */
export function unlockedPatterns(skills: SkillMap): PatternId[] {
  return PATTERNS.filter((p) => isUnlocked(p.id, skills)).map((p) => p.id);
}

/** Chance of solving a typical medium (rating 1350) in this pattern; used for readiness. */
export function mediumSolveChance(p: PatternId, skills: SkillMap): number {
  return solveProbability(skillOf(skills, p).rating, 1350);
}
