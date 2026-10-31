import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_RETENTION_DAYS, retentionDays } from "@/lib/privacy";

describe("retention setting", () => {
  it("defaults to 90 days and accepts 1 to 3650", () => {
    expect(retentionDays({})).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays({ RETENTION_DAYS: "30" })).toBe(30);
    expect(retentionDays({ RETENTION_DAYS: "0" })).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays({ RETENTION_DAYS: "abc" })).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays({ RETENTION_DAYS: "99999" })).toBe(3650);
  });
});

describe("privacy against the database", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "privacy-db-"));
    delete process.env.ANTHROPIC_API_KEY;
  });

  const DAY = 86_400_000;
  const config = { persona: "friendly" as const, minutes: 30 as const, hintsAllowed: true, company: null };

  async function newUser(name: string) {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    await ensureMigrated();
    const id = `u-${name}-${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(schema.user).values({ id, name, email: `${id}@x.dev` });
    return { id, email: `${id}@x.dev` };
  }

  /** A finished mock with a transcript and a stored report, started `daysAgo` days ago. */
  async function recordedMock(userId: string, daysAgo: number) {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const mock = await import("@/lib/mock");
    const id = await mock.createMockSession(userId, { slug: "pair-with-target-sum", config, language: "python" });
    const startedAt = new Date(Date.now() - daysAgo * DAY);
    await db
      .update(schema.mockSessions)
      .set({ startedAt, endedAt: new Date(startedAt.getTime() + 20 * 60_000), finalCode: "print(1)" })
      .where(eq(schema.mockSessions.id, id));
    await db.insert(schema.sessionEvents).values({
      sessionId: id,
      t: 5_000,
      type: "transcript",
      payload: { speaker: "candidate", text: "my secret plan", source: "typed" },
    });
    await db.insert(schema.feedbackReports).values({ sessionId: id, userId, generator: "heuristic", report: { quote: "my secret plan" } });
    return id;
  }

  it("needs consent before a mock can record, and can withdraw it", async () => {
    const { getPrivacy, setRecordingConsent } = await import("@/lib/privacy");
    const mock = await import("@/lib/mock");
    const u = await newUser("consent");
    expect(await getPrivacy(u.id)).toEqual({ recordingConsent: false, consentAt: null });
    await expect(mock.createMockSession(u.id, { slug: "pair-with-target-sum", config, language: "python" })).rejects.toThrow(
      /agree to recording/,
    );
    await setRecordingConsent(u.id, true);
    expect((await getPrivacy(u.id)).recordingConsent).toBe(true);
    expect(await mock.createMockSession(u.id, { slug: "pair-with-target-sum", config, language: "python" })).toBeTruthy();
    await setRecordingConsent(u.id, false);
    expect((await getPrivacy(u.id)).recordingConsent).toBe(false);
  });

  it("asks again when the consent text's version changes", async () => {
    const { db, schema } = await import("@/lib/db");
    const { getPrivacy } = await import("@/lib/privacy");
    const u = await newUser("version");
    await db.insert(schema.privacySettings).values({ userId: u.id, recordingConsentAt: new Date(), recordingConsentVersion: 0 });
    expect((await getPrivacy(u.id)).recordingConsent).toBe(false);
  });

  it("purges recordings past the retention limit but keeps the session row", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const { purgeExpired, setRecordingConsent } = await import("@/lib/privacy");
    const mock = await import("@/lib/mock");
    const { generateReport } = await import("@/lib/feedback");
    const u = await newUser("retention");
    await setRecordingConsent(u.id, true);
    const old = await recordedMock(u.id, 120);
    const recent = await recordedMock(u.id, 10);
    await db.insert(schema.assistedSessions).values({
      id: `a-${u.id}`,
      userId: u.id,
      taskId: "rate-limit",
      minutes: 45,
      assistant: "scripted",
      startedAt: new Date(Date.now() - 200 * DAY),
      explanation: "I asked it to write the limiter",
      finalFiles: { "a.js": "x" },
    });
    await db.insert(schema.assistedEvents).values({ sessionId: `a-${u.id}`, t: 1, type: "prompt", payload: { text: "write it" } });
    await db.insert(schema.debugRounds).values({
      id: `d-${u.id}`,
      userId: u.id,
      taskId: "checkout",
      minutes: 30,
      assistant: "none",
      startedAt: new Date(Date.now() - 200 * DAY),
      chat: [{ role: "user", text: "why", t: 1 }],
      answers: { q1: "because" },
    });

    const counts = await purgeExpired(new Date(), 90);
    expect(counts.mockSessions).toBeGreaterThanOrEqual(1);
    expect(counts.assistedSessions).toBeGreaterThanOrEqual(1);
    expect(counts.debugRounds).toBeGreaterThanOrEqual(1);

    const events = (id: string) => db.select().from(schema.sessionEvents).where(eq(schema.sessionEvents.sessionId, id));
    const report = (id: string) => db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, id));
    expect(await events(old)).toEqual([]);
    expect(await report(old)).toEqual([]);
    expect(await events(recent)).toHaveLength(1);
    expect(await report(recent)).toHaveLength(1);

    const purged = (await mock.getMockSession(old))!;
    expect(purged.purgedAt).toBeInstanceOf(Date);
    expect(purged.finalCode).toBeNull();
    expect(purged.endedAt).toBeInstanceOf(Date); // still counts as a completed session
    await expect(generateReport(purged)).rejects.toThrow(/deleted/);

    const [a] = await db.select().from(schema.assistedSessions).where(eq(schema.assistedSessions.id, `a-${u.id}`));
    expect(a).toMatchObject({ explanation: null, finalFiles: null });
    expect(await db.select().from(schema.assistedEvents).where(eq(schema.assistedEvents.sessionId, `a-${u.id}`))).toEqual([]);
    const [d] = await db.select().from(schema.debugRounds).where(eq(schema.debugRounds.id, `d-${u.id}`));
    expect(d).toMatchObject({ chat: [], answers: null });

    // Running it again finds nothing new.
    const again = await purgeExpired(new Date(), 90);
    expect(again.mockSessions).toBe(0);
  });

  it("deletes every row a user has, and only theirs", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const { deleteAllUserData, setRecordingConsent } = await import("@/lib/privacy");
    const track = await import("@/lib/track");
    const me = await newUser("leaver");
    const other = await newUser("stayer");
    for (const u of [me, other]) {
      await setRecordingConsent(u.id, true);
      await track.saveGoals(u.id, { targetCompanies: ["google"], level: "mid", interviewDate: null, hoursPerWeek: 5, language: "python", timeZone: null });
      await recordedMock(u.id, 1);
    }
    await db.insert(schema.companyProfiles).values({
      companyId: "acme",
      version: 99,
      status: "approved",
      generator: "claude",
      data: {},
      reviewedBy: me.email,
    });

    await deleteAllUserData(me);

    const userTables = [
      schema.goals,
      schema.privacySettings,
      schema.patternSkill,
      schema.attempts,
      schema.reviewCards,
      schema.mockSessions,
      schema.feedbackReports,
      schema.drills,
      schema.assistedSessions,
      schema.debugRounds,
      schema.diagnostics,
      schema.session,
      schema.account,
    ] as const;
    for (const t of userTables) {
      expect(await db.select().from(t).where(eq(t.userId, me.id))).toEqual([]);
    }
    expect(await db.select().from(schema.user).where(eq(schema.user.id, me.id))).toEqual([]);
    expect(await db.select().from(schema.mockSessions).where(eq(schema.mockSessions.userId, other.id))).toHaveLength(1);
    expect(await db.select().from(schema.goals).where(eq(schema.goals.userId, other.id))).toHaveLength(1);
    const [p] = await db.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.companyId, "acme"));
    expect(p.reviewedBy).toBe("deleted user");
  });
});
