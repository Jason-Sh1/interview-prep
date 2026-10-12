// Grading for code comprehension and debugging rounds (spec 4.5). Pure: the
// round in, report out. Bugs count as fixed when the tests that catch them
// pass; written answers are scored on the ideas they cover. With
// ANTHROPIC_API_KEY set, ./claude.ts re-scores the written parts.
import { HIRE_SIGNALS, type HireSignal, type RubricScore } from "../feedback/analyze";
import type { DebugTask } from "./types";

export const DEBUG_RUBRIC = ["comprehension", "debugging", "verification", "writeup"] as const;
export type DebugKey = (typeof DEBUG_RUBRIC)[number];

export const DEBUG_INFO: Record<DebugKey, { label: string; help: string }> = {
  comprehension: { label: "Code comprehension", help: "Explains how the code works, its costs, and where a change would go." },
  debugging: { label: "Finding and fixing bugs", help: "Fixes the root cause of each bug without breaking what worked." },
  verification: { label: "Verification", help: "Runs the tests, adds cases for the boundaries, and finishes green." },
  writeup: { label: "Explaining the bugs", help: "Says what was wrong, why, and how the fix was checked." },
};

const WEIGHTS: Record<DebugKey, number> = { comprehension: 1, debugging: 1.5, verification: 1, writeup: 1 };

export interface RunRecord {
  t: number;
  passed: number;
  total: number;
}

export interface DebugGradeInput {
  task: DebugTask;
  finalFiles: Record<string, string>;
  answers: Record<string, string>;
  /** The candidate's write-up of the bugs they found. */
  notes: string;
  /** Visible and hidden tests run on the final code. */
  tests: { passed: number; total: number; failing: string[] };
  runs: RunRecord[];
  prompts: number;
  withAssistant: boolean;
  durationMs: number;
}

export interface BugResult {
  id: string;
  file: string;
  description: string;
  fixed: boolean;
  explained: boolean;
}

export interface QuestionResult {
  id: string;
  prompt: string;
  yours: string;
  model: string;
  score: number;
  /** What a strong answer covers that this one didn't, when graded by Claude. */
  note?: string;
}

export interface DebugReport {
  version: 1;
  generator: "claude" | "heuristic";
  summary: string;
  rubric: Record<DebugKey, RubricScore>;
  overall: number;
  hire: { signal: HireSignal; reasons: string[] };
  bugs: BugResult[];
  questions: QuestionResult[];
  tests: { passed: number; total: number; failing: string[] };
  /** Failing tests that belong to no seeded bug: something that worked was broken. */
  regressions: string[];
  /** Test cases the candidate added to the visible test files. */
  testsAdded: number;
  stats: { runs: number; firstRunMs: number | null; prompts: number; withAssistant: boolean; durationMs: number };
  focus: { area: DebugKey; title: string; why: string; drill: string }[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Share of the word groups the text mentions (each group is synonyms). */
export function coverage(text: string, groups: string[][]): number {
  if (!groups.length) return 0;
  const t = norm(text);
  return groups.filter((g) => g.some((w) => t.includes(w.toLowerCase()))).length / groups.length;
}

const countTests = (src: string) => (src.match(/\b(test|it)\s*\(/g) ?? []).length;

/** New test cases in the visible test files (and any new test files). */
export function testsAdded(task: DebugTask, files: Record<string, string>): number {
  let n = 0;
  for (const [path, src] of Object.entries(files)) {
    if (!path.startsWith("tests/") || task.hiddenTests[path] !== undefined) continue;
    n += Math.max(0, countTests(src) - countTests(task.files[path] ?? ""));
  }
  return n;
}

export function weightedDebugOverall(rubric: Record<DebugKey, RubricScore>): number {
  const total = DEBUG_RUBRIC.reduce((s, k) => s + WEIGHTS[k], 0);
  return Math.round((DEBUG_RUBRIC.reduce((s, k) => s + WEIGHTS[k] * rubric[k].score, 0) / total) * 100) / 100;
}

/** The signal for the overall score, capped by how many bugs are still in the code. */
export function debugHireSignal(overall: number, fixed: number, bugs: number): HireSignal {
  let s: HireSignal = overall >= 3.6 ? "strong-hire" : overall >= 3.1 ? "hire" : overall >= 2.6 ? "lean-hire" : overall >= 1.9 ? "no" : "strong-no";
  const cap: HireSignal | null = fixed === bugs ? null : fixed >= bugs - 1 ? "lean-hire" : "no";
  if (cap && HIRE_SIGNALS.indexOf(s) > HIRE_SIGNALS.indexOf(cap)) s = cap;
  return s;
}

const DRILLS: Record<DebugKey, { title: string; drill: string }> = {
  comprehension: {
    title: "Read before you fix",
    drill: "Before touching code, write a three-line summary of the entry point and each module it calls, then trace one input through by hand.",
  },
  debugging: {
    title: "Hunt the boundaries",
    drill: "For every comparison, sort and loop end in the code, write the input that sits exactly on the boundary and predict the output before you run it.",
  },
  verification: {
    title: "Prove each fix with a test",
    drill: "For each bug, add a failing test first, fix the code, and rerun the whole suite so you catch regressions.",
  },
  writeup: {
    title: "Explain bugs like a postmortem",
    drill: "For each bug write one line each: the symptom, the root cause, the fix, and how you verified it.",
  },
};

export function gradeDebugRound(input: DebugGradeInput): DebugReport {
  const { task } = input;
  const failing = new Set(input.tests.failing);
  const owned = new Set(task.bugs.flatMap((b) => b.tests));
  const bugs: BugResult[] = task.bugs.map((b) => ({
    id: b.id,
    file: b.file,
    description: b.description,
    fixed: b.tests.every((t) => !failing.has(t)),
    explained: coverage(input.notes, b.keywords) === 1,
  }));
  const regressions = input.tests.failing.filter((n) => !owned.has(n));
  const fixed = bugs.filter((b) => b.fixed).length;
  const added = testsAdded(task, input.finalFiles);

  const questions: QuestionResult[] = task.questions.map((q) => {
    const yours = (input.answers[q.id] ?? "").trim();
    const c = yours ? coverage(yours, q.keywords) : 0;
    return { id: q.id, prompt: q.prompt, yours, model: q.answer, score: yours ? clamp(1 + Math.round(c * 3), 1, 4) : 1 };
  });
  const compAvg = questions.reduce((s, q) => s + q.score, 0) / Math.max(1, questions.length);

  const frac = fixed / Math.max(1, bugs.length);
  let debugScore = frac === 1 ? 4 : frac >= 2 / 3 ? 3 : frac >= 1 / 3 ? 2 : 1;
  if (regressions.length) debugScore = Math.max(1, debugScore - 1);

  const passRate = input.tests.total ? input.tests.passed / input.tests.total : 0;
  let verifyScore = !input.runs.length ? 1 : passRate === 1 ? 3 : passRate >= 0.8 ? 2 : 1;
  if (added > 0 && input.runs.length) verifyScore += 1;
  verifyScore = clamp(verifyScore, 1, 4);

  const explained = bugs.filter((b) => b.explained).length;
  const mentionsCheck = /\b(test|tests|tested|ran|verified|checked)\b/i.test(input.notes);
  const writeFrac = explained / Math.max(1, bugs.length);
  const writeScore = !input.notes.trim() ? 1 : clamp(1 + Math.round(writeFrac * 2.5) + (mentionsCheck ? 0.5 : 0), 1, 4);

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const rubric: Record<DebugKey, RubricScore> = {
    comprehension: {
      score: Math.round(compAvg),
      evidence: questions.every((q) => !q.yours)
        ? "You didn't answer the questions about the code."
        : `Your answers covered ${questions.filter((q) => q.score >= 3).length} of ${questions.length} questions well.`,
    },
    debugging: {
      score: debugScore,
      evidence: `You fixed ${fixed} of ${plural(bugs.length, "bug")}${regressions.length ? `, but ${plural(regressions.length, "test")} that passed before now fail${regressions.length === 1 ? "s" : ""}` : ""}.`,
    },
    verification: {
      score: verifyScore,
      evidence: !input.runs.length
        ? "You never ran the tests."
        : `You ran the tests ${plural(input.runs.length, "time")}${added ? ` and added ${plural(added, "test case")}` : ""}; the full suite ended at ${input.tests.passed}/${input.tests.total}.`,
    },
    writeup: {
      score: Math.round(writeScore),
      evidence: !input.notes.trim()
        ? "You didn't write up the bugs."
        : `Your write-up explained the root cause of ${explained} of ${plural(bugs.length, "bug")}${mentionsCheck ? " and how you checked the fixes" : ""}.`,
    },
  };
  const overall = weightedDebugOverall(rubric);
  const signal = debugHireSignal(overall, fixed, bugs.length);
  const reasons = [
    fixed === bugs.length ? "Found and fixed every bug." : `Left ${plural(bugs.length - fixed, "bug")} in the code, which caps the signal.`,
    ...(regressions.length ? ["Broke behavior that worked before."] : []),
    ...(rubric.comprehension.score >= 3 ? ["Explained the code clearly."] : rubric.comprehension.score <= 2 ? ["Couldn't fully explain how the code works."] : []),
    ...(input.withAssistant && input.prompts > 0 ? [`Used the assistant ${plural(input.prompts, "time")}.`] : []),
  ];
  const focus = [...DEBUG_RUBRIC]
    .filter((k) => rubric[k].score <= 3)
    .sort((a, b) => rubric[a].score - rubric[b].score || WEIGHTS[b] - WEIGHTS[a])
    .slice(0, 3)
    .map((area) => ({ area, why: rubric[area].evidence, ...DRILLS[area] }));

  const worst = [...DEBUG_RUBRIC].sort((a, b) => rubric[a].score - rubric[b].score || WEIGHTS[b] - WEIGHTS[a])[0];
  const summary =
    rubric[worst].score >= 4
      ? `You fixed all ${plural(bugs.length, "bug")} and explained the code well.`
      : `You fixed ${fixed} of ${plural(bugs.length, "bug")}. Biggest gap: ${DEBUG_INFO[worst].label.toLowerCase()}.`;

  return {
    version: 1,
    generator: "heuristic",
    summary,
    rubric,
    overall,
    hire: { signal, reasons },
    bugs,
    questions,
    tests: input.tests,
    regressions,
    testsAdded: added,
    stats: {
      runs: input.runs.length,
      firstRunMs: input.runs[0]?.t ?? null,
      prompts: input.prompts,
      withAssistant: input.withAssistant,
      durationMs: input.durationMs,
    },
    focus,
  };
}
