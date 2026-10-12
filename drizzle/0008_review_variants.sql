CREATE TABLE "problem_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_slug" text NOT NULL,
	"data" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "variant_id" integer;--> statement-breakpoint
CREATE INDEX "problem_variants_base_idx" ON "problem_variants" USING btree ("base_slug");