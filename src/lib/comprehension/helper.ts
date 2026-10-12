// The offline helper for debugging rounds when no API key is set: canned
// explanations per task, picked by keywords. It explains and nudges but never
// names a bug outright, the way a good pair would in an interview.
import type { DebugTask } from "./types";

const ASK_FOR_ANSWER = /\b(fix (it|this|the bugs?) for me|what('?s| is| are) the bugs?|where('?s| is| are) the bugs?|find (the|all) bugs?|just tell me|give me the (fix|answer))\b/;

export function helperReply(task: DebugTask, prompt: string): string {
  const p = prompt.toLowerCase();
  if (ASK_FOR_ANSWER.test(p)) {
    return "I won't hand you the bugs; finding them is the point of this round. Pick the first failing test and tell me what you expected and what you got, or name a function you're unsure about, and I'll walk through it with you.";
  }
  let best: { reply: string; hits: number } | null = null;
  for (const topic of task.topics) {
    const hits = topic.keywords.filter((k) => p.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { reply: topic.reply, hits };
  }
  if (best) return best.reply;
  const files = Object.keys(task.files)
    .filter((f) => f.startsWith("src/"))
    .map((f) => `\`${f}\``)
    .join(", ");
  return `I can explain any part of this repo (${files}) or help you reason about a failing test. Ask about a specific function or paste the failure you're looking at.`;
}
