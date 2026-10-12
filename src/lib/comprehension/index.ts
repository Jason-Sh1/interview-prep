import "server-only";
// Data access for code comprehension and debugging rounds: sessions, saving
// work in progress, the optional assistant, and the end-of-round report.

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { claudeEnabled } from "../interview/claude";
import { claudeDebugReport, claudeHelperReply } from "./claude";
import { gradeDebugRound, type DebugReport, type RunRecord } from "./grade";
import { helperReply } from "./helper";
import { DEBUG_TASK_BY_ID } from "./tasks";
import type { DebugTask } from "./types";

export type DebugAssistant = "claude" | "scripted" | "none";

export interface DebugRound {
  id: string;
  userId: string;
  task: DebugTask;
  minutes: number;
  assistant: DebugAssistant;
  startedAt: Date;
  endedAt: Date | null;
  files: Record<string, string>;
  chat: { role: "user" | "assistant"; text: string; t: number }[];
  runs: RunRecord[];
  report: DebugReport | null;
}

type Row = typeof schema.debugRounds.$inferSelect;

function fromRow(r: Row): DebugRound | null {
  const task = DEBUG_TASK_BY_ID.get(r.taskId);
  if (!task) return null;
  return {
    id: r.id,
    userId: r.userId,
    task,
    minutes: r.minutes,
    assistant: r.assistant as DebugAssistant,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    files: { ...task.files, ...(r.files ?? {}) },
    chat: r.chat,
    runs: r.runs,
    report: (r.report as unknown as DebugReport) ?? null,
  };
}

export const debugClock = (r: DebugRound) => Math.max(0, Date.now() - r.startedAt.getTime());

export async function createDebugRound(userId: string, taskId: string, minutes: number, withAssistant: boolean): Promise<string> {
  await ensureMigrated();
  if (!DEBUG_TASK_BY_ID.has(taskId)) throw new Error("Unknown task");
  const id = randomUUID();
  const assistant: DebugAssistant = !withAssistant ? "none" : claudeEnabled() ? "claude" : "scripted";
  await db.insert(schema.debugRounds).values({ id, userId, taskId, minutes, assistant });
  return id;
}

export async function getDebugRound(id: string, userId: string): Promise<DebugRound | null> {
  await ensureMigrated();
  const [r] = await db.select().from(schema.debugRounds).where(and(eq(schema.debugRounds.id, id), eq(schema.debugRounds.userId, userId)));
  return r ? fromRow(r) : null;
}

export async function listDebugRounds(userId: string): Promise<DebugRound[]> {
  await ensureMigrated();
  const rows = await db.select().from(schema.debugRounds).where(eq(schema.debugRounds.userId, userId)).orderBy(desc(schema.debugRounds.startedAt)).limit(30);
  return rows.flatMap((r) => fromRow(r) ?? []);
}

const open = (id: string) => and(eq(schema.debugRounds.id, id), isNull(schema.debugRounds.endedAt));

/** Saves the latest files and appends a test run, while the round is open. */
export async function saveDebugProgress(round: DebugRound, input: { files?: Record<string, string>; run?: { passed: number; total: number } }): Promise<void> {
  if (!input.files && !input.run) return;
  await db
    .update(schema.debugRounds)
    .set({
      ...(input.files ? { files: input.files } : {}),
      // Appended in SQL so two saves in flight can't drop a run.
      ...(input.run ? { runs: sql`${schema.debugRounds.runs} || ${JSON.stringify([{ t: debugClock(round), ...input.run }])}::jsonb` } : {}),
    })
    .where(open(round.id));
}

/** One assistant turn; the prompt and reply are kept for the report. */
export async function debugChat(round: DebugRound, text: string, files: Record<string, string>): Promise<string> {
  if (round.assistant === "none") throw new Error("This round has no assistant");
  const t = debugClock(round);
  const reply =
    round.assistant === "claude" ? await claudeHelperReply(round.task, round.chat, text, files) : helperReply(round.task, text);
  const turn = [
    { role: "user" as const, text, t },
    { role: "assistant" as const, text: reply, t: debugClock(round) },
  ];
  await db
    .update(schema.debugRounds)
    .set({ chat: sql`${schema.debugRounds.chat} || ${JSON.stringify(turn)}::jsonb` })
    .where(open(round.id));
  return reply;
}

export async function finishDebugRound(
  round: DebugRound,
  input: { files: Record<string, string>; answers: Record<string, string>; notes: string; tests: { passed: number; total: number; failing: string[] } },
): Promise<void> {
  await db
    .update(schema.debugRounds)
    .set({ endedAt: new Date(), files: input.files, answers: input.answers, notes: input.notes, testResults: input.tests })
    .where(open(round.id));
}

const inFlight = new Map<string, Promise<DebugReport>>();

export function generateDebugReport(round: DebugRound): Promise<DebugReport> {
  if (round.report) return Promise.resolve(round.report);
  const running = inFlight.get(round.id);
  if (running) return running;
  const p = buildReport(round).finally(() => inFlight.delete(round.id));
  inFlight.set(round.id, p);
  return p;
}

async function buildReport(round: DebugRound): Promise<DebugReport> {
  const [row] = await db.select().from(schema.debugRounds).where(eq(schema.debugRounds.id, round.id));
  if (!row?.endedAt) throw new Error("The round hasn't ended yet");
  if (row.report) return row.report as unknown as DebugReport;
  const input = {
    task: round.task,
    finalFiles: { ...round.task.files, ...(row.files ?? {}) },
    answers: row.answers ?? {},
    notes: row.notes ?? "",
    tests: row.testResults ?? { passed: 0, total: 0, failing: [] },
    runs: row.runs,
    prompts: row.chat.filter((m) => m.role === "user").length,
    withAssistant: row.assistant !== "none",
    durationMs: row.endedAt.getTime() - row.startedAt.getTime(),
  };
  let report = gradeDebugRound(input);
  if (claudeEnabled()) {
    try {
      report = await claudeDebugReport(input, report);
    } catch (e) {
      console.error("Claude grading failed; using the rule-based report", e);
    }
  }
  await db.update(schema.debugRounds).set({ report: report as unknown as Record<string, unknown> }).where(eq(schema.debugRounds.id, round.id));
  return report;
}
