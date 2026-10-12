// Pure helpers over a session's event log: rebuild the code at any moment and
// summarize the latest state for the interviewer.
import type { Language } from "../runner/drivers";
import type { EditOp, RunPayload, SessionEvent, Speaker } from "./types";

/**
 * Applies one Monaco change event. The ops all refer to the text before the
 * change and don't overlap, so they are applied from the end backwards.
 */
export function applyOps(code: string, ops: EditOp[]): string {
  const sorted = [...ops].sort((a, b) => b.offset - a.offset);
  let out = code;
  for (const op of sorted) out = out.slice(0, op.offset) + op.text + out.slice(op.offset + op.length);
  return out;
}

/** The code at time `t`: the latest snapshot at or before `t`, with later edits applied. */
export function codeAt(events: SessionEvent[], t = Infinity): { code: string; language: Language | null } {
  const upTo = events.filter((e) => e.t <= t);
  let code = "";
  let language: Language | null = null;
  let start = 0;
  for (let i = upTo.length - 1; i >= 0; i--) {
    const e = upTo[i];
    if (e.type === "snapshot") {
      code = e.payload.code;
      language = e.payload.language;
      start = i + 1;
      break;
    }
  }
  for (const e of upTo.slice(start)) if (e.type === "edit") code = applyOps(code, e.payload.ops);
  return { code, language };
}

/** When the candidate pressed Start (the first start marker), or null before that. */
export function interviewStartT(events: SessionEvent[]): number | null {
  return events.find((e) => e.type === "marker" && e.payload.what === "start")?.t ?? null;
}

export interface Line {
  speaker: Speaker;
  text: string;
  t: number;
}

export function transcript(events: SessionEvent[]): Line[] {
  return events.flatMap((e) => (e.type === "transcript" ? [{ speaker: e.payload.speaker, text: e.payload.text, t: e.t }] : []));
}

export function lastRun(events: SessionEvent[]): (RunPayload & { t: number }) | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "run") return { ...e.payload, t: e.t };
  }
  return null;
}

/** Everything an interviewer turn needs to know about the moment. */
export interface TurnContext {
  elapsedMs: number;
  remainingMs: number;
  code: string;
  language: Language | null;
  /** True when the code differs from the starter template. */
  hasCode: boolean;
  lastRun: (RunPayload & { t: number }) | null;
  runs: number;
  everAccepted: boolean;
  lines: Line[];
  /** Milliseconds since the candidate last spoke, counting from the Start press at most. */
  sinceCandidateSpokeMs: number;
  /** Milliseconds since the code last changed, counting from the Start press at most. */
  sinceCodeChangedMs: number;
}

/** `now` is on the recording's clock; the interview's own clock starts at the Start press. */
export function turnContext(events: SessionEvent[], opts: { now: number; totalMs: number; starter: string }): TurnContext {
  const { code, language } = codeAt(events);
  const lines = transcript(events);
  const runs = events.filter((e) => e.type === "run");
  const lastCandidate = [...lines].reverse().find((l) => l.speaker === "candidate");
  const lastEdit = [...events].reverse().find((e) => e.type === "edit");
  const norm = (s: string) => s.replace(/\s+/g, "");
  // No start marker yet (it may still be in the browser's send queue) means the clock hasn't started.
  const startT = interviewStartT(events) ?? opts.now;
  const elapsedMs = Math.max(0, opts.now - startT);
  return {
    elapsedMs,
    remainingMs: Math.max(0, opts.totalMs - elapsedMs),
    code,
    language,
    hasCode: code.length > 0 && norm(code) !== norm(opts.starter),
    lastRun: lastRun(events),
    runs: runs.length,
    everAccepted: runs.some((e) => e.type === "run" && e.payload.scope === "all" && e.payload.verdict === "accepted"),
    lines,
    sinceCandidateSpokeMs: opts.now - Math.max(lastCandidate?.t ?? 0, startT),
    sinceCodeChangedMs: opts.now - Math.max(lastEdit?.t ?? 0, startT),
  };
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface SessionStats {
  candidateTurns: number;
  interviewerTurns: number;
  candidateWords: number;
  runs: number;
  failedRuns: number;
  firstRunMs: number | null;
  acceptedMs: number | null;
  /** When the candidate first spoke, a proxy for time to the first clarifying question. */
  firstSpokeMs: number | null;
  /** The longest stretch without the candidate saying anything, after they first spoke. */
  longestSilence: { fromMs: number; ms: number } | null;
  edits: number;
}

/** Simple numbers from the timeline; the full feedback report (spec 4.4) builds on these. */
export function sessionStats(events: SessionEvent[], durationMs: number): SessionStats {
  const lines = transcript(events);
  const cand = lines.filter((l) => l.speaker === "candidate");
  const runs = events.filter((e): e is Extract<SessionEvent, { type: "run" }> => e.type === "run");
  const accepted = runs.find((r) => r.payload.scope === "all" && r.payload.verdict === "accepted");
  let longest: SessionStats["longestSilence"] = null;
  const times = [...cand.map((l) => l.t), durationMs];
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (!longest || gap > longest.ms) longest = { fromMs: times[i - 1], ms: gap };
  }
  return {
    candidateTurns: cand.length,
    interviewerTurns: lines.length - cand.length,
    candidateWords: cand.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0),
    runs: runs.length,
    failedRuns: runs.filter((r) => r.payload.verdict !== "accepted").length,
    firstRunMs: runs[0]?.t ?? null,
    acceptedMs: accepted?.t ?? null,
    firstSpokeMs: cand[0]?.t ?? null,
    longestSilence: cand.length ? longest : null,
    edits: events.filter((e) => e.type === "edit").length,
  };
}
