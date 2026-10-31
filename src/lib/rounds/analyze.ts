// Rule-based helpers shared by the conversation rounds' graders: what the
// candidate said, how much, how clearly, and simple keyword coverage checks.
// Pure functions; the kind-specific graders build on them.
import { HIRE_SIGNALS, type HireSignal } from "../feedback/analyze";
import type { RoundFocus, RoundScore, Turn } from "./types";

/** Groups of synonyms; a group is "mentioned" when any of its phrases appears. */
export type KeywordGroups = string[][];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+#./%$ -]/g, " ").replace(/\s+/g, " ")} `;

/** True if any phrase in the group appears as whole words in the text. */
export function mentionsGroup(text: string, group: string[]): boolean {
  const t = norm(text);
  return group.some((p) => t.includes(` ${p.toLowerCase().trim()} `) || t.includes(` ${p.toLowerCase().trim()}s `));
}

/** Indexes of the groups the text mentions. */
export function groupsMentioned(text: string, groups: KeywordGroups): number[] {
  return groups.flatMap((g, i) => (mentionsGroup(text, g) ? [i] : []));
}

export const candidateTurns = (turns: Turn[]) => turns.filter((t) => t.speaker === "candidate");
export const candidateText = (turns: Turn[]) => candidateTurns(turns).map((t) => t.text).join(" \n");
export const wordCount = (s: string) => (s.match(/[A-Za-z0-9']+/g) ?? []).length;

const FILLERS = [/\bu+m+\b/g, /\bu+h+\b/g, /\ber+m*\b/g, /\blike,/g, /\byou know\b/g, /\bi mean\b/g, /\bbasically\b/g, /\bkind of\b/g, /\bsort of\b/g, /\bliterally\b/g];

export interface TalkMetrics {
  candidateWords: number;
  interviewerWords: number;
  /** Candidate share of all words, 0..1. */
  share: number;
  /** Filler words per 100 candidate words. */
  fillersPer100: number;
  candidateTurns: number;
  /** Mean words per candidate turn. */
  wordsPerTurn: number;
  /** Questions the candidate asked. */
  questions: number;
}

export function talkMetrics(turns: Turn[]): TalkMetrics {
  const mine = candidateTurns(turns);
  const candidateWords = mine.reduce((n, t) => n + wordCount(t.text), 0);
  const interviewerWords = turns.filter((t) => t.speaker === "interviewer").reduce((n, t) => n + wordCount(t.text), 0);
  const lower = mine.map((t) => t.text.toLowerCase()).join(" ");
  const fillers = FILLERS.reduce((n, re) => n + (lower.match(re)?.length ?? 0), 0);
  return {
    candidateWords,
    interviewerWords,
    share: candidateWords + interviewerWords ? candidateWords / (candidateWords + interviewerWords) : 0,
    fillersPer100: candidateWords ? Math.round((fillers / candidateWords) * 1000) / 10 : 0,
    candidateTurns: mine.length,
    wordsPerTurn: mine.length ? Math.round(candidateWords / mine.length) : 0,
    questions: mine.filter((t) => /\?\s*$/.test(t.text.trim()) || /^(what|how|can|could|should|do|does|is|are|will|would|which|when|where|who|why)\b/i.test(t.text.trim())).length,
  };
}

/** Maps a 0..1 fraction to a 1..4 score with the given cut points for 2, 3 and 4. */
export function scoreFromFraction(f: number, cuts: [number, number, number] = [0.25, 0.5, 0.75]): number {
  return f >= cuts[2] ? 4 : f >= cuts[1] ? 3 : f >= cuts[0] ? 2 : 1;
}

export const clampScore = (n: number) => Math.min(4, Math.max(1, Math.round(n)));

export function weighted(rubric: Record<string, RoundScore>, weights: Record<string, number>): number {
  const keys = Object.keys(weights).filter((k) => rubric[k]);
  const total = keys.reduce((n, k) => n + weights[k], 0);
  if (!total) return 0;
  return Math.round((keys.reduce((n, k) => n + rubric[k].score * weights[k], 0) / total) * 100) / 100;
}

const LEVEL_SHIFT: Record<string, number> = { "new-grad": -0.15, mid: 0, senior: 0.2, staff: 0.3 };
const STRICT = new Set(["google", "meta", "amazon"]);

/** How far above the default bar this company and level sit. */
export const roundBarShift = (company: string | null, level: string) =>
  (company && STRICT.has(company) ? 0.1 : company === "startup" ? -0.1 : 0) + (LEVEL_SHIFT[level] ?? 0);

export function roundHireSignal(overall: number, shift: number, cap?: HireSignal): HireSignal {
  const o = overall - shift;
  let s: HireSignal = o >= 3.6 ? "strong-hire" : o >= 3.1 ? "hire" : o >= 2.6 ? "lean-hire" : o >= 1.9 ? "no" : "strong-no";
  if (cap && HIRE_SIGNALS.indexOf(s) > HIRE_SIGNALS.indexOf(cap)) s = cap;
  return s;
}

/** The three weakest rubric areas (score 3 or less), each with its drill. */
export function focusFrom(
  rubric: Record<string, RoundScore>,
  weights: Record<string, number>,
  drills: Record<string, { title: string; drill: string }>,
): RoundFocus[] {
  return Object.keys(weights)
    .filter((k) => rubric[k] && rubric[k].score <= 3 && drills[k])
    .sort((a, b) => rubric[a].score - rubric[b].score || weights[b] - weights[a])
    .slice(0, 3)
    .map((area) => ({ area, why: rubric[area].evidence, ...drills[area] }));
}

/** The strongest areas, as short phrases for the report. */
export function strengthsFrom(rubric: Record<string, RoundScore>, labels: Record<string, { label: string }>): string[] {
  return Object.keys(rubric)
    .filter((k) => rubric[k].score >= 4 && labels[k])
    .map((k) => `${labels[k].label}: ${rubric[k].evidence}`)
    .slice(0, 3);
}

/** Lowercased last few candidate turns, for the scripted interviewers' checks. */
export const recentCandidate = (turns: Turn[], n = 1) =>
  candidateTurns(turns)
    .slice(-n)
    .map((t) => t.text)
    .join(" ");

/** Picks a line deterministically from a list, so the same round replays the same way in tests. */
export function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length];
}
