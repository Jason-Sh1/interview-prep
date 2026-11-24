import "server-only";
import { after } from "next/server";
import { purgeExpiredIfDue } from "./privacy";

/**
 * Schedules the once-a-day retention purge to run after the current response
 * is sent, so it never slows a page down. The Vercel cron job does the same
 * work when CRON_SECRET is set; this makes deletion happen without it too.
 * Outside a request (scripts, tests) `after` throws, and nothing is scheduled.
 */
export function scheduleRetentionPurge(schedule: (task: () => Promise<void>) => void = after): void {
  try {
    schedule(async () => {
      try {
        const purged = await purgeExpiredIfDue();
        if (purged && Object.values(purged).some((n) => n > 0)) console.info("[retention] purged expired recordings", purged);
      } catch (e) {
        console.error("[retention] purge failed", e);
      }
    });
  } catch {
    // Not inside a request.
  }
}
