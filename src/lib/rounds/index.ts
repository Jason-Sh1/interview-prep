import "server-only";
// Data access and the turn loop for conversation rounds (system design,
// behavioral, code walkthrough): create and load rounds, save the artifact,
// run interviewer turns (Claude or scripted), finish, and build the report.

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { COMPANY_BY_ID } from "../engine/companies";
import { claudeEnabled, claudeTurn } from "../interview/claude";
import { claudeRoundReport, roundTurnMessage } from "./claude";
import type { RoundKindDef } from "./kind";
import { getApprovedProfiles } from "../research";
import { builtKinds, kindDef } from "./registry";
import { suggestRounds } from "./suggest";
import { ROUND_SILENT, type RoundConfig, type RoundKind, type RoundReport, type Turn, type TurnInput } from "./types";

export interface Round {
  id: string;
  userId: string;
  kind: RoundKind;
  topicId: string;
  config: RoundConfig;
  interviewer: "claude" | "scripted";
  artifact: Record<string, unknown>;
  transcript: Turn[];
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  report: RoundReport | null;
}

type Row = typeof schema.rounds.$inferSelect;

const fromRow = (r: Row): Round => ({
  id: r.id,
  userId: r.userId,
  kind: r.kind as RoundKind,
  topicId: r.topicId,
  config: r.config as unknown as RoundConfig,
  interviewer: r.interviewer as Round["interviewer"],
  artifact: r.artifact,
  transcript: r.transcript,
  createdAt: r.createdAt,
  startedAt: r.startedAt,
  endedAt: r.endedAt,
  report: (r.report as unknown as RoundReport) ?? null,
});

/** Slack past the time box for a last turn in flight and clock drift. */
export const ROUND_GRACE_MS = 2 * 60_000;
/** A round left open this long past its time box is ended at its last activity. */
const ABANDON_MS = 15 * 60_000;

export const roundClock = (r: Pick<Round, "startedAt">, now = Date.now()) => (r.startedAt ? Math.max(0, now - r.startedAt.getTime()) : 0);
export const roundTimeUp = (r: Pick<Round, "startedAt" | "config">, now = Date.now()) => roundClock(r, now) > r.config.minutes * 60_000 + ROUND_GRACE_MS;

export class RoundClosedError extends Error {
  constructor(message = "This round has ended.") {
    super(message);
  }
}

const companyOf = (config: RoundConfig) => (config.company ? (COMPANY_BY_ID[config.company] ?? null) : null);

export async function createRound(userId: string, kind: RoundKind, topicId: string, config: RoundConfig, artifact?: Record<string, unknown>): Promise<string> {
  await ensureMigrated();
  const def = kindDef(kind);
  if (!def || !def.topics.some((t) => t.id === topicId)) throw new Error("Unknown round topic");
  const id = randomUUID();
  await db.insert(schema.rounds).values({
    id,
    userId,
    kind,
    topicId,
    config: config as unknown as Record<string, unknown>,
    interviewer: claudeEnabled() ? "claude" : "scripted",
    artifact: (artifact ?? def.initialArtifact(topicId)) as Record<string, unknown>,
  });
  return id;
}

/** Loads a round, ending it first if it was abandoned long past its time box. */
export async function getRound(id: string, userId: string): Promise<Round | null> {
  await ensureMigrated();
  const [r] = await db.select().from(schema.rounds).where(and(eq(schema.rounds.id, id), eq(schema.rounds.userId, userId)));
  if (!r) return null;
  const round = fromRow(r);
  if (!round.endedAt && round.startedAt && roundClock(round) > round.config.minutes * 60_000 + ABANDON_MS) {
    const lastT = round.transcript.at(-1)?.t ?? 0;
    const endedAt = new Date(round.startedAt.getTime() + Math.min(lastT, round.config.minutes * 60_000));
    await db.update(schema.rounds).set({ endedAt }).where(and(eq(schema.rounds.id, id), isNull(schema.rounds.endedAt)));
    round.endedAt = endedAt;
  }
  return round;
}

export async function listRounds(userId: string, kind?: RoundKind, limit = 30): Promise<Round[]> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(schema.rounds)
    .where(kind ? and(eq(schema.rounds.userId, userId), eq(schema.rounds.kind, kind)) : eq(schema.rounds.userId, userId))
    .orderBy(desc(schema.rounds.createdAt))
    .limit(limit);
  return rows.map(fromRow);
}

const open = (id: string) => and(eq(schema.rounds.id, id), isNull(schema.rounds.endedAt));

function defFor(round: Round): RoundKindDef {
  const def = kindDef(round.kind);
  if (!def) throw new Error(`Unknown round kind ${round.kind}`);
  return def;
}

/** Validates and saves the artifact while the round is open and in time. */
export async function saveArtifact(round: Round, artifact: unknown): Promise<void> {
  if (round.endedAt) throw new RoundClosedError();
  if (roundTimeUp(round)) throw new RoundClosedError("Time's up for this round. Press End to get your report.");
  const parsed = defFor(round).artifactSchema.parse(artifact);
  await db.update(schema.rounds).set({ artifact: parsed as Record<string, unknown> }).where(open(round.id));
  round.artifact = parsed as Record<string, unknown>;
}

async function appendTurn(id: string, turn: Turn) {
  await db
    .update(schema.rounds)
    .set({ transcript: sql`${schema.rounds.transcript} || ${JSON.stringify([turn])}::jsonb` })
    .where(eq(schema.rounds.id, id));
}

/**
 * One interviewer turn, streamed as text chunks. A "start" turn starts the
 * clock. The candidate's words and everything sent back are recorded, even
 * when the turn is cut off by a newer one.
 */
export async function* runRoundTurn(round: Round, input: TurnInput, signal?: AbortSignal): AsyncGenerator<string> {
  if (round.endedAt) throw new RoundClosedError();
  const def = defFor(round);
  if (input.kind === "start" && !round.startedAt) {
    const startedAt = new Date();
    await db.update(schema.rounds).set({ startedAt }).where(and(open(round.id), isNull(schema.rounds.startedAt)));
    round.startedAt = startedAt;
  }
  if (!round.startedAt) throw new RoundClosedError("Press Start first.");
  if (roundTimeUp(round)) throw new RoundClosedError("Time's up for this round. Press End to get your report.");
  // Only open the round once; a reload re-sends "start".
  if (input.kind === "start" && round.transcript.some((t) => t.speaker === "interviewer")) return;

  const now = roundClock(round);
  const totalMs = round.config.minutes * 60_000;
  if (input.kind === "say") {
    const turn: Turn = { speaker: "candidate", text: input.text.trim(), t: now, source: input.source };
    await appendTurn(round.id, turn);
    round.transcript = [...round.transcript, turn];
  }

  const [row] = await db.select({ stage: schema.rounds.stage }).from(schema.rounds).where(eq(schema.rounds.id, round.id));
  const company = companyOf(round.config);
  const scripted = def.scripted({
    topicId: round.topicId,
    config: round.config,
    companyName: company?.name ?? null,
    transcript: round.transcript,
    artifact: round.artifact,
    input,
    elapsedMs: now,
    remainingMs: totalMs - now,
    state: row?.stage ?? {},
  });
  await db.update(schema.rounds).set({ stage: scripted.state }).where(eq(schema.rounds.id, round.id));

  let sent = "";
  let finished = false;
  try {
    if (round.interviewer === "claude") {
      try {
        const message = roundTurnMessage(input, {
          elapsedMs: now,
          remainingMs: totalMs - now,
          artifact: def.describeArtifact(round.topicId, round.artifact),
          artifactLabel: round.kind === "design" ? "Whiteboard and notes" : round.kind === "behavioral" ? "Candidate's story notes" : "The code under discussion",
        });
        const history = input.kind === "say" ? round.transcript.slice(0, -1) : round.transcript;
        const chunks = claudeTurn(def.systemPrompt(round.topicId, round.config, company), history, message, signal);
        // Hold back the start of the reply until it can't be the silent marker.
        let pending = "";
        let decided = false;
        for await (const chunk of chunks) {
          if (decided) {
            sent += chunk;
            yield chunk;
            continue;
          }
          pending += chunk;
          const head = pending.trimStart();
          if (head.length >= ROUND_SILENT.length || !ROUND_SILENT.startsWith(head)) {
            decided = true;
            if (head.startsWith(ROUND_SILENT)) break;
            sent += pending;
            yield pending;
          }
        }
      } catch (e) {
        if (signal?.aborted) return;
        console.error("Claude round interviewer turn failed", e);
        if (!sent && scripted.text !== ROUND_SILENT) {
          sent = scripted.text;
          yield scripted.text;
        }
      }
    } else if (scripted.text !== ROUND_SILENT) {
      sent = scripted.text;
      yield scripted.text;
    }
    finished = true;
  } finally {
    const text = sent.trim();
    if (text && !text.startsWith(ROUND_SILENT)) {
      await appendTurn(round.id, { speaker: "interviewer", text, t: roundClock(round), ...(finished && !signal?.aborted ? {} : { interrupted: true }) });
    }
  }
}

/** Ends the round, saving the final artifact if it arrived in time. */
export async function finishRound(round: Round, artifact?: unknown): Promise<void> {
  if (round.endedAt) return;
  const def = defFor(round);
  const set: Partial<typeof schema.rounds.$inferInsert> = { endedAt: new Date() };
  if (artifact !== undefined && !roundTimeUp(round)) {
    const parsed = def.artifactSchema.safeParse(artifact);
    if (parsed.success) set.artifact = parsed.data as Record<string, unknown>;
  }
  if (!round.startedAt) set.startedAt = set.endedAt;
  await db.update(schema.rounds).set(set).where(open(round.id));
}

const inFlight = new Map<string, Promise<RoundReport>>();

export function generateRoundReport(round: Round): Promise<RoundReport> {
  if (round.report) return Promise.resolve(round.report);
  const running = inFlight.get(round.id);
  if (running) return running;
  const p = buildReport(round.id).finally(() => inFlight.delete(round.id));
  inFlight.set(round.id, p);
  return p;
}

async function buildReport(id: string): Promise<RoundReport> {
  const [row] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, id));
  if (!row?.endedAt) throw new Error("The round hasn't ended yet");
  if (row.report) return row.report as unknown as RoundReport;
  const round = fromRow(row);
  const def = defFor(round);
  const ctx = {
    topicId: round.topicId,
    config: round.config,
    companyName: companyOf(round.config)?.name ?? null,
    transcript: round.transcript,
    artifact: round.artifact,
    durationMs: round.startedAt ? Math.max(0, row.endedAt.getTime() - round.startedAt.getTime()) : 0,
  };
  let report = def.grade(ctx);
  if (claudeEnabled() && round.transcript.some((t) => t.speaker === "candidate")) {
    try {
      report = await claudeRoundReport(def, ctx, report);
    } catch (e) {
      console.error("Claude round grading failed; using the rule-based report", e);
    }
  }
  await db.update(schema.rounds).set({ report: report as unknown as Record<string, unknown> }).where(eq(schema.rounds.id, id));
  return report;
}

/** Today's suggested conversation rounds, with the last report's top focus area for each. */
export async function getRoundSuggestions(userId: string, goals: { level: string; targetCompanies: string[] }, daysLeft: number | null, now = new Date()) {
  const [all, profiles] = await Promise.all([listRounds(userId, undefined, 100), getApprovedProfiles().catch(() => new Map<string, never>())]);
  const built = builtKinds();
  const history = built.map((kind) => {
    const mine = all.filter((r) => r.kind === kind);
    const graded = mine.find((r) => r.report);
    return { kind, last: mine[0] ? (mine[0].startedAt ?? mine[0].createdAt) : null, focus: graded?.report?.focus[0] ?? null };
  });
  const loops: Record<string, string> = {};
  for (const t of goals.targetCompanies) loops[t] = profiles.get(t)?.data.loop ?? "";
  return { suggestions: suggestRounds({ level: goals.level, daysLeft, targets: goals.targetCompanies, loops, history, built, now }), history };
}
