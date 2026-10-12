import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { eventSchema } from "@/lib/interview/types";
import { appendEvents, getMockSession } from "@/lib/mock";

const body = z.object({ events: z.array(eventSchema).max(500) });

/** Appends a batch of timeline events (code edits and snapshots, runs, markers) from the browser. */
export async function POST(req: Request, ctx: RouteContext<"/api/mock/[id]/events">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const session = await getMockSession(id, user.id);
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.endedAt) return NextResponse.json({ error: "This interview has ended" }, { status: 409 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  // Candidate speech is recorded by the turn route, interviewer speech by the server.
  await appendEvents(id, parsed.data.events.filter((e) => e.type !== "transcript"));
  return NextResponse.json({ ok: true });
}
