import type { Pattern, PatternId } from "./types";

// Prerequisite graph for the pattern-first track (spec 4.2). Ordered so that
// every pattern appears after its prerequisites. Five foundational patterns
// have no prerequisites, so the first days already mix topics.
export const PATTERNS: Pattern[] = [
  {
    id: "arrays-hashing",
    name: "Arrays & Hashing",
    summary: "Counting, lookups and grouping with hash maps and sets.",
    prerequisites: [],
  },
  {
    id: "two-pointers",
    name: "Two Pointers",
    summary: "Walk a sorted array or string from both ends, or at two speeds.",
    prerequisites: [],
  },
  {
    id: "stack",
    name: "Stack",
    summary: "Matching, monotonic stacks and evaluating expressions.",
    prerequisites: [],
  },
  {
    id: "binary-search",
    name: "Binary Search",
    summary: "Halve a sorted space, including binary search on the answer.",
    prerequisites: [],
  },
  {
    id: "recursion",
    name: "Recursion & Memoization",
    summary: "Break a problem into smaller copies of itself and cache repeated work.",
    prerequisites: [],
  },
  {
    id: "greedy",
    name: "Greedy",
    summary: "Make the locally best choice and prove it never hurts.",
    prerequisites: ["arrays-hashing"],
  },
  {
    id: "sliding-window",
    name: "Sliding Window",
    summary: "Grow and shrink a window over a sequence while tracking its state.",
    prerequisites: ["two-pointers"],
  },
  {
    id: "linked-list",
    name: "Linked List",
    summary: "Pointer rewiring, dummy heads and fast/slow pointers.",
    prerequisites: ["two-pointers"],
  },
  {
    id: "intervals",
    name: "Intervals",
    summary: "Sort by start or end, then merge, insert or count overlaps.",
    prerequisites: ["greedy"],
  },
  {
    id: "trees",
    name: "Trees",
    summary: "DFS and BFS over binary trees and binary search trees.",
    prerequisites: ["recursion"],
  },
  {
    id: "heap",
    name: "Heap / Priority Queue",
    summary: "Top-k, streaming medians and merging sorted inputs.",
    prerequisites: ["arrays-hashing", "trees"],
  },
  {
    id: "backtracking",
    name: "Backtracking",
    summary: "Build candidates step by step and undo choices that fail.",
    prerequisites: ["recursion"],
  },
  {
    id: "dp-1d",
    name: "1-D Dynamic Programming",
    summary: "One-dimensional state: climbing, robbing, partitioning.",
    prerequisites: ["recursion"],
  },
  {
    id: "tries",
    name: "Tries",
    summary: "Prefix trees for word lookup and prefix search.",
    prerequisites: ["trees"],
  },
  {
    id: "graphs",
    name: "Graphs (BFS/DFS)",
    summary: "Grids and adjacency lists, connected components, shortest steps.",
    prerequisites: ["trees"],
  },
  {
    id: "dp-2d",
    name: "2-D Dynamic Programming",
    summary: "Grid paths, two-string problems and knapsack.",
    prerequisites: ["dp-1d"],
  },
  {
    id: "union-find",
    name: "Union-Find",
    summary: "Disjoint sets for connectivity and cycle detection.",
    prerequisites: ["graphs"],
  },
  {
    id: "advanced-graphs",
    name: "Advanced Graphs",
    summary: "Topological sort, Dijkstra and minimum spanning trees.",
    prerequisites: ["graphs", "heap"],
  },
];

export const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p.id, p])) as Record<
  PatternId,
  Pattern
>;
