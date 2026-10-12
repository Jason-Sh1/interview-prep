CREATE TABLE "debug_rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"minutes" integer NOT NULL,
	"assistant" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"files" jsonb,
	"chat" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb,
	"notes" text,
	"test_results" jsonb,
	"report" jsonb
);
--> statement-breakpoint
ALTER TABLE "debug_rounds" ADD CONSTRAINT "debug_rounds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debug_rounds_user_started_idx" ON "debug_rounds" USING btree ("user_id","started_at");