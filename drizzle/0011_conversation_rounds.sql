CREATE TABLE "resumes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"file_name" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"topic_id" text NOT NULL,
	"config" jsonb NOT NULL,
	"interviewer" text NOT NULL,
	"artifact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"report" jsonb
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"situation" text DEFAULT '' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"competencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rounds_user_kind_idx" ON "rounds" USING btree ("user_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "stories_user_idx" ON "stories" USING btree ("user_id");