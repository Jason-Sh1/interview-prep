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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  },
  (t) => [index("attempts_user_finished_idx").on(t.userId, t.finishedAt)],
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
