CREATE TABLE "privacy_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"recording_consent_at" timestamp,
	"recording_consent_version" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "assisted_sessions" ADD COLUMN "purged_at" timestamp;--> statement-breakpoint
ALTER TABLE "debug_rounds" ADD COLUMN "purged_at" timestamp;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD COLUMN "purged_at" timestamp;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "purged_at" timestamp;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;