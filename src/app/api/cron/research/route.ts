import { cronAuthorized } from "@/lib/cron";
import { runResearch } from "@/lib/research";

// The weekly research run (spec 4.6), scheduled in vercel.json. Off unless
// CRON_SECRET is set (see lib/cron.ts).

export const maxDuration = 800;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const run = await runResearch("cron");
  if (!run) return Response.json({ status: "already-running" }, { status: 409 });
  return Response.json({ id: run.id, status: run.status, results: run.results, error: run.error });
}
