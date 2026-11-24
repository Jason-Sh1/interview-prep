import { cronAuthorized } from "@/lib/cron";
import { researchBudgetMs, runResearch } from "@/lib/research";

// The research run (spec 4.6), scheduled on weekdays in vercel.json. Off unless
// CRON_SECRET is set (see lib/cron.ts). Each call researches the companies not
// done in the last 6 days, oldest first, for as long as fits in Vercel's
// 300-second limit (Hobby's maximum); the rest go first the next weekday. So
// each company is still researched about once a week.

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const run = await runResearch("cron", undefined, { budgetMs: researchBudgetMs(), skipFreshDays: 6 });
  if (!run) return Response.json({ status: "already-running" }, { status: 409 });
  return Response.json({ id: run.id, status: run.status, results: run.results, error: run.error });
}
