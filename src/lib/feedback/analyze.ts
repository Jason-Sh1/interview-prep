// The feedback report (spec 4.4), computed from a mock interview's recorded
// timeline: code edits, test runs and both sides of the transcript. Pure:
// events in, report out. The communication numbers always come from here;
// with ANTHROPIC_API_KEY set, Claude rewrites the rubric, hire signal and
// focus areas on top of them (see ./claude.ts).
import { APPROACH_WORDS, HINT_WORDS, compareComplexity, isQuestion, spokenComplexity } from "../interview/scripted";
import { fmtClock, transcript } from "../interview/timeline";
import type { SessionEvent } from "../interview/types";
import { PATTERN_BY_ID } from "../problems/patterns";
import type { Difficulty, Problem } from "../problems/types";
import { TARGET_MINUTES } from "../engine/rating";

export const RUBRIC = ["understanding", "approach", "correctness", "testing", "complexity", "communication"] as const;
export type RubricKey = (typeof RUBRIC)[number];

export const RUBRIC_INFO: Record<RubricKey, { label: string; help: string }> = {
  understanding: { label: "Problem understanding", help: "Clarified inputs, constraints and edge cases before solving." },
  approach: { label: "Approach and algorithm", help: "Found a sound approach, explained it before coding, and needed little help." },
  correctness: { label: "Code correctness and quality", help: "Working code that passes the full test suite." },
  testing: { label: "Testing and edge cases", help: "Ran tests along the way and reasoned about edge cases." },
  complexity: { label: "Complexity analysis", help: "Stated the time and space complexity, and it matched the optimal." },
  communication: { label: "Communication", help: "Kept talking through the work, including under pressure." },
};

/** Correctness and approach count most, as they do in real debriefs. */
const WEIGHTS: Record<RubricKey, number> = {
  understanding: 1,
  approach: 1.5,
  correctness: 1.5,
  testing: 1,
  complexity: 1,
  communication: 1,
};

export const HIRE_SIGNALS = ["strong-no", "no", "lean-hire", "hire", "strong-hire"] as const;
export type HireSignal = (typeof HIRE_SIGNALS)[number];

export const HIRE_LABELS: Record<HireSignal, string> = {
  "strong-no": "Strong no",
  no: "No hire",
  "lean-hire": "Lean hire",
  hire: "Hire",
  "strong-hire": "Strong hire",
};

/** A silence longer than this counts as a silent stretch. */
export const SILENCE_MS = 45_000;
/** Seconds of speech assumed per word when an utterance has no start time. */
const SECONDS_PER_WORD = 0.4;

const FILLERS: [string, RegExp][] = [
  ["um", /\bu+m+\b/g],
  ["uh", /\bu+h+\b/g],
  ["er", /\ber+m*\b/g],
  ["hmm", /\bhm+\b/g],
  ["like", /\blike,/g],
  ["you know", /\byou know\b/g],
  ["I mean", /\bi mean\b/g],
  ["basically", /\bbasically\b/g],
  ["kind of", /\bkind of\b/g],
  ["sort of", /\bsort of\b/g],
  ["literally", /\bliterally\b/g],
];

const EDGE_CASES: [string, RegExp][] = [
  ["empty input", /\bempty\b|\bno elements\b|\bzero[- ]length\b/],
  ["single element", /\bsingle\b|\bone element\b|\bjust one\b|\blength (of )?one\b/],
  ["duplicates", /\bduplicate|\brepeated\b|\bsame value/],
  ["negative numbers", /\bnegative/],
  ["large input", /\boverflow\b|\blarge (input|numbers?|values?)\b|\bmillion|\bbillion/],
  ["null or missing", /\bnull\b|\bnone\b|\bundefined\b|\bmissing\b/],
  ["sorted or unsorted", /\bsorted\b|\bunsorted\b/],
  ["bounds", /\bbound(s|ary|aries)\b|\boff[- ]by[- ]one\b|\bedge case/],
];

export interface SilentStretch {
  fromMs: number;
  ms: number;
  /** The candidate was editing code during the silence. */
  coding: boolean;
  /** The silence started right after a failed test run. */
  afterFailedRun: boolean;
}

export interface CommunicationMetrics {
  /** When the candidate first asked a question. */
  firstQuestionMs: number | null;
  questionsBeforeCoding: number;
  firstCodeMs: number | null;
  /** Explained an approach before typing code. */
  approachBeforeCoding: boolean;
  approachStatedMs: number | null;
  silentStretches: SilentStretch[];
  longestSilenceMs: number;
  fillerCount: number;
  fillersPer100Words: number;
  topFillers: { word: string; count: number }[];
  /** Words per minute of speaking time; null when nothing was spoken aloud. */
  wordsPerMinute: number | null;
  /** Talked within a minute after most failed runs; null when no run failed. */
  narratedDebugging: boolean | null;
  candidateWords: number;
  /** Share of all words spoken by the candidate. */
  talkShare: number;
  complexityStated: string | null;
  /** -1 better than optimal (suspicious), 0 matches, 1 worse, null unknown. */
  complexityVerdict: -1 | 0 | 1 | null;
  edgeCasesMentioned: string[];
  hintRequests: number;
  /** Whether any transcript came from speech (fillers and pace only mean something then). */
  spoken: boolean;
}

export interface Moment {
  t: number;
  tone: "good" | "warn" | "info";
  text: string;
}

export interface RubricScore {
  /** 1 (well below the bar) to 4 (strong). */
  score: number;
  evidence: string;
}

export interface FocusArea {
  area: RubricKey;
  title: string;
  why: string;
  drill: string;
}

export interface Outcome {
  accepted: boolean;
  acceptedMs: number | null;
  /** Best result of a full-suite run, or the last run when there was no full run. */
  passed: number;
  total: number;
  runs: number;
  failedSubmits: number;
  durationMs: number;
}

export interface FeedbackReport {
  version: 1;
  generator: "claude" | "heuristic";
  summary: string;
  rubric: Record<RubricKey, RubricScore>;
  /** Weighted average of the rubric, 1–4. */
  overall: number;
  hire: { signal: HireSignal; reasons: string[]; bar: string };
  communication: CommunicationMetrics;
  outcome: Outcome;
  moments: Moment[];
  focus: FocusArea[];
  /**
   * Where the interview actually began (the Start press) on the recording's
   * clock. Every time in the report counts from there; add this to jump the replay.
   */
  startOffsetMs?: number;
}

/** Shifts a recording so time zero is the Start press, dropping the setup time before it. */
export function fromStart(events: SessionEvent[], durationMs: number): { events: SessionEvent[]; durationMs: number; offset: number } {
  const offset = events.find((e) => e.type === "marker" && e.payload.what === "start")?.t ?? 0;
  if (!offset) return { events, durationMs, offset: 0 };
  const shift = (t: number) => Math.max(0, t - offset);
  return {
    offset,
    durationMs: shift(durationMs),
    events: events.map((e) =>
      e.type === "transcript" && e.payload.startT !== undefined
        ? { ...e, t: shift(e.t), payload: { ...e.payload, startT: shift(e.payload.startT) } }
        : { ...e, t: shift(e.t) },
    ),
  };
}

export interface AnalyzeInput {
  events: SessionEvent[];
  problem: Pick<Problem, "title" | "pattern" | "difficulty" | "complexity">;
  durationMs: number;
  /** Target company id, for the hire bar. */
  company: string | null;
  /** Candidate level from goals: new-grad, mid, senior, staff. */
  level: string;
}

type RunEvent = Extract<SessionEvent, { type: "run" }>;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function communicationMetrics(events: SessionEvent[], problem: AnalyzeInput["problem"], durationMs: number): CommunicationMetrics {
  const lines = transcript(events);
  const cand = events.filter(
    (e): e is Extract<SessionEvent, { type: "transcript" }> => e.type === "transcript" && e.payload.speaker === "candidate",
  );
  const edits = events.filter((e) => e.type === "edit");
  const runs = events.filter((e): e is RunEvent => e.type === "run");
  const firstCodeMs = edits[0]?.t ?? null;
  const beforeCoding = cand.filter((c) => firstCodeMs === null || c.t <= firstCodeMs);

  const questions = cand.filter((c) => isQuestion(c.payload.text));
  const approach = beforeCoding.find((c) => APPROACH_WORDS.test(c.payload.text.toLowerCase()) && words(c.payload.text) >= 8);
  const wordsBeforeCoding = beforeCoding.reduce((n, c) => n + words(c.payload.text), 0);

  // Speaking intervals, then the gaps between them from the first utterance to the end.
  const intervals = cand.map((c) => {
    const est = c.t - words(c.payload.text) * SECONDS_PER_WORD * 1000;
    return { from: Math.max(0, c.payload.startT ?? est), to: c.t };
  });
  const silences: SilentStretch[] = [];
  const failed = runs.filter((r) => r.payload.verdict !== "accepted");
  if (intervals.length) {
    const ends = [...intervals.map((i) => i.to), durationMs];
    for (let i = 0; i < ends.length - 1; i++) {
      const from = ends[i];
      const to = i + 1 < intervals.length ? intervals[i + 1].from : durationMs;
      const ms = to - from;
      if (ms < SILENCE_MS) continue;
      silences.push({
        fromMs: from,
        ms,
        coding: edits.some((e) => e.t > from && e.t < to),
        afterFailedRun: failed.some((r) => r.t >= from - 5_000 && r.t <= from + 20_000) || failed.some((r) => r.t > from && r.t < to - SILENCE_MS),
      });
    }
  }

  const text = cand.map((c) => c.payload.text.toLowerCase()).join(" \n ");
  const fillerCounts = FILLERS.map(([word, re]) => ({ word, count: (text.match(re) ?? []).length })).filter((f) => f.count > 0);
  const fillerCount = fillerCounts.reduce((n, f) => n + f.count, 0);
  const candidateWords = cand.reduce((n, c) => n + words(c.payload.text), 0);
  const allWords = lines.reduce((n, l) => n + words(l.text), 0);

  const spokenLines = cand.filter((c) => c.payload.source !== "typed");
  const timed = spokenLines.filter((c) => c.payload.startT !== undefined && c.t > c.payload.startT);
  const speakingMs = timed.reduce((n, c) => n + (c.t - (c.payload.startT as number)), 0);
  const wordsPerMinute = speakingMs >= 10_000 ? Math.round(timed.reduce((n, c) => n + words(c.payload.text), 0) / (speakingMs / 60_000)) : null;

  // Narration while debugging: did the candidate say something within a minute after a failed run?
  let narratedDebugging: boolean | null = null;
  if (failed.length) {
    const narrated = failed.filter((r) => cand.some((c) => c.t > r.t && c.t <= r.t + 60_000 && words(c.payload.text) >= 4)).length;
    narratedDebugging = narrated / failed.length >= 0.5;
  }

  let complexityStated: string | null = null;
  for (const c of cand) {
    const said = spokenComplexity(c.payload.text);
    if (said) complexityStated = said;
  }

  return {
    firstQuestionMs: questions[0]?.t ?? null,
    questionsBeforeCoding: questions.filter((q) => firstCodeMs === null || q.t <= firstCodeMs).length,
    firstCodeMs,
    approachBeforeCoding: !!approach || wordsBeforeCoding >= 40,
    approachStatedMs: approach?.t ?? null,
    silentStretches: silences,
    longestSilenceMs: silences.reduce((m, s) => Math.max(m, s.ms), 0),
    fillerCount,
    fillersPer100Words: candidateWords ? Math.round((fillerCount / candidateWords) * 1000) / 10 : 0,
    topFillers: fillerCounts.sort((a, b) => b.count - a.count).slice(0, 3),
    wordsPerMinute,
    narratedDebugging,
    candidateWords,
    talkShare: allWords ? Math.round((candidateWords / allWords) * 100) / 100 : 0,
    complexityStated,
    complexityVerdict: complexityStated ? compareComplexity(complexityStated, problem.complexity.time) : null,
    edgeCasesMentioned: EDGE_CASES.filter(([, re]) => re.test(text)).map(([name]) => name),
    hintRequests: cand.filter((c) => HINT_WORDS.test(c.payload.text.toLowerCase())).length,
    spoken: spokenLines.length > 0,
  };
}

export function outcomeOf(events: SessionEvent[], durationMs: number): Outcome {
  const runs = events.filter((e): e is RunEvent => e.type === "run");
  const full = runs.filter((r) => r.payload.scope === "all");
  const accepted = full.find((r) => r.payload.verdict === "accepted");
  const best = [...full].sort((a, b) => b.payload.passed / (b.payload.total || 1) - a.payload.passed / (a.payload.total || 1))[0] ?? runs.at(-1);
  return {
    accepted: !!accepted,
    acceptedMs: accepted?.t ?? null,
    passed: best?.payload.passed ?? 0,
    total: best?.payload.total ?? 0,
    runs: runs.length,
    failedSubmits: full.filter((r) => r.payload.verdict !== "accepted").length,
    durationMs,
  };
}

function scoreRubric(m: CommunicationMetrics, o: Outcome, events: SessionEvent[], difficulty: Difficulty, optimal: string): Record<RubricKey, RubricScore> {
  const sampleRunsBeforeSubmit = (() => {
    const runs = events.filter((e): e is RunEvent => e.type === "run");
    const firstSubmit = runs.findIndex((r) => r.payload.scope === "all");
    return (firstSubmit === -1 ? runs : runs.slice(0, firstSubmit)).filter((r) => r.payload.scope === "sample").length;
  })();
  const targetMs = TARGET_MINUTES[difficulty] * 60_000;

  // Understanding
  let understanding: RubricScore;
  if (m.questionsBeforeCoding >= 2) understanding = { score: 4, evidence: `Asked ${m.questionsBeforeCoding} clarifying questions before coding.` };
  else if (m.questionsBeforeCoding === 1) understanding = { score: 3, evidence: "Asked one clarifying question before coding; one or two more (input size, empty input, duplicates) would be stronger." };
  else if (m.firstQuestionMs !== null) understanding = { score: 2, evidence: `First question came at ${fmtClock(m.firstQuestionMs)}, after coding had started.` };
  else understanding = { score: 1, evidence: "Never asked a clarifying question." };

  // Approach
  let approach = m.approachBeforeCoding ? 3 : 2;
  const approachNotes: string[] = [m.approachBeforeCoding ? "Explained an approach before coding." : "Started coding without first explaining the approach."];
  if (o.accepted && o.acceptedMs !== null && o.acceptedMs <= targetMs && m.complexityVerdict !== 1) {
    approach += 1;
    approachNotes.push(`Reached a working solution in ${fmtClock(o.acceptedMs)}, inside the ${TARGET_MINUTES[difficulty]}-minute target.`);
  }
  if (m.complexityVerdict === 1) {
    approach = Math.min(approach, 2);
    approachNotes.push(`The approach ran in ${m.complexityStated}, slower than the optimal ${optimal}.`);
  }
  if (!o.accepted && !m.approachBeforeCoding) approach = 1;
  if (m.hintRequests >= 2) {
    approach -= 1;
    approachNotes.push(`Asked for help ${plural(m.hintRequests, "time")}.`);
  }

  // Correctness
  let correctness: RubricScore;
  const frac = o.total ? o.passed / o.total : 0;
  if (o.accepted) {
    correctness =
      o.failedSubmits <= 1
        ? { score: 4, evidence: `Passed the full suite${o.failedSubmits ? " after one failed submit" : " on the first submit"}.` }
        : { score: 3, evidence: `Passed the full suite after ${o.failedSubmits} failed submits.` };
  } else if (o.runs === 0) correctness = { score: 1, evidence: "The code was never run, so it ended unverified." };
  else if (frac >= 0.7) correctness = { score: 2, evidence: `Best run passed ${o.passed} of ${o.total} tests; not all cases were handled.` };
  else correctness = { score: 1, evidence: `Best run passed ${o.passed} of ${o.total} tests.` };

  // Testing
  const testingPoints = (sampleRunsBeforeSubmit >= 1 ? 1 : 0) + (m.edgeCasesMentioned.length >= 1 ? 1 : 0) + (m.edgeCasesMentioned.length >= 2 ? 1 : 0);
  const testingEvidence = [
    sampleRunsBeforeSubmit ? `Ran the sample tests ${plural(sampleRunsBeforeSubmit, "time")} before submitting.` : "Submitted without running the sample tests first.",
    m.edgeCasesMentioned.length ? `Talked about edge cases: ${m.edgeCasesMentioned.join(", ")}.` : "Didn't talk through any edge cases.",
  ].join(" ");

  // Complexity
  let complexity: RubricScore;
  if (m.complexityStated === null) complexity = { score: 1, evidence: `Never stated the time complexity (optimal is ${optimal}).` };
  else if (m.complexityVerdict === 0) complexity = { score: 4, evidence: `Stated ${m.complexityStated}, which matches the optimal.` };
  else if (m.complexityVerdict === -1) complexity = { score: 2, evidence: `Stated ${m.complexityStated}, better than the optimal ${optimal}, so the analysis was likely off.` };
  else if (m.complexityVerdict === 1) complexity = { score: 2, evidence: `Stated ${m.complexityStated}; the optimal is ${optimal}.` };
  else complexity = { score: 3, evidence: `Stated ${m.complexityStated} (optimal is ${optimal}).` };

  // Communication
  let comm = 4;
  const commNotes: string[] = [];
  const codingSilence = m.silentStretches.filter((s) => s.coding).reduce((mx, s) => Math.max(mx, s.ms), 0);
  if (codingSilence >= 120_000) {
    comm -= 1;
    commNotes.push(`Went quiet for ${fmtClock(codingSilence)} while coding.`);
  }
  if (m.narratedDebugging === false) {
    comm -= 1;
    commNotes.push("Debugged in silence after failed runs.");
  }
  if (m.spoken && m.fillersPer100Words > 6) {
    comm -= 1;
    commNotes.push(`${m.fillersPer100Words} filler words per 100.`);
  }
  if (m.candidateWords < 60 && o.durationMs > 10 * 60_000) {
    comm -= 1;
    commNotes.push(`Said only ${m.candidateWords} words in ${fmtClock(o.durationMs)}.`);
  }
  if (!commNotes.length) commNotes.push("Kept talking through the problem, with no long silences.");

  return {
    understanding,
    approach: { score: clamp(approach, 1, 4), evidence: approachNotes.join(" ") },
    correctness,
    testing: { score: 1 + testingPoints, evidence: testingEvidence },
    complexity,
    communication: { score: clamp(comm, 1, 4), evidence: commNotes.join(" ") },
  };
}

export function weightedOverall(rubric: Record<RubricKey, RubricScore>): number {
  const total = RUBRIC.reduce((n, k) => n + WEIGHTS[k], 0);
  return Math.round((RUBRIC.reduce((n, k) => n + rubric[k].score * WEIGHTS[k], 0) / total) * 100) / 100;
}

const STRICT_COMPANIES = new Set(["google", "meta"]);
const LEVEL_SHIFT: Record<string, number> = { "new-grad": -0.15, mid: 0, senior: 0.2, staff: 0.3 };

/** How much higher than the default the hire bar sits for this company and level. */
export function barShift(company: string | null, level: string): number {
  return (company && STRICT_COMPANIES.has(company) ? 0.15 : company === "startup" ? -0.1 : 0) + (LEVEL_SHIFT[level] ?? 0);
}

export function describeBar(company: string | null, companyName: string | null, level: string): string {
  const levelName = { "new-grad": "new-grad", mid: "mid-level", senior: "senior", staff: "staff" }[level] ?? level;
  return `Calibrated for a ${levelName} loop${companyName ? ` at ${companyName}` : ""}.`;
}

/** Maps the weighted rubric to a hire signal; an unsolved problem caps it. */
export function hireSignal(overall: number, outcome: Outcome, shift: number): HireSignal {
  const o = overall - shift;
  let signal: HireSignal = o >= 3.6 ? "strong-hire" : o >= 3.1 ? "hire" : o >= 2.6 ? "lean-hire" : o >= 1.9 ? "no" : "strong-no";
  const frac = outcome.total ? outcome.passed / outcome.total : 0;
  const cap: HireSignal | null = outcome.accepted ? null : frac >= 0.5 ? "lean-hire" : "no";
  if (cap && HIRE_SIGNALS.indexOf(signal) > HIRE_SIGNALS.indexOf(cap)) signal = cap;
  return signal;
}

const DRILLS: Record<RubricKey, (ctx: { pattern: string; title: string; optimal: string }) => { title: string; drill: string }> = {
  understanding: () => ({
    title: "Clarify before you solve",
    drill: "Spend the first two or three minutes of every problem on questions: input size, empty or single-element input, duplicates, and what to return when there's no answer.",
  }),
  approach: (c) => ({
    title: `Strengthen ${c.pattern}`,
    drill: `Do two more ${c.pattern} problems this week, and before typing each one, say the approach and its complexity out loud in under a minute.`,
  }),
  correctness: (c) => ({
    title: "Get to working code",
    drill: `Re-solve ${c.title} from scratch against the clock. Write the simplest correct version first, run it, then optimize.`,
  }),
  testing: () => ({
    title: "Test like an interviewer",
    drill: "Before you submit, run the samples and walk one edge case through your code by hand, saying each variable's value as you go.",
  }),
  complexity: (c) => ({
    title: "State complexity every time",
    drill: `For your next five problems, state time and space complexity before you run the code, and say why (here the optimal was ${c.optimal}).`,
  }),
  communication: () => ({
    title: "Keep talking under pressure",
    drill: "When a test fails, narrate: what you expected, what you saw, and the next thing you'll check. Never let more than 30 seconds pass in silence.",
  }),
};

function focusAreas(rubric: Record<RubricKey, RubricScore>, problem: AnalyzeInput["problem"]): FocusArea[] {
  const ctx = { pattern: PATTERN_BY_ID[problem.pattern].name, title: problem.title, optimal: problem.complexity.time };
  return [...RUBRIC]
    .filter((k) => rubric[k].score <= 3)
    .sort((a, b) => rubric[a].score - rubric[b].score || WEIGHTS[b] - WEIGHTS[a])
    .slice(0, 3)
    .map((area) => ({ area, why: rubric[area].evidence, ...DRILLS[area](ctx) }));
}

function moments(m: CommunicationMetrics, events: SessionEvent[]): Moment[] {
  const out: Moment[] = [];
  if (m.firstQuestionMs !== null) out.push({ t: m.firstQuestionMs, tone: "good", text: "First clarifying question." });
  if (m.approachStatedMs !== null) out.push({ t: m.approachStatedMs, tone: "good", text: "Explained the approach before coding." });
  if (m.firstCodeMs !== null && !m.approachBeforeCoding) out.push({ t: m.firstCodeMs, tone: "warn", text: "Started coding before explaining an approach." });
  for (const r of events.filter((e): e is RunEvent => e.type === "run")) {
    if (r.payload.scope === "all" && r.payload.verdict === "accepted") out.push({ t: r.t, tone: "good", text: "All tests passed." });
    else if (r.payload.scope === "all")
      out.push({ t: r.t, tone: "warn", text: `Submit failed: ${r.payload.passed}/${r.payload.total}${r.payload.failingLabels.length ? ` (${r.payload.failingLabels.slice(0, 2).join(", ")})` : ""}.` });
  }
  for (const s of m.silentStretches) {
    if (s.afterFailedRun) out.push({ t: s.fromMs, tone: "warn", text: `Went silent for ${fmtClock(s.ms)} after a test failed.` });
    else if (s.ms >= 90_000) out.push({ t: s.fromMs, tone: "warn", text: `Silent for ${fmtClock(s.ms)}${s.coding ? " while coding" : ""}.` });
  }
  const said = events.find((e) => e.type === "transcript" && e.payload.speaker === "candidate" && spokenComplexity(e.payload.text));
  if (said) out.push({ t: said.t, tone: m.complexityVerdict === 0 ? "good" : "info", text: `Stated complexity: ${m.complexityStated}.` });
  return out.sort((a, b) => a.t - b.t);
}

function summaryLine(signal: HireSignal, rubric: Record<RubricKey, RubricScore>, o: Outcome): string {
  const best = [...RUBRIC].sort((a, b) => rubric[b].score - rubric[a].score || WEIGHTS[b] - WEIGHTS[a])[0];
  const worst = [...RUBRIC].sort((a, b) => rubric[a].score - rubric[b].score || WEIGHTS[b] - WEIGHTS[a])[0];
  const result = o.accepted ? "You solved it" : o.runs ? `You got ${o.passed} of ${o.total} tests passing` : "You didn't get to running code";
  if (rubric[worst].score >= 4) return `${result}, and every part of the rubric was strong: ${HIRE_LABELS[signal].toLowerCase()}.`;
  return `${result}. Strongest: ${RUBRIC_INFO[best].label.toLowerCase()}. Biggest gap: ${RUBRIC_INFO[worst].label.toLowerCase()}.`;
}

export function hireReasons(rubric: Record<RubricKey, RubricScore>, o: Outcome): string[] {
  const reasons: string[] = [];
  reasons.push(o.accepted ? "Reached a fully working solution." : "Didn't reach a fully working solution, which caps the signal.");
  const strong = RUBRIC.filter((k) => rubric[k].score >= 4).map((k) => RUBRIC_INFO[k].label.toLowerCase());
  const weak = RUBRIC.filter((k) => rubric[k].score <= 2).map((k) => RUBRIC_INFO[k].label.toLowerCase());
  if (strong.length) reasons.push(`Strong on ${strong.join(", ")}.`);
  if (weak.length) reasons.push(`Below the bar on ${weak.join(", ")}.`);
  return reasons;
}

/** The heuristic report: always available, no API key needed. */
export function analyzeSession(input: AnalyzeInput, companyName: string | null = null): FeedbackReport {
  const { events, problem, durationMs } = input;
  const communication = communicationMetrics(events, problem, durationMs);
  const outcome = outcomeOf(events, durationMs);
  const rubric = scoreRubric(communication, outcome, events, problem.difficulty, problem.complexity.time);
  const overall = weightedOverall(rubric);
  const signal = hireSignal(overall, outcome, barShift(input.company, input.level));
  return {
    version: 1,
    generator: "heuristic",
    summary: summaryLine(signal, rubric, outcome),
    rubric,
    overall,
    hire: { signal, reasons: hireReasons(rubric, outcome), bar: describeBar(input.company, companyName, input.level) },
    communication,
    outcome,
    moments: moments(communication, events),
    focus: focusAreas(rubric, problem),
  };
}

/**
 * Performance in [0, 1] for the skill update, from the rubric: mostly
 * correctness and approach, as in a real debrief.
 */
export function mockScore(report: FeedbackReport): number {
  return clamp((report.overall - 1) / 3, 0, 1) * (report.outcome.accepted ? 1 : 0.6);
}
