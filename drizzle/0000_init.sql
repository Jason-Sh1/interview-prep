CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"problem_slug" text NOT NULL,
	"pattern" text NOT NULL,
	"mode" text NOT NULL,
	"language" text NOT NULL,
	"solved" boolean NOT NULL,
	"gave_up" boolean DEFAULT false NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp DEFAULT now() NOT NULL,
	"seconds_to_first_run" integer,
	"seconds_to_accepted" integer,
	"run_count" integer DEFAULT 0 NOT NULL,
	"failed_runs" integer DEFAULT 0 NOT NULL,
	"failing_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"confidence" integer,
	"complexity_correct" boolean,
	"score" real NOT NULL,
	"rating_before" real NOT NULL,
	"rating_after" real NOT NULL,
	"code" text
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"target_companies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"level" text DEFAULT 'mid' NOT NULL,
	"interview_date" date,
	"hours_per_week" integer DEFAULT 7 NOT NULL,
	"language" text DEFAULT 'python' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern_skill" (
	"user_id" text NOT NULL,
	"pattern" text NOT NULL,
	"rating" real NOT NULL,
	"uncertainty" real NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"solved" integer DEFAULT 0 NOT NULL,
	"fail_streak" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	CONSTRAINT "pattern_skill_user_id_pattern_pk" PRIMARY KEY("user_id","pattern")
);
--> statement-breakpoint
CREATE TABLE "review_cards" (
	"user_id" text NOT NULL,
	"problem_slug" text NOT NULL,
	"due" timestamp NOT NULL,
	"card" jsonb NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_review" timestamp,
	CONSTRAINT "review_cards_user_id_problem_slug_pk" PRIMARY KEY("user_id","problem_slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_skill" ADD CONSTRAINT "pattern_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_finished_idx" ON "attempts" USING btree ("user_id","finished_at");--> statement-breakpoint
CREATE INDEX "review_cards_due_idx" ON "review_cards" USING btree ("user_id","due");