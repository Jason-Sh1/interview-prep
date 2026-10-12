import "server-only";
// Feedback reports: built once when a finished mock is first viewed, stored,
// and fed back into the learning track at the same moment.

import { eq } from "drizzle-orm";
import { db, ensureMigrated, schema } from "../db";
import { COMPANY_BY_ID } from "../engine/companies";
import { claudeEnabled } from "../interview/claude";
import { getEvents, type MockSession } from "../mock";
import { PROBLEM_BY_SLUG } from "../problems";
import { applyMockFeedback, getGoals } from "../track";
import { analyzeSession, type FeedbackReport } from "./analyze";
import { claudeReport } from "./claude";
import type { TrackChange } from "./track-update";

export interface StoredReport {
  report: FeedbackReport;
  trackChanges: TrackChange[];
  createdAt: Date;
}

export async function getReport(sessionId: string): Promise<StoredReport | null> {
  await ensureMigrated();
  const [r] = await db.select().from(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, sessionId));
  if (!r) return null;
  return { report: r.report as unknown as FeedbackReport, trackChanges: r.trackChanges as unknown as TrackChange[], createdAt: r.createdAt };
}

// One generation per session at a time, so a double click or two tabs don't run it twice.
const inFlight = new Map<string, Promise<StoredReport>>();

/** Builds, stores and applies the report for a finished session; returns the existing one if there is one. */
export function generateReport(session: MockSession): Promise<StoredReport> {
  const running = inFlight.get(session.id);
  if (running) return running;
  const p = build(session).finally(() => inFlight.delete(session.id));
  inFlight.set(session.id, p);
  return p;
}

async function build(session: MockSession): Promise<StoredReport> {
  const existing = await getReport(session.id);
  if (existing) return existing;
  if (!session.endedAt) throw new Error("The interview hasn't ended yet");
  const problem = PROBLEM_BY_SLUG.get(session.problemSlug);
  if (!problem) throw new Error("Unknown problem");

  const [events, goals] = await Promise.all([getEvents(session.id), getGoals(session.userId)]);
  const level = goals?.level ?? "mid";
  const companyName = session.config.company ? (COMPANY_BY_ID[session.config.company]?.name ?? null) : null;
  const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
  let report = analyzeSession({ events, problem, durationMs, company: session.config.company, level }, companyName);
  if (claudeEnabled()) {
    try {
      report = await claudeReport(events, problem, report, { level, companyName, minutes: session.config.minutes });
    } catch (e) {
      console.error("Claude feedback failed; using the rule-based report", e);
    }
  }

  // Insert first so the track is only changed by the request that created the report.
  const [inserted] = await db
    .insert(schema.feedbackReports)
    .values({ sessionId: session.id, userId: session.userId, generator: report.generator, report: report as unknown as Record<string, unknown> })
    .onConflictDoNothing()
    .returning({ createdAt: schema.feedbackReports.createdAt });
  if (!inserted) return (await getReport(session.id)) as StoredReport;

  const trackChanges = await applyMockFeedback(session.userId, problem, report);
  await db
    .update(schema.feedbackReports)
    .set({ trackChanges: trackChanges as unknown as Record<string, unknown>[] })
    .where(eq(schema.feedbackReports.sessionId, session.id));
  return { report, trackChanges, createdAt: inserted.createdAt };
}
