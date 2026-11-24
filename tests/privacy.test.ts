import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_RETENTION_DAYS, retentionDays, retentionSchedule } from "@/lib/privacy";

describe("retention setting", () => {
  it("defaults to 90 days and accepts 1 to 3650", () => {
    expect(retentionDays({})).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays({ RETENTION_DAYS: "30" })).toBe(30);
    expect(retentionDays({ RETENTION_DAYS: "0" })).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays({ RETENTION_DAYS: "abc" })).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays({ RETENTION_DAYS: "99999" })).toBe(3650);
  });

  it("describes the schedule that is actually configured", () => {
    expect(retentionSchedule({ VERCEL: "1", CRON_SECRET: "s" })).toMatch(/scheduled job/);
    expect(retentionSchedule({ VERCEL: "1" })).toMatch(/when someone uses the site/);
    expect(retentionSchedule({ CRON_SECRET: "s" })).toMatch(/when someone uses the site/);
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

    await db.insert(schema.rounds).values({
      id: `r-${u.id}`,
      userId: u.id,
      kind: "design",
      topicId: "url-shortener",
      config: {},
      interviewer: "scripted",
      artifact: { board: "boxes" },
      transcript: [{ speaker: "candidate", text: "my design", t: 1 }],
      createdAt: new Date(Date.now() - 200 * DAY),
      endedAt: new Date(Date.now() - 200 * DAY),
      report: { quote: "my design" },
    });

    const counts = await purgeExpired(new Date(), 90);
    expect(counts.rounds).toBeGreaterThanOrEqual(1);
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
    const [round] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, `r-${u.id}`));
    expect(round).toMatchObject({ transcript: [], artifact: {}, report: null });
    expect(round.purgedAt).toBeInstanceOf(Date);

    // Running it again finds nothing new.
    const again = await purgeExpired(new Date(), 90);
    expect(again.mockSessions).toBe(0);
  });

  it("deletes one user's recordings on request and leaves everyone else's", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const { purgeRecordings, setRecordingConsent } = await import("@/lib/privacy");
    const mock = await import("@/lib/mock");
    const me = await newUser("mine");
    const other = await newUser("theirs");
    for (const u of [me, other]) await setRecordingConsent(u.id, true);
    const mine = [await recordedMock(me.id, 1), await recordedMock(me.id, 200)];
    const theirs = await recordedMock(other.id, 1);

    // No date limit: recent and old recordings both go.
    expect((await purgeRecordings({ userId: me.id })).mockSessions).toBe(2);
    for (const id of mine) {
      expect((await mock.getMockSession(id))!.purgedAt).toBeInstanceOf(Date);
      expect(await mock.getEvents(id)).toEqual([]);
    }
    expect((await mock.getMockSession(theirs))!.purgedAt).toBeNull();
    expect(await mock.getEvents(theirs)).toHaveLength(1);
    expect(await db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, theirs))).toHaveLength(1);
    // Already purged rows aren't counted again.
    expect((await purgeRecordings({ userId: me.id })).mockSessions).toBe(0);
  });

  it("refuses to rebuild the report of a purged round, for every round type", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const { purgeRecordings, setRecordingConsent } = await import("@/lib/privacy");
    const assisted = await import("@/lib/assisted");
    const debug = await import("@/lib/comprehension");
    const rounds = await import("@/lib/rounds");
    const u = await newUser("regen");
    await setRecordingConsent(u.id, true);
    const tests = { passed: 0, total: 0, failing: [] };

    const aId = await assisted.createAssistedSession(u.id, "rate-limit", 45);
    await assisted.finishAssisted((await assisted.getAssistedSession(aId, u.id))!, { files: { "a.js": "mine" }, explanation: "mine", tests });
    const dId = await debug.createDebugRound(u.id, "checkout-bugs", 30, false);
    await debug.finishDebugRound((await debug.getDebugRound(dId, u.id))!, { files: {}, answers: { q: "mine" }, notes: "mine", tests });
    const roundIds: string[] = [];
    for (const [kind, topic] of [["design", "url-shortener"], ["behavioral", "amazon-lp"]] as const) {
      const id = await rounds.createRound(u.id, kind, topic, { minutes: 30, persona: "neutral", company: null, level: "mid" });
      await rounds.finishRound((await rounds.getRound(id, u.id))!);
      roundIds.push(id);
    }

    expect(await purgeRecordings({ userId: u.id })).toEqual({ mockSessions: 0, assistedSessions: 1, debugRounds: 1, rounds: 2 });

    const a = (await assisted.getAssistedSession(aId, u.id))!;
    expect(a.purgedAt).toBeInstanceOf(Date);
    await expect(assisted.generateAssistedReport(a)).rejects.toThrow(/deleted/);
    const d = (await debug.getDebugRound(dId, u.id))!;
    expect(d.purgedAt).toBeInstanceOf(Date);
    await expect(debug.generateDebugReport(d)).rejects.toThrow(/deleted/);
    for (const id of roundIds) await expect(rounds.generateRoundReport((await rounds.getRound(id, u.id))!)).rejects.toThrow(/deleted/);

    // Nothing was written back.
    expect((await db.select().from(schema.assistedSessions).where(eq(schema.assistedSessions.id, aId)))[0].report).toBeNull();
    expect((await db.select().from(schema.debugRounds).where(eq(schema.debugRounds.id, dId)))[0].report).toBeNull();
    for (const id of roundIds) expect((await db.select().from(schema.rounds).where(eq(schema.rounds.id, id)))[0].report).toBeNull();
  });

  it("ends a session that is still open when its recording is purged, and records nothing more", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const { purgeRecordings, setRecordingConsent } = await import("@/lib/privacy");
    const mock = await import("@/lib/mock");
    const assisted = await import("@/lib/assisted");
    const debug = await import("@/lib/comprehension");
    const rounds = await import("@/lib/rounds");
    const u = await newUser("open");
    await setRecordingConsent(u.id, true);

    const mId = await mock.createMockSession(u.id, { slug: "pair-with-target-sum", config, language: "python" });
    const aId = await assisted.createAssistedSession(u.id, "rate-limit", 45);
    const dId = await debug.createDebugRound(u.id, "checkout-bugs", 30, false);
    const rId = await rounds.createRound(u.id, "design", "url-shortener", { minutes: 30, persona: "neutral", company: null, level: "mid" });
    // Loaded before the purge, as a request already in flight would have them.
    const staleMock = (await mock.getMockSession(mId, u.id))!;
    const staleAssisted = (await assisted.getAssistedSession(aId, u.id))!;
    const staleDebug = (await debug.getDebugRound(dId, u.id))!;
    let staleRound = (await rounds.getRound(rId, u.id))!;
    for await (const _ of rounds.runRoundTurn(staleRound, { kind: "start" })) void _;
    staleRound = (await rounds.getRound(rId, u.id))!;

    await purgeRecordings({ userId: u.id });

    // Every row is ended, so the API routes (which check endedAt) refuse further writes.
    expect((await mock.getMockSession(mId, u.id))!.endedAt).toBeInstanceOf(Date);
    expect((await assisted.getAssistedSession(aId, u.id))!.endedAt).toBeInstanceOf(Date);
    expect((await debug.getDebugRound(dId, u.id))!.endedAt).toBeInstanceOf(Date);
    expect((await rounds.getRound(rId, u.id))!.endedAt).toBeInstanceOf(Date);

    // Writes already in flight with a stale copy land nowhere.
    await mock.appendEvents(mId, [{ type: "marker", t: 1, payload: { what: "start" } }]);
    for await (const _ of mock.runTurn(staleMock, { kind: "utterance", text: "my secret plan", source: "typed" })) void _;
    expect(await mock.getEvents(mId)).toEqual([]);
    await assisted.chat(staleAssisted, { text: "write it for me", model: "scripted", files: {} });
    expect(await assisted.getAssistedEvents(aId)).toEqual([]);
    await debug.saveDebugProgress(staleDebug, { files: { "a.js": "mine" } });
    expect((await db.select().from(schema.debugRounds).where(eq(schema.debugRounds.id, dId)))[0].files).toBeNull();
    for await (const _ of rounds.runRoundTurn(staleRound, { kind: "say", text: "my design", source: "typed" })) void _;
    expect((await db.select().from(schema.rounds).where(eq(schema.rounds.id, rId)))[0]).toMatchObject({ transcript: [], stage: {} });
  });

  it("runs the retention purge at most once a day from page loads", async () => {
    const { purgeExpiredIfDue, resetRetentionPurgeClock, setRecordingConsent } = await import("@/lib/privacy");
    const { scheduleRetentionPurge } = await import("@/lib/retention-schedule");
    const mock = await import("@/lib/mock");
    const u = await newUser("daily");
    await setRecordingConsent(u.id, true);
    const old = await recordedMock(u.id, 120);
    resetRetentionPurgeClock();

    // A page load schedules the purge to run after the response.
    const tasks: (() => Promise<void>)[] = [];
    scheduleRetentionPurge((t) => void tasks.push(t));
    expect(tasks).toHaveLength(1);
    await tasks[0]();
    expect((await mock.getMockSession(old))!.purgedAt).toBeInstanceOf(Date);

    // Within the day it doesn't run again; a day later it does.
    const now = Date.now();
    const again = await recordedMock(u.id, 120);
    expect(await purgeExpiredIfDue(new Date(now + 3_600_000), 90)).toBeNull();
    expect((await mock.getMockSession(again))!.purgedAt).toBeNull();
    expect((await purgeExpiredIfDue(new Date(now + 86_400_000 + 60_000), 90))?.mockSessions).toBeGreaterThanOrEqual(1);
    expect((await mock.getMockSession(again))!.purgedAt).toBeInstanceOf(Date);

    // Outside a request, `after` throws and nothing is scheduled (or thrown).
    expect(() =>
      scheduleRetentionPurge(() => {
        throw new Error("after() outside a request");
      }),
    ).not.toThrow();
    resetRetentionPurgeClock();
  });

  // Deleting the user row is all "Delete everything" does, so every table that
  // holds a user's data has to cascade from it. Checked against the migrated
  // database, so a new table that forgets the cascade (or the foreign key) fails here.
  it("cascades every table that holds user data from user.id", async () => {
    const { db } = await import("@/lib/db");
    const { sql } = await import("drizzle-orm");
    const rows = async <T,>(q: import("drizzle-orm").SQL) => {
      const res = (await db.execute(q)) as unknown as T[] | { rows: T[] };
      return Array.isArray(res) ? res : res.rows;
    };
    const withUserId = (
      await rows<{ table_name: string }>(sql`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id'`)
    ).map((r) => r.table_name);
    const fks = await rows<{ tbl: string; col: string; target: string; action: string }>(sql`
      select c.conrelid::regclass::text as tbl, a.attname as col, c.confrelid::regclass::text as target, c.confdeltype as action
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace`);
    const unquote = (t: string) => t.replace(/^public\./, "").replace(/"/g, "");

    // Every user_id column has a cascading foreign key to user.
    expect(withUserId.length).toBeGreaterThanOrEqual(15);
    for (const t of withUserId) {
      const fk = fks.find((f) => unquote(f.tbl) === t && f.col === "user_id");
      expect(fk, `${t}.user_id has no foreign key to user`).toBeDefined();
      expect([unquote(fk!.target), fk!.action], `${t}.user_id`).toEqual(["user", "c"]);
    }
    // A table without user_id that hangs off a user's table (timeline events) cascades from it too.
    const owned = new Set([...withUserId, "user"]);
    for (const f of fks) {
      if (!owned.has(unquote(f.target)) || withUserId.includes(unquote(f.tbl))) continue;
      expect(f.action, `${unquote(f.tbl)}.${f.col} -> ${unquote(f.target)}`).toBe("c");
    }
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

    // Rows the test created in tables reached only through a session (timeline events, the report).
    const [myMock] = await db.select().from(schema.mockSessions).where(eq(schema.mockSessions.userId, me.id));
    expect(await db.select().from(schema.sessionEvents).where(eq(schema.sessionEvents.sessionId, myMock.id))).toHaveLength(1);

    await deleteAllUserData(me);

    expect(await db.select().from(schema.user).where(eq(schema.user.id, me.id))).toEqual([]);
    expect(await db.select().from(schema.mockSessions).where(eq(schema.mockSessions.userId, me.id))).toEqual([]);
    expect(await db.select().from(schema.sessionEvents).where(eq(schema.sessionEvents.sessionId, myMock.id))).toEqual([]);
    expect(await db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.userId, me.id))).toEqual([]);
    expect(await db.select().from(schema.goals).where(eq(schema.goals.userId, me.id))).toEqual([]);
    expect(await db.select().from(schema.privacySettings).where(eq(schema.privacySettings.userId, me.id))).toEqual([]);
    expect(await db.select().from(schema.mockSessions).where(eq(schema.mockSessions.userId, other.id))).toHaveLength(1);
    expect(await db.select().from(schema.goals).where(eq(schema.goals.userId, other.id))).toHaveLength(1);
    const [p] = await db.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.companyId, "acme"));
    expect(p.reviewedBy).toBe("deleted user");
  });
});
