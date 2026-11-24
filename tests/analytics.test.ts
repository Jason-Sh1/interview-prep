import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
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
      completed: { practice: 2, mock: 1, assisted: 0, debug: 0, design: 0, behavioral: 0, walkthrough: 0 },
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

describe("usage stats from the database", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "analytics-db-"));
  });

  it("counts each table's sessions in the right week, finished or not", { timeout: 120_000 }, async () => {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const { usageStats } = await import("@/lib/analytics-db");
    await ensureMigrated();
    const now = at("2026-10-31T12:00:00Z"); // a Saturday
    const thisWeek = at("2026-10-28T10:00:00Z");
    const lastWeek = at("2026-10-21T10:00:00Z");
    const longAgo = at("2026-06-01T10:00:00Z");
    for (const id of ["ua", "ub", "uc"]) await db.insert(schema.user).values({ id, name: id, email: `${id}@x.dev` });

    const attempt = { pattern: "two-pointers", mode: "learn", language: "python", solved: true, score: 1, ratingBefore: 0, ratingAfter: 0.1 };
    await db.insert(schema.attempts).values([
      { ...attempt, userId: "ua", problemSlug: "p1", startedAt: thisWeek, finishedAt: thisWeek },
      { ...attempt, userId: "ua", problemSlug: "p2", startedAt: lastWeek, finishedAt: lastWeek },
      { ...attempt, userId: "ub", problemSlug: "p3", startedAt: longAgo, finishedAt: longAgo },
    ]);
    const mock = { problemSlug: "pair-with-target-sum", config: {}, language: "python", voice: "browser", interviewer: "scripted" };
    await db.insert(schema.mockSessions).values([
      { ...mock, id: "m1", userId: "ua", startedAt: thisWeek, endedAt: thisWeek },
      { ...mock, id: "m2", userId: "ub", startedAt: thisWeek }, // active, didn't finish
      { ...mock, id: "m3", userId: "uc", startedAt: lastWeek, endedAt: lastWeek, purgedAt: now }, // purged still counts
    ]);
    await db.insert(schema.assistedSessions).values({ id: "a1", userId: "ub", taskId: "rate-limit", minutes: 45, assistant: "scripted", startedAt: thisWeek, endedAt: thisWeek });
    await db.insert(schema.debugRounds).values({ id: "d1", userId: "uc", taskId: "checkout-bugs", minutes: 30, assistant: "none", startedAt: thisWeek, endedAt: thisWeek });
    const round = { config: {}, interviewer: "scripted", createdAt: thisWeek, endedAt: thisWeek };
    await db.insert(schema.rounds).values([
      { ...round, id: "r1", userId: "uc", kind: "design", topicId: "url-shortener" },
      { ...round, id: "r2", userId: "uc", kind: "behavioral", topicId: "amazon-lp" },
    ]);

    const weeks = await usageStats(now, 2);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(weeks[1]).toEqual({
      weekStart: "2026-10-26",
      activeUsers: 3,
      // Behavioral rounds count as behavioral, not as system design.
      completed: { practice: 1, mock: 1, assisted: 1, debug: 1, design: 1, behavioral: 1, walkthrough: 0 },
      sessionsCompleted: 5,
    });
    expect(weeks[0]).toEqual({
      weekStart: "2026-10-19",
      activeUsers: 2,
      completed: { practice: 1, mock: 1, assisted: 0, debug: 0, design: 0, behavioral: 0, walkthrough: 0 },
      sessionsCompleted: 1,
    });
  });
});
