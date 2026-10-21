import { desc } from "drizzle-orm";
import { collectAll } from "@/server/collect";
import { db, schema } from "@/server/db";
import { bearerOk, noStore } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_GAP_MS = 2 * 60_000;   // the newsroom checks every few minutes

/**
 * Runs one collection pass. Called by GitHub Actions every hour, before each video run, and Vercel Cron daily.
 * No password is needed: collecting is harmless and repeatable, so instead it simply refuses to
 * run more than once every 2 minutes (protects the news sources and the database).
 * A request carrying CRON_SECRET (if one is set) skips that wait.
 */
export async function GET(req: Request) {
  const forced = bearerOk(req, process.env.CRON_SECRET);
  if (!forced) {
    const [last] = await db().select({ at: schema.collectorRuns.startedAt }).from(schema.collectorRuns).orderBy(desc(schema.collectorRuns.startedAt)).limit(1);
    const wait = last ? MIN_GAP_MS - (Date.now() - last.at.getTime()) : 0;
    if (wait > 0) return noStore({ ok: true, skipped: true, nextInSeconds: Math.ceil(wait / 1000) });
  }
  const results = await collectAll();
  return noStore({ ok: results.some((r) => r.ok), results });
}
