// Review variants (spec 4.2 "Variants"): a solved problem with changed
// constraints or a follow-up twist, so a review tests understanding instead
// of memory of the old code. Pure helpers: the shape a variant is stored in,
// and turning the model's draft into a checked Problem.
import type { CompareMode, FunctionSignature, Problem, TestCase, ValueType } from "../problems/types";

export const VALUE_TYPES = [
  "int",
  "float",
  "bool",
  "string",
  "int[]",
  "float[]",
  "bool[]",
  "string[]",
  "int[][]",
  "string[][]",
  "ListNode",
  "TreeNode",
] as const satisfies readonly ValueType[];

export const COMPARE_MODES = ["exact", "unordered", "unordered-nested", "float"] as const satisfies readonly CompareMode[];

/** What a stored variant holds; the rest comes from the base problem. */
export interface VariantData {
  title: string;
  /** One line on what changed from the original, shown before the attempt. */
  twist: string;
  statement: string;
  constraints: string[];
  hints: [string, string, string];
  complexity: { time: string; space: string };
  signature: FunctionSignature;
  tests: TestCase[];
  reference: string;
}

/** The model's draft, before it's checked: test values arrive as JSON text. */
export interface VariantDraft {
  title: string;
  twist: string;
  statement: string;
  constraints: string[];
  hints: string[];
  complexity: { time: string; space: string };
  functionName: string;
  params: { name: string; type: (typeof VALUE_TYPES)[number] }[];
  returns: (typeof VALUE_TYPES)[number];
  compare: (typeof COMPARE_MODES)[number];
  reference: string;
  tests: { input: string; expected: string; label?: string; sample: boolean }[];
}

const IDENT = /^[a-z][A-Za-z0-9]*$/;

/**
 * Checks a draft's shape and parses its tests. Throws with the reason when
 * it can't be used; running the reference against the tests is a separate
 * step (./index.ts), since it needs a process.
 */
export function draftToVariant(d: VariantDraft): VariantData {
  if (!IDENT.test(d.functionName)) throw new Error(`Bad function name: ${d.functionName}`);
  if (!d.params.length || d.params.some((p) => !IDENT.test(p.name))) throw new Error("Bad parameter names");
  if (new Set(d.params.map((p) => p.name)).size !== d.params.length) throw new Error("Duplicate parameter names");
  if (d.hints.length < 3 || d.hints.slice(0, 3).some((h) => !h.trim())) throw new Error("Needs three hints");
  if (!d.complexity.time.startsWith("O(")) throw new Error("Complexity should look like O(...)");
  if (!new RegExp(`function\\s+${d.functionName}\\s*\\(`).test(d.reference)) throw new Error("The reference doesn't define the function");
  const tests: TestCase[] = d.tests.map((t, i) => {
    let input: unknown;
    let expected: unknown;
    try {
      input = JSON.parse(t.input);
      expected = JSON.parse(t.expected);
    } catch {
      throw new Error(`Test ${i + 1} isn't valid JSON`);
    }
    if (!Array.isArray(input) || input.length !== d.params.length) throw new Error(`Test ${i + 1} needs ${d.params.length} arguments`);
    return { input, expected, ...(t.sample ? { sample: true } : {}), ...(t.label ? { label: t.label.slice(0, 40) } : {}) };
  });
  if (tests.length < 5) throw new Error("Needs at least five tests");
  if (!tests.some((t) => t.sample)) throw new Error("Needs a sample test");
  if (tests.length > 40 || JSON.stringify(tests).length > 200_000) throw new Error("Tests are too large");
  return {
    title: d.title.trim().slice(0, 80),
    twist: d.twist.trim().slice(0, 300),
    statement: d.statement.trim().slice(0, 6000),
    constraints: d.constraints.slice(0, 8),
    hints: [d.hints[0], d.hints[1], d.hints[2]],
    complexity: d.complexity,
    signature: {
      kind: "function",
      name: d.functionName,
      params: d.params,
      returns: d.returns,
      ...(d.compare !== "exact" ? { compare: d.compare } : {}),
    },
    tests,
    reference: d.reference,
  };
}

/** The base problem with the variant's content swapped in. It keeps the base slug, so the review counts for the original's card. */
export function variantProblem(base: Problem, v: VariantData): Problem {
  return {
    ...base,
    title: v.title,
    statement: v.statement,
    constraints: v.constraints,
    hints: v.hints,
    complexity: v.complexity,
    signature: v.signature,
    tests: v.tests,
    reference: v.reference,
    source: undefined,
  };
}
