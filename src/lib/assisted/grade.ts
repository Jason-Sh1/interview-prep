// Grading for AI-assisted rounds (spec 4.5): decomposition, prompt quality,
// reviewing and correcting AI output (including bugs planted in assistant
// answers), correctness, and ownership of the final code. Pure: the round's
// events in, report out. With ANTHROPIC_API_KEY set, ./grade-claude.ts
// rewrites the rubric on top of these numbers.
import { HIRE_LABELS, HIRE_SIGNALS, type HireSignal, type RubricScore } from "../feedback/analyze";
import { fmtClock } from "../interview/timeline";
import { FLAG_WORDS } from "./scripted";
import type { AssistedEvent, AssistedTask } from "./types";

export const ASSISTED_RUBRIC = ["decomposition", "prompting", "review", "correctness", "ownership"] as const;
export type AssistedKey = (typeof ASSISTED_RUBRIC)[number];

export const ASSISTED_INFO: Record<AssistedKey, { label: string; help: string }> = {
  decomposition: { label: "Decomposition", help: "Broke the task into focused steps instead of asking for everything at once." },
  prompting: { label: "Prompt quality", help: "Gave the assistant context: files, functions, constraints and expected behavior." },
  review: { label: "Reviewing AI output", help: "Checked answers before trusting them, and caught the mistakes." },
  correctness: { label: "Correctness", help: "The final code passes the full test suite, including hidden tests." },
  ownership: { label: "Ownership", help: "Can explain the change, how it was verified, and what was fixed along the way." },
};

const WEIGHTS: Record<AssistedKey, number> = { decomposition: 1, prompting: 1, review: 1.5, correctness: 1.5, ownership: 1 };

export interface BugOutcome {
  t: number;
  description: string;
  outcome: "caught" | "missed" | "avoided" | "unclear";
  how: string;
}

export interface PromptNote {
  t: number;
  text: string;
  score: number;
  notes: string[];
}

export interface TestSummary {
  passed: number;
  total: number;
  failing: string[];
}

export interface AssistedReport {
  version: 1;
  generator: "claude" | "heuristic";
  summary: string;
  rubric: Record<AssistedKey, RubricScore>;
  overall: number;
  hire: { signal: HireSignal; reasons: string[] };
  bugs: BugOutcome[];
  tests: TestSummary;
  prompts: PromptNote[];
  /** Share of the new lines in the final code that came from assistant answers. */
  aiShare: number | null;
  stats: { prompts: number; runs: number; pastes: number; pastesFromAssistant: number; durationMs: number };
  focus: { area: AssistedKey; title: string; why: string; drill: string }[];
}

export interface GradeInput {
  task: AssistedTask;
  events: AssistedEvent[];
  finalFiles: Record<string, string>;
  explanation: string;
  tests: TestSummary;
  durationMs: number;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const EXPLORE = /\b(explain|what does|how does|why|walk me|overview|where is|what is|understand|structure)\b/;
const BEHAVIOR = /\b(should|must|return|returns|expect|status|header|when|if|only|never|always|exactly|without|instead)\b|\d/;
const VERIFY = /\b(test|tests|tested|ran|run|verified|verify|checked|check|edge case|boundary)\b/;
const AI_FIX = /\b(assistant|ai|claude|model|suggest\w*|bug|wrong|incorrect|fixed|caught|off[- ]by[- ]one)\b/;
const WHY = /\b(because|so that|trade-?off|instead of|chose|decided)\b/;

type Snapshot = Extract<AssistedEvent, { type: "snapshot" }>;
type Reply = Extract<AssistedEvent, { type: "reply" }>;
type Prompt = Extract<AssistedEvent, { type: "prompt" }>;

/** Identifiers in the repo (function, class and variable names) a good prompt might mention. */
function repoIdentifiers(task: AssistedTask): Set<string> {
  const ids = new Set<string>();
  for (const [path, src] of Object.entries(task.files)) {
    ids.add(path.toLowerCase());
    ids.add(path.split("/").pop()!.toLowerCase());
    ids.add(path.split("/").pop()!.replace(/\.js$/, "").toLowerCase());
    for (const m of src.matchAll(/\b(?:function|class|const|let)\s+([A-Za-z_]\w{3,})/g)) ids.add(m[1].toLowerCase());
  }
  return ids;
}

export function gradePrompt(text: string, ids: Set<string>): PromptNote {
  const lower = text.toLowerCase();
  const notes: string[] = [];
  let score = 1;
  const tokens = lower.match(/[a-z_][\w./-]*/g) ?? [];
  if (tokens.some((t) => ids.has(t) || ids.has(t.replace(/[().,:;]+$/, "")))) score += 1;
  else notes.push("Name the file or function you mean.");
  // Questions about the code don't need to specify behavior.
  if (BEHAVIOR.test(lower) || EXPLORE.test(lower)) score += 1;
  else notes.push("Say what the code should do: inputs, outputs, edge cases.");
  if (words(text) >= 15 || text.includes("`")) score += 1;
  else notes.push("Add context: what you've tried, or the relevant constraint.");
  return { t: 0, text, score, notes };
}

function requirementHits(task: AssistedTask, text: string): number {
  const lower = text.toLowerCase();
  return task.requirements.filter((r) => r.keywords.some((k) => lower.includes(k))).length;
}

/** Lines added relative to the starter files, and how many of them appear in assistant code. */
export function aiShare(task: AssistedTask, finalFiles: Record<string, string>, replies: string[]): number | null {
  const norm = (l: string) => l.trim().replace(/\s+/g, " ");
  const starter = new Set(Object.values(task.files).flatMap((s) => s.split("\n").map(norm)));
  const added = Object.values(finalFiles)
    .flatMap((s) => s.split("\n").map(norm))
    .filter((l) => l.length >= 4 && !starter.has(l) && !/^(\/\/|\*|\/\*)/.test(l));
  if (!added.length) return null;
  const fromAi = new Set(replies.flatMap((r) => [...r.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split("\n").map(norm))));
  return Math.round((added.filter((l) => fromAi.has(l)).length / added.length) * 100) / 100;
}

export function bugOutcomes(task: AssistedTask, events: AssistedEvent[], finalFiles: Record<string, string>, tests: TestSummary): BugOutcome[] {
  const snapshots = events.filter((e): e is Snapshot => e.type === "snapshot");
  const prompts = events.filter((e): e is Prompt => e.type === "prompt");
  const out: BugOutcome[] = [];
  for (const r of events.filter((e): e is Reply => e.type === "reply" && !!e.payload.planted)) {
    const planted = r.payload.planted!;
    const flagged = prompts.find((p) => p.t > r.t && FLAG_WORDS.test(p.payload.text.toLowerCase()));
    const bug = planted.id ? task.bugs.find((b) => b.id === planted.id) : undefined;
    if (bug) {
      const re = new RegExp(bug.signature);
      const inFinal = Object.values(finalFiles).some((s) => re.test(s));
      const firstSeen = snapshots.find((s) => s.t >= r.t && Object.values(s.payload.files).some((f) => re.test(f)));
      if (inFinal) out.push({ t: r.t, description: bug.description, outcome: "missed", how: "The buggy code is still in your final version." });
      else if (flagged)
        out.push({ t: r.t, description: bug.description, outcome: "caught", how: `You told the assistant at ${fmtClock(flagged.t)}: "${flagged.payload.text.slice(0, 120)}"` });
      else if (firstSeen) out.push({ t: r.t, description: bug.description, outcome: "caught", how: `You pasted it at ${fmtClock(firstSeen.t)}, then fixed it before finishing.` });
      else out.push({ t: r.t, description: bug.description, outcome: "avoided", how: "You didn't use that part of the answer." });
    } else {
      const allPass = tests.total > 0 && tests.passed === tests.total;
      if (flagged) out.push({ t: r.t, description: planted.description, outcome: "caught", how: `You pushed back at ${fmtClock(flagged.t)}.` });
      else if (allPass) out.push({ t: r.t, description: planted.description, outcome: "caught", how: "Your final code passes every test, so it didn't survive." });
      else out.push({ t: r.t, description: planted.description, outcome: "unclear", how: "Some tests still fail; check whether this is one of the reasons." });
    }
  }
  return out;
}

export function weightedOverall(rubric: Record<AssistedKey, RubricScore>): number {
  const total = ASSISTED_RUBRIC.reduce((n, k) => n + WEIGHTS[k], 0);
  return Math.round((ASSISTED_RUBRIC.reduce((n, k) => n + rubric[k].score * WEIGHTS[k], 0) / total) * 100) / 100;
}

export function assistedSignal(overall: number, tests: TestSummary): HireSignal {
  let s: HireSignal = overall >= 3.6 ? "strong-hire" : overall >= 3.1 ? "hire" : overall >= 2.6 ? "lean-hire" : overall >= 1.9 ? "no" : "strong-no";
  const frac = tests.total ? tests.passed / tests.total : 0;
  const cap: HireSignal | null = frac === 1 ? null : frac >= 0.5 ? "lean-hire" : "no";
  if (cap && HIRE_SIGNALS.indexOf(s) > HIRE_SIGNALS.indexOf(cap)) s = cap;
  return s;
}

const DRILLS: Record<AssistedKey, { title: string; drill: string }> = {
  decomposition: {
    title: "Plan, then prompt in steps",
    drill: "Before your first prompt, write the steps down (read the code, the core function, the wiring, the tests), then prompt one step at a time and run the tests between steps.",
  },
  prompting: {
    title: "Write prompts like tickets",
    drill: "Every prompt names the file and function, states the expected behavior with one example or edge case, and says what to leave alone.",
  },
  review: {
    title: "Review every answer like a code review",
    drill: "Read each answer line by line before pasting, check comparisons and units against the brief, and run the tests right after pasting.",
  },
  correctness: {
    title: "Finish with a green suite",
    drill: "Write the edge-case tests from the brief yourself (boundaries, empty input, limits) before asking for code, and don't finish until they pass.",
  },
  ownership: {
    title: "Own the explanation",
    drill: "Practice a two-minute walkthrough: what changed in which files, why this design, how you verified it, and what the assistant got wrong.",
  },
};

export function gradeRound(input: GradeInput): AssistedReport {
  const { task, events, finalFiles, explanation, tests, durationMs } = input;
  const prompts = events.filter((e): e is Prompt => e.type === "prompt");
  const replies = events.filter((e): e is Reply => e.type === "reply");
  const runs = events.filter((e) => e.type === "run");
  const pastes = events.filter((e): e is Extract<AssistedEvent, { type: "paste" }> => e.type === "paste");
  const ids = repoIdentifiers(task);
  const promptNotes = prompts.map((p) => ({ ...gradePrompt(p.payload.text, ids), t: p.t }));
  const bugs = bugOutcomes(task, events, finalFiles, tests);
  const share = aiShare(task, finalFiles, replies.map((r) => r.payload.text));

  // Decomposition
  const needed = Math.max(2, Math.ceil(task.requirements.length * 0.75));
  const wholeTask = prompts.filter((p) => requirementHits(task, p.payload.text) >= needed);
  let decomposition: RubricScore;
  if (!prompts.length) decomposition = { score: 2, evidence: "You didn't use the assistant. In an AI-enabled round, interviewers want to see you use it well." };
  else if (wholeTask.length && prompts.length === 1) decomposition = { score: 1, evidence: "You asked for the whole task in a single prompt." };
  else if (wholeTask.length && wholeTask[0] === prompts[0])
    decomposition = { score: 2, evidence: `Your first prompt asked for most of the task at once (${fmtClock(prompts[0].t)}), then you followed up.` };
  else if (prompts.some((p) => EXPLORE.test(p.payload.text.toLowerCase())) || prompts.length >= 3)
    decomposition = { score: 4, evidence: `You worked in ${plural(prompts.length, "focused prompt")}${prompts.some((p) => EXPLORE.test(p.payload.text.toLowerCase())) ? ", starting by understanding the code" : ""}.` };
  else decomposition = { score: 3, evidence: `You split the work across ${plural(prompts.length, "prompt")}.` };

  // Prompt quality
  const avg = promptNotes.length ? promptNotes.reduce((n, p) => n + p.score, 0) / promptNotes.length : 0;
  const prompting: RubricScore = promptNotes.length
    ? {
        score: clamp(Math.round(avg), 1, 4),
        evidence: `Average prompt scored ${avg.toFixed(1)} of 4.${
          promptNotes.flatMap((p) => p.notes).length ? ` Most common gap: ${mostCommon(promptNotes.flatMap((p) => p.notes))}` : " Prompts named the code, the behavior and the context."
        }`,
      }
    : { score: 1, evidence: "No prompts to grade." };

  // Reviewing AI output
  let review: RubricScore;
  const runsAfterPaste = pastes.filter((p) => p.payload.fromAssistant && runs.some((r) => r.t > p.t && r.t - p.t < 5 * 60_000)).length;
  const aiPastes = pastes.filter((p) => p.payload.fromAssistant).length;
  if (bugs.length) {
    const caught = bugs.filter((b) => b.outcome === "caught").length;
    const missed = bugs.filter((b) => b.outcome === "missed").length;
    const credit = bugs.reduce((n, b) => n + (b.outcome === "caught" ? 1 : b.outcome === "avoided" ? 0.75 : b.outcome === "unclear" ? 0.5 : 0), 0) / bugs.length;
    const score = missed === 0 && caught > 0 ? 4 : credit >= 0.5 ? 3 : credit > 0 ? 2 : 1;
    review = {
      score,
      evidence: `The assistant slipped ${plural(bugs.length, "bug")} into its answers: you caught ${caught}${missed ? `, missed ${missed}` : ""}${bugs.length - caught - missed ? `, and ${bugs.length - caught - missed} didn't come into play` : ""}.`,
    };
  } else if (aiPastes) {
    review = {
      score: runsAfterPaste / aiPastes >= 0.5 ? 3 : 2,
      evidence: `You ran the tests after ${runsAfterPaste} of ${plural(aiPastes, "paste")} from the assistant.`,
    };
  } else if (share !== null && share > 0) {
    review = { score: 2, evidence: `About ${Math.round(share * 100)}% of your new code matches the assistant's answers, and you didn't run the tests right after using it.` };
  } else review = { score: 3, evidence: "You didn't paste assistant code, so there was nothing to review." };

  // Correctness
  const frac = tests.total ? tests.passed / tests.total : 0;
  const correctness: RubricScore = {
    score: frac === 1 ? 4 : frac >= 0.8 ? 3 : frac >= 0.5 ? 2 : 1,
    evidence: `${tests.passed} of ${tests.total} tests pass, including the hidden ones${tests.failing.length ? `. Failing: ${tests.failing.slice(0, 3).join("; ")}` : ""}.`,
  };

  // Ownership
  const lower = explanation.toLowerCase();
  const fileNames = Object.keys(task.files).flatMap((f) => [f.toLowerCase(), f.split("/").pop()!.replace(/\.js$/, "").toLowerCase()]);
  let pts = 0;
  const own: string[] = [];
  if (words(explanation) >= 50) pts++;
  else own.push("The explanation was short.");
  if (fileNames.some((f) => lower.includes(f))) pts++;
  else own.push("It didn't say which files or functions changed.");
  if (VERIFY.test(lower)) pts++;
  else own.push("It didn't say how you verified the change.");
  if ((bugs.length ? AI_FIX : WHY).test(lower)) pts++;
  else own.push(bugs.length ? "It didn't mention what the assistant got wrong." : "It didn't explain why you chose this design.");
  let ownScore = clamp(pts, 1, 4);
  if (share !== null && share > 0.8 && pts < 3) {
    ownScore = Math.max(1, ownScore - 1);
    own.push(`About ${Math.round(share * 100)}% of the new code came straight from the assistant.`);
  }
  const ownership: RubricScore = { score: ownScore, evidence: own.length ? own.join(" ") : "You explained what changed, why, how you verified it, and what you corrected." };

  const rubric = { decomposition, prompting, review, correctness, ownership };
  const overall = weightedOverall(rubric);
  const signal = assistedSignal(overall, tests);
  const strong = ASSISTED_RUBRIC.filter((k) => rubric[k].score >= 4).map((k) => ASSISTED_INFO[k].label.toLowerCase());
  const weak = ASSISTED_RUBRIC.filter((k) => rubric[k].score <= 2).map((k) => ASSISTED_INFO[k].label.toLowerCase());
  const reasons = [
    frac === 1 ? "The final code passes every test." : `The final code fails ${tests.total - tests.passed} of ${tests.total} tests, which caps the signal.`,
    ...(strong.length ? [`Strong on ${strong.join(", ")}.`] : []),
    ...(weak.length ? [`Below the bar on ${weak.join(", ")}.`] : []),
  ];
  const focus = [...ASSISTED_RUBRIC]
    .filter((k) => rubric[k].score <= 3)
    .sort((a, b) => rubric[a].score - rubric[b].score || WEIGHTS[b] - WEIGHTS[a])
    .slice(0, 3)
    .map((area) => ({ area, why: rubric[area].evidence, ...DRILLS[area] }));

  return {
    version: 1,
    generator: "heuristic",
    summary: `${HIRE_LABELS[signal]}: ${tests.passed} of ${tests.total} tests pass${bugs.length ? `, and you caught ${bugs.filter((b) => b.outcome === "caught").length} of ${plural(bugs.length, "planted bug")}` : ""}.`,
    rubric,
    overall,
    hire: { signal, reasons },
    bugs,
    tests,
    prompts: promptNotes,
    aiShare: share,
    stats: { prompts: prompts.length, runs: runs.length, pastes: pastes.length, pastesFromAssistant: aiPastes, durationMs },
    focus,
  };
}

function mostCommon(xs: string[]): string {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
