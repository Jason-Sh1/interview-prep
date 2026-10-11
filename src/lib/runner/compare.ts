import type { CompareMode, Signature, TestCase } from "../problems/types";
import { parseProgramOutput, type RawTestResult } from "./drivers";

export interface TestResult {
  index: number;
  passed: boolean;
  input: unknown[];
  expected: unknown;
  actual?: unknown;
  error?: string;
  stdout: string;
  ms: number;
  label?: string;
  sample: boolean;
}

export type Verdict =
  | "accepted"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit"
  | "compile_error"
  | "internal_error";

export interface RunOutcome {
  verdict: Verdict;
  results: TestResult[];
  passed: number;
  total: number;
  /** Output printed outside any test, or the compiler/runtime message when the program failed. */
  message?: string;
  runner: "browser" | "judge0" | "local";
}

function canonical(v: unknown): string {
  return JSON.stringify(v);
}

function sortKey(v: unknown): string {
  return canonical(v);
}

function deepEqual(a: unknown, b: unknown, float: boolean): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return float ? Math.abs(a - b) <= 1e-5 : a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i], float));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every((k) =>
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], float),
      )
    );
  }
  return a === b;
}

export function valuesMatch(actual: unknown, expected: unknown, mode: CompareMode = "exact"): boolean {
  if (mode === "float") return deepEqual(actual, expected, true);
  if (mode === "exact") return deepEqual(actual, expected, false);
  if (!Array.isArray(actual) || !Array.isArray(expected)) return deepEqual(actual, expected, false);
  let a = actual;
  let e = expected;
  if (mode === "unordered-nested") {
    const sortInner = (x: unknown) =>
      Array.isArray(x) ? [...x].sort((p, q) => (sortKey(p) < sortKey(q) ? -1 : sortKey(p) > sortKey(q) ? 1 : 0)) : x;
    a = a.map(sortInner);
    e = e.map(sortInner);
  }
  const sortOuter = (xs: unknown[]) => [...xs].map(canonical).sort();
  return deepEqual(sortOuter(a), sortOuter(e), false);
}

export function compareMode(sig: Signature): CompareMode {
  return sig.kind === "function" ? (sig.compare ?? "exact") : "exact";
}

/** Turns raw program output into graded test results. */
export function gradeOutput(
  sig: Signature,
  tests: TestCase[],
  stdout: string,
  stderr: string,
  runner: RunOutcome["runner"],
  opts: { timedOut?: boolean; compileError?: string } = {},
): RunOutcome {
  if (opts.compileError) {
    return { verdict: "compile_error", results: [], passed: 0, total: tests.length, message: opts.compileError, runner };
  }
  const { results: raw, extra } = parseProgramOutput(stdout);
  if (!raw) {
    return {
      verdict: opts.timedOut ? "time_limit" : "runtime_error",
      results: [],
      passed: 0,
      total: tests.length,
      message: opts.timedOut
        ? "Time limit exceeded. Look for an infinite loop or an approach that is too slow."
        : (stderr || extra || "The program exited without producing results.").slice(0, 4000),
      runner,
    };
  }
  const mode = compareMode(sig);
  const results: TestResult[] = tests.map((t, i) => {
    const r: RawTestResult = raw[i] ?? { stdout: "", ms: 0, error: "No result" };
    const passed = r.error === undefined && valuesMatch(r.actual, t.expected, mode);
    return {
      index: i,
      passed,
      input: t.input,
      expected: t.expected,
      actual: r.actual,
      error: r.error,
      stdout: r.stdout,
      ms: r.ms,
      label: t.label,
      sample: !!t.sample,
    };
  });
  const passed = results.filter((r) => r.passed).length;
  const verdict: Verdict =
    passed === tests.length ? "accepted" : results.some((r) => r.error) ? "runtime_error" : "wrong_answer";
  return { verdict, results, passed, total: tests.length, message: extra.trim() || undefined, runner };
}
