import { NextResponse } from "next/server";
import { z } from "zod";
import { filesInputSchema } from "@/lib/assisted/types";
import { getCurrentUser } from "@/lib/auth/session";
import { debugTimeUp, getDebugRound, saveDebugProgress } from "@/lib/comprehension";

const body = z.object({
  files: filesInputSchema.optional(),
  run: z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).optional(),
});

/** Saves the latest files and records a test run while a debugging round is open. */
export async function POST(req: Request, ctx: RouteContext<"/api/debug/[id]/save">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { id } = await ctx.params;
  const round = await getDebugRound(id, user.id);
  if (!round) return NextResponse.json({ error: "Unknown round" }, { status: 404 });
  if (round.endedAt) return NextResponse.json({ error: "This round has ended" }, { status: 409 });
  if (debugTimeUp(round)) return NextResponse.json({ error: "Time's up. Finish and write up what you found." }, { status: 409 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await saveDebugProgress(round, parsed.data);
  return NextResponse.json({ ok: true });
}
