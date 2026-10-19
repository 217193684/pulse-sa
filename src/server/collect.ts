/**
 * One collection pass: run every source, store new signals, record how each source did,
 * and prune old rows so the free database never fills up (signals older than RETAIN_DAYS).
 */
import { eq, lt } from "drizzle-orm";
import { db, schema } from "./db";
import type { NewSignal } from "./sources/common";
import { collectNews } from "./sources/news";
import { collectTrends } from "./sources/trends";
import { collectEskom } from "./sources/eskom";
import { collectGdelt } from "./sources/gdelt";

export const RETAIN_DAYS = 30;

export async function storeSignals(rows: NewSignal[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const res = await db().insert(schema.signals).values(rows.slice(i, i + 200)).onConflictDoNothing().returning({ id: schema.signals.id });
    inserted += res.length;
  }
  return inserted;
}

async function run(source: string, fn: () => Promise<{ signals: NewSignal[]; errors: string[] }>) {
  const [r] = await db().insert(schema.collectorRuns).values({ source }).returning({ id: schema.collectorRuns.id });
  try {
    const { signals, errors } = await fn();
    // Within one batch two sources can carry the same article; keep the first.
    const seen = new Set<string>();
    const unique = signals.filter((s) => { const k = s.urlKey ?? `${s.source}:${s.externalId}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const inserted = await storeSignals(unique);
    const ok = errors.length === 0 || signals.length > 0;
    await db().update(schema.collectorRuns).set({ finishedAt: new Date(), ok: ok ? 1 : 0, fetched: signals.length, inserted, error: errors.join(" | ").slice(0, 2000) || null }).where(eq(schema.collectorRuns.id, r.id));
    return { source, ok, fetched: signals.length, inserted, errors };
  } catch (e) {
    const msg = (e as Error).message;
    await db().update(schema.collectorRuns).set({ finishedAt: new Date(), ok: 0, error: msg.slice(0, 2000) }).where(eq(schema.collectorRuns.id, r.id));
    return { source, ok: false, fetched: 0, inserted: 0, errors: [msg] };
  }
}

export async function setStatus(key: string, value: Record<string, unknown>) {
  await db().insert(schema.status).values({ key, value }).onConflictDoUpdate({ target: schema.status.key, set: { value, updatedAt: new Date() } });
}

export async function collectAll() {
  const results = [];
  results.push(await run("news", collectNews));
  results.push(await run("trends", collectTrends));
  results.push(await run("eskom", async () => {
    const r = await collectEskom();
    if (r.stage != null) await setStatus("eskom", { stage: r.stage, checkedAt: new Date().toISOString() });
    return r;
  }));
  results.push(await run("gdelt", collectGdelt));
  const cutoff = new Date(Date.now() - RETAIN_DAYS * 86400_000);
  await db().delete(schema.signals).where(lt(schema.signals.publishedAt, cutoff));
  await db().delete(schema.collectorRuns).where(lt(schema.collectorRuns.startedAt, cutoff));
  return results;
}
