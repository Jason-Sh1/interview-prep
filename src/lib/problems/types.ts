// Problem bank types. Problems live in code (versioned content); user data in
// the database references them by slug.

export type PatternId =
  | "arrays-hashing"
  | "two-pointers"
  | "sliding-window"
  | "stack"
  | "binary-search"
  | "linked-list"
  | "recursion"
  | "trees"
  | "heap"
  | "backtracking"
  | "tries"
  | "graphs"
  | "union-find"
  | "advanced-graphs"
  | "dp-1d"
  | "dp-2d"
  | "greedy"
  | "intervals";

export type Difficulty = "easy" | "medium" | "hard";

/**
 * Value types the test drivers know how to pass in and read back.
 * ListNode and TreeNode are serialized as arrays (LeetCode style: a linked list
 * as its values, a tree in level order with null for missing children).
 */
export type ValueType =
  | "int"
  | "float"
  | "bool"
  | "string"
  | "int[]"
  | "float[]"
  | "bool[]"
  | "string[]"
  | "int[][]"
  | "string[][]"
  | "ListNode"
  | "TreeNode"
  | "void";

export interface Param {
  /** camelCase name; the Python template converts it to snake_case. */
  name: string;
  type: ValueType;
}

/**
 * How a result is compared with the expected value.
 * - exact: deep equality
 * - unordered: the top-level array may be in any order
 * - unordered-nested: each inner array may be in any order, and so may the outer one
 * - float: numbers equal within 1e-5
 */
export type CompareMode = "exact" | "unordered" | "unordered-nested" | "float";

export interface FunctionSignature {
  kind: "function";
  /** camelCase function name; Python uses snake_case. */
  name: string;
  params: Param[];
  returns: ValueType;
  compare?: CompareMode;
  /**
   * For functions that modify an argument in place and return nothing: the
   * index of the argument whose final value is the answer.
   */
  inPlaceArg?: number;
}

export interface MethodSignature {
  name: string;
  params: Param[];
  returns: ValueType;
}

/** A class the user implements; tests call a sequence of operations. */
export interface DesignSignature {
  kind: "design";
  className: string;
  constructorParams: Param[];
  methods: MethodSignature[];
}

export type Signature = FunctionSignature | DesignSignature;

/**
 * One test case.
 * - function problems: `input` is the argument list.
 * - design problems: `input` is `[operations, argumentLists]`, where the first
 *   operation is the class name (constructor), and `expected` is the list of
 *   return values (null for the constructor and void methods).
 */
export interface TestCase {
  input: unknown[];
  expected: unknown;
  /** Shown in the statement and run by "Run"; other tests run only on "Submit". */
  sample?: boolean;
  /** Short label for the kind of case, e.g. "empty input", "duplicates". */
  label?: string;
}

export interface Problem {
  slug: string;
  title: string;
  pattern: PatternId;
  difficulty: Difficulty;
  /** Elo-style difficulty rating: easy ~900–1150, medium ~1200–1500, hard ~1550–1800. */
  rating: number;
  /** Original or paraphrased statement, Markdown. */
  statement: string;
  constraints: string[];
  /** Tiered hints: nudge, approach, pseudocode. */
  hints: [string, string, string];
  /** Optimal complexity, written as e.g. "O(n log n)". */
  complexity: { time: string; space: string };
  signature: Signature;
  tests: TestCase[];
  /** Companies known to ask this or a close variant (estimates until the research job runs). */
  companies: string[];
  /** Link to the public problem this is modeled on, if any. */
  source?: { name: string; url: string };
  /** Reference solution in JavaScript, same shape as the user's code. Server and tests only. */
  reference: string;
}

export interface Pattern {
  id: PatternId;
  name: string;
  summary: string;
  /** Patterns that should reach a working rating before this one unlocks. */
  prerequisites: PatternId[];
}
