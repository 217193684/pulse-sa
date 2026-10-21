/**
 * Turns stored signals into "problems": a category in a place (or nationally) over the last
 * 24 hours, compared with that same category+place's normal daily level over the week before.
 * Comparing each group with its own normal (not raw volume) keeps busy topics and big cities
 * from always winning, and lets a quiet town's unusual spike rise to the top.
 */
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { CATEGORIES, CATEGORY_BY_ID, PROBLEM_IDS, type CategoryId } from "./classify";
import { PLACE_BY_SLUG } from "./geo/places";

const HOUR = 3600_000;
export const NATIONAL = "za";

export type Hotspot = { slug: string; name: string; lat: number; lon: number; weight: number; intensity: number };
export type ProblemCard = {
  type: "problem"; id: string; category: CategoryId; categoryLabel: string; color: string;
  place: string | null; placeSlug: string | null; title: string; headline: string; publisher: string | null; url: string | null;
  trend: string; ratio: number | null; signals: number; score: number; spark: number[]; hotspots: Hotspot[]; updatedAt: string;
};
export type TrendingCard = { type: "trending"; id: "trending"; title: string; items: { query: string; traffic: number; url: string | null }[]; updatedAt: string };
export type VideoCard = { type: "video"; id: string; youtubeId: string; title: string; creator: string | null; category: string | null; thumbnail: string };
export type FeedCard = ProblemCard | TrendingCard | VideoCard;

/** "around Durban", "in Gauteng", "across South Africa" */
const placePhrase = (place: { name: string; kind: string } | null | undefined) =>
  !place ? "across South Africa" : place.kind === "province" ? `in ${place.name}` : `around ${place.name}`;

export const problemId = (category: string, placeSlug: string | null) => `${category}~${placeSlug ?? NATIONAL}`;
export function parseProblemId(id: string): { category: CategoryId; placeSlug: string | null } | null {
  const [cat, place] = id.split("~");
  if (!PROBLEM_IDS.has(cat as CategoryId) || !place) return null;
  if (place !== NATIONAL && !PLACE_BY_SLUG.has(place)) return null;
  return { category: cat as CategoryId, placeSlug: place === NATIONAL ? null : place };
}

/** Plain-language label for how unusual today is. */
export function trendLabel(ratio: number | null): string {
  if (ratio == null) return "New today";
  if (ratio >= 3) return "Much more than usual";
  if (ratio >= 1.5) return "More than usual";
  if (ratio >= 0.75) return "Around normal";
  return "Quieter than usual";
}

type Group = { category: CategoryId; placeSlug: string | null; w24: number; n24: number; last: Date; daily: number };

async function groups(now: Date): Promise<Group[]> {
  const d24 = new Date(now.getTime() - 24 * HOUR);
  const d8 = new Date(now.getTime() - 8 * 24 * HOUR);
  const rows = await db().execute<{ category: CategoryId; place_slug: string | null; w24: string; n24: string; last: Date | string | null; wbase: string }>(sql`
    select category, place_slug,
      coalesce(sum(weight) filter (where published_at > ${d24}), 0) as w24,
      count(*) filter (where published_at > ${d24}) as n24,
      max(published_at) filter (where published_at > ${d24}) as last,
      coalesce(sum(weight) filter (where published_at <= ${d24} and published_at > ${d8}), 0) as wbase
    from signals
    where published_at > ${d8} and category <> 'trending'
    group by category, place_slug`);
  return rows.rows
    .filter((r) => Number(r.n24) > 0 && PROBLEM_IDS.has(r.category))   // the problem feed/map only; other news becomes videos
    .map((r) => ({ category: r.category, placeSlug: r.place_slug, w24: Number(r.w24), n24: Number(r.n24), last: new Date(r.last as string), daily: Number(r.wbase) / 7 }));
}

/** Hourly weighted counts for the last 24h, grouped into 8 three-hour buckets (oldest first). */
async function sparks(now: Date): Promise<Map<string, number[]>> {
  const d24 = new Date(now.getTime() - 24 * HOUR);
  const rows = await db().execute<{ category: string; place_slug: string | null; b: number; w: string }>(sql`
    select category, place_slug, least(7, floor(extract(epoch from (published_at - ${d24})) / 10800))::int as b, sum(weight) as w
    from signals where published_at > ${d24} and category <> 'trending'
    group by 1, 2, 3`);
  const out = new Map<string, number[]>();
  for (const r of rows.rows) {
    const id = problemId(r.category, r.place_slug);
    const arr = out.get(id) ?? new Array(8).fill(0);
    arr[Math.max(0, Math.min(7, Number(r.b)))] += Number(r.w);
    out.set(id, arr);
  }
  return out;
}

function hotspotsFor(all: Group[], category: CategoryId): Hotspot[] {
  const pinned = all.filter((g) => g.category === category && g.placeSlug && PLACE_BY_SLUG.has(g.placeSlug));
  const max = Math.max(1, ...pinned.map((g) => g.w24));
  return pinned
    .map((g) => { const p = PLACE_BY_SLUG.get(g.placeSlug!)!; return { slug: p.slug, name: p.name, lat: p.lat, lon: p.lon, weight: g.w24, intensity: Math.round((g.w24 / max) * 100) / 100 }; })
    .sort((a, b) => b.weight - a.weight);
}

async function topSignal(category: CategoryId, placeSlug: string | null, since: Date) {
  const [s] = await db().select().from(schema.signals)
    .where(and(eq(schema.signals.category, category), placeSlug ? eq(schema.signals.placeSlug, placeSlug) : isNull(schema.signals.placeSlug), gte(schema.signals.publishedAt, since)))
    .orderBy(desc(schema.signals.weight), desc(schema.signals.publishedAt)).limit(1);
  return s;
}

export async function problemCards(now = new Date(), limit = 20): Promise<ProblemCard[]> {
  const all = await groups(now);
  const sp = await sparks(now);
  const scored = all.map((g) => {
    const ratio = g.daily > 0 ? g.w24 / g.daily : null;
    // Volume matters, but being unusual for this place matters more.
    const score = g.w24 + 2 * Math.max(0, g.w24 - g.daily) + (ratio == null ? 1 : 0);
    return { g, ratio, score };
  }).sort((a, b) => b.score - a.score || b.g.last.getTime() - a.g.last.getTime()).slice(0, limit);

  const eskom = await db().select().from(schema.status).where(eq(schema.status.key, "eskom")).limit(1);
  const stage = Number(eskom[0]?.value?.stage ?? 0);
  const since = new Date(now.getTime() - 24 * HOUR);

  return Promise.all(scored.map(async ({ g, ratio, score }) => {
    const cat = CATEGORY_BY_ID.get(g.category)!;
    const place = g.placeSlug ? PLACE_BY_SLUG.get(g.placeSlug) ?? null : null;
    const top = await topSignal(g.category, g.placeSlug, since);
    const title = g.category === "power" && !place && stage > 0
      ? `Load-shedding: stage ${stage} right now`
      : `${cat.phrase} ${placePhrase(place)}`;
    return {
      type: "problem" as const, id: problemId(g.category, g.placeSlug), category: g.category, categoryLabel: cat.label, color: cat.color,
      place: place?.name ?? null, placeSlug: place?.slug ?? null, title,
      headline: top?.title ?? "", publisher: top?.publisher ?? null, url: top?.url ?? null,
      trend: trendLabel(ratio), ratio: ratio == null ? null : Math.round(ratio * 10) / 10, signals: g.n24, score: Math.round(score * 10) / 10,
      spark: sp.get(problemId(g.category, g.placeSlug)) ?? new Array(8).fill(0),
      hotspots: hotspotsFor(all, g.category).slice(0, 12), updatedAt: g.last.toISOString(),
    };
  }));
}

export async function trendingCard(now = new Date()): Promise<TrendingCard | null> {
  const since = new Date(now.getTime() - 24 * HOUR);
  const rows = await db().select().from(schema.signals)
    .where(and(eq(schema.signals.source, "trends"), gte(schema.signals.publishedAt, since)))
    .orderBy(desc(schema.signals.weight), desc(schema.signals.publishedAt)).limit(30);
  if (!rows.length) return null;
  const items = rows
    .map((r) => ({ query: r.title, traffic: Number((r.extra as { traffic?: number } | null)?.traffic ?? 0), url: r.url }))
    .sort((a, b) => b.traffic - a.traffic).slice(0, 6);
  return { type: "trending", id: "trending", title: "What South Africa is searching right now", items, updatedAt: rows[0].collectedAt.toISOString() };
}

export async function videoCards(): Promise<VideoCard[]> {
  const rows = await db().select().from(schema.videos).where(eq(schema.videos.active, 1)).orderBy(desc(schema.videos.createdAt)).limit(20);
  return rows.map((v) => ({ type: "video", id: `video-${v.id}`, youtubeId: v.youtubeId, title: v.title, creator: v.creator, category: v.category, thumbnail: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` }));
}

/** The feed: problems in score order, the searches card second, a video after every 3 problems. */
export async function feed(now = new Date()): Promise<FeedCard[]> {
  const [problems, trending, vids] = await Promise.all([problemCards(now), trendingCard(now), videoCards()]);
  const out: FeedCard[] = [];
  let v = 0;
  problems.forEach((p, i) => {
    out.push(p);
    if (i === 0 && trending) out.push(trending);
    if ((i + 1) % 3 === 0 && v < vids.length) out.push(vids[v++]);
  });
  if (!problems.length && trending) out.push(trending);
  while (v < vids.length && out.length < 6) out.push(vids[v++]);
  return out;
}

export async function mapLayer(category: CategoryId, now = new Date()) {
  const all = await groups(now);
  const cat = CATEGORY_BY_ID.get(category)!;
  const spots = hotspotsFor(all, category);
  const national = all.find((g) => g.category === category && !g.placeSlug);
  const since = new Date(now.getTime() - 24 * HOUR);
  const rising = await Promise.all(spots.slice(0, 5).map(async (h) => ({ ...h, id: problemId(category, h.slug), headline: (await topSignal(category, h.slug, since))?.title ?? "" })));
  return {
    category, label: cat.label, color: cat.color, hotspots: spots, rising,
    nationalSignals: national?.n24 ?? 0,
    layers: CATEGORIES.map((c) => ({ id: c.id, label: c.label, color: c.color, signals: all.filter((g) => g.category === c.id).reduce((n, g) => n + g.n24, 0) })),
  };
}

export async function problemDetail(id: string, now = new Date()) {
  const parsed = parseProblemId(id);
  if (!parsed) return null;
  const { category, placeSlug } = parsed;
  const cat = CATEGORY_BY_ID.get(category)!;
  const place = placeSlug ? PLACE_BY_SLUG.get(placeSlug)! : null;
  const d7 = new Date(now.getTime() - 7 * 24 * HOUR);
  const where = and(eq(schema.signals.category, category), placeSlug ? eq(schema.signals.placeSlug, placeSlug) : isNull(schema.signals.placeSlug), gte(schema.signals.publishedAt, d7));
  const items = await db().select().from(schema.signals).where(where).orderBy(desc(schema.signals.publishedAt)).limit(40);
  const daily = await db().execute<{ d: number; w: string }>(sql`
    select least(6, floor(extract(epoch from (${now}::timestamptz - published_at)) / 86400))::int as d, sum(weight) as w
    from signals where ${where} group by 1`);
  const days = new Array(7).fill(0);
  for (const r of daily.rows) days[6 - Number(r.d)] += Number(r.w);
  const card = (await problemCards(now, 200)).find((c) => c.id === id) ?? null;
  return {
    id, category, categoryLabel: cat.label, color: cat.color, place: place?.name ?? null,
    title: card?.title ?? `${cat.phrase} ${placePhrase(place)}`,
    trend: card?.trend ?? "Quiet today", days,
    sources: new Set(items.map((i) => i.publisher).filter(Boolean)).size,
    signals: items.map((i) => ({ title: i.title, publisher: i.publisher, url: i.url, source: i.source, publishedAt: i.publishedAt.toISOString() })),
    hotspots: card?.hotspots ?? [],
  };
}

/** Today's top 3, with a ready-to-post caption (for sharing and the daily auto-post). */
export async function top3(now = new Date(), appUrl = "") {
  const cards = (await problemCards(now, 3));
  const lines = cards.map((c, i) => `${i + 1}. ${c.title} (${c.trend.toLowerCase()})`);
  const caption = cards.length
    ? `What South Africa struggled with today:\n${lines.join("\n")}\n\nSee the live map on Pulse SA${appUrl ? `: ${appUrl}` : ""}\n#PulseSA #SouthAfrica #Mzansi`
    : "";
  return { date: now.toISOString().slice(0, 10), cards, caption };
}
