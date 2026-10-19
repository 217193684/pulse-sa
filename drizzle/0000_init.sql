CREATE TABLE "collector_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" integer DEFAULT 0 NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"url_key" text,
	"title" text NOT NULL,
	"url" text,
	"publisher" text,
	"category" text NOT NULL,
	"place_slug" text,
	"lat" double precision,
	"lon" double precision,
	"weight" integer DEFAULT 1 NOT NULL,
	"extra" jsonb,
	"published_at" timestamp with time zone NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_id" text NOT NULL,
	"title" text NOT NULL,
	"creator" text,
	"category" text,
	"place_slug" text,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_youtube_id_unique" UNIQUE("youtube_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signals_source_ext_idx" ON "signals" USING btree ("source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_url_key_idx" ON "signals" USING btree ("url_key") WHERE "signals"."url_key" is not null;--> statement-breakpoint
CREATE INDEX "signals_cat_time_idx" ON "signals" USING btree ("category","published_at");--> statement-breakpoint
CREATE INDEX "signals_time_idx" ON "signals" USING btree ("published_at");