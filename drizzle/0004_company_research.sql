CREATE TABLE "company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"generator" text NOT NULL,
	"data" jsonb NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_company_version_idx" ON "company_profiles" USING btree ("company_id","version");--> statement-breakpoint
CREATE INDEX "company_profiles_status_idx" ON "company_profiles" USING btree ("status","reviewed_at");