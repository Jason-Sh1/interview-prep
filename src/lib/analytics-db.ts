import "server-only";
import { gte } from "drizzle-orm";
import { weekStart, weeklyStats, type Activity, type WeekStats } from "./analytics";
import { db, ensureMigrated, schema } from "./db";

/** Weekly active users and completed sessions for the last `weeks` weeks. */
export async function usageStats(now = new Date(), weeks = 8): Promise<WeekStats[]> {
  await ensureMigrated();
  const since = new Date(weekStart(now).getTime() - (weeks - 1) * 7 * 86_400_000);
  const a = schema.attempts;
  const m = schema.mockSessions;
  const as = schema.assistedSessions;
  const d = schema.debugRounds;
  // Only the user id, a time and whether it finished: nothing about content.
  const [attempts, mocks, assisted, debug] = await Promise.all([
    db.select({ userId: a.userId, at: a.finishedAt }).from(a).where(gte(a.finishedAt, since)),
    db.select({ userId: m.userId, at: m.startedAt, endedAt: m.endedAt }).from(m).where(gte(m.startedAt, since)),
    db.select({ userId: as.userId, at: as.startedAt, endedAt: as.endedAt }).from(as).where(gte(as.startedAt, since)),
    db.select({ userId: d.userId, at: d.startedAt, endedAt: d.endedAt }).from(d).where(gte(d.startedAt, since)),
  ]);
  const activity: Activity[] = [
    ...attempts.map((r) => ({ userId: r.userId, at: r.at, kind: "practice" as const, completed: true })),
    ...mocks.map((r) => ({ userId: r.userId, at: r.at, kind: "mock" as const, completed: !!r.endedAt })),
    ...assisted.map((r) => ({ userId: r.userId, at: r.at, kind: "assisted" as const, completed: !!r.endedAt })),
    ...debug.map((r) => ({ userId: r.userId, at: r.at, kind: "debug" as const, completed: !!r.endedAt })),
  ];
  return weeklyStats(activity, now, weeks);
}
