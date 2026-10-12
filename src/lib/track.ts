import "server-only";
// Data access for the learning track: reads the user's state, builds the
// plan, and records attempts (rating update, stuck detection, FSRS review).

import { and, desc, eq, gte } from "drizzle-orm";
import { db, ensureMigrated, schema } from "./db";
import { gradeFor, cardFromJson, cardToJson, newCard, reviewCard, type Confidence } from "./engine/fsrs";
import type { SkillMap } from "./engine/mastery";
import { buildPlan, type AttemptSummary, type DailyPlan } from "./engine/planner";
import { attemptScore, INITIAL_RATING, INITIAL_UNCERTAINTY, isFastTrack, updateSkill } from "./engine/rating";
import type { FeedbackReport } from "./feedback/analyze";
import { planMockUpdate, type TrackChange } from "./feedback/track-update";
import { PROBLEM_BY_SLUG, PROBLEMS } from "./problems";
import { getLiveCompanies } from "./research";
import type { PatternId, Problem } from "./problems/types";
import type { Language } from "./runner/drivers";
import { judge0Enabled, runOnJudge0 } from "./runner/judge0";

export interface Goals {
  targetCompanies: string[];
  level: string;
  interviewDate: string | null;
  hoursPerWeek: number;
  language: Language;
}

export async function getGoals(userId: string): Promise<Goals | null> {
  await ensureMigrated();
  const [g] = await db.select().from(schema.goals).where(eq(schema.goals.userId, userId));
  if (!g) return null;
  return {
    targetCompanies: g.targetCompanies,
    level: g.level,
    interviewDate: g.interviewDate,
    hoursPerWeek: g.hoursPerWeek,
    language: g.language as Language,
  };
}

export async function saveGoals(userId: string, goals: Goals): Promise<void> {
  await ensureMigrated();
  await db
    .insert(schema.goals)
    .values({ userId, ...goals })
    .onConflictDoUpdate({ target: schema.goals.userId, set: { ...goals, updatedAt: new Date() } });
}

export async function getSkills(userId: string): Promise<SkillMap> {
  await ensureMigrated();
  const rows = await db.select().from(schema.patternSkill).where(eq(schema.patternSkill.userId, userId));
  const map: SkillMap = {};
  for (const r of rows) {
    map[r.pattern as PatternId] = {
      rating: r.rating,
      uncertainty: r.uncertainty,
      attempts: r.attempts,
      solved: r.solved,
      failStreak: r.failStreak,
    };
  }
  return map;
}

export async function getAttemptSummaries(userId: string): Promise<AttemptSummary[]> {
  const rows = await db
    .select({
      problemSlug: schema.attempts.problemSlug,
      pattern: schema.attempts.pattern,
      solved: schema.attempts.solved,
      mode: schema.attempts.mode,
      finishedAt: schema.attempts.finishedAt,
    })
    .from(schema.attempts)
    .where(eq(schema.attempts.userId, userId))
    .orderBy(desc(schema.attempts.finishedAt));
  return rows.map((r) => ({ ...r, pattern: r.pattern as PatternId, mode: r.mode as AttemptSummary["mode"] }));
}

export async function getCards(userId: string) {
  return db
    .select({ problemSlug: schema.reviewCards.problemSlug, due: schema.reviewCards.due, reps: schema.reviewCards.reps })
    .from(schema.reviewCards)
    .where(eq(schema.reviewCards.userId, userId));
}

export interface TrackState {
  goals: Goals;
  skills: SkillMap;
  attempts: AttemptSummary[];
  cards: { problemSlug: string; due: Date; reps: number }[];
  plan: DailyPlan;
}

export async function getTrackState(userId: string, goals: Goals, now = new Date()): Promise<TrackState> {
  const [skills, attempts, cards, companies] = await Promise.all([
    getSkills(userId),
    getAttemptSummaries(userId),
    getCards(userId),
    getLiveCompanies(),
  ]);
  const plan = buildPlan({ now, goals, skills, attempts, cards, problems: PROBLEMS, companies });
  return { goals, skills, attempts, cards, plan };
}

export async function getProblemHistory(userId: string, slug: string) {
  await ensureMigrated();
  const [attempts, [card]] = await Promise.all([
    db
      .select()
      .from(schema.attempts)
      .where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.problemSlug, slug)))
      .orderBy(desc(schema.attempts.finishedAt))
      .limit(10),
    db
      .select()
      .from(schema.reviewCards)
      .where(and(eq(schema.reviewCards.userId, userId), eq(schema.reviewCards.problemSlug, slug))),
  ]);
  return { attempts, card: card ?? null };
}

export interface AttemptInput {
  slug: string;
  mode: "learn" | "review" | "mixed";
  language: Language;
  solved: boolean;
  gaveUp: boolean;
  startedAt: string;
  secondsToFirstRun: number | null;
  secondsToAccepted: number | null;
  runCount: number;
  failedRuns: number;
  failingLabels: string[];
  hintsUsed: number;
  confidence: Confidence | null;
  complexityChoice: string | null;
  code: string | null;
}

export interface AttemptResult {
  score: number;
  solved: boolean;
  ratingBefore: number;
  ratingAfter: number;
  fastTrack: boolean;
  nextReview: string | null;
  stuck: boolean;
}

const normalizeO = (s: string) => s.replace(/\s+/g, "").replace(/·|\*/g, "").toLowerCase();

export async function recordAttempt(userId: string, input: AttemptInput, now = new Date()): Promise<AttemptResult> {
  await ensureMigrated();
  const problem = PROBLEM_BY_SLUG.get(input.slug);
  if (!problem) throw new Error("Unknown problem");

  // With Judge0 the server re-checks an accepted claim against every test.
  let solved = input.solved;
  if (solved && judge0Enabled() && input.code) {
    const check = await runOnJudge0(problem.signature, input.language, input.code, problem.tests);
    solved = check.verdict === "accepted";
  }

  const complexityCorrect =
    input.complexityChoice === null ? null : normalizeO(input.complexityChoice) === normalizeO(problem.complexity.time);
  const signals = {
    solved,
    difficulty: problem.difficulty,
    hintsUsed: input.hintsUsed,
    failedRuns: input.failedRuns,
    secondsToAccepted: input.secondsToAccepted,
    complexityCorrect,
  };
  const score = attemptScore(signals);
  const fastTrack = isFastTrack(signals);

  const [row] = await db
    .select()
    .from(schema.patternSkill)
    .where(and(eq(schema.patternSkill.userId, userId), eq(schema.patternSkill.pattern, problem.pattern)));
  const before = row ?? {
    rating: INITIAL_RATING,
    uncertainty: INITIAL_UNCERTAINTY,
    attempts: 0,
    solved: 0,
    failStreak: 0,
  };
  // Reviews move the rating less than first attempts: they test memory as much as skill.
  const after = updateSkill(before, problem.rating, score, { fastTrack, weight: input.mode === "review" ? 0.5 : 1 });
  const failStreak = solved ? 0 : before.failStreak + 1;

  await db
    .insert(schema.patternSkill)
    .values({
      userId,
      pattern: problem.pattern,
      rating: after.rating,
      uncertainty: after.uncertainty,
      attempts: before.attempts + 1,
      solved: before.solved + (solved ? 1 : 0),
      failStreak,
      lastAttemptAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.patternSkill.userId, schema.patternSkill.pattern],
      set: {
        rating: after.rating,
        uncertainty: after.uncertainty,
        attempts: before.attempts + 1,
        solved: before.solved + (solved ? 1 : 0),
        failStreak,
        lastAttemptAt: now,
      },
    });

  // FSRS: a solved problem becomes a review card; any later attempt reviews it.
  const [existing] = await db
    .select()
    .from(schema.reviewCards)
    .where(and(eq(schema.reviewCards.userId, userId), eq(schema.reviewCards.problemSlug, problem.slug)));
  let nextReview: Date | null = existing?.due ?? null;
  if (existing || solved) {
    const grade = gradeFor({ solved, confidence: input.confidence, hintsUsed: input.hintsUsed, fastTrack });
    const card = reviewCard(existing ? cardFromJson(existing.card) : newCard(now), grade, now);
    nextReview = card.due;
    const values = {
      due: card.due,
      card: cardToJson(card),
      reps: card.reps,
      lapses: card.lapses,
      lastReview: now,
    };
    await db
      .insert(schema.reviewCards)
      .values({ userId, problemSlug: problem.slug, ...values })
      .onConflictDoUpdate({ target: [schema.reviewCards.userId, schema.reviewCards.problemSlug], set: values });
  }

  await db.insert(schema.attempts).values({
    userId,
    problemSlug: problem.slug,
    pattern: problem.pattern,
    mode: input.mode,
    language: input.language,
    solved,
    gaveUp: input.gaveUp,
    startedAt: new Date(input.startedAt),
    finishedAt: now,
    secondsToFirstRun: input.secondsToFirstRun,
    secondsToAccepted: solved ? input.secondsToAccepted : null,
    runCount: input.runCount,
    failedRuns: input.failedRuns,
    failingLabels: input.failingLabels.slice(0, 20),
    hintsUsed: input.hintsUsed,
    confidence: input.confidence,
    complexityCorrect,
    score,
    ratingBefore: before.rating,
    ratingAfter: after.rating,
    code: input.code?.slice(0, 50_000) ?? null,
  });

  return {
    score,
    solved,
    ratingBefore: before.rating,
    ratingAfter: after.rating,
    fastTrack,
    nextReview: nextReview?.toISOString() ?? null,
    stuck: failStreak >= 2,
  };
}

/**
 * Feeds a mock interview's feedback into the track: weaknesses lower the
 * pattern rating, and a failed or shaky solve comes back as a re-solve due
 * today (spec 4.2 "Mock feedback loop"). Returns what changed, for the report.
 */
export async function applyMockFeedback(userId: string, problem: Problem, report: FeedbackReport, now = new Date()): Promise<TrackChange[]> {
  await ensureMigrated();
  const changes: TrackChange[] = [];
  const [row] = await db
    .select()
    .from(schema.patternSkill)
    .where(and(eq(schema.patternSkill.userId, userId), eq(schema.patternSkill.pattern, problem.pattern)));
  const before = row ?? { rating: INITIAL_RATING, uncertainty: INITIAL_UNCERTAINTY };
  const plan = planMockUpdate(report, before, problem.rating);

  if (plan.skill) {
    await db
      .insert(schema.patternSkill)
      .values({ userId, pattern: problem.pattern, rating: plan.skill.rating, uncertainty: plan.skill.uncertainty })
      .onConflictDoUpdate({
        target: [schema.patternSkill.userId, schema.patternSkill.pattern],
        set: { rating: plan.skill.rating, uncertainty: plan.skill.uncertainty },
      });
    changes.push({ kind: "rating", pattern: problem.pattern, before: before.rating, after: plan.skill.rating });
  }

  if (plan.resolve) {
    const [existing] = await db
      .select({ problemSlug: schema.reviewCards.problemSlug })
      .from(schema.reviewCards)
      .where(and(eq(schema.reviewCards.userId, userId), eq(schema.reviewCards.problemSlug, problem.slug)));
    if (existing) {
      await db
        .update(schema.reviewCards)
        .set({ due: now })
        .where(and(eq(schema.reviewCards.userId, userId), eq(schema.reviewCards.problemSlug, problem.slug)));
    } else {
      const card = newCard(now);
      await db.insert(schema.reviewCards).values({ userId, problemSlug: problem.slug, due: now, card: cardToJson(card), reps: 0, lapses: 0 });
    }
    changes.push({ kind: "review", slug: problem.slug, title: problem.title });
  }
  return changes;
}

/** Attempts in the last `days` days, for the progress page. */
export async function recentAttempts(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  return db
    .select()
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), gte(schema.attempts.finishedAt, since)))
    .orderBy(desc(schema.attempts.finishedAt));
}
