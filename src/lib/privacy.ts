import "server-only";
// Privacy: consent before recording a mock interview, a retention limit on
// recordings, and deleting everything a user has stored.
//
// What counts as a recording: a mock interview's timeline (transcript of both
// voices, code edits, test runs) and its feedback report, which quotes the
// transcript; an AI-assisted round's chat, files and explanation; a debugging
// round's chat, files and answers; a conversation round's (system design)
// transcript, whiteboard and report. Audio itself is never stored by the app:
// speech is turned into text by the browser or by LiveKit, and only the text
// is kept.

import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db, ensureMigrated, schema } from "./db";

/** Bump when the consent text changes materially, so everyone is asked again. */
export const CONSENT_VERSION = 1;

export const DEFAULT_RETENTION_DAYS = 90;

/** Days recordings are kept, from RETENTION_DAYS (1 to 3650), default 90. */
export function retentionDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.RETENTION_DAYS ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 3650) : DEFAULT_RETENTION_DAYS;
}

export interface PrivacyState {
  recordingConsent: boolean;
  consentAt: Date | null;
}

export async function getPrivacy(userId: string): Promise<PrivacyState> {
  await ensureMigrated();
  const [r] = await db.select().from(schema.privacySettings).where(eq(schema.privacySettings.userId, userId));
  const ok = !!r?.recordingConsentAt && (r.recordingConsentVersion ?? 0) >= CONSENT_VERSION;
  return { recordingConsent: ok, consentAt: ok ? r!.recordingConsentAt : null };
}

export const hasRecordingConsent = async (userId: string) => (await getPrivacy(userId)).recordingConsent;

export async function setRecordingConsent(userId: string, granted: boolean, now = new Date()): Promise<void> {
  await ensureMigrated();
  const values = granted
    ? { recordingConsentAt: now, recordingConsentVersion: CONSENT_VERSION, updatedAt: now }
    : { recordingConsentAt: null, recordingConsentVersion: null, updatedAt: now };
  await db
    .insert(schema.privacySettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.privacySettings.userId, set: values });
}

export class ConsentRequiredError extends Error {
  constructor() {
    super("Mock interviews record a transcript; agree to recording first.");
    this.name = "ConsentRequiredError";
  }
}

export interface PurgeCounts {
  mockSessions: number;
  assistedSessions: number;
  debugRounds: number;
  /** Conversation rounds (system design and later formats). */
  rounds: number;
}

/**
 * Deletes recordings, keeping a content-free row (problem, dates) so progress
 * counts and analytics still add up. With `before`, only sessions started
 * before then (the retention limit); with `userId`, only that user's.
 */
export async function purgeRecordings(opts: { before?: Date; userId?: string }, now = new Date()): Promise<PurgeCounts> {
  await ensureMigrated();
  const m = schema.mockSessions;
  const a = schema.assistedSessions;
  const d = schema.debugRounds;

  const mockIds = (
    await db
      .select({ id: m.id })
      .from(m)
      .where(and(isNull(m.purgedAt), opts.before ? lt(m.startedAt, opts.before) : undefined, opts.userId ? eq(m.userId, opts.userId) : undefined))
  ).map((r) => r.id);
  if (mockIds.length) {
    await db.delete(schema.sessionEvents).where(inArray(schema.sessionEvents.sessionId, mockIds));
    await db.delete(schema.feedbackReports).where(inArray(schema.feedbackReports.sessionId, mockIds));
    await db.update(m).set({ finalCode: null, interviewerState: {}, purgedAt: now }).where(inArray(m.id, mockIds));
  }

  const assistedIds = (
    await db
      .select({ id: a.id })
      .from(a)
      .where(and(isNull(a.purgedAt), opts.before ? lt(a.startedAt, opts.before) : undefined, opts.userId ? eq(a.userId, opts.userId) : undefined))
  ).map((r) => r.id);
  if (assistedIds.length) {
    await db.delete(schema.assistedEvents).where(inArray(schema.assistedEvents.sessionId, assistedIds));
    await db
      .update(a)
      .set({ finalFiles: null, explanation: null, report: null, assistantState: {}, purgedAt: now })
      .where(inArray(a.id, assistedIds));
  }

  const debugIds = (
    await db
      .select({ id: d.id })
      .from(d)
      .where(and(isNull(d.purgedAt), opts.before ? lt(d.startedAt, opts.before) : undefined, opts.userId ? eq(d.userId, opts.userId) : undefined))
  ).map((r) => r.id);
  if (debugIds.length) {
    await db
      .update(d)
      .set({ files: null, chat: [], answers: null, notes: null, report: null, purgedAt: now })
      .where(inArray(d.id, debugIds));
  }

  const r = schema.rounds;
  const roundIds = (
    await db
      .select({ id: r.id })
      .from(r)
      .where(and(isNull(r.purgedAt), opts.before ? lt(r.createdAt, opts.before) : undefined, opts.userId ? eq(r.userId, opts.userId) : undefined))
  ).map((x) => x.id);
  if (roundIds.length) {
    await db.update(r).set({ transcript: [], artifact: {}, stage: {}, report: null, purgedAt: now }).where(inArray(r.id, roundIds));
  }

  return { mockSessions: mockIds.length, assistedSessions: assistedIds.length, debugRounds: debugIds.length, rounds: roundIds.length };
}

/** The daily retention job: purges recordings older than the limit. */
export function purgeExpired(now = new Date(), days = retentionDays()): Promise<PurgeCounts> {
  return purgeRecordings({ before: new Date(now.getTime() - days * 86_400_000) }, now);
}

/**
 * Deletes the user and everything that references them (every progress,
 * recording and privacy table cascades from user.id), and removes their email
 * from research reviews they signed off.
 */
export async function deleteAllUserData(user: { id: string; email: string }): Promise<void> {
  await ensureMigrated();
  await db.update(schema.companyProfiles).set({ reviewedBy: "deleted user" }).where(eq(schema.companyProfiles.reviewedBy, user.email));
  await db.delete(schema.user).where(eq(schema.user.id, user.id));
  // Single-user mode caches the built-in user; make the next request start fresh.
  (globalThis as { __ipLocalUser?: unknown }).__ipLocalUser = undefined;
}
