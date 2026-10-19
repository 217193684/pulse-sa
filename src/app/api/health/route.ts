import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { noStore } from "@/server/http";

export const dynamic = "force-dynamic";

/** Is the database reachable, and how did each source do on its latest run? */
export async function GET() {
  try {
    const runs = await db().select().from(schema.collectorRuns).orderBy(desc(schema.collectorRuns.startedAt)).limit(40);
    const latest = new Map<string, (typeof runs)[number]>();
    for (const r of runs) if (!latest.has(r.source)) latest.set(r.source, r);
    const [{ n }] = (await db().execute<{ n: string }>(sql`select count(*) as n from signals where published_at > now() - interval '24 hours'`)).rows;
    return noStore({
      ok: true, signals24h: Number(n),
      sources: [...latest.values()].map((r) => ({ source: r.source, ok: r.ok === 1, at: r.startedAt, fetched: r.fetched, inserted: r.inserted, error: r.error })),
    });
  } catch (e) {
    return noStore({ ok: false, error: (e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "[db]") }, 503);
  }
}
