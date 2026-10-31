import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getRound, RoundClosedError, runRoundTurn, saveArtifact } from "@/lib/rounds";
import { turnInputSchema } from "@/lib/rounds/types";

const body = z.object({ input: turnInputSchema, artifact: z.unknown().optional() });

/**
 * One interviewer turn in a conversation round. The latest artifact (the
 * whiteboard, notes or code) rides along so the interviewer sees it. Streams
 * the reply as plain text; an empty body means the interviewer stays quiet.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/rounds/[id]/turn">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const round = await getRound(id, user.id);
  if (!round) return NextResponse.json({ error: "Unknown round" }, { status: 404 });
  if (round.endedAt) return NextResponse.json({ error: "This round has ended" }, { status: 409 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    if (parsed.data.artifact !== undefined && round.startedAt) await saveArtifact(round, parsed.data.artifact);
  } catch (e) {
    if (e instanceof RoundClosedError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: "Couldn't read your work. Reload and try again." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const turn = runRoundTurn(round, parsed.data.input, req.signal);
  // Pull the first chunk before answering so a closed round gets a proper error.
  let first: IteratorResult<string>;
  try {
    first = await turn.next();
  } catch (e) {
    if (e instanceof RoundClosedError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("Round turn failed", e);
    return NextResponse.json({ error: "The interviewer couldn't answer. Try again." }, { status: 502 });
  }
  let primed = !first.done;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (primed) {
          primed = false;
          controller.enqueue(encoder.encode(first.value as string));
          return;
        }
        if (first.done) return controller.close();
        const { value, done } = await turn.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel() {
      await turn.return(undefined);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
