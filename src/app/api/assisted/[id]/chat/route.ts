import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { chat, getAssistedSession } from "@/lib/assisted";
import { filesInputSchema } from "@/lib/assisted/types";

const body = z.object({ text: z.string().trim().min(1).max(10_000), model: z.string().max(100), files: filesInputSchema });

/** One message to the round's AI assistant; returns its answer. */
export async function POST(req: Request, ctx: RouteContext<"/api/assisted/[id]/chat">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const session = await getAssistedSession(id, user.id);
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.endedAt) return NextResponse.json({ error: "This round has ended" }, { status: 409 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json({ reply: await chat(session, parsed.data) });
  } catch (e) {
    console.error("Assistant turn failed", e);
    return NextResponse.json({ error: "The assistant couldn't answer. Try again." }, { status: 502 });
  }
}
