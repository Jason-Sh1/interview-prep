CREATE TABLE "assisted_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"t" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assisted_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"minutes" integer NOT NULL,
	"assistant" text NOT NULL,
	"assistant_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"final_files" jsonb,
	"explanation" text,
	"test_results" jsonb,
	"report" jsonb
);
--> statement-breakpoint
ALTER TABLE "assisted_events" ADD CONSTRAINT "assisted_events_session_id_assisted_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assisted_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assisted_sessions" ADD CONSTRAINT "assisted_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assisted_events_session_t_idx" ON "assisted_events" USING btree ("session_id","t");--> statement-breakpoint
CREATE INDEX "assisted_sessions_user_started_idx" ON "assisted_sessions" USING btree ("user_id","started_at");