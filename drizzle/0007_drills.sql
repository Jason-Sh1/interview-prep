CREATE TABLE "drills" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"area" text NOT NULL,
	"title" text NOT NULL,
	"drill" text NOT NULL,
	"problem_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"done_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "drills" ADD CONSTRAINT "drills_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drills" ADD CONSTRAINT "drills_session_id_mock_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mock_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drills_user_open_idx" ON "drills" USING btree ("user_id","done_at","created_at");