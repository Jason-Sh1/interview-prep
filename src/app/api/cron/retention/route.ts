import { cronAuthorized } from "@/lib/cron";
import { purgeExpired, retentionDays } from "@/lib/privacy";

// The daily retention job, scheduled in vercel.json: deletes interview
// recordings older than RETENTION_DAYS (default 90). Off unless CRON_SECRET is
// set (see lib/cron.ts).

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const days = retentionDays();
  const purged = await purgeExpired(new Date(), days);
  return Response.json({ retentionDays: days, purged });
}
