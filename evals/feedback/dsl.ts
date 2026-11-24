// A tiny language for writing simulated mock interviews as readable scripts
// instead of raw timeline events. Each step is "at N seconds, this happened";
// `build` turns the script into the same SessionEvent[] a real recording has.

import type { HireSignal, RubricKey } from "../../src/lib/feedback/analyze";
import type { SessionEvent } from "../../src/lib/interview/types";
import { PROBLEM_BY_SLUG } from "../../src/lib/problems";
import type { Problem } from "../../src/lib/problems/types";
import { starterCode } from "../../src/lib/runner/drivers";

export type Polarity = "strength" | "weakness";

/** One "correct feedback" point: what a calibrated human interviewer would tell the candidate. */
export type Label = [Polarity, string];

export type Step =
  | { at: number; say: string; typed?: boolean }
  | { at: number; ask: string }
  | { at: number; code: string }
  | { at: number; run: "sample" | "all"; pass: number; of: number; failing?: string[] };

export interface Scenario {
  id: string;
  /** What kind of interview this simulates, in a few words. */
  title: string;
  problem: string;
  level: "new-grad" | "mid" | "senior" | "staff";
  company: string | null;
  /** When the interview ended, in minutes. */
  endMin: number;
  steps: Step[];
  /**
   * DRAFT labels. Rubric areas left out are "meets the bar, nothing worth
   * saying". Written from the script as a human interviewer would judge it,
   * not from any grader's output. Every one needs a human review.
   */
  labels: Partial<Record<RubricKey, Label>>;
  /** Hire signals a calibrated interviewer could reasonably give. */
  hire: HireSignal[];
  reviewed: false;
}

export interface BuiltSession {
  scenario: Scenario;
  problem: Problem;
  events: SessionEvent[];
  durationMs: number;
}

// Shorthands so the scenario file reads like a script.
export const say = (at: number, text: string): Step => ({ at, say: text });
export const typed = (at: number, text: string): Step => ({ at, say: text, typed: true });
export const ask = (at: number, text: string): Step => ({ at, ask: text });
export const code = (at: number, text: string): Step => ({ at, code: text });
export const run = (at: number, scope: "sample" | "all", pass: number, of: number, failing: string[] = []): Step => ({
  at,
  run: scope,
  pass,
  of,
  failing,
});

/** About 2.5 spoken words a second, so speech has a start as real STT segments do. */
const speakingMs = (text: string) => Math.max(1000, Math.round(text.split(/\s+/).length * 400));

export function build(s: Scenario): BuiltSession {
  const problem = PROBLEM_BY_SLUG.get(s.problem);
  if (!problem) throw new Error(`${s.id}: unknown problem ${s.problem}`);
  let codeText = starterCode(problem.signature, "python");
  const events: SessionEvent[] = [
    { type: "snapshot", t: 0, payload: { code: codeText, language: "python" } },
    { type: "marker", t: 0, payload: { what: "start" } },
  ];
  const steps = [...s.steps].sort((a, b) => a.at - b.at);
  for (const step of steps) {
    const t = Math.round(step.at * 1000);
    if ("say" in step) {
      events.push({
        type: "transcript",
        t,
        payload: {
          speaker: "candidate",
          text: step.say,
          source: step.typed ? "typed" : "browser-stt",
          ...(step.typed ? {} : { startT: Math.max(0, t - speakingMs(step.say)) }),
        },
      });
    } else if ("ask" in step) {
      events.push({ type: "transcript", t, payload: { speaker: "interviewer", text: step.ask, source: "interviewer" } });
    } else if ("code" in step) {
      const text = `\n${step.code}`;
      events.push({ type: "edit", t, payload: { ops: [{ offset: codeText.length, length: 0, text }] } });
      codeText += text;
    } else {
      events.push({ type: "snapshot", t, payload: { code: codeText, language: "python" } });
      events.push({
        type: "run",
        t,
        payload: {
          scope: step.run,
          verdict: step.pass === step.of ? "accepted" : "wrong_answer",
          passed: step.pass,
          total: step.of,
          failingLabels: step.failing ?? [],
        },
      });
    }
  }
  const durationMs = s.endMin * 60_000;
  events.push({ type: "marker", t: durationMs, payload: { what: "end" } });
  return { scenario: s, problem, events, durationMs };
}
