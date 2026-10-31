import { describe, expect, it } from "vitest";
import { weekStart, weeklyStats, type Activity } from "@/lib/analytics";

const at = (iso: string) => new Date(iso);

describe("weekly usage stats", () => {
  it("starts weeks on Monday, UTC", () => {
    expect(weekStart(at("2026-10-31T23:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z"); // Saturday
    expect(weekStart(at("2026-10-26T00:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z"); // Monday
    expect(weekStart(at("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z"); // Sunday
  });

  it("counts distinct active users and finished sessions per week", () => {
    const activity: Activity[] = [
      { userId: "a", at: at("2026-10-27T10:00:00Z"), kind: "practice", completed: true },
      { userId: "a", at: at("2026-10-28T10:00:00Z"), kind: "practice", completed: true },
      { userId: "a", at: at("2026-10-29T10:00:00Z"), kind: "mock", completed: true },
      { userId: "b", at: at("2026-10-30T10:00:00Z"), kind: "mock", completed: false }, // active, but didn't finish
      { userId: "c", at: at("2026-10-20T10:00:00Z"), kind: "assisted", completed: true }, // the week before
      { userId: "d", at: at("2026-08-01T10:00:00Z"), kind: "debug", completed: true }, // out of range
    ];
    const weeks = weeklyStats(activity, at("2026-10-31T12:00:00Z"), 3);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(weeks[2]).toEqual({
      weekStart: "2026-10-26",
      activeUsers: 2,
      completed: { practice: 2, mock: 1, assisted: 0, debug: 0, round: 0 },
      sessionsCompleted: 1,
    });
    expect(weeks[1]).toMatchObject({ activeUsers: 1, sessionsCompleted: 1 });
    expect(weeks[0]).toMatchObject({ activeUsers: 0, sessionsCompleted: 0 });
  });

  it("returns only totals, never user ids", () => {
    const weeks = weeklyStats([{ userId: "secret-user", at: at("2026-10-27T10:00:00Z"), kind: "mock", completed: true }], at("2026-10-31T12:00:00Z"), 1);
    expect(JSON.stringify(weeks)).not.toContain("secret-user");
  });
});
