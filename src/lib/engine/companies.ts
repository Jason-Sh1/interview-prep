import type { PatternId } from "../problems/types";

// How much each company's coding rounds lean on each pattern, from 0 to 1.
// These are hand-made starting estimates from public interview write-ups and
// the frequency lists in the spec's research. The weekly research job
// (spec 4.6) will replace them with sourced, dated profiles.

export interface CompanyProfile {
  id: string;
  name: string;
  style: string;
  emphasis: Partial<Record<PatternId, number>>;
}

const DEFAULT_EMPHASIS = 0.3;

export const COMPANIES: CompanyProfile[] = [
  {
    id: "google",
    name: "Google",
    style: "AI-off algorithm rounds; graphs, DP and follow-up variations.",
    emphasis: {
      "arrays-hashing": 0.7, graphs: 0.9, "dp-1d": 0.7, "dp-2d": 0.7, trees: 0.7,
      "binary-search": 0.6, "advanced-graphs": 0.6, intervals: 0.5, heap: 0.5,
      "union-find": 0.5, tries: 0.5, backtracking: 0.5, recursion: 0.5, "sliding-window": 0.5,
    },
  },
  {
    id: "meta",
    name: "Meta",
    style: "Two fast mediums per round, plus an AI-enabled coding round.",
    emphasis: {
      "arrays-hashing": 0.9, "two-pointers": 0.8, trees: 0.8, graphs: 0.7, "sliding-window": 0.7,
      stack: 0.6, "binary-search": 0.6, heap: 0.6, "linked-list": 0.5, intervals: 0.6, recursion: 0.5,
    },
  },
  {
    id: "amazon",
    name: "Amazon",
    style: "Practical mediums tied to leadership principles; BFS, heaps and design.",
    emphasis: {
      "arrays-hashing": 0.9, graphs: 0.8, heap: 0.8, trees: 0.7, "sliding-window": 0.6,
      intervals: 0.6, "dp-1d": 0.5, "two-pointers": 0.5, "advanced-graphs": 0.5, greedy: 0.5,
    },
  },
  {
    id: "microsoft",
    name: "Microsoft",
    style: "Classic data-structure questions: lists, trees, strings.",
    emphasis: {
      "arrays-hashing": 0.8, "linked-list": 0.8, trees: 0.8, "two-pointers": 0.6, stack: 0.6,
      "dp-1d": 0.5, recursion: 0.5, "binary-search": 0.5, backtracking: 0.4,
    },
  },
  {
    id: "apple",
    name: "Apple",
    style: "Team-specific; strong fundamentals in arrays, strings and trees.",
    emphasis: {
      "arrays-hashing": 0.8, "two-pointers": 0.6, trees: 0.6, "linked-list": 0.6, stack: 0.5,
      "sliding-window": 0.5, "dp-1d": 0.4,
    },
  },
  {
    id: "bloomberg",
    name: "Bloomberg",
    style: "Data-structure heavy: stacks, linked lists, design classes.",
    emphasis: {
      "arrays-hashing": 0.8, stack: 0.8, "linked-list": 0.7, heap: 0.6, trees: 0.6,
      intervals: 0.5, graphs: 0.5, "two-pointers": 0.5,
    },
  },
  {
    id: "uber",
    name: "Uber",
    style: "Graphs and practical problem solving.",
    emphasis: {
      graphs: 0.8, "advanced-graphs": 0.7, heap: 0.6, "arrays-hashing": 0.7, intervals: 0.6,
      "union-find": 0.5, "dp-1d": 0.5, "binary-search": 0.5,
    },
  },
  {
    id: "stripe",
    name: "Stripe",
    style: "Practical, multi-part coding on realistic data; less pure algorithms.",
    emphasis: {
      "arrays-hashing": 0.9, intervals: 0.6, stack: 0.5, "two-pointers": 0.4, greedy: 0.4,
      heap: 0.4, graphs: 0.4,
    },
  },
  {
    id: "startup",
    name: "Startups (general)",
    style: "Practical, often AI-permitted rounds; fundamentals over puzzles.",
    emphasis: {
      "arrays-hashing": 0.9, "two-pointers": 0.5, "sliding-window": 0.5, stack: 0.5, trees: 0.5,
      graphs: 0.5, intervals: 0.5, heap: 0.4,
    },
  },
];

export const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c])) as Record<
  string,
  CompanyProfile
>;

export function emphasisFor(companyId: string, pattern: PatternId): number {
  return COMPANY_BY_ID[companyId]?.emphasis[pattern] ?? DEFAULT_EMPHASIS;
}

/** Average emphasis of a pattern across the user's target companies (0.5 when none). */
export function patternFrequency(targets: string[], pattern: PatternId): number {
  const known = targets.filter((t) => COMPANY_BY_ID[t]);
  if (!known.length) return 0.5;
  return known.reduce((s, t) => s + emphasisFor(t, pattern), 0) / known.length;
}

/** Whether a problem's company list mentions one of the targets. */
export function problemAskedByTargets(problemCompanies: string[], targets: string[]): boolean {
  const names = new Set(targets.map((t) => COMPANY_BY_ID[t]?.name.toLowerCase()).filter(Boolean));
  return problemCompanies.some((c) => names.has(c.toLowerCase()));
}
