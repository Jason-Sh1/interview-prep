// LiveKit voice agent for mock interviews (spec 5: STT -> Claude -> TTS).
//
// The agent handles audio only: LiveKit Inference turns the candidate's speech
// into text and the interviewer's replies into speech. Every interviewer turn
// comes from the app's /api/mock/[id]/turn route, which holds the live code,
// test runs and transcript, runs Claude (or the scripted fallback), and
// records both sides of the conversation. So this worker keeps no state of
// its own beyond the session id it was dispatched with.
import { type JobContext, ServerOptions, cli, defineAgent, llm, voice } from "@livekit/agents";
import { RoomEvent } from "@livekit/rtc-node";
import { ReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.INTERVIEWER_AGENT_SECRET;
const STT_MODEL = process.env.STT_MODEL || "deepgram/nova-3";
const TTS_MODEL = process.env.TTS_MODEL || "cartesia/sonic-3";

type TurnBody =
  | { kind: "start" | "silence" | "run" | "wrap" }
  | { kind: "utterance"; text: string; source: "livekit-stt" | "typed" };

/** Asks the app for the interviewer's next words, streamed as text. */
async function requestTurn(sessionId: string, turn: TurnBody): Promise<AsyncIterator<string>> {
  if (!SECRET) throw new Error("INTERVIEWER_AGENT_SECRET is not set");
  const res = await fetch(`${APP_URL}/api/mock/${sessionId}/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-secret": SECRET },
    body: JSON.stringify(turn),
  });
  if (!res.ok || !res.body) throw new Error(`Turn request failed: HTTP ${res.status}`);
  const stream = res.body;
  const decoder = new TextDecoder();
  return (async function* () {
    for await (const bytes of stream) yield decoder.decode(bytes, { stream: true });
    const tail = decoder.decode();
    if (tail) yield tail;
  })();
}

/** What an Agent's llmNode may stream: text, plus framework chunk types we don't use. */
type LlmChunk = NonNullable<Awaited<ReturnType<voice.Agent["llmNode"]>>> extends ReadableStream<infer C> ? C : never;

/** The stream, or null if it ends without any text (the interviewer chose to stay quiet). */
async function nonEmpty<C = string>(reader: AsyncIterator<string>): Promise<ReadableStream<C> | null> {
  let first = "";
  while (!first.trim()) {
    const { value, done } = await reader.next();
    if (done) return null;
    first += value;
  }
  // Strings are valid for every C this is used with (string, or llmNode's chunk union).
  const out = (s: string) => s as unknown as C;
  return new ReadableStream<C>({
    start(controller) {
      controller.enqueue(out(first));
    },
    async pull(controller) {
      const { value, done } = await reader.next();
      if (done) controller.close();
      else controller.enqueue(out(value));
    },
    async cancel() {
      await reader.return?.();
    },
  });
}

class Interviewer extends voice.Agent {
  constructor(private sessionId: string) {
    super({ instructions: "Replies come from the interview app's turn endpoint." });
  }

  // Replace the LLM step: send what the candidate said to the app and speak its reply.
  override async llmNode(chatCtx: llm.ChatContext): Promise<ReadableStream<LlmChunk> | null> {
    const last = [...chatCtx.items].reverse().find((i): i is llm.ChatMessage => i.type === "message" && i.role === "user");
    const text = last?.textContent?.trim();
    if (!text) return null;
    return nonEmpty<LlmChunk>(await requestTurn(this.sessionId, { kind: "utterance", text, source: "livekit-stt" }));
  }
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const { sessionId } = JSON.parse(ctx.job.metadata || "{}") as { sessionId?: string };
    if (!sessionId) throw new Error("Dispatched without a sessionId in the job metadata");
    await ctx.connect();

    const session = new voice.AgentSession({ stt: STT_MODEL, tts: TTS_MODEL });
    await session.start({ agent: new Interviewer(sessionId), room: ctx.room });

    const speak = async (body: TurnBody) => {
      try {
        const reply = await nonEmpty(await requestTurn(sessionId, body));
        if (reply) session.say(reply);
      } catch (e) {
        console.error("Interviewer turn failed", e);
      }
    };

    // The page sends event turns (test runs, silence, time running out) and typed messages as data.
    ctx.room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (topic !== "interview") return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as { type: string; kind?: string; text?: string };
        if (msg.type === "turn" && (msg.kind === "run" || msg.kind === "silence" || msg.kind === "wrap")) void speak({ kind: msg.kind });
        else if (msg.type === "text" && msg.text?.trim()) void speak({ kind: "utterance", text: msg.text.trim(), source: "typed" });
      } catch {
        /* ignore malformed messages */
      }
    });

    await speak({ kind: "start" });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: process.env.LIVEKIT_AGENT_NAME || "interviewer" }));
}
