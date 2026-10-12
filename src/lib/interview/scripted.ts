// The scripted interviewer: the no-key fallback when ANTHROPIC_API_KEY is not
// set, and the backup if a Claude call fails. It walks the usual interview
// arc (clarify, approach, code, complexity, follow-up, wrap) with simple
// keyword and code checks. Pure: state in, reply and new state out.
import type { Problem } from "../problems/types";
import type { TurnContext } from "./timeline";
import { SILENT, type MockConfig, type Persona, type TurnKind } from "./types";

export type Phase = "clarify" | "approach" | "coding" | "complexity" | "followup" | "wrap" | "done";

export interface ScriptState {
  phase: Phase;
  hintsGiven: number;
  /** One-off probes already used, so they aren't repeated. */
  asked: string[];
  questions: number;
  complexityTries: number;
  acks: number;
  lastNudgeMs: number | null;
}

export const INITIAL_SCRIPT_STATE: ScriptState = {
  phase: "clarify",
  hintsGiven: 0,
  asked: [],
  questions: 0,
  complexityTries: 0,
  acks: 0,
  lastNudgeMs: null,
};

export interface ScriptInput {
  kind: TurnKind;
  text?: string;
  ctx: TurnContext;
  problem: Pick<Problem, "slug" | "title" | "statement" | "constraints" | "hints" | "complexity" | "tests">;
  config: MockConfig;
  companyName?: string | null;
}

const NUDGE_GAP_MS = 90_000;

function pick(persona: Persona, lines: Record<Persona, string>): string {
  return lines[persona];
}

/** Strips Markdown so a hint reads naturally out loud. */
export function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SPOKEN: [RegExp, string][] = [
  [/\bn\s*log\s*n\b|\bn\s*log\s*of\s*n\b|\blinearithmic\b/, "O(nlogn)"],
  [/\blog\s*(of\s*)?n\b|\blogarithmic\b/, "O(logn)"],
  [/\bn\s*(squared|\^\s*2|2)\b|\bquadratic\b/, "O(n^2)"],
  [/\bn\s*(cubed|\^\s*3)\b|\bcubic\b/, "O(n^3)"],
  [/\b2\s*\^\s*n\b|\btwo to the n\b|\bexponential\b/, "O(2^n)"],
  [/\bn\s*factorial\b|\bn!/, "O(n!)"],
  [/\bm\s*(times|\*|·|by)?\s*n\b/, "O(mn)"],
  [/\bv\s*\+\s*e\b|\bv\s*plus\s*e\b/, "O(v+e)"],
  [/\bconstant\b|\bo\s*\(?\s*1\s*\)?/, "O(1)"],
  [/\blinear\b|\bo\s*\(?\s*n\s*\)?(?!\s*(log|\^|squared|cubed|factorial|!))/, "O(n)"],
];

/** Normalizes a written complexity like "O(n log n)" or "O(m·n)" for comparison. */
export function normComplexity(s: string): string {
  return s.toLowerCase().replace(/\s+|·|\*/g, "").replace(/^o/, "O");
}

/**
 * Finds a time complexity in what the candidate said, whether written
 * ("O(n log n)") or spoken ("n log n", "linear", "o of n squared").
 */
export function spokenComplexity(text: string): string | null {
  const t = text.toLowerCase().replace(/big[\s-]*o/g, "o").replace(/\bo of\b/g, "o");
  const written = t.match(/o\s*\(([^)]+)\)/);
  if (written) {
    const inner = written[1].replace(/\s+|·|\*/g, "");
    if (inner === "n2" || inner === "n²") return "O(n^2)";
    return `O(${inner})`;
  }
  for (const [re, val] of SPOKEN) if (re.test(t)) return val;
  return null;
}

const ORDER = ["O(1)", "O(logn)", "O(n)", "O(nlogn)", "O(n^2)", "O(n^3)", "O(2^n)", "O(n!)"];

/** -1 better than optimal, 0 matches, 1 worse, null when not comparable. */
export function compareComplexity(said: string, optimal: string): -1 | 0 | 1 | null {
  const a = normComplexity(said);
  const b = normComplexity(optimal);
  if (a === b) return 0;
  const ia = ORDER.indexOf(a);
  const ib = ORDER.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  return ia < ib ? -1 : 1;
}

const QUESTION_START = /^(can|could|do|does|is|are|should|will|would|what|how|which|when|where|may|am i)\b/;
export const APPROACH_WORDS =
  /\b(hash ?(map|set|table)|dictionary|set|sort|two pointers?|pointer|sliding window|window|stack|queue|heap|priority queue|binary search|bfs|dfs|breadth|depth|recurs\w*|memo\w*|dynamic programming|dp|greedy|graph|tree|trie|union find|iterate|loop|brute force|my approach|i would|i'd|i will|i'll|the idea)\b/;
export const HINT_WORDS = /\b(hint|i'?m stuck|i am stuck|no idea|not sure how|don'?t know how|help me)\b/;

export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.endsWith("?") || QUESTION_START.test(t);
}

/** Answers a clarifying question from the statement, constraints and test labels. */
export function answerClarifying(text: string, problem: ScriptInput["problem"]): string {
  const t = text.toLowerCase();
  const labels = problem.tests.map((x) => x.label?.toLowerCase() ?? "").join(" | ");
  const statement = problem.statement.toLowerCase();
  if (/\bempty\b|\bno elements\b|\bzero length\b/.test(t)) {
    return /empty/.test(labels) ? "Yes, the input can be empty, so handle that." : "You can assume it isn't empty unless the constraints say otherwise.";
  }
  if (/\bnegative\b/.test(t)) {
    return problem.constraints.some((c) => /-\s*\d/.test(c)) ? "Yes, values can be negative." : "Check the constraints; I wouldn't assume negatives.";
  }
  if (/\bduplicate/.test(t)) return /duplicate/.test(labels) || /duplicate/.test(statement) ? "Yes, there can be duplicates." : "Good thing to ask. Don't assume the values are unique.";
  if (/\bsorted\b/.test(t)) return /sorted/.test(statement) ? "Yes, as the statement says, it's sorted." : "No, don't assume it's sorted.";
  if (/\b(big|large|size|how many|length|bounds?|range|constraints?)\b/.test(t) && problem.constraints.length) {
    return `Here are the bounds: ${problem.constraints.slice(0, 2).join("; ")}.`;
  }
  if (/\b(always|guaranteed|exactly one|valid)\b/.test(t)) return "Yes, you can assume the input is valid as described.";
  return "Good question. Go with the most reasonable assumption, say it out loud, and handle it in your code.";
}

/** A rough check for two nested loops, the most common thing to probe on. */
export function hasNestedLoop(code: string): boolean {
  const lines = code.split("\n");
  const loops: number[] = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)(for|while)\b/);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, "    ").length;
    if (loops.some((i) => i < indent)) return true;
    loops.push(indent);
  }
  return false;
}

const FOLLOW_UPS = [
  "Follow-up: what if the input were too large to fit in memory?",
  "Follow-up: what if the input arrived as a stream, one element at a time?",
  "Follow-up: how would you change this if it ran many times on the same input?",
  "Follow-up: if you had to use constant extra space, what would you give up?",
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function scriptedTurn(state: ScriptState, input: ScriptInput): { text: string; state: ScriptState } {
  const s: ScriptState = { ...state, asked: [...state.asked] };
  const { ctx, problem, config } = input;
  const persona = config.persona;
  const text = (input.text ?? "").trim();
  const lower = text.toLowerCase();
  const optimal = problem.complexity.time;
  const say = (out: string) => ({ text: out, state: s });
  const silent = () => ({ text: SILENT, state: s });
  const once = (id: string) => (s.asked.includes(id) ? false : (s.asked.push(id), true));

  const giveHint = () => {
    if (!config.hintsAllowed) {
      return say(
        pick(persona, {
          friendly: "I'd love to see how far you get on your own first. What's the simplest solution you can think of, even a slow one?",
          neutral: "Hints are off for this one. What's the simplest solution you can think of, even a slow one?",
          terse: "No hints this round. Start with brute force.",
        }),
      );
    }
    if (s.hintsGiven >= 2) return say("I'd rather not give more away. Try writing the brute force first, then we can improve it.");
    const hint = speakable(problem.hints[s.hintsGiven]);
    s.hintsGiven++;
    return say(pick(persona, { friendly: `Sure. ${hint}`, neutral: `Here's a hint. ${hint}`, terse: hint }));
  };

  switch (input.kind) {
    case "start": {
      s.phase = "clarify";
      const company = input.companyName ? ` in the style of a ${input.companyName} interview` : "";
      return say(
        pick(persona, {
          friendly: `Hi, thanks for joining! Today we'll work through ${problem.title}${company}. The statement's on your screen. Take a moment to read it, ask me anything that's unclear, and talk me through your approach before you start coding.`,
          neutral: `Hello. Today's problem is ${problem.title}${company}. Read the statement, ask any clarifying questions, and walk me through your approach before you code.`,
          terse: `Problem: ${problem.title}. Ask questions if you have them, then tell me your approach.`,
        }),
      );
    }

    case "wrap": {
      if (s.phase === "wrap" || s.phase === "done") return silent();
      s.phase = "wrap";
      return say(
        ctx.everAccepted
          ? "We're almost out of time. Give me a quick summary of your solution and its complexity."
          : "We're almost out of time. Wherever you are, tell me what's left and how you'd finish it.",
      );
    }

    case "silence": {
      if (s.phase === "done" || s.phase === "wrap") return silent();
      if (s.lastNudgeMs !== null && ctx.elapsedMs - s.lastNudgeMs < NUDGE_GAP_MS) return silent();
      s.lastNudgeMs = ctx.elapsedMs;
      if (s.phase === "coding" && ctx.sinceCodeChangedMs < 20_000) {
        return say(pick(persona, { friendly: "Can you talk me through what you're writing?", neutral: "Talk me through what you're writing.", terse: "Narrate as you go." }));
      }
      const stalled = ctx.sinceCodeChangedMs > 120_000 && ctx.elapsedMs > 8 * 60_000;
      if (stalled && config.hintsAllowed && s.hintsGiven < 2 && s.phase !== "complexity" && s.phase !== "followup") {
        return say(`You've been quiet for a bit. ${giveHint().text}`);
      }
      return say(pick(persona, { friendly: "What are you thinking right now?", neutral: "What are you thinking?", terse: "Thoughts?" }));
    }

    case "run": {
      const run = ctx.lastRun;
      if (!run) return silent();
      if (run.scope === "all" && run.verdict === "accepted") {
        if (s.phase === "complexity" || s.phase === "followup" || s.phase === "wrap" || s.phase === "done") return silent();
        s.phase = "complexity";
        return say(pick(persona, { friendly: "Nice, everything passes. What's the time and space complexity?", neutral: "All tests pass. What's the time and space complexity?", terse: "Passing. Complexity?" }));
      }
      if (run.verdict === "accepted") {
        return once("edge-cases") ? say("Examples pass. Before you submit, which edge cases are you worried about?") : silent();
      }
      if (run.failingLabels.length && once(`fail:${run.failingLabels[0]}`)) {
        return say(`Looks like the ${run.failingLabels[0]} case fails. What do you think is going on?`);
      }
      return once("debug") ? say("Something's failing. How would you track it down?") : silent();
    }

    case "utterance": {
      if (!text) return silent();
      if (HINT_WORDS.test(lower) && s.phase !== "done") return giveHint();

      switch (s.phase) {
        case "clarify": {
          if (isQuestion(text) && !APPROACH_WORDS.test(lower)) {
            s.questions++;
            const answer = answerClarifying(text, problem);
            return say(s.questions >= 2 ? `${answer} When you're ready, walk me through your approach.` : `${answer} Anything else?`);
          }
          if (APPROACH_WORDS.test(lower) || text.split(/\s+/).length > 12) {
            s.phase = "approach";
            const c = spokenComplexity(text);
            if (c) return approachComplexity(c);
            return say(pick(persona, { friendly: "Okay, that sounds like a plan. What would the time and space complexity be?", neutral: "What's the time and space complexity of that?", terse: "Complexity?" }));
          }
          return say(pick(persona, { friendly: "Sure. Whenever you're ready, tell me how you'd approach it.", neutral: "Okay. How would you approach it?", terse: "Approach?" }));
        }

        case "approach": {
          const c = spokenComplexity(text);
          if (c) return approachComplexity(c);
          if (s.asked.includes("better")) {
            s.phase = "coding";
            return say("Okay, go ahead and code it.");
          }
          if (once("approach-complexity")) return say("And what would the complexity be?");
          s.phase = "coding";
          return say("Alright, go ahead and code it.");
        }

        case "coding": {
          if (ctx.hasCode && hasNestedLoop(ctx.code) && compareComplexity("O(n^2)", optimal) === 1 && once("nested-loop")) {
            return say("I see a nested loop there. What does that do to the complexity?");
          }
          if (/\b(done|finished|i think (this|that|it) works)\b/.test(lower) && !ctx.everAccepted) {
            return say("Okay. Walk me through it on one of the examples, then run the tests.");
          }
          s.acks++;
          const acks = persona === "terse" ? ["Okay.", "Mm-hm.", "Go on."] : ["Okay.", "Mm-hm, go on.", "Makes sense.", "Sure."];
          return say(acks[s.acks % acks.length]);
        }

        case "complexity": {
          const c = spokenComplexity(text);
          if (!c) return say("What's the time complexity, in big O?");
          const cmp = compareComplexity(c, optimal);
          if (cmp === 0 || cmp === null) {
            s.phase = "followup";
            return say(`${cmp === 0 ? "Right." : "Okay."} ${FOLLOW_UPS[hash(problem.slug) % FOLLOW_UPS.length]}`);
          }
          s.complexityTries++;
          if (s.complexityTries < 2) return say("Are you sure? Walk me through where that comes from.");
          s.phase = "followup";
          return say(`I'd say it's ${optimal}. ${FOLLOW_UPS[hash(problem.slug) % FOLLOW_UPS.length]}`);
        }

        case "followup": {
          if (once("tests")) return say("Good. How would you test this? Which edge cases matter most?");
          s.phase = "wrap";
          return say("That's everything I had. Do you have any questions for me?");
        }

        case "wrap": {
          s.phase = "done";
          return say("Thanks, that's it for today. End the interview whenever you're ready and I'll put your timeline together.");
        }

        case "done":
          return say("Thanks. You can end the interview whenever you're ready.");
      }
    }
  }
  return silent();

  function approachComplexity(c: string) {
    const cmp = compareComplexity(c, optimal);
    if (cmp === 1 && once("better")) {
      return say("That would work. Can you do better than that, or do you want to start with it?");
    }
    s.phase = "coding";
    return say(pick(persona, { friendly: "Sounds good, go ahead and code it.", neutral: "Okay, go ahead and code it.", terse: "Code it." }));
  }
}
