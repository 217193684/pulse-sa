CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_key" text NOT NULL,
	"day" text NOT NULL,
	"title" text NOT NULL,
	"caption" text NOT NULL,
	"hashtags" jsonb NOT NULL,
	"article_keys" jsonb NOT NULL,
	"credits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"mp4" "bytea" NOT NULL,
	"poster" "bytea",
	"bytes" integer NOT NULL,
	"duration_sec" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clip_id" uuid,
	"story_key" text,
	"platform" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "clips_fingerprint_idx" ON "clips" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "clips_story_idx" ON "clips" USING btree ("story_key","created_at");