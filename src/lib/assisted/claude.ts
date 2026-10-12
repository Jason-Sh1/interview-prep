import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AssistedTask } from "./types";

// The chat assistant for AI-assisted rounds when ANTHROPIC_API_KEY is set.
// The candidate picks the model, as in Meta's round. On some turns the
// assistant is asked to slip in one subtle bug and name it in a marker line,
// which is stripped before the candidate sees the answer and kept for grading.

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const PLANT_MARKER = /\n?\s*\[\[planted:\s*([\s\S]*?)\]\]\s*$/;

function system(task: AssistedTask): string {
  return `You are the AI coding assistant built into a practice interview: an "AI-assisted coding round" like the ones Meta and others now run. The candidate is working on this task in a small JavaScript (CommonJS) repo:

${task.brief}

Answer like a strong pair programmer: short explanations, and code they can paste. You can't edit files; the candidate must paste or type your code themselves, so show complete functions rather than fragments when you write code. Don't solve parts of the task they didn't ask about. Use plain Markdown with \`\`\`js fences.`;
}

const PLANT_INSTRUCTION = `For this answer only: if your answer includes code, slip in exactly one subtle, realistic bug that a careful reviewer would catch (for example an off-by-one, a wrong boundary, a wrong unit, or a missed case from the brief). Don't hint at it anywhere in the answer. Then, as the very last line, write [[planted: <one sentence saying what the bug is>]]. If your answer has no code, don't add a bug or that line. This is a training exercise in reviewing AI output; the bug is revealed to the candidate afterward.`;

export interface ChatTurn {
  prompt: string;
  reply: string;
}

function repoBlock(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, src]) => `--- ${path} ---\n${src.slice(0, 20_000)}`)
    .join("\n\n");
}

export async function claudeAssistantReply(opts: {
  task: AssistedTask;
  model: string;
  history: ChatTurn[];
  prompt: string;
  files: Record<string, string>;
  plant: boolean;
}): Promise<{ text: string; planted?: { description: string } }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of opts.history.slice(-12)) {
    messages.push({ role: "user", content: turn.prompt }, { role: "assistant", content: turn.reply });
  }
  messages.push({ role: "user", content: `The repo right now:\n\n${repoBlock(opts.files)}\n\n---\n\n${opts.prompt}` });

  const isHaiku = opts.model.startsWith("claude-haiku");
  const res = await getClient().beta.messages.create({
    model: opts.model,
    max_tokens: 8000,
    // Server-side refusal fallback; Haiku has none.
    ...(isHaiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    output_config: { effort: "low" },
    system: opts.plant ? `${system(opts.task)}\n\n${PLANT_INSTRUCTION}` : system(opts.task),
    messages,
  });
  if (res.stop_reason === "refusal") throw new Error("The assistant declined to answer");
  let text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  const m = text.match(PLANT_MARKER);
  let planted: { description: string } | undefined;
  if (m) {
    text = text.slice(0, m.index).trim();
    if (opts.plant && m[1].trim()) planted = { description: m[1].trim() };
  }
  return { text, planted };
}
