import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRound, RoundClosedError, saveArtifact } from "@/lib/rounds";

/** Autosaves a round's artifact (the whiteboard, story notes or code). */
export async function POST(req: Request, ctx: RouteContext<"/api/rounds/[id]/artifact">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const round = await getRound(id, user.id);
  if (!round) return NextResponse.json({ error: "Unknown round" }, { status: 404 });
  const text = await req.text();
  if (text.length > 2_000_000) return NextResponse.json({ error: "That's too large to save." }, { status: 413 });
  try {
    await saveArtifact(round, JSON.parse(text));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RoundClosedError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: "Couldn't save your latest changes." }, { status: 400 });
  }
}
