CREATE TABLE "feedback_reports" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"generator" text NOT NULL,
	"report" jsonb NOT NULL,
	"track_changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_session_id_mock_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mock_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;