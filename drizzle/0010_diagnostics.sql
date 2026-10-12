CREATE TABLE "diagnostics" (
	"user_id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"problems" jsonb NOT NULL,
	"mock_slug" text NOT NULL,
	"mock_session_id" text,
	"completed_at" timestamp,
	"skipped" boolean DEFAULT false NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_mock_session_id_mock_sessions_id_fk" FOREIGN KEY ("mock_session_id") REFERENCES "public"."mock_sessions"("id") ON DELETE set null ON UPDATE no action;