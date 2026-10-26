import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/**
 * Explainer videos (the 5-12 minute case-file videos). Made in GitHub Actions, stored as GitHub release files,
 * listed here so the app can show them, let you pick a thumbnail and send one to YouTube.
 *
 * status: queued (asked for in the app) → making → ready → send (you pressed Send) → sending → on_youtube; or failed.
 */
export type Explainer = {
  id: string; title: string; topic: string | null; status: string; minutes: number | null;
  videoUrl: string | null; previewUrl: string | null; thumbs: string[]; description: string | null;
  youtubeId: string | null; thumb: number | null; privacy: string | null; source: string; error: string | null;
  createdAt: string; updatedAt: string;
};

let ready = false;
async function ensureTable() {
  if (ready) return;
  await db().execute(sql`create table if not exists explainers (
    id text primary key, title text not null, topic text, status text not null, minutes real,
    video_url text, preview_url text, thumbs jsonb not null default '[]'::jsonb, description text,
    youtube_id text, thumb integer, privacy text, source text not null default 'daily', error text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  ready = true;
}

const row = (r: Record<string, unknown>): Explainer => ({
  id: r.id as string, title: r.title as string, topic: (r.topic as string) ?? null, status: r.status as string,
  minutes: r.minutes == null ? null : Number(r.minutes), videoUrl: (r.video_url as string) ?? null, previewUrl: (r.preview_url as string) ?? null,
  thumbs: (r.thumbs as string[]) ?? [], description: (r.description as string) ?? null, youtubeId: (r.youtube_id as string) ?? null,
  thumb: r.thumb == null ? null : Number(r.thumb), privacy: (r.privacy as string) ?? null, source: r.source as string, error: (r.error as string) ?? null,
  createdAt: new Date(r.created_at as string).toISOString(), updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listExplainers(limit = 30): Promise<Explainer[]> {
  await ensureTable();
  const r = await db().execute(sql`select * from explainers order by created_at desc limit ${limit}`);
  return (r.rows as Record<string, unknown>[]).map(row);
}

export async function getExplainer(id: string): Promise<Explainer | null> {
  await ensureTable();
  const r = await db().execute(sql`select * from explainers where id = ${id}`);
  return r.rows.length ? row(r.rows[0] as Record<string, unknown>) : null;
}

/** Explainers asked for in the app today (to stop runaway Claude costs). */
export async function requestsToday(): Promise<number> {
  await ensureTable();
  const r = await db().execute(sql`select count(*)::int as n from explainers where source = 'app' and created_at > now() - interval '24 hours'`);
  return Number((r.rows[0] as { n: number }).n);
}

export async function requestExplainer(topic: string): Promise<Explainer> {
  await ensureTable();
  const id = `req-${Date.now().toString(36)}`;
  await db().execute(sql`insert into explainers (id, title, topic, status, source) values (${id}, ${topic.slice(0, 120)}, ${topic}, 'queued', 'app')`);
  return (await getExplainer(id))!;
}

export async function requestSend(id: string, thumb: number, privacy: string) {
  await ensureTable();
  await db().execute(sql`update explainers set status = 'send', thumb = ${thumb}, privacy = ${privacy}, error = null, updated_at = now() where id = ${id}`);
}

/** Work for the GitHub side: explainers to make and videos to send to YouTube. */
export async function pendingJobs() {
  await ensureTable();
  const r = await db().execute(sql`select * from explainers where status in ('queued', 'send') order by created_at`);
  return (r.rows as Record<string, unknown>[]).map(row);
}

/** Updates from the GitHub workflows (insert-or-update: the daily run creates its own row). */
export async function saveExplainer(id: string, p: Partial<Explainer> & { replaces?: string }) {
  await ensureTable();
  if (p.replaces && p.replaces !== id) await db().execute(sql`delete from explainers where id = ${p.replaces} and status in ('queued', 'making', 'failed')`);
  await db().execute(sql`insert into explainers (id, title, topic, status, minutes, video_url, preview_url, thumbs, description, youtube_id, source, error)
    values (${id}, ${p.title ?? id}, ${p.topic ?? null}, ${p.status ?? 'making'}, ${p.minutes ?? null}, ${p.videoUrl ?? null}, ${p.previewUrl ?? null},
            ${JSON.stringify(p.thumbs ?? [])}::jsonb, ${p.description ?? null}, ${p.youtubeId ?? null}, ${p.source ?? 'daily'}, ${p.error ?? null})
    on conflict (id) do update set
      title = coalesce(${p.title ?? null}, explainers.title), status = coalesce(${p.status ?? null}, explainers.status),
      minutes = coalesce(${p.minutes ?? null}, explainers.minutes), video_url = coalesce(${p.videoUrl ?? null}, explainers.video_url),
      preview_url = coalesce(${p.previewUrl ?? null}, explainers.preview_url),
      thumbs = case when ${p.thumbs ? JSON.stringify(p.thumbs) : null}::jsonb is null then explainers.thumbs else ${p.thumbs ? JSON.stringify(p.thumbs) : null}::jsonb end,
      description = coalesce(${p.description ?? null}, explainers.description), youtube_id = coalesce(${p.youtubeId ?? null}, explainers.youtube_id),
      error = ${p.error ?? null}, updated_at = now()`);
}
