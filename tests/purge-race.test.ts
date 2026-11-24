import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// A report still being graded when the user deletes their recordings must not
// be written afterwards. The Claude graders are replaced by ones that wait on a
// promise the test releases, so the purge can run while grading is pending.
// No API is called: the graders return the rule-based report they were given.
const gate = vi.hoisted(() => ({ wait: async () => {} }));

/** The next grading call waits until `release()`; `started` resolves when it begins. */
function holdNextGrading() {
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  let markStarted!: () => void;
  const started = new Promise<void>((r) => (markStarted = r));
  gate.wait = async () => {
    markStarted();
    await released;
  };
  return { started, release };
}

vi.mock("@/lib/interview/claude", async (importOriginal) => ({ ...(await importOriginal<object>()), claudeEnabled: () => true }));
vi.mock("@/lib/feedback/claude", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  claudeReport: async (_events: unknown, _problem: unknown, base: unknown) => (await gate.wait(), base),
}));
vi.mock("@/lib/assisted/grade-claude", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  claudeAssistedReport: async (_input: unknown, base: unknown) => (await gate.wait(), base),
}));
vi.mock("@/lib/comprehension/claude", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  claudeDebugReport: async (_input: unknown, base: unknown) => (await gate.wait(), base),
}));
vi.mock("@/lib/rounds/claude", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  claudeRoundReport: async (_def: unknown, _ctx: unknown, base: unknown) => (await gate.wait(), base),
}));

describe("a purge while a report is being generated", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "purge-race-db-"));
  });

  const config = { persona: "friendly" as const, minutes: 30 as const, hintsAllowed: true, company: null };
  const tests = { passed: 0, total: 0, failing: [] };

  async function newUser(name: string) {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const { setRecordingConsent } = await import("@/lib/privacy");
    await ensureMigrated();
    const id = `u-${name}-${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(schema.user).values({ id, name, email: `${id}@x.dev` });
    await setRecordingConsent(id, true);
    return id;
  }

  /** Runs `build`, purges the user's recordings while grading is pending, then lets grading finish. */
  async function purgeDuring<T>(userId: string, build: () => Promise<T>) {
    const { purgeRecordings } = await import("@/lib/privacy");
    const hold = holdNextGrading();
    const pending = build();
    pending.catch(() => {});
    await hold.started;
    await purgeRecordings({ userId });
    hold.release();
    return pending;
  }

  it("stores no report and no drills for a mock interview", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const mock = await import("@/lib/mock");
    const { generateReport } = await import("@/lib/feedback");
    const u = await newUser("mock");
    const id = await mock.createMockSession(u, { slug: "pair-with-target-sum", config, language: "python" });
    const startedAt = new Date(Date.now() - 30 * 60_000);
    await db.update(schema.mockSessions).set({ startedAt, endedAt: new Date() }).where(eq(schema.mockSessions.id, id));
    await db.insert(schema.sessionEvents).values({ sessionId: id, t: 5_000, type: "transcript", payload: { speaker: "candidate", text: "my secret plan", source: "typed" } });
    const session = (await mock.getMockSession(id))!;

    await expect(purgeDuring(u, () => generateReport(session))).rejects.toThrow(/deleted/);
    expect(await db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, id))).toEqual([]);
    expect(await db.select().from(schema.drills).where(eq(schema.drills.sessionId, id))).toEqual([]);
  });

  it("stores no report for an AI-assisted round", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const assisted = await import("@/lib/assisted");
    const u = await newUser("assisted");
    const id = await assisted.createAssistedSession(u, "rate-limit", 45);
    await assisted.finishAssisted((await assisted.getAssistedSession(id, u))!, { files: { "a.js": "mine" }, explanation: "mine", tests });
    const session = (await assisted.getAssistedSession(id, u))!;

    await expect(purgeDuring(u, () => assisted.generateAssistedReport(session))).rejects.toThrow(/deleted/);
    expect((await db.select().from(schema.assistedSessions).where(eq(schema.assistedSessions.id, id)))[0].report).toBeNull();
  });

  it("stores no report for a debugging round", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const debug = await import("@/lib/comprehension");
    const u = await newUser("debug");
    const id = await debug.createDebugRound(u, "checkout-bugs", 30, false);
    await debug.finishDebugRound((await debug.getDebugRound(id, u))!, { files: {}, answers: { q: "mine" }, notes: "mine", tests });
    const round = (await debug.getDebugRound(id, u))!;

    await expect(purgeDuring(u, () => debug.generateDebugReport(round))).rejects.toThrow(/deleted/);
    expect((await db.select().from(schema.debugRounds).where(eq(schema.debugRounds.id, id)))[0].report).toBeNull();
  });

  it("stores no report for system design and behavioral rounds", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const rounds = await import("@/lib/rounds");
    for (const [kind, topic] of [["design", "url-shortener"], ["behavioral", "amazon-lp"]] as const) {
      const u = await newUser(kind);
      const id = await rounds.createRound(u, kind, topic, { minutes: 30, persona: "neutral", company: null, level: "mid" });
      // Claude grades only a round where the candidate spoke.
      await db.update(schema.rounds).set({ transcript: [{ speaker: "candidate", text: "my answer", t: 1 }] }).where(eq(schema.rounds.id, id));
      await rounds.finishRound((await rounds.getRound(id, u))!);
      const round = (await rounds.getRound(id, u))!;

      await expect(purgeDuring(u, () => rounds.generateRoundReport(round))).rejects.toThrow(/deleted/);
      expect((await db.select().from(schema.rounds).where(eq(schema.rounds.id, id)))[0].report).toBeNull();
    }
  });

  it("removes a report or drill wording that reached an already purged session on the next run", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const mock = await import("@/lib/mock");
    const rounds = await import("@/lib/rounds");
    const { purgeRecordings } = await import("@/lib/privacy");
    const u = await newUser("repair");
    const id = await mock.createMockSession(u, { slug: "pair-with-target-sum", config, language: "python" });
    const roundId = await rounds.createRound(u, "design", "url-shortener", { minutes: 30, persona: "neutral", company: null, level: "mid" });
    expect(await purgeRecordings({ userId: u })).toMatchObject({ mockSessions: 1, rounds: 1 });

    // What a write that raced the purge would leave behind.
    await db.insert(schema.sessionEvents).values({ sessionId: id, t: 1, type: "transcript", payload: { speaker: "candidate", text: "my secret plan", source: "typed" } });
    await db.insert(schema.feedbackReports).values({ sessionId: id, userId: u, generator: "claude", report: { quote: "my secret plan" } });
    await db.insert(schema.drills).values({ userId: u, sessionId: id, area: "testing", title: "You said my secret plan", drill: "Trace my secret plan", problemSlug: "valid-anagram" });
    await db.update(schema.rounds).set({ report: { quote: "my design" } }).where(eq(schema.rounds.id, roundId));

    // Nothing new to purge, but the leftovers go.
    expect(await purgeRecordings({ userId: u })).toEqual({ mockSessions: 0, assistedSessions: 0, debugRounds: 0, rounds: 0 });
    expect(await mock.getEvents(id)).toEqual([]);
    expect(await db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, id))).toEqual([]);
    const [drill] = await db.select().from(schema.drills).where(eq(schema.drills.sessionId, id));
    expect(drill).toMatchObject({ area: "testing", title: "Testing and edge cases" });
    expect(JSON.stringify(drill)).not.toContain("secret plan");
    expect((await db.select().from(schema.rounds).where(eq(schema.rounds.id, roundId)))[0].report).toBeNull();

    // The retention job (no user given) repairs too.
    await db.insert(schema.feedbackReports).values({ sessionId: id, userId: u, generator: "claude", report: { quote: "my secret plan" } });
    await purgeRecordings({ before: new Date(0) });
    expect(await db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, id))).toEqual([]);
  });
});
