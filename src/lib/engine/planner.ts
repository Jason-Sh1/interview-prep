// Next-problem selection and the daily plan (spec 4.2).
//
// Every candidate (due reviews and open new problems) gets
//
//   score = w1·pattern_weakness + w2·company_frequency + w3·difficulty_fit
//         + w4·review_due + w5·interleave_bonus + w7·novelty − w6·recently_seen
//
// with weights that shift by phase (time left before the interview). The plan
// fills the user's daily time budget greedily, penalizing repeats of a pattern
// so a day mixes topics. It is pure: callers recompute it after every attempt.

import { PATTERN_BY_ID, PATTERNS } from "../problems/patterns";
import type { Difficulty, PatternId, Problem } from "../problems/types";
import { COMPANY_BY_ID, patternFrequency, problemAskedByTargets } from "./companies";
import {
  isLearned,
  isProblemOpen,
  isStuck,
  isUnlocked,
  skillOf,
  type SkillMap,
} from "./mastery";
import { solveProbability } from "./rating";

export type Phase = "breadth" | "strengthen" | "final";

export const PHASE_INFO: Record<Phase, { label: string; focus: string }> = {
  breadth: { label: "Build breadth", focus: "New patterns first, with reviews to lock them in." },
  strengthen: {
    label: "Strengthen",
    focus: "Your weakest patterns and mixed practice where you name the pattern yourself.",
  },
  final: {
    label: "Final stretch",
    focus: "Reviews and the problems your target companies ask most.",
  },
};

interface Weights {
  weakness: number;
  frequency: number;
  fit: number;
  review: number;
  interleave: number;
  recent: number;
  novelty: number;
}

export const PHASE_WEIGHTS: Record<Phase, Weights> = {
  breadth: { weakness: 0.3, frequency: 0.1, fit: 0.3, review: 0.35, interleave: 0.1, recent: 0.4, novelty: 0.35 },
  strengthen: { weakness: 0.45, frequency: 0.2, fit: 0.25, review: 0.4, interleave: 0.25, recent: 0.4, novelty: 0.1 },
  final: { weakness: 0.2, frequency: 0.45, fit: 0.15, review: 0.55, interleave: 0.2, recent: 0.4, novelty: 0 },
};

/** Minutes budgeted per item, including reading and the post-solve check-in. */
export const ITEM_MINUTES: Record<Difficulty | "review", number> = {
  easy: 20,
  medium: 30,
  hard: 45,
  review: 10,
};

const DAY_MS = 86_400_000;
const PATTERN_REPEAT_PENALTY = 0.3;
const MAX_ITEMS = 8;

export interface AttemptSummary {
  problemSlug: string;
  pattern: PatternId;
  solved: boolean;
  mode: "learn" | "review" | "mixed";
  finishedAt: Date;
}

export interface PlannerInput {
  now: Date;
  goals: { targetCompanies: string[]; interviewDate: string | null; hoursPerWeek: number };
  skills: SkillMap;
  /** Recent attempts, any order. */
  attempts: AttemptSummary[];
  cards: { problemSlug: string; due: Date }[];
  problems: Problem[];
}

export type ItemKind = "new" | "review" | "mixed" | "bridge";

export interface PlanItem {
  slug: string;
  pattern: PatternId;
  kind: ItemKind;
  /** Interleaved practice: don't show the pattern until after the attempt. */
  hidePattern: boolean;
  minutes: number;
  score: number;
  components: Weights;
  reason: string;
}

export interface DailyPlan {
  phase: Phase;
  daysLeft: number | null;
  minutesBudget: number;
  items: PlanItem[];
  /** Slugs finished today (solved or reviewed). */
  doneToday: string[];
  /** Patterns where stuck detection kicked in. */
  stuck: PatternId[];
}

export function daysUntil(date: string | null, now: Date): number | null {
  if (!date) return null;
  const target = new Date(`${date}T23:59:59`);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY_MS));
}

export function phaseFor(daysLeft: number | null, skills: SkillMap): Phase {
  if (daysLeft !== null) {
    if (daysLeft <= 14) return "final";
    if (daysLeft <= 42) return "strengthen";
    return "breadth";
  }
  // No date: move on from breadth once most patterns have been started.
  const started = PATTERNS.filter((p) => skillOf(skills, p.id).attempts > 0).length;
  return started >= PATTERNS.length * 0.6 ? "strengthen" : "breadth";
}

export function dailyMinutes(hoursPerWeek: number): number {
  return Math.round(Math.min(240, Math.max(20, (hoursPerWeek * 60) / 7)));
}

function weakness(p: PatternId, skills: SkillMap): number {
  const s = skillOf(skills, p);
  const low = Math.min(1, Math.max(0, (1450 - s.rating) / 600));
  return 0.7 * low + 0.3 * Math.min(1, s.uncertainty / 300);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function companyNames(targets: string[]): string {
  const names = targets.map((t) => COMPANY_BY_ID[t]?.name).filter(Boolean) as string[];
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and others`;
}

function reasonFor(
  item: Omit<PlanItem, "reason">,
  w: Weights,
  ctx: { input: PlannerInput; problem: Problem; overdueDays: number },
): string {
  const { input, problem } = ctx;
  const pattern = PATTERN_BY_ID[item.pattern].name;
  if (item.kind === "bridge") {
    return `You missed two ${pattern} problems in a row; this easier one rebuilds the idea before you retry.`;
  }
  if (item.kind === "review") {
    const when =
      ctx.overdueDays >= 1 ? `overdue by ${Math.floor(ctx.overdueDays)} day${ctx.overdueDays >= 2 ? "s" : ""}` : "due today";
    return `Review ${when}: re-derive the approach out loud in 2 minutes, or re-implement it against the clock.`;
  }
  const c = item.components;
  const parts: [number, string][] = [
    [w.weakness * c.weakness, `${pattern} is one of your weaker patterns (rating ${Math.round(skillOf(input.skills, item.pattern).rating)}).`],
    [
      w.frequency * c.frequency,
      input.goals.targetCompanies.length
        ? `${companyNames(input.goals.targetCompanies)} ${problemAskedByTargets(problem.companies, input.goals.targetCompanies) ? "ask this problem or a close variant" : `lean on ${pattern}`}.`
        : `${pattern} shows up often across companies.`,
    ],
    [
      w.fit * c.fit,
      `About a ${Math.round(solveProbability(skillOf(input.skills, item.pattern).rating, problem.rating) * 100)}% solve chance: the stretch zone where practice pays off most.`,
    ],
    [w.novelty * c.novelty, `Starts a new pattern: ${pattern}.`],
    [w.interleave * c.interleave, "Mixed practice: work out which pattern applies before you code."],
  ];
  if (item.kind === "mixed") return "Mixed practice: the pattern is hidden, so spotting it is part of the problem.";
  parts.sort((a, b) => b[0] - a[0]);
  return parts[0][1];
}

export function buildPlan(input: PlannerInput): DailyPlan {
  const { now, skills, problems } = input;
  const daysLeft = daysUntil(input.goals.interviewDate, now);
  const phase = phaseFor(daysLeft, skills);
  const w = PHASE_WEIGHTS[phase];
  const budget = dailyMinutes(input.goals.hoursPerWeek);
  const bySlug = new Map(problems.map((p) => [p.slug, p]));

  const solved = new Set(input.attempts.filter((a) => a.solved).map((a) => a.problemSlug));
  const today = input.attempts.filter((a) => isSameDay(a.finishedAt, now));
  const doneToday = [...new Set(today.map((a) => a.problemSlug))];
  const doneSet = new Set(doneToday);
  const recentPatterns = [...input.attempts]
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime())
    .slice(0, 3)
    .map((a) => a.pattern);
  const lastTouched = new Map<string, Date>();
  for (const a of input.attempts) {
    const prev = lastTouched.get(a.problemSlug);
    if (!prev || prev < a.finishedAt) lastTouched.set(a.problemSlug, a.finishedAt);
  }
  const stuck = PATTERNS.map((p) => p.id).filter((p) => isUnlocked(p, skills) && isStuck(p, skills));

  const freq = (p: Problem) =>
    Math.min(
      1,
      patternFrequency(input.goals.targetCompanies, p.pattern) +
        (problemAskedByTargets(p.companies, input.goals.targetCompanies) ? 0.3 : 0),
    );
  const recentlySeen = (slug: string) => {
    const t = lastTouched.get(slug);
    if (!t) return 0;
    const days = (now.getTime() - t.getTime()) / DAY_MS;
    return days < 2 ? 1 : days < 7 ? 0.4 : 0;
  };
  const total = (c: Weights) =>
    w.weakness * c.weakness +
    w.frequency * c.frequency +
    w.fit * c.fit +
    w.review * c.review +
    w.interleave * c.interleave +
    w.novelty * c.novelty -
    w.recent * c.recent;

  type Candidate = Omit<PlanItem, "reason"> & { overdueDays: number };
  const candidates: Candidate[] = [];
  const endToday = endOfDay(now);

  // Due reviews. A missed day just leaves more cards due; the budget caps how
  // many land today and the most overdue rank first, so nothing piles up.
  for (const card of input.cards) {
    const p = bySlug.get(card.problemSlug);
    if (!p || doneSet.has(p.slug) || card.due > endToday) continue;
    const overdueDays = Math.max(0, (now.getTime() - card.due.getTime()) / DAY_MS);
    const components: Weights = {
      weakness: weakness(p.pattern, skills),
      frequency: freq(p),
      fit: 0.5,
      review: Math.min(2, 1 + overdueDays / 7),
      interleave: recentPatterns.includes(p.pattern) ? 0 : 1,
      recent: 0,
      novelty: 0,
    };
    candidates.push({
      slug: p.slug,
      pattern: p.pattern,
      kind: "review",
      hidePattern: false,
      minutes: ITEM_MINUTES.review,
      score: total(components),
      components,
      overdueDays,
    });
  }

  // Stuck patterns get one bridge problem: the easiest problem below the ones
  // that were just failed, even if it was solved before. If there is nothing
  // easier, the pattern stays open and the UI points to its concept refresher.
  const bridged = new Set<PatternId>();
  for (const pattern of stuck) {
    const failedRatings = input.attempts
      .filter((a) => a.pattern === pattern && !a.solved)
      .map((a) => bySlug.get(a.problemSlug)?.rating ?? Infinity);
    const ceiling = Math.min(...failedRatings);
    const bridge = problems
      .filter((p) => p.pattern === pattern && p.rating < ceiling && !doneSet.has(p.slug))
      .sort((a, b) => a.rating - b.rating)[0];
    if (!bridge) continue;
    bridged.add(pattern);
    const components: Weights = {
      weakness: weakness(pattern, skills),
      frequency: freq(bridge),
      fit: 1,
      review: 0,
      interleave: 0,
      recent: 0,
      novelty: 0,
    };
    candidates.push({
      slug: bridge.slug,
      pattern,
      kind: "bridge",
      hidePattern: false,
      minutes: ITEM_MINUTES[bridge.difficulty],
      score: total(components) + 1,
      components,
      overdueDays: 0,
    });
  }

  // New problems in unlocked patterns, within reach of the current rating.
  // Stuck patterns only get their bridge until it is solved.
  const taken = new Set([...candidates.map((c) => c.slug), ...input.cards.map((c) => c.problemSlug)]);
  for (const p of problems) {
    if (solved.has(p.slug) || doneSet.has(p.slug) || taken.has(p.slug)) continue;
    if (bridged.has(p.pattern)) continue;
    if (!isProblemOpen(p, skills, solved, problems)) continue;
    const s = skillOf(skills, p.pattern);
    const prob = solveProbability(s.rating, p.rating);
    const learned = isLearned(p.pattern, skills);
    const components: Weights = {
      weakness: weakness(p.pattern, skills),
      frequency: freq(p),
      fit: Math.max(0, 1 - Math.abs(prob - 0.7) / 0.7),
      review: 0,
      interleave: learned && !recentPatterns.includes(p.pattern) ? 1 : 0,
      recent: recentlySeen(p.slug),
      novelty: s.attempts === 0 ? 1 : 0,
    };
    candidates.push({
      slug: p.slug,
      pattern: p.pattern,
      kind: learned && phase !== "breadth" ? "mixed" : "new",
      hidePattern: learned && phase !== "breadth",
      minutes: ITEM_MINUTES[p.difficulty],
      score: total(components),
      components,
      overdueDays: 0,
    });
  }

  // Greedy fill of the day's budget, spreading patterns.
  const items: PlanItem[] = [];
  const perPattern = new Map<PatternId, number>();
  // Time already spent today counts against the budget.
  let used = 0;
  const counted = new Set<string>();
  for (const a of today) {
    const p = bySlug.get(a.problemSlug);
    if (!p || counted.has(a.problemSlug)) continue;
    counted.add(a.problemSlug);
    used += a.mode === "review" ? ITEM_MINUTES.review : ITEM_MINUTES[p.difficulty];
  }
  const pool = [...candidates];
  while (pool.length && items.length < MAX_ITEMS) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (items.length > 0 && used + c.minutes > budget) continue;
      const adj = c.score - PATTERN_REPEAT_PENALTY * (perPattern.get(c.pattern) ?? 0);
      if (adj > bestScore) {
        bestScore = adj;
        best = i;
      }
    }
    if (best === -1) break;
    const [c] = pool.splice(best, 1);
    const problem = bySlug.get(c.slug)!;
    const { overdueDays, ...item } = c;
    items.push({ ...item, reason: reasonFor(item, w, { input, problem, overdueDays }) });
    used += c.minutes;
    perPattern.set(c.pattern, (perPattern.get(c.pattern) ?? 0) + 1);
  }

  return { phase, daysLeft, minutesBudget: budget, items, doneToday, stuck };
}

/** The single best next problem (used by "Next problem" after finishing one). */
export function nextItem(input: PlannerInput): PlanItem | null {
  return buildPlan(input).items[0] ?? null;
}
