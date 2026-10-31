// Privacy-friendly usage numbers: weekly active users and sessions completed,
// counted from the app's own tables. No tracking script, no cookies, no event
// log of page views; nothing leaves the database but totals. A deleted
// account's history leaves the totals with it.
//
// The bucketing is pure so it can be tested; lib/analytics-db.ts reads rows.

export type ActivityKind = "practice" | "mock" | "assisted" | "debug" | "round";

export interface Activity {
  userId: string;
  at: Date;
  kind: ActivityKind;
  /** A finished session (an attempt always counts as finished). */
  completed: boolean;
}

export interface WeekStats {
  /** Monday of the week, YYYY-MM-DD (UTC). */
  weekStart: string;
  activeUsers: number;
  completed: Record<ActivityKind, number>;
  /** Mock interviews plus AI-assisted, debugging and conversation rounds finished. */
  sessionsCompleted: number;
}

const DAY = 86_400_000;

/** Midnight UTC on the Monday of `d`'s week. */
export function weekStart(d: Date): Date {
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const sinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * DAY);
}

/** The last `weeks` weeks up to and including the current one, oldest first. */
export function weeklyStats(activity: Activity[], now: Date, weeks = 8): WeekStats[] {
  const current = weekStart(now).getTime();
  const starts = Array.from({ length: weeks }, (_, i) => current - (weeks - 1 - i) * 7 * DAY);
  const buckets = starts.map(() => ({ users: new Set<string>(), completed: { practice: 0, mock: 0, assisted: 0, debug: 0, round: 0 } }));
  for (const a of activity) {
    const i = starts.indexOf(weekStart(a.at).getTime());
    if (i === -1) continue;
    buckets[i].users.add(a.userId);
    if (a.completed) buckets[i].completed[a.kind] += 1;
  }
  return buckets.map((b, i) => ({
    weekStart: new Date(starts[i]).toISOString().slice(0, 10),
    activeUsers: b.users.size,
    completed: b.completed,
    sessionsCompleted: b.completed.mock + b.completed.assisted + b.completed.debug + b.completed.round,
  }));
}
