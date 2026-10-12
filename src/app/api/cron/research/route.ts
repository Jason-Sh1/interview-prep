import { timingSafeEqual } from "node:crypto";
import { runResearch } from "@/lib/research";

// The weekly research run (spec 4.6). Vercel Cron calls this with
// `Authorization: Bearer $CRON_SECRET` (see vercel.json); any other scheduler
// can do the same. Without CRON_SECRET set, the route is off.

export const maxDuration = 800;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const run = await runResearch("cron");
  if (!run) return Response.json({ status: "already-running" }, { status: 409 });
  return Response.json({ id: run.id, status: run.status, results: run.results, error: run.error });
}
