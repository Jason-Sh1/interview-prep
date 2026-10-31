// The no-key behavioral interviewer: asks the round's questions in order,
// probes one or two STAR gaps in each answer ("what did you personally do?",
// "what was the outcome?"), keeps to the clock, then asks if the candidate has
// questions and closes. Pure and deterministic.
import { candidateTurns, pick, wordCount } from "../rounds/analyze";
import type { ScriptContext, ScriptReply } from "../rounds/kind";
import { ROUND_SILENT, type RoundConfig } from "../rounds/types";
import type { BehavioralArtifact } from "./artifact";
import { QUESTION_BY_ID, type BehavioralQuestion } from "./questions";
import { analyzeAnswer, type StarGap } from "./star";

export type ProbeKind = "situation" | "personal" | "outcome" | "metric" | "reflect" | "specific";

export const PROBES: Record<Exclude<ProbeKind, "specific">, string[]> = {
  situation: [
    "Tell me more about the situation. Where were you, and what was at stake?",
    "Can you give me a bit more context first? What was going on, and why did it matter?",
  ],
  personal: ["What did you personally do? Walk me through your own steps.", "You said \"we\" a lot there. What was your part, specifically?"],
  outcome: ["What was the outcome?", "How did it end up? What changed because of what you did?"],
  metric: ["Can you put a number on the result? How much, how fast, or how many people?", "How did you measure whether it worked?"],
  reflect: ["Looking back, what would you do differently?", "What did you take away from that?"],
};

/** Which probe covers which STAR gap, in the order an interviewer would ask. */
const GAP_PROBE: Partial<Record<StarGap, Exclude<ProbeKind, "specific">>> = {
  detail: "situation",
  action: "personal",
  ownership: "personal",
  result: "outcome",
  metric: "metric",
  situation: "situation",
  reflection: "reflect",
};

export const YOUR_QUESTIONS = "That's all the questions I have. Do you have any questions for me?";
/** Minutes kept at the end for the candidate's questions. */
const CLOSE_MS = 3 * 60_000;

export interface BehavioralScriptState {
  phase: "questions" | "your-questions" | "closed";
  /** Index into the artifact's questionIds. */
  q: number;
  /** Probes asked for the current question. */
  probes: ProbeKind[];
  /** Candidate turns before the current question was asked. */
  answerFrom: number;
  nudged: boolean;
  turns: number;
}

export const INITIAL_BEHAVIORAL_STATE: BehavioralScriptState = { phase: "questions", q: 0, probes: [], answerFrom: 0, nudged: false, turns: 0 };

const ACKS: Record<RoundConfig["persona"], string[]> = {
  friendly: ["Thanks, that's helpful.", "Great, thank you.", "I appreciate the detail.", "Thanks for walking me through that."],
  neutral: ["Okay, thanks.", "Got it.", "Alright.", "Thank you."],
  terse: ["Okay.", "Noted.", "Fine.", "Mm."],
};
const NEXT = ["Next question.", "Let's move on.", "Switching gears a bit.", "Here's another one."];

const isClarifying = (s: string) => wordCount(s) <= 25 && (/\?\s*$/.test(s.trim()) || /^(can|could|should|does|do|is|would|what kind|any)\b/i.test(s.trim()));
const NO_QUESTIONS = /\b(no|nope|none|not really|i'?m good|that'?s all|nothing)\b/i;

export function questionsOf(a: BehavioralArtifact): BehavioralQuestion[] {
  return a.questionIds.flatMap((id) => (QUESTION_BY_ID.has(id) ? [QUESTION_BY_ID.get(id)!] : []));
}

/** How many probes the clock allows for question `q` right now. */
function probeBudget(q: number, n: number, elapsedMs: number, totalMs: number): number {
  const per = Math.max(60_000, (totalMs - CLOSE_MS - 60_000) / Math.max(1, n));
  const due = 60_000 + (q + 1) * per;
  if (elapsedMs > due) return 0;
  if (elapsedMs > due - per * 0.3) return 1;
  return 2;
}

/** The probe for the most important STAR gap not yet asked, if any. */
export function nextProbe(answer: string, question: BehavioralQuestion, asked: ProbeKind[]): Exclude<ProbeKind, "specific"> | null {
  const a = analyzeAnswer(answer, question.competencies);
  for (const gap of a.gaps) {
    const kind = GAP_PROBE[gap];
    if (!kind || asked.includes(kind)) continue;
    // One question about the result is enough: don't follow "outcome" with "metric".
    if (kind === "metric" && asked.includes("outcome")) continue;
    return kind;
  }
  return null;
}

export function behavioralScripted(ctx: ScriptContext<BehavioralArtifact>): ScriptReply {
  const s: BehavioralScriptState = { ...INITIAL_BEHAVIORAL_STATE, ...(ctx.state as Partial<BehavioralScriptState>) };
  s.probes = [...s.probes];
  s.turns++;
  const done = (text: string): ScriptReply => ({ text, state: s as unknown as Record<string, unknown> });
  const questions = questionsOf(ctx.artifact);
  const persona = ctx.config.persona;
  const ack = () => pick(ACKS[persona], s.turns);
  const totalMs = ctx.elapsedMs + ctx.remainingMs;
  const mine = candidateTurns(ctx.transcript);

  const ask = (i: number, lead: string): ScriptReply => {
    s.q = i;
    s.probes = [];
    s.nudged = false;
    s.answerFrom = mine.length;
    return done(`${lead} ${questions[i].text}`.trim());
  };
  const toYourQuestions = (lead: string): ScriptReply => {
    s.phase = "your-questions";
    return done(`${lead} ${YOUR_QUESTIONS}`.trim());
  };

  if (ctx.input.kind === "start") {
    if (!questions.length) {
      s.phase = "your-questions";
      return done("Hi. There are no questions set for this round. Press End to finish.");
    }
    const hello =
      persona === "friendly"
        ? "Hi, thanks for making the time! This is a behavioral round."
        : persona === "terse"
          ? "Hi. Behavioral round."
          : "Hi, thanks for joining. This is a behavioral round.";
    const frame = `I'll ask about ${questions.length} situations from your past work${ctx.companyName ? `, the way ${ctx.companyName} interviewers do` : ""}. Use specific examples, and tell me what you did yourself.`;
    return ask(0, `${hello} ${frame} To start:`);
  }
  if (s.phase === "closed") return done(ctx.input.kind === "say" ? "We're out of time. Press End to get your written report." : ROUND_SILENT);
  if (ctx.input.kind === "wrap") {
    if (s.phase !== "questions") return done(ROUND_SILENT);
    return toYourQuestions("We're nearly out of time, so let's stop there.");
  }
  if (ctx.input.kind === "silence") {
    if (s.nudged || s.phase !== "questions") return done(ROUND_SILENT);
    s.nudged = true;
    const answered = mine.length > s.answerFrom;
    return done(
      answered
        ? "Take your time. Is there anything you'd add, or shall we move on?"
        : "Take a moment if you need to. Any example works: work, school, or a side project. It's fine to think out loud.",
    );
  }

  const text = ctx.input.text;
  if (s.phase === "your-questions") {
    s.phase = "closed";
    const asked = /\?/.test(text) || /\b(what|how|curious|wondering|ask)\b/i.test(text);
    if (asked && !(NO_QUESTIONS.test(text) && !/\?/.test(text)))
      return done("Good question. In a real loop I'd tell you about the team and how we work; here, your report covers how this went. Thanks for your time, that's the end of the round. Press End to get your written report.");
    return done("No problem. Thanks for your time, that's the end of the round. Press End to get your written report.");
  }

  const question = questions[s.q];
  if (!question) return toYourQuestions(ack());

  // A short clarifying question about the question itself.
  if (isClarifying(text) && mine.length - s.answerFrom <= 1)
    return done("Any example works: from work, school, or a side project. Pick one where you personally made a difference, and walk me through it.");

  const answer = mine.slice(s.answerFrom).map((t) => t.text).join(" ");
  const budget = probeBudget(s.q, questions.length, ctx.elapsedMs, totalMs);
  if (s.probes.length < budget) {
    const probe = nextProbe(answer, question, s.probes);
    if (probe) {
      s.probes.push(probe);
      return done(pick(PROBES[probe], s.turns + s.q));
    }
    // A complete answer still gets one question-specific follow-up when there's time.
    if (!s.probes.length && question.probes.length) {
      s.probes.push("specific");
      return done(`${ack()} ${pick(question.probes, s.q)}`);
    }
  }

  const next = s.q + 1;
  if (next >= questions.length) return toYourQuestions(ack());
  if (ctx.remainingMs < CLOSE_MS + 60_000) return toYourQuestions(`${ack()} We're running short on time.`);
  return ask(next, `${ack()} ${pick(NEXT, s.turns)}`);
}
