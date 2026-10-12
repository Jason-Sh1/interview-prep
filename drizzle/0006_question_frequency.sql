CREATE TABLE "question_frequency" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"company_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"problem_slug" text,
	"frequency" text NOT NULL,
	"last_seen" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_frequency" ADD CONSTRAINT "question_frequency_profile_id_company_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_frequency_profile_idx" ON "question_frequency" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "question_frequency_company_idx" ON "question_frequency" USING btree ("company_id","problem_slug");