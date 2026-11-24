import { timingSafeEqual } from "node:crypto";

// Scheduled jobs (vercel.json crons) call their routes with
// `Authorization: Bearer $CRON_SECRET`; Vercel sends it automatically and any
// other scheduler can do the same. With CRON_SECRET unset, every job is off.

export function cronAuthorized(req: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}
