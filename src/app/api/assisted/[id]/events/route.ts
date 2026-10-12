import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { appendAssistedEvents, getAssistedSession } from "@/lib/assisted";
import { clientEventSchema } from "@/lib/assisted/types";

const body = z.object({ events: z.array(clientEventSchema).max(200) });

/** Appends snapshots, pastes and test runs from the browser. */
export async function POST(req: Request, ctx: RouteContext<"/api/assisted/[id]/events">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const session = await getAssistedSession(id, user.id);
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.endedAt) return NextResponse.json({ error: "This round has ended" }, { status: 409 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await appendAssistedEvents(id, parsed.data.events);
  return NextResponse.json({ ok: true });
}
