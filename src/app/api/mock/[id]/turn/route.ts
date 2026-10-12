import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isAgentRequest } from "@/lib/interview/livekit";
import { turnKindSchema } from "@/lib/interview/types";
import { getMockSession, runTurn } from "@/lib/mock";

const body = z.object({
  kind: turnKindSchema,
  text: z.string().max(5000).optional(),
  source: z.enum(["browser-stt", "typed", "livekit-stt"]).optional(),
  startT: z.number().int().nonnegative().optional(),
});

/**
 * One interviewer turn. Called by the browser (browser voice mode) or by the
 * LiveKit agent worker, which authenticates with INTERVIEWER_AGENT_SECRET.
 * Streams the reply as plain text; an empty body means the interviewer stays quiet.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/mock/[id]/turn">) {
  const { id } = await ctx.params;
  let session;
  if (isAgentRequest(req)) {
    session = await getMockSession(id);
  } else {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    session = await getMockSession(id, user.id);
  }
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.endedAt) return NextResponse.json({ error: "This interview has ended" }, { status: 409 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const encoder = new TextEncoder();
  const turn = runTurn(session, parsed.data, req.signal);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
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
