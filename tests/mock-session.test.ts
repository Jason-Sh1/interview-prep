import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { fromStart } from "@/lib/feedback/analyze";
import type { SessionEvent } from "@/lib/interview/types";

describe("fromStart", () => {
  it("counts the report from the Start press", () => {
    const events: SessionEvent[] = [
      { type: "snapshot", t: 1_000, payload: { code: "", language: "python" } },
      { type: "marker", t: 120_000, payload: { what: "start" } },
      { type: "transcript", t: 150_000, payload: { speaker: "candidate", text: "Can the input be empty?", source: "typed", startT: 145_000 } },
    ];
    const out = fromStart(events, 600_000);
    expect(out.offset).toBe(120_000);
    expect(out.durationMs).toBe(480_000);
    expect(out.events.map((e) => e.t)).toEqual([0, 0, 30_000]);
    expect((out.events[2].payload as { startT: number }).startT).toBe(25_000);
    expect(fromStart(events.slice(2), 600_000).offset).toBe(0);
  });
});

// Against an embedded database, with the scripted interviewer (no API key).
describe("mock sessions", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "mock-db-"));
    delete process.env.ANTHROPIC_API_KEY;
  });

  async function setup() {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const mock = await import("@/lib/mock");
    await ensureMigrated();
    const userId = `u-${Math.random().toString(36).slice(2)}`;
    await db.insert(schema.user).values({ id: userId, name: "T", email: `${userId}@x.dev` });
    const id = await mock.createMockSession(userId, {
      slug: "pair-with-target-sum",
      config: { persona: "friendly", minutes: 30, hintsAllowed: true, company: null },
      language: "python",
    });
    return { db, schema, mock, id, userId };
  }

  it("records an interviewer reply that was cut off", async () => {
    const { mock, id } = await setup();
    const session = (await mock.getMockSession(id))!;
    const turn = mock.runTurn(session, { kind: "start" });
    const first = await turn.next();
    expect(first.done).toBe(false);
    await turn.return(undefined); // a new turn aborted this one
    const lines = (await mock.getEvents(id)).filter((e) => e.type === "transcript");
    expect(lines).toHaveLength(1);
    expect(lines[0].payload).toMatchObject({ speaker: "interviewer", interrupted: true, text: String(first.value).trim() });
  });

  it("ends an abandoned session at its last activity", async () => {
    const { db, schema, mock, id } = await setup();
    const { eq } = await import("drizzle-orm");
    // Started two days ago; the last thing recorded was 10 minutes in.
    const startedAt = new Date(Date.now() - 2 * 86_400_000);
    await db.update(schema.mockSessions).set({ startedAt }).where(eq(schema.mockSessions.id, id));
    await mock.appendEvents(id, [{ type: "snapshot", t: 600_000, payload: { code: "def f(): pass", language: "python" } }]);
    const session = (await mock.getMockSession(id))!;
    expect(session.endedAt?.getTime()).toBe(startedAt.getTime() + 600_000);
    const events = await mock.getEvents(id);
    expect(events.at(-1)).toMatchObject({ type: "marker", t: 600_000, payload: { what: "end" } });
    // A session still within its time is left alone.
    const fresh = await setup();
    expect((await fresh.mock.getMockSession(fresh.id))!.endedAt).toBeNull();
  });

  it("gives a late Start its full time before ending the session", async () => {
    const { db, schema, mock, id } = await setup();
    const { eq } = await import("drizzle-orm");
    // Set up 50 minutes ago, Start pressed 30 minutes in: still inside 30 minutes plus overtime.
    await db.update(schema.mockSessions).set({ startedAt: new Date(Date.now() - 50 * 60_000) }).where(eq(schema.mockSessions.id, id));
    await mock.appendEvents(id, [{ type: "marker", t: 30 * 60_000, payload: { what: "start" } }]);
    expect((await mock.getMockSession(id))!.endedAt).toBeNull();
  });
});

describe("interview clock", () => {
  it("runs from the Start press, not from session setup", async () => {
    const { turnContext } = await import("@/lib/interview/timeline");
    const setup: SessionEvent[] = [{ type: "snapshot", t: 1_000, payload: { code: "", language: "python" } }];
    // Five minutes of reading before Start don't count against the interview.
    const started: SessionEvent[] = [...setup, { type: "marker", t: 300_000, payload: { what: "start" } }];
    expect(turnContext(started, { now: 360_000, totalMs: 1_800_000, starter: "" })).toMatchObject({ elapsedMs: 60_000, remainingMs: 1_740_000 });
  });
});
