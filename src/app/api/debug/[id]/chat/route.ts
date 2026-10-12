import { NextResponse } from "next/server";
import { z } from "zod";
import { filesInputSchema } from "@/lib/assisted/types";
import { getCurrentUser } from "@/lib/auth/session";
import { debugChat, getDebugRound } from "@/lib/comprehension";

const body = z.object({ text: z.string().trim().min(1).max(10_000), files: filesInputSchema });

/** One message to a debugging round's assistant; returns its answer. */
export async function POST(req: Request, ctx: RouteContext<"/api/debug/[id]/chat">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const round = await getDebugRound(id, user.id);
  if (!round) return NextResponse.json({ error: "Unknown round" }, { status: 404 });
  if (round.endedAt) return NextResponse.json({ error: "This round has ended" }, { status: 409 });
  if (round.assistant === "none") return NextResponse.json({ error: "This round has no assistant" }, { status: 409 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json({ reply: await debugChat(round, parsed.data.text, parsed.data.files) });
  } catch (e) {
    console.error("Debug assistant turn failed", e);
    return NextResponse.json({ error: "The assistant couldn't answer. Try again." }, { status: 502 });
  }
}
