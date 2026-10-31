import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Auth tables (Better Auth core schema)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Learning track

/** Onboarding answers that drive the plan (spec 4.1). */
export const goals = pgTable("goals", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  targetCompanies: jsonb("target_companies").$type<string[]>().notNull().default([]),
  level: text("level").notNull().default("mid"),
  interviewDate: date("interview_date", { mode: "string" }),
  hoursPerWeek: integer("hours_per_week").notNull().default(7),
  language: text("language").notNull().default("python"),
  /** IANA time zone from the browser, so plan days follow the user's clock. */
  timeZone: text("time_zone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * The onboarding diagnostic (spec 4.1): three short problems and a short
 * voice mock that set the starting skill estimates. One per user.
 */
export const diagnostics = pgTable("diagnostics", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  /** Bank slugs of the solo problems. */
  problems: jsonb("problems").$type<string[]>().notNull(),
  /** Bank slug of the voice mock's problem, and its session once started. */
  mockSlug: text("mock_slug").notNull(),
  mockSessionId: text("mock_session_id").references(() => mockSessions.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at"),
  skipped: boolean("skipped").notNull().default(false),
  /** DiagnosticResult from src/lib/diagnostic/plan.ts. */
  result: jsonb("result").$type<Record<string, unknown>>(),
});

/** Per-user, per-pattern skill estimate (Elo-style rating with uncertainty). */
export const patternSkill = pgTable(
  "pattern_skill",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    rating: real("rating").notNull(),
    uncertainty: real("uncertainty").notNull(),
    attempts: integer("attempts").notNull().default(0),
    solved: integer("solved").notNull().default(0),
    /** Failed attempts in a row in this pattern; drives stuck detection. */
    failStreak: integer("fail_streak").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pattern] })],
);

/** One attempt at a problem, with the signals listed in spec 4.2. */
export const attempts = pgTable(
  "attempts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    problemSlug: text("problem_slug").notNull(),
    pattern: text("pattern").notNull(),
    /** learn: new problem; review: FSRS review; mixed: interleaved, pattern hidden. */
    mode: text("mode").notNull(),
    language: text("language").notNull(),
    solved: boolean("solved").notNull(),
    /** Gave up or ran out of time without an accepted answer. */
    gaveUp: boolean("gave_up").notNull().default(false),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at").notNull().defaultNow(),
    secondsToFirstRun: integer("seconds_to_first_run"),
    secondsToAccepted: integer("seconds_to_accepted"),
    runCount: integer("run_count").notNull().default(0),
    failedRuns: integer("failed_runs").notNull().default(0),
    /** Labels of the tests that failed along the way (e.g. "empty input"). */
    failingLabels: jsonb("failing_labels").$type<string[]>().notNull().default([]),
    hintsUsed: integer("hints_used").notNull().default(0),
    /** Self-rated confidence 1–4 (Again, Hard, Good, Easy); also the FSRS grade. */
    confidence: integer("confidence"),
    /** Whether the time complexity the user picked matched the optimal one. */
    complexityCorrect: boolean("complexity_correct"),
    /** Performance score in [0, 1] used for the rating update. */
    score: real("score").notNull(),
    ratingBefore: real("rating_before").notNull(),
    ratingAfter: real("rating_after").notNull(),
    code: text("code"),
    /** Set when this attempt was a review on an AI-written variant (problem_variants). */
    variantId: integer("variant_id"),
  },
  (t) => [index("attempts_user_finished_idx").on(t.userId, t.finishedAt)],
);

/**
 * Review variants of bank problems (spec 4.2): changed constraints or a
 * follow-up twist, written by Claude and kept only if the reference passes
 * its own tests. Shared by every user; each user gets one they haven't done.
 */
export const problemVariants = pgTable(
  "problem_variants",
  {
    id: serial("id").primaryKey(),
    baseSlug: text("base_slug").notNull(),
    /** VariantData from src/lib/variants/shape.ts. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("problem_variants_base_idx").on(t.baseSlug)],
);

/** FSRS review card per solved problem (state from ts-fsrs). */
export const reviewCards = pgTable(
  "review_cards",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    problemSlug: text("problem_slug").notNull(),
    due: timestamp("due").notNull(),
    /** Serialized ts-fsrs Card. */
    card: jsonb("card").$type<Record<string, unknown>>().notNull(),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReview: timestamp("last_review"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.problemSlug] }), index("review_cards_due_idx").on(t.userId, t.due)],
);

// ---------------------------------------------------------------------------
// Live mock interviews (spec 4.3)

/** One mock interview: the problem, its settings, and how it was run. */
export const mockSessions = pgTable(
  "mock_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    problemSlug: text("problem_slug").notNull(),
    /** Persona, length, hints and company style chosen at setup. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    language: text("language").notNull(),
    /** "livekit" (server voice pipeline) or "browser" (Web Speech API). */
    voice: text("voice").notNull(),
    /** "claude" or "scripted" (the no-key fallback). */
    interviewer: text("interviewer").notNull(),
    /** The scripted interviewer's progress through the interview. */
    interviewerState: jsonb("interviewer_state").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    finalCode: text("final_code"),
  },
  (t) => [index("mock_sessions_user_started_idx").on(t.userId, t.startedAt)],
);

/**
 * The session's append-only timeline: code edits and snapshots, test runs,
 * and transcript segments from both speakers. `t` is milliseconds since the
 * session started; the feedback report (spec 4.4) replays from this.
 */
export const sessionEvents = pgTable(
  "session_events",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => mockSessions.id, { onDelete: "cascade" }),
    t: integer("t").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("session_events_session_t_idx").on(t.sessionId, t.t)],
);

// ---------------------------------------------------------------------------
// Feedback reports (spec 4.4)

/**
 * One report per finished mock interview. `report` is the FeedbackReport
 * from src/lib/feedback/analyze.ts; `trackChanges` records what it changed in
 * the learning track, which is applied once, when the report is created.
 */
export const feedbackReports = pgTable("feedback_reports", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => mockSessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** "claude" or "heuristic". */
  generator: text("generator").notNull(),
  report: jsonb("report").$type<Record<string, unknown>>().notNull(),
  trackChanges: jsonb("track_changes").$type<Record<string, unknown>[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Focus-area drills from mock feedback (spec 4.4), pushed into the plan: each
 * pairs a focus area's drill with a problem to practice it on. Done when the
 * user next attempts that problem.
 */
export const drills = pgTable(
  "drills",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => mockSessions.id, { onDelete: "cascade" }),
    /** The rubric area it works on. */
    area: text("area").notNull(),
    title: text("title").notNull(),
    drill: text("drill").notNull(),
    problemSlug: text("problem_slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    doneAt: timestamp("done_at"),
  },
  (t) => [index("drills_user_open_idx").on(t.userId, t.doneAt, t.createdAt)],
);

// ---------------------------------------------------------------------------
// AI-assisted coding rounds (spec 4.5)

/** One AI-assisted round: the task, how it ended, and its report. */
export const assistedSessions = pgTable(
  "assisted_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    minutes: integer("minutes").notNull(),
    /** "claude" or "scripted" (the no-key practice assistant). */
    assistant: text("assistant").notNull(),
    /** The scripted assistant's state (planted bugs so far). */
    assistantState: jsonb("assistant_state").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    finalFiles: jsonb("final_files").$type<Record<string, string>>(),
    explanation: text("explanation"),
    /** Visible and hidden test results at the end. */
    testResults: jsonb("test_results").$type<Record<string, unknown>>(),
    /** The AssistedReport from src/lib/assisted/grade.ts, once built. */
    report: jsonb("report").$type<Record<string, unknown>>(),
  },
  (t) => [index("assisted_sessions_user_started_idx").on(t.userId, t.startedAt)],
);

/** The round's timeline: prompts, replies (with planted bugs), snapshots, pastes and test runs. */
export const assistedEvents = pgTable(
  "assisted_events",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => assistedSessions.id, { onDelete: "cascade" }),
    t: integer("t").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("assisted_events_session_t_idx").on(t.sessionId, t.t)],
);

// ---------------------------------------------------------------------------
// Code comprehension and debugging rounds (spec 4.5)

/**
 * One debugging round: a repo with seeded bugs, an optional assistant, and
 * written answers at the end. Small enough to keep the chat, test runs and
 * latest files on the row instead of a separate timeline.
 */
export const debugRounds = pgTable(
  "debug_rounds",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    minutes: integer("minutes").notNull(),
    /** "claude", "scripted" (the offline helper) or "none" (no assistant). */
    assistant: text("assistant").notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    /** The latest files, saved while working and at the end. */
    files: jsonb("files").$type<Record<string, string>>(),
    chat: jsonb("chat").$type<{ role: "user" | "assistant"; text: string; t: number }[]>().notNull().default([]),
    runs: jsonb("runs").$type<{ t: number; passed: number; total: number }[]>().notNull().default([]),
    answers: jsonb("answers").$type<Record<string, string>>(),
    notes: text("notes"),
    testResults: jsonb("test_results").$type<{ passed: number; total: number; failing: string[]; passing?: string[] }>(),
    /** The DebugReport from src/lib/comprehension/grade.ts, once built. */
    report: jsonb("report").$type<Record<string, unknown>>(),
  },
  (t) => [index("debug_rounds_user_started_idx").on(t.userId, t.startedAt)],
);

// ---------------------------------------------------------------------------
// Company research (spec 4.6)

/** One run of the research job: weekly from cron, or started by hand. */
export const researchRuns = pgTable("research_runs", {
  id: serial("id").primaryKey(),
  /** "cron", "manual" or "cli". */
  trigger: text("trigger").notNull(),
  /** "running", "done", "failed" or "skipped" (no API key). */
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  /** Per company: "queued" (a new version waits for review), "unchanged" or "failed". */
  results: jsonb("results").$type<{ companyId: string; result: string; error?: string }[]>().notNull().default([]),
  error: text("error"),
});

/**
 * Versioned company profiles. Version 1 is the built-in estimate; later
 * versions come from research runs and wait in the review queue until a
 * person approves them. The planner uses each company's latest approved one.
 */
export const companyProfiles = pgTable(
  "company_profiles",
  {
    id: serial("id").primaryKey(),
    companyId: text("company_id").notNull(),
    version: integer("version").notNull(),
    /** "pending", "approved" or "rejected". */
    status: text("status").notNull(),
    /** "seed" (the built-in estimate) or "claude" (a research run). */
    generator: text("generator").notNull(),
    /** ProfileData from src/lib/research/profiles.ts. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    /** What changed from the version before, for reviewers and the What's new panel. */
    changes: jsonb("changes").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<{ url: string; title: string; published?: string }[]>().notNull().default([]),
    runId: integer("run_id").references(() => researchRuns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** When research last confirmed this version still holds. */
    verifiedAt: timestamp("verified_at"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by"),
  },
  (t) => [
    uniqueIndex("company_profiles_company_version_idx").on(t.companyId, t.version),
    index("company_profiles_status_idx").on(t.status, t.reviewedAt),
  ],
);

/**
 * Which problems a company is reported to ask (spec 4.6), one row per
 * question per profile version, so frequencies go through the same review
 * as the profile they belong to. The planner uses the rows of each company's
 * latest approved version; companies without any fall back to the problem
 * bank's own lists.
 */
export const questionFrequency = pgTable(
  "question_frequency",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull(),
    title: text("title").notNull(),
    /** Link to the public problem; we never store its text. */
    url: text("url"),
    /** The bank problem modeled on it, when there is one. */
    problemSlug: text("problem_slug"),
    /** "high", "medium" or "low". */
    frequency: text("frequency").notNull(),
    /** When it was last reported, as the source gives it (YYYY-MM or YYYY-MM-DD). */
    lastSeen: text("last_seen"),
    sources: jsonb("sources").$type<{ url: string; title: string; published?: string }[]>().notNull().default([]),
  },
  (t) => [index("question_frequency_profile_idx").on(t.profileId), index("question_frequency_company_idx").on(t.companyId, t.problemSlug)],
);

// ---------------------------------------------------------------------------
// Conversation rounds (spec 4.5, phase 4): system design, behavioral and code
// walkthrough. One table for all three; the kind decides what the artifact holds.

/** One conversation round: setup, the transcript, the candidate's artifact, and its report. */
export const rounds = pgTable(
  "rounds",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "design", "behavioral" or "walkthrough". */
    kind: text("kind").notNull(),
    /** The design prompt, behavioral question set, or walkthrough id. */
    topicId: text("topic_id").notNull(),
    /** minutes, persona, company, level. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    /** "claude" or "scripted". */
    interviewer: text("interviewer").notNull(),
    /** Design: whiteboard scene. Behavioral: stories in play. Walkthrough: the code under discussion. */
    artifact: jsonb("artifact").$type<Record<string, unknown>>().notNull().default({}),
    /** Both sides of the conversation, appended in SQL. */
    transcript: jsonb("transcript").$type<{ speaker: "interviewer" | "candidate"; text: string; t: number; source?: string; interrupted?: boolean }[]>().notNull().default([]),
    /** The scripted interviewer's state (phase, questions asked). */
    stage: jsonb("stage").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** When the candidate pressed Start; the clock runs from here. */
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    /** The RoundReport from src/lib/rounds/types.ts, once built. */
    report: jsonb("report").$type<Record<string, unknown>>(),
  },
  (t) => [index("rounds_user_kind_idx").on(t.userId, t.kind, t.createdAt)],
);

/** The behavioral story bank: STAR stories, drafted from a resume or written by hand. */
export const stories = pgTable(
  "stories",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    situation: text("situation").notNull().default(""),
    task: text("task").notNull().default(""),
    action: text("action").notNull().default(""),
    result: text("result").notNull().default(""),
    /** Competencies it shows (ownership, conflict, failure...), from src/lib/behavioral. */
    competencies: jsonb("competencies").$type<string[]>().notNull().default([]),
    /** "resume", "manual" or "round" (written up after a behavioral round). */
    origin: text("origin").notNull().default("manual"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("stories_user_idx").on(t.userId)],
);

/** The user's resume as plain text (pasted or extracted from a PDF), for the story bank. */
export const resumes = pgTable("resumes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  fileName: text("file_name"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
