// Calendar-day math in the user's time zone. The server runs in UTC, so
// "today" has to come from the zone the browser reported, not the host clock.

const DAY_MS = 86_400_000;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(d: Date, tz: string | undefined): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const key = tz ?? "";
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(key, f);
  }
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour, min: o.minute, s: o.second };
}

/** The local calendar day of an instant, as days since the epoch. */
export function dayNumber(d: Date, tz?: string): number {
  const p = parts(d, tz);
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / DAY_MS);
}

export function isSameDayIn(a: Date, b: Date, tz?: string): boolean {
  return dayNumber(a, tz) === dayNumber(b, tz);
}

/** How far the zone is ahead of UTC at an instant, in ms. */
function offsetMs(d: Date, tz?: string): number {
  const p = parts(d, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The last millisecond of the local day containing `d`. */
export function endOfDayIn(d: Date, tz?: string): Date {
  const nextMidnightUtc = (dayNumber(d, tz) + 1) * DAY_MS;
  // Local midnight is UTC midnight minus the offset; recheck the offset at that instant for DST changes.
  let t = nextMidnightUtc - offsetMs(d, tz);
  t = nextMidnightUtc - offsetMs(new Date(t), tz);
  return new Date(t - 1);
}

/** Days until a YYYY-MM-DD date, counting the day itself (1 on the day), 0 once it has passed. */
export function daysUntilIn(date: string | null, now: Date, tz?: string): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const target = Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  return Math.max(0, target - dayNumber(now, tz) + 1);
}
