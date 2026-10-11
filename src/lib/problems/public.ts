import type { Problem, TestCase } from "./types";

/** What the browser gets: everything except the reference solution. */
export type PublicProblem = Omit<Problem, "reference" | "tests">;

export function toPublic(p: Problem): PublicProblem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reference, tests, ...rest } = p;
  return rest;
}

const COMMON_COMPLEXITIES = [
  "O(1)",
  "O(log n)",
  "O(n)",
  "O(n log n)",
  "O(n^2)",
  "O(n^3)",
  "O(2^n)",
  "O(n!)",
  "O(m·n)",
  "O(V + E)",
  "O(E log V)",
];

/** Options for "what's the time complexity?": the right answer plus four plausible others, in a stable order. */
export function complexityOptions(p: Problem): string[] {
  const correct = p.complexity.time;
  let h = 0;
  for (const ch of p.slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const others = COMMON_COMPLEXITIES.filter((c) => c.replace(/\s/g, "") !== correct.replace(/\s/g, ""));
  const picked: string[] = [];
  for (let i = 0; picked.length < 4 && i < others.length * 3; i++) {
    const c = others[(h + i * 7) % others.length];
    if (!picked.includes(c)) picked.push(c);
  }
  const all = [...picked, correct];
  // Deterministic shuffle so the right answer isn't always last.
  return all.sort((a, b) => ((a.length * 13 + h) % 7) - ((b.length * 13 + h) % 7) || a.localeCompare(b));
}

export function sampleTests(p: Problem): TestCase[] {
  return p.tests.filter((t) => t.sample);
}
