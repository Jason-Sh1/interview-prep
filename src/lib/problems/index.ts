import { arraysHashing } from "./bank/arrays-hashing";
import { twoPointers } from "./bank/two-pointers";
import { slidingWindow } from "./bank/sliding-window";
import { stack } from "./bank/stack";
import { binarySearch } from "./bank/binary-search";
import { linkedList } from "./bank/linked-list";
import { recursion } from "./bank/recursion";
import { trees } from "./bank/trees";
import { heap } from "./bank/heap";
import { backtracking } from "./bank/backtracking";
import { tries } from "./bank/tries";
import { greedy } from "./bank/greedy";
import { graphs } from "./bank/graphs";
import { unionFind } from "./bank/union-find";
import { advancedGraphs } from "./bank/advanced-graphs";
import { dp1d } from "./bank/dp-1d";
import { dp2d } from "./bank/dp-2d";
import { intervals } from "./bank/intervals";
import { PATTERNS } from "./patterns";
import type { PatternId, Problem } from "./types";

export const PROBLEMS: Problem[] = [
  ...arraysHashing,
  ...twoPointers,
  ...slidingWindow,
  ...stack,
  ...binarySearch,
  ...linkedList,
  ...recursion,
  ...trees,
  ...heap,
  ...backtracking,
  ...tries,
  ...greedy,
  ...graphs,
  ...unionFind,
  ...advancedGraphs,
  ...dp1d,
  ...dp2d,
  ...intervals,
];

export const PROBLEM_BY_SLUG = new Map(PROBLEMS.map((p) => [p.slug, p]));

export function problemsForPattern(pattern: PatternId): Problem[] {
  return PROBLEMS.filter((p) => p.pattern === pattern).sort((a, b) => a.rating - b.rating);
}

export { PATTERNS };
