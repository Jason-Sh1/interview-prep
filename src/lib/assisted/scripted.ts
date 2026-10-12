// The practice assistant used when no API key is set: canned answers per
// task, picked by keywords, with planted bugs in some of them so reviewing
// AI output is part of the round (spec 4.5). Pure: state in, answer out.
import type { AssistedTask } from "./types";

export interface ScriptedState {
  /** Bug ids already planted this session. */
  planted: string[];
  /** Answers with code given so far. */
  codeReplies: number;
  /** Planted bugs the candidate hasn't pointed out yet, so "that's wrong" gets a correction. */
  pending: { topic: string; bug: string }[];
  /** The bug in the most recent answer, if it had one. */
  lastBug: string | null;
}

export const INITIAL_SCRIPTED_STATE: ScriptedState = { planted: [], codeReplies: 0, pending: [], lastBug: null };

/** Words that mean the candidate thinks the last answer was wrong. */
export const FLAG_WORDS = /\b(bug|buggy|wrong|incorrect|off[- ]by[- ]one|doesn'?t work|does not work|not working|failing|fails|broken|mistake|typo|error in|that'?s not right|isn'?t right)\b/;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface ScriptedAnswer {
  text: string;
  planted?: { id: string; description: string };
  state: ScriptedState;
}

export function scriptedReply(task: AssistedTask, state: ScriptedState, prompt: string, seed: string): ScriptedAnswer {
  const p = prompt.toLowerCase();
  const s: ScriptedState = { ...state, planted: [...state.planted], pending: [...state.pending] };

  if (FLAG_WORDS.test(p) && (s.pending.length || s.lastBug)) {
    // Correct the planted bug the candidate is pointing at: the one whose topic
    // the message is about, else the one in the last answer.
    const target =
      s.pending.find((x) => task.topics.find((t) => t.id === x.topic)?.keywords.some((k) => p.includes(k))) ??
      s.pending.find((x) => x.bug === s.lastBug);
    s.lastBug = null;
    if (!target) {
      return {
        text: "I'm not sure which part you mean. Can you point me at the line, or paste the failing test and its error? Then I can check that piece.",
        state: s,
      };
    }
    s.pending = s.pending.filter((x) => x !== target);
    const topic = task.topics.find((t) => t.id === target.topic);
    const bug = task.bugs.find((b) => b.id === target.bug);
    if (topic && bug) {
      return { text: `You're right, I made a mistake there. ${bug.description} Here's the corrected version:\n\n${topic.reply}`, state: s };
    }
  }

  let best: { topic: (typeof task.topics)[number]; hits: number } | null = null;
  for (const topic of task.topics) {
    const hits = topic.keywords.filter((k) => p.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { topic, hits };
  }
  if (!best) {
    const files = Object.keys(task.files).map((f) => `\`${f}\``).join(", ");
    return {
      text: `I can help with this repo (${files}). Try asking me to explain how it fits together, to write a specific function, or which edge cases to test. Specific questions get better answers: name the file and function, and say what it should do.`,
      state: s,
    };
  }

  const { topic } = best;
  const hasCode = topic.reply.includes("```");
  const available = (topic.buggy ?? []).filter((b) => !s.planted.includes(b.bug));
  const h = hash(`${seed}:${topic.id}:${s.codeReplies}`);
  // Plant in about half of the answers that can carry a bug, and make sure
  // one lands by the second code answer.
  const plant = available.length > 0 && (h % 2 === 0 || (s.planted.length === 0 && s.codeReplies >= 1));
  if (hasCode) s.codeReplies += 1;
  if (plant) {
    const variant = available[h % available.length];
    const bug = task.bugs.find((b) => b.id === variant.bug)!;
    s.planted.push(bug.id);
    s.pending.push({ topic: topic.id, bug: bug.id });
    s.lastBug = bug.id;
    return { text: variant.reply, planted: { id: bug.id, description: bug.description }, state: s };
  }
  s.lastBug = null;
  return { text: topic.reply, state: s };
}
