/**
 * Pulse SA data model.
 *
 * - signals: one row per thing we noticed (a headline, a trending search, a load-shedding stage),
 *   already sorted into a category and, when possible, pinned to a place.
 * - collector_runs: one row per source per run, so failures are visible instead of silent.
 * - videos: short clips curated for the feed (YouTube links), optionally tied to a category/place.
 * - status: small key/value facts that change over time (e.g. the current Eskom stage).
 */
import { sql } from "drizzle-orm";
import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // news | trends | eskom | gdelt
    externalId: text("external_id").notNull(),
    urlKey: text("url_key"), // normalised article URL, so the same story from two sources counts once
    title: text("title").notNull(),
    url: text("url"),
    publisher: text("publisher"),
    category: text("category").notNull(), // see CATEGORIES in classify.ts
    placeSlug: text("place_slug"), // null = national / unknown place
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    weight: integer("weight").notNull().default(1),
    extra: jsonb("extra").$type<Record<string, unknown>>(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("signals_source_ext_idx").on(t.source, t.externalId),
    uniqueIndex("signals_url_key_idx").on(t.urlKey).where(sql`${t.urlKey} is not null`),
    index("signals_cat_time_idx").on(t.category, t.publishedAt),
    index("signals_time_idx").on(t.publishedAt),
  ],
);

export const collectorRuns = pgTable("collector_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: integer("ok").notNull().default(0), // 1 = success
  fetched: integer("fetched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  error: text("error"),
});

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  youtubeId: text("youtube_id").notNull().unique(),
  title: text("title").notNull(),
  creator: text("creator"),
  category: text("category"),
  placeSlug: text("place_slug"),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const status = pgTable("status", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
