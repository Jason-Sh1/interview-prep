import "server-only";
// Data access for live mock interviews: sessions, their event timeline, and
// interviewer turns (Claude when configured, the scripted interviewer otherwise).

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, ensureMigrated, schema } from "./db";
import { COMPANY_BY_ID } from "./engine/companies";
import { claudeEnabled, claudeTurn } from "./interview/claude";
import { livekitEnabled } from "./interview/livekit";
import { systemPrompt, turnMessage } from "./interview/prompt";
import { INITIAL_SCRIPT_STATE, scriptedTurn, type ScriptState } from "./interview/scripted";
import { turnContext } from "./interview/timeline";
import {
  SILENT,
  eventSchema,
  mockConfigSchema,
  type InterviewerKind,
  type MockConfig,
  type SessionEvent,
  type TranscriptPayload,
  type TurnKind,
  type VoiceMode,
} from "./interview/types";
import { PROBLEM_BY_SLUG } from "./problems";
import type { Problem } from "./problems/types";
import { starterCode, type Language } from "./runner/drivers";

export interface MockSession {
  id: string;
  userId: string;
  problemSlug: string;
  config: MockConfig;
  language: Language;
  voice: VoiceMode;
  interviewer: InterviewerKind;
  startedAt: Date;
  endedAt: Date | null;
  finalCode: string | null;
}

type Row = typeof schema.mockSessions.$inferSelect;

function fromRow(r: Row): MockSession {
  return {
    id: r.id,
    userId: r.userId,
    problemSlug: r.problemSlug,
    config: mockConfigSchema.parse(r.config),
    language: r.language as Language,
    voice: r.voice as VoiceMode,
    interviewer: r.interviewer as InterviewerKind,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    finalCode: r.finalCode,
  };
}

/** Which voice pipeline and interviewer a new session gets, from the environment. */
export function mockCapabilities(): { voice: VoiceMode; interviewer: InterviewerKind } {
  return { voice: livekitEnabled() ? "livekit" : "browser", interviewer: claudeEnabled() ? "claude" : "scripted" };
}

export async function createMockSession(userId: string, input: { slug: string; config: MockConfig; language: Language }): Promise<string> {
  await ensureMigrated();
  const id = randomUUID();
  const caps = mockCapabilities();
  await db.insert(schema.mockSessions).values({
    id,
    userId,
    problemSlug: input.slug,
    config: input.config,
    language: input.language,
    voice: caps.voice,
    interviewer: caps.interviewer,
    interviewerState: INITIAL_SCRIPT_STATE as unknown as Record<string, unknown>,
  });
  return id;
}

/** The session, if it exists and (when a user is given) belongs to them. */
export async function getMockSession(id: string, userId?: string): Promise<MockSession | null> {
  await ensureMigrated();
  const where = userId ? and(eq(schema.mockSessions.id, id), eq(schema.mockSessions.userId, userId)) : eq(schema.mockSessions.id, id);
  const [r] = await db.select().from(schema.mockSessions).where(where);
  return r ? fromRow(r) : null;
}

export async function listMockSessions(userId: string): Promise<MockSession[]> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(schema.mockSessions)
    .where(eq(schema.mockSessions.userId, userId))
    .orderBy(desc(schema.mockSessions.startedAt))
    .limit(50);
  return rows.map(fromRow);
}

export async function getEvents(sessionId: string): Promise<SessionEvent[]> {
  const rows = await db
    .select()
    .from(schema.sessionEvents)
    .where(eq(schema.sessionEvents.sessionId, sessionId))
    .orderBy(asc(schema.sessionEvents.t), asc(schema.sessionEvents.id));
  // Rows were validated on the way in; skip any that no longer parse.
  return rows.flatMap((r) => {
    const e = eventSchema.safeParse({ type: r.type, t: r.t, payload: r.payload });
    return e.success ? [e.data] : [];
  });
}

export async function appendEvents(sessionId: string, events: SessionEvent[]): Promise<void> {
  if (!events.length) return;
  await db.insert(schema.sessionEvents).values(
    events.map((e) => ({ sessionId, t: e.t, type: e.type, payload: e.payload as Record<string, unknown> })),
  );
}

/** Milliseconds since the session started, by the server clock. */
export const sessionClock = (s: MockSession) => Math.max(0, Date.now() - s.startedAt.getTime());

export async function endMockSession(s: MockSession, finalCode: string | null): Promise<void> {
  if (s.endedAt) return;
  await appendEvents(s.id, [{ type: "marker", t: sessionClock(s), payload: { what: "end" } }]);
  await db.update(schema.mockSessions).set({ endedAt: new Date(), finalCode }).where(eq(schema.mockSessions.id, s.id));
}

export interface TurnInput {
  kind: TurnKind;
  /** The candidate's words, for an utterance. */
  text?: string;
  source?: TranscriptPayload["source"];
  /** When the candidate started speaking, by the session clock. */
  startT?: number;
}

function companyName(config: MockConfig): string | null {
  return config.company ? (COMPANY_BY_ID[config.company]?.name ?? null) : null;
}

/**
 * Runs one interviewer turn and streams the reply text. Records the
 * candidate's utterance first and the interviewer's reply when it finishes,
 * so the transcript holds both sides. Yields nothing when the interviewer
 * stays quiet.
 */
export async function* runTurn(session: MockSession, input: TurnInput, signal?: AbortSignal): AsyncGenerator<string> {
  const problem = PROBLEM_BY_SLUG.get(session.problemSlug) as Problem;
  const events = await getEvents(session.id);
  const now = sessionClock(session);
  const lang = (events.findLast((e) => e.type === "snapshot")?.payload as { language?: Language } | undefined)?.language ?? session.language;
  const ctx = turnContext(events, { now, totalMs: session.config.minutes * 60_000, starter: starterCode(problem.signature, lang) });

  if (input.kind === "utterance") {
    if (!input.text?.trim()) return;
    await appendEvents(session.id, [
      {
        type: "transcript",
        t: now,
        payload: { speaker: "candidate", text: input.text.trim(), source: input.source ?? "typed", ...(input.startT !== undefined ? { startT: input.startT } : {}) },
      },
    ]);
  }

  const [row] = await db.select({ s: schema.mockSessions.interviewerState }).from(schema.mockSessions).where(eq(schema.mockSessions.id, session.id));
  const state = { ...INITIAL_SCRIPT_STATE, ...(row?.s as Partial<ScriptState>) };
  const scripted = scriptedTurn(state, { kind: input.kind, text: input.text, ctx, problem, config: session.config, companyName: companyName(session.config) });
  await db.update(schema.mockSessions).set({ interviewerState: scripted.state as unknown as Record<string, unknown> }).where(eq(schema.mockSessions.id, session.id));

  let reply = "";
  if (session.interviewer === "claude") {
    try {
      const chunks = claudeTurn(systemPrompt(problem, session.config, session.config.company ? (COMPANY_BY_ID[session.config.company] ?? null) : null), ctx.lines, turnMessage(input.kind, input.text, ctx), signal);
      // Hold back the start of the reply until it can't be the silent marker.
      let pending = "";
      let decided = false;
      for await (const chunk of chunks) {
        reply += chunk;
        if (decided) {
          yield chunk;
          continue;
        }
        pending += chunk;
        const head = pending.trimStart();
        if (head.length >= SILENT.length || !SILENT.startsWith(head)) {
          decided = true;
          if (head.startsWith(SILENT)) break;
          yield pending;
        }
      }
      if (!decided) reply = "";
    } catch (e) {
      if (signal?.aborted) return;
      console.error("Claude interviewer turn failed; using the scripted reply", e);
      reply = scripted.text;
      if (reply !== SILENT) yield reply;
    }
  } else {
    reply = scripted.text;
    if (reply !== SILENT) yield reply;
  }

  reply = reply.trim();
  if (!reply || reply.startsWith(SILENT)) return;
  await appendEvents(session.id, [
    { type: "transcript", t: sessionClock(session), payload: { speaker: "interviewer", text: reply, source: "interviewer" } },
  ]);
}
