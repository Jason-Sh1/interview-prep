import "server-only";
// Privacy: consent before recording a mock interview, a retention limit on
// recordings, and deleting everything a user has stored.
//
// What counts as a recording: a mock interview's timeline (transcript of both
// voices, code edits, test runs), its feedback report, which quotes the
// transcript, and the wording of the drills that report wrote; an AI-assisted round's chat, files and explanation; a debugging
// round's chat, files and answers; a conversation round's (system design)
// transcript, whiteboard and report. Audio itself is never stored by the app:
// speech is turned into text by the browser or by LiveKit, and only the text
// is kept.

import { and, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { isSingleUser, LOCAL_USER } from "./auth/mode";
import { db, ensureMigrated, schema } from "./db";
import { RUBRIC, RUBRIC_INFO } from "./feedback/analyze";

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
    super("Interviews record a transcript; agree to recording first.");
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
 *
 * A session still open is ended in the same step (dated now), so it can't go
 * on recording into the emptied row: every write path refuses ended sessions,
 * and the append helpers also refuse purged ones for writes already in flight.
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
    // A mock's drills stay in the plan (the area and the problem to practice it on), but their
    // title and advice were written from the transcript, so they become the rubric's generic text.
    for (const area of RUBRIC) {
      await db
        .update(schema.drills)
        .set({ title: RUBRIC_INFO[area].label, drill: RUBRIC_INFO[area].help })
        .where(and(inArray(schema.drills.sessionId, mockIds), eq(schema.drills.area, area)));
    }
    await db
      .update(schema.drills)
      .set({ title: "Practice", drill: "Work on this problem." })
      .where(and(inArray(schema.drills.sessionId, mockIds), notInArray(schema.drills.area, [...RUBRIC])));
    await db
      .update(m)
      .set({ finalCode: null, interviewerState: {}, endedAt: sql`coalesce(${m.endedAt}, ${now.toISOString()}::timestamp)`, purgedAt: now })
      .where(inArray(m.id, mockIds));
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
      .set({ finalFiles: null, explanation: null, report: null, assistantState: {}, endedAt: sql`coalesce(${a.endedAt}, ${now.toISOString()}::timestamp)`, purgedAt: now })
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
      .set({ files: null, chat: [], answers: null, notes: null, report: null, endedAt: sql`coalesce(${d.endedAt}, ${now.toISOString()}::timestamp)`, purgedAt: now })
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
    await db
      .update(r)
      .set({ transcript: [], artifact: {}, stage: {}, report: null, endedAt: sql`coalesce(${r.endedAt}, ${now.toISOString()}::timestamp)`, purgedAt: now })
      .where(inArray(r.id, roundIds));
  }

  return { mockSessions: mockIds.length, assistedSessions: assistedIds.length, debugRounds: debugIds.length, rounds: roundIds.length };
}

/** The daily retention job: purges recordings older than the limit. */
export function purgeExpired(now = new Date(), days = retentionDays()): Promise<PurgeCounts> {
  return purgeRecordings({ before: new Date(now.getTime() - days * 86_400_000) }, now);
}

const DAY_MS = 86_400_000;
const purgeState = globalThis as { __ipLastRetentionPurge?: number };

/**
 * The retention purge, at most once a day per server instance. Signed-in page
 * loads call it (lib/retention-schedule.ts), so recordings are deleted on time
 * even when the cron job isn't configured. Returns null when it didn't run.
 * After a failure it tries again an hour later rather than on every request.
 */
export async function purgeExpiredIfDue(now = new Date(), days = retentionDays()): Promise<PurgeCounts | null> {
  if (now.getTime() - (purgeState.__ipLastRetentionPurge ?? 0) < DAY_MS) return null;
  purgeState.__ipLastRetentionPurge = now.getTime();
  try {
    return await purgeExpired(now, days);
  } catch (e) {
    purgeState.__ipLastRetentionPurge = now.getTime() - DAY_MS + 3_600_000;
    throw e;
  }
}

/** Forget the last run, for tests. */
export const resetRetentionPurgeClock = () => void (purgeState.__ipLastRetentionPurge = undefined);

/**
 * When the retention purge actually runs, in words for the privacy page,
 * Settings and the consent notice. A Vercel cron job runs only on Vercel with
 * CRON_SECRET set; otherwise it's the once-a-day check on page loads.
 */
export function retentionSchedule(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL && env.CRON_SECRET
    ? "A scheduled job deletes them every day, so a recording can outlive the limit by up to a day."
    : "The app checks for them at most once a day, when someone uses the site, so a recording can outlive the limit by a day or until the next visit.";
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
  if (isSingleUser()) {
    // Start over as a fresh built-in user, which single-user mode prefers, rather
    // than becoming whichever other account in the database is oldest.
    await db.insert(schema.user).values(LOCAL_USER).onConflictDoNothing();
  }
  // Single-user mode caches its user; make the next request look it up again.
  (globalThis as { __ipLocalUser?: unknown }).__ipLocalUser = undefined;
}
