// The onboarding diagnostic (spec 4.1): three short problems across core
// patterns plus one short voice mock, giving a starting estimate per pattern
// and per communication dimension. Pure helpers; ./index.ts stores it.
import { INITIAL_RATING, INITIAL_UNCERTAINTY } from "../engine/rating";
import type { SkillMap } from "../engine/mastery";
import { RUBRIC, type CommunicationMetrics, type FeedbackReport, type RubricKey } from "../feedback/analyze";
import { PATTERNS } from "../problems/patterns";
import type { PatternId, Problem } from "../problems/types";

/** Patterns for the solo problems, and the target difficulty of each. */
export const DIAGNOSTIC_STEPS: { pattern: PatternId; rating: number }[] = [
  { pattern: "arrays-hashing", rating: 1100 },
  { pattern: "two-pointers", rating: 1150 },
  { pattern: "stack", rating: 1250 },
];
/** The voice mock: a fourth core pattern, a short medium. */
export const DIAGNOSTIC_MOCK = { pattern: "binary-search" as PatternId, rating: 1250, minutes: 15 as const };

/** About 40 minutes in all: three problems at ~8 minutes each plus the 15-minute mock. */
export const DIAGNOSTIC_MINUTES = 40;

function closest(problems: Problem[], pattern: PatternId, rating: number, avoid: Set<string>): Problem | null {
  const pool = problems.filter((p) => p.pattern === pattern && !avoid.has(p.slug));
  return pool.sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))[0] ?? null;
}

/** Picks the diagnostic's problems, avoiding ones the user already solved (from an import, say). */
export function pickDiagnostic(problems: Problem[], solved: Set<string>): { problems: string[]; mock: string } {
  const avoid = new Set(solved);
  const picks: string[] = [];
  for (const step of DIAGNOSTIC_STEPS) {
    const p = closest(problems, step.pattern, step.rating, avoid) ?? closest(problems, step.pattern, step.rating, new Set());
    if (p) {
      picks.push(p.slug);
      avoid.add(p.slug);
    }
  }
  const mock = closest(problems, DIAGNOSTIC_MOCK.pattern, DIAGNOSTIC_MOCK.rating, avoid) ?? closest(problems, DIAGNOSTIC_MOCK.pattern, DIAGNOSTIC_MOCK.rating, new Set());
  if (!mock) throw new Error("No problem for the diagnostic mock");
  return { problems: picks, mock: mock.slug };
}

/** How far a rating may be nudged for patterns the diagnostic didn't test. */
const PRIOR_SHIFT_CAP = 150;
const PRIOR_UNCERTAINTY = 270;

/**
 * Starting estimates for the patterns the diagnostic didn't test: everyone
 * starts at the same rating, so half of the average move on the tested
 * patterns is carried over, with uncertainty left high so the first real
 * attempts still move it quickly. Patterns the diagnostic tested or the user
 * already attempted are left alone.
 */
export function untestedPriors(
  moves: number[],
  skills: SkillMap,
  tested: Set<PatternId>,
): { pattern: PatternId; rating: number; uncertainty: number }[] {
  if (!moves.length) return [];
  const avg = moves.reduce((s, m) => s + m, 0) / moves.length;
  const shift = Math.max(-PRIOR_SHIFT_CAP, Math.min(PRIOR_SHIFT_CAP, avg / 2));
  if (Math.abs(shift) < 1) return [];
  return PATTERNS.filter((p) => !tested.has(p.id) && !skills[p.id]?.attempts).map((p) => ({
    pattern: p.id,
    rating: Math.round(INITIAL_RATING + shift),
    uncertainty: Math.min(INITIAL_UNCERTAINTY, PRIOR_UNCERTAINTY),
  }));
}

/** The communication baseline taken from the diagnostic mock's report. */
export interface CommunicationBaseline {
  rubric: Record<RubricKey, number>;
  firstQuestionMs: number | null;
  approachBeforeCoding: boolean;
  longestSilenceMs: number;
  fillersPer100Words: number;
  wordsPerMinute: number | null;
  narratedDebugging: boolean | null;
}

export function communicationBaseline(report: FeedbackReport): CommunicationBaseline {
  const c: CommunicationMetrics = report.communication;
  return {
    rubric: Object.fromEntries(RUBRIC.map((k) => [k, report.rubric[k].score])) as Record<RubricKey, number>,
    firstQuestionMs: c.firstQuestionMs,
    approachBeforeCoding: c.approachBeforeCoding,
    longestSilenceMs: c.longestSilenceMs,
    fillersPer100Words: c.fillersPer100Words,
    wordsPerMinute: c.wordsPerMinute,
    narratedDebugging: c.narratedDebugging,
  };
}

export interface DiagnosticResult {
  /** Each tested problem: solved or not, and the rating move for its pattern. */
  problems: { slug: string; pattern: PatternId; solved: boolean; before: number; after: number }[];
  /** Untested patterns given a starting estimate from the tested ones. */
  priors: { pattern: PatternId; rating: number }[];
  communication: CommunicationBaseline | null;
}
