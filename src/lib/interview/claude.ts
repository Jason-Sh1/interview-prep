import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Line } from "./timeline";

// The Claude interviewer, used when ANTHROPIC_API_KEY is set. The spec picks
// Sonnet for conversational turns: fast enough for voice, strong at reading code.

export const INTERVIEWER_MODEL = process.env.INTERVIEWER_MODEL || "claude-sonnet-5-5";

export function claudeEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/** Rebuilds the conversation so far as alternating messages (the API merges same-role neighbours). */
export function historyMessages(lines: Line[]): Anthropic.Beta.BetaMessageParam[] {
  const msgs: Anthropic.Beta.BetaMessageParam[] = lines.map((l) =>
    l.speaker === "candidate" ? { role: "user", content: `Candidate said: "${l.text}"` } : { role: "assistant", content: l.text },
  );
  if (msgs.length && msgs[0].role === "assistant") msgs.unshift({ role: "user", content: "[Event] The candidate just joined. Open the interview." });
  return msgs;
}

/**
 * Streams the interviewer's reply as text chunks. Low effort keeps the first
 * word fast; the "default" fallback chain covers a policy refusal.
 */
export async function* claudeTurn(system: string, history: Line[], message: string, signal?: AbortSignal): AsyncGenerator<string> {
  const stream = getClient().beta.messages.stream(
    {
      model: INTERVIEWER_MODEL,
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [...historyMessages(history), { role: "user", content: message }],
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new Error("The interviewer model declined this turn");
}
