import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { candidateToken, livekitEnabled } from "@/lib/interview/livekit";
import { getMockSession } from "@/lib/mock";

/** A LiveKit room token for the candidate; joining dispatches the interviewer agent. */
export async function POST(_req: Request, ctx: RouteContext<"/api/mock/[id]/livekit">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!livekitEnabled()) return NextResponse.json({ error: "LiveKit is not configured" }, { status: 404 });
  const { id } = await ctx.params;
  const session = await getMockSession(id, user.id);
  if (!session || session.voice !== "livekit") return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.endedAt) return NextResponse.json({ error: "This interview has ended" }, { status: 409 });
  return NextResponse.json(await candidateToken(id, user));
}
