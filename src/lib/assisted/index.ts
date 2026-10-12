import "server-only";
// Data access for AI-assisted rounds: sessions, their timeline, the chat
// assistant (Claude when configured, the practice assistant otherwise), and
// the end-of-round report.

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { claudeEnabled } from "../interview/claude";
import { claudeAssistantReply } from "./claude";
import { gradeRound, type AssistedReport, type TestSummary } from "./grade";
import { claudeAssistedReport } from "./grade-claude";
import { INITIAL_SCRIPTED_STATE, scriptedReply, type ScriptedState } from "./scripted";
import { TASK_BY_ID } from "./tasks";
import { ASSISTANT_MODELS, SCRIPTED_MODEL, assistedEventSchema, type AssistantKind, type AssistedEvent, type AssistedTask } from "./types";

export interface AssistedSession {
  id: string;
  userId: string;
  task: AssistedTask;
  minutes: number;
  assistant: AssistantKind;
  startedAt: Date;
  endedAt: Date | null;
  finalFiles: Record<string, string> | null;
  explanation: string | null;
  report: AssistedReport | null;
}

type Row = typeof schema.assistedSessions.$inferSelect;

function fromRow(r: Row): AssistedSession | null {
  const task = TASK_BY_ID.get(r.taskId);
  if (!task) return null;
  return {
    id: r.id,
    userId: r.userId,
    task,
    minutes: r.minutes,
    assistant: r.assistant as AssistantKind,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    finalFiles: r.finalFiles ?? null,
    explanation: r.explanation,
    report: (r.report as unknown as AssistedReport) ?? null,
  };
}

export const assistantKind = (): AssistantKind => (claudeEnabled() ? "claude" : "scripted");

/** The models the chat offers for a session. */
export function modelChoices(kind: AssistantKind) {
  return kind === "claude" ? [...ASSISTANT_MODELS] : [SCRIPTED_MODEL];
}

export async function createAssistedSession(userId: string, taskId: string, minutes: number): Promise<string> {
  await ensureMigrated();
  if (!TASK_BY_ID.has(taskId)) throw new Error("Unknown task");
  const id = randomUUID();
  await db.insert(schema.assistedSessions).values({
    id,
    userId,
    taskId,
    minutes,
    assistant: assistantKind(),
    assistantState: INITIAL_SCRIPTED_STATE as unknown as Record<string, unknown>,
  });
  await appendAssistedEvents(id, [{ type: "marker", t: 0, payload: { what: "start" } }]);
  return id;
}

export async function getAssistedSession(id: string, userId: string): Promise<AssistedSession | null> {
  await ensureMigrated();
  const [r] = await db
    .select()
    .from(schema.assistedSessions)
    .where(and(eq(schema.assistedSessions.id, id), eq(schema.assistedSessions.userId, userId)));
  return r ? fromRow(r) : null;
}

export async function listAssistedSessions(userId: string): Promise<AssistedSession[]> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(schema.assistedSessions)
    .where(eq(schema.assistedSessions.userId, userId))
    .orderBy(desc(schema.assistedSessions.startedAt))
    .limit(30);
  return rows.flatMap((r) => fromRow(r) ?? []);
}

export async function getAssistedEvents(sessionId: string): Promise<AssistedEvent[]> {
  const rows = await db
    .select()
    .from(schema.assistedEvents)
    .where(eq(schema.assistedEvents.sessionId, sessionId))
    .orderBy(asc(schema.assistedEvents.t), asc(schema.assistedEvents.id));
  return rows.flatMap((r) => {
    const e = assistedEventSchema.safeParse({ type: r.type, t: r.t, payload: r.payload });
    return e.success ? [e.data] : [];
  });
}

export async function appendAssistedEvents(sessionId: string, events: AssistedEvent[]): Promise<void> {
  if (!events.length) return;
  await db
    .insert(schema.assistedEvents)
    .values(events.map((e) => ({ sessionId, t: e.t, type: e.type, payload: e.payload as Record<string, unknown> })));
}

export const assistedClock = (s: AssistedSession) => Math.max(0, Date.now() - s.startedAt.getTime());

/** The chat as the candidate sees it: prompts and replies, without planted-bug details. */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  model: string;
  t: number;
}

export function visibleChat(events: AssistedEvent[]): ChatMessage[] {
  return events.flatMap((e): ChatMessage[] =>
    e.type === "prompt"
      ? [{ role: "user", text: e.payload.text, model: e.payload.model, t: e.t }]
      : e.type === "reply"
        ? [{ role: "assistant", text: e.payload.text, model: e.payload.model, t: e.t }]
        : [],
  );
}

/** One chat turn: records the prompt, asks the assistant, records and returns the reply. */
export async function chat(session: AssistedSession, input: { text: string; model: string; files: Record<string, string> }): Promise<string> {
  const allowed = modelChoices(session.assistant).map((m) => m.id as string);
  const model = allowed.includes(input.model) ? input.model : allowed[0];
  await appendAssistedEvents(session.id, [{ type: "prompt", t: assistedClock(session), payload: { text: input.text, model } }]);

  const [row] = await db
    .select({ s: schema.assistedSessions.assistantState })
    .from(schema.assistedSessions)
    .where(eq(schema.assistedSessions.id, session.id));
  const state: ScriptedState = { ...INITIAL_SCRIPTED_STATE, ...(row?.s as Partial<ScriptedState>) };

  let text: string;
  let planted: { id?: string; description: string } | undefined;
  if (session.assistant === "claude") {
    const events = await getAssistedEvents(session.id);
    const history: { prompt: string; reply: string }[] = [];
    let pending: string | null = null;
    for (const e of events) {
      if (e.type === "prompt") pending = e.payload.text;
      else if (e.type === "reply" && pending !== null) {
        history.push({ prompt: pending, reply: e.payload.text });
        pending = null;
      }
    }
    // The prompt just recorded is the last one; it isn't part of the history.
    const plantedSoFar = events.filter((e) => e.type === "reply" && e.payload.planted).length;
    const plant = Math.random() < (plantedSoFar === 0 && history.length >= 1 ? 0.6 : 0.25);
    const res = await claudeAssistantReply({ task: session.task, model, history, prompt: input.text, files: input.files, plant });
    text = res.text;
    planted = res.planted;
  } else {
    const res = scriptedReply(session.task, state, input.text, session.id);
    text = res.text;
    planted = res.planted;
    await db
      .update(schema.assistedSessions)
      .set({ assistantState: res.state as unknown as Record<string, unknown> })
      .where(eq(schema.assistedSessions.id, session.id));
  }
  await appendAssistedEvents(session.id, [{ type: "reply", t: assistedClock(session), payload: { text, model, ...(planted ? { planted } : {}) } }]);
  return text;
}

/** Ends the round with the final code, the candidate's explanation and the full test results. */
export async function finishAssisted(
  session: AssistedSession,
  input: { files: Record<string, string>; explanation: string; tests: TestSummary },
): Promise<void> {
  if (session.endedAt) return;
  const t = assistedClock(session);
  await appendAssistedEvents(session.id, [
    { type: "snapshot", t, payload: { files: input.files } },
    { type: "marker", t, payload: { what: "end" } },
  ]);
  await db
    .update(schema.assistedSessions)
    .set({
      endedAt: new Date(),
      finalFiles: input.files,
      explanation: input.explanation,
      testResults: input.tests as unknown as Record<string, unknown>,
    })
    .where(and(eq(schema.assistedSessions.id, session.id), isNull(schema.assistedSessions.endedAt)));
}

const inFlight = new Map<string, Promise<AssistedReport>>();

/** Builds and stores the report for a finished round, once. */
export function generateAssistedReport(session: AssistedSession): Promise<AssistedReport> {
  if (session.report) return Promise.resolve(session.report);
  const running = inFlight.get(session.id);
  if (running) return running;
  const p = buildReport(session).finally(() => inFlight.delete(session.id));
  inFlight.set(session.id, p);
  return p;
}

async function buildReport(session: AssistedSession): Promise<AssistedReport> {
  const [row] = await db.select().from(schema.assistedSessions).where(eq(schema.assistedSessions.id, session.id));
  if (!row?.endedAt) throw new Error("The round hasn't ended yet");
  if (row.report) return row.report as unknown as AssistedReport;
  const events = await getAssistedEvents(session.id);
  const input = {
    task: session.task,
    events,
    finalFiles: row.finalFiles ?? session.task.files,
    explanation: row.explanation ?? "",
    tests: (row.testResults as unknown as TestSummary) ?? { passed: 0, total: 0, failing: [] },
    durationMs: row.endedAt.getTime() - row.startedAt.getTime(),
  };
  let report = gradeRound(input);
  if (claudeEnabled()) {
    try {
      report = await claudeAssistedReport(input, report);
    } catch (e) {
      console.error("Claude grading failed; using the rule-based report", e);
    }
  }
  await db
    .update(schema.assistedSessions)
    .set({ report: report as unknown as Record<string, unknown> })
    .where(eq(schema.assistedSessions.id, session.id));
  return report;
}
