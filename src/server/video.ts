/**
 * Turns today's top problems into video scripts, decides what NOT to post again, and stores
 * finished videos.
 *
 * Duplicate rules (checked when planning AND again when a video is uploaded):
 *  1. Same story (category + place) already made today → skip.
 *  2. Same story in the last 3 days and ≥60% of its articles were already used → skip
 *     (it only comes back when there is genuinely new reporting).
 *  3. Same video file (SHA-256 fingerprint) → refused.
 */
import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { CATEGORY_BY_ID, type CategoryId } from "./classify";
import { PLACES, PLACE_BY_SLUG, type Place } from "./geo/places";
import { problemCards, type ProblemCard } from "./problems";

const HOUR = 3600_000;
export const CLIP_RETAIN_DAYS = 7;
export const REPEAT_WINDOW_DAYS = 3;
export const REPEAT_OVERLAP = 0.6;

/** South African calendar day, so "today" flips at midnight SAST, not UTC. */
export const saDay = (d = new Date()) => new Date(d.getTime() + 2 * HOUR).toISOString().slice(0, 10);

// ---------------------------------------------------------------- hashtags

const PROVINCE_TAG: Record<string, string> = { GP: "Gauteng", KZN: "KZN", WC: "WesternCape", EC: "EasternCape", FS: "FreeState", LP: "Limpopo", MP: "Mpumalanga", NW: "NorthWest", NC: "NorthernCape" };
const CATEGORY_TAGS: Record<CategoryId, string[]> = {
  water: ["WaterCrisis", "WaterOutage"], power: ["PowerCuts", "Electricity"], transport: ["Transport", "Commuters"],
  education: ["Students", "Education"], jobs: ["Jobs", "Unemployment"], grants: ["SASSA", "Grants"],
  cost: ["CostOfLiving", "FuelPrice"], health: ["Health", "PublicHealth"], safety: ["Safety", "Protest"], trending: ["Trending"],
};
/** Words in headlines that deserve their own hashtag when they appear. */
const KEYWORD_TAGS: [RegExp, string][] = [
  [/load[- ]?shedding/i, "LoadShedding"], [/load[- ]?reduction/i, "LoadReduction"], [/\bEskom\b/i, "Eskom"], [/City Power/i, "CityPower"],
  [/\bNSFAS\b/i, "NSFAS"], [/\bmatric\b/i, "Matric2026"], [/\bSASSA\b/i, "SASSA"], [/\bSRD\b/i, "SRDGrant"],
  [/taxi strike/i, "TaxiStrike"], [/fuel|petrol|diesel/i, "FuelPrice"], [/cholera/i, "Cholera"], [/Rand Water/i, "RandWater"],
  [/\bPRASA\b|Metrorail/i, "Metrorail"], [/shutdown/i, "NationalShutdown"], [/retrench/i, "Retrenchments"], [/service delivery/i, "ServiceDelivery"],
];
const BASE_TAGS = ["Mzansi", "SouthAfrica", "PulseSA"];
/** The other name people actually use for a metro (only well-known ones). */
const METRO_ALT_TAG: Record<string, string> = { johannesburg: "Joburg", tshwane: "Pretoria", ethekwini: "eThekwini", "nelson-mandela-bay": "NelsonMandelaBay", "cape-town": "CapeTown", "buffalo-city": "BuffaloCity", mangaung: "Mangaung" };

const pascal = (s: string) => s.normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

export function hashtags(category: CategoryId, places: Place[], headlines: string[], max = 12): string[] {
  const tags: string[] = [];
  for (const p of places) {
    tags.push(pascal(p.name));
    const alt = METRO_ALT_TAG[p.slug];
    if (alt) tags.push(alt);
    if (p.kind !== "province") tags.push(PROVINCE_TAG[p.province]);
  }
  const text = headlines.join(" ");
  for (const [re, tag] of KEYWORD_TAGS) if (re.test(text)) tags.push(tag);
  tags.push(...CATEGORY_TAGS[category], ...BASE_TAGS);
  const seen = new Set<string>();
  return tags.filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, max).map((t) => `#${t}`);
}

// ---------------------------------------------------------------- scripts

/** The four big words that open the video. Plain and accurate: the data says there is a problem, not more. */
function hookLines(category: CategoryId, place: Place | null, card: ProblemCard): string[] {
  const where = (place ? `${place.name.toUpperCase()}’S` : "MZANSI’S");
  const last = card.trend === "More than usual" || card.trend === "Much more than usual" ? "IS GROWING" : card.trend === "New today" ? "RIGHT NOW" : "TODAY";
  switch (category) {
    case "education": return [place ? place.name.toUpperCase() : "MZANSI", "STUDENTS", "ARE", "STRUGGLING"];
    case "grants": return ["SASSA", "GRANT", "WORRIES", last];
    case "cost": return [where, "MONEY", "PRESSURE", last];
    case "jobs": return [where, "JOBS", "PROBLEM", last];
    case "safety": return [where, "SAFETY", "WORRIES", last];
    default: return [where, (CATEGORY_BY_ID.get(category)?.label ?? category).toUpperCase(), "PROBLEM", last];
  }
}

/** Words of a headline worth colouring red (the category's own keywords). */
function emphasis(headline: string, category: CategoryId): string[] {
  const cat = CATEGORY_BY_ID.get(category);
  const hits = new Set<string>();
  for (const re of cat?.patterns ?? []) for (const m of headline.matchAll(new RegExp(re.source, "gi"))) m[0].split(/\s+/).forEach((w) => hits.add(w.toLowerCase()));
  return [...hits];
}

const PHOTO_WORDS: Record<CategoryId, string[]> = {
  water: ["water reservoir", "water tower", "dam"], power: ["power station", "electricity pylon", "substation"], transport: ["minibus taxi", "train station", "highway"],
  education: ["university", "school"], jobs: ["city", "skyline"], grants: ["post office", "shopping centre"], cost: ["filling station", "market"],
  health: ["hospital", "clinic"], safety: ["street", "city centre"], trending: ["skyline"],
};

export type VideoCard = { source: string; text: string; emphasis: string[]; place: string; lat: number; lon: number; photoQueries: string[] };
export type VideoScript = {
  storyKey: string; day: string; category: CategoryId; title: string; color: string;
  hook: string[]; where: string; sub: string;
  spots: { name: string; lat: number; lon: number; w: number }[];
  cards: VideoCard[]; caption: string; hashtags: string[]; articleKeys: string[];
};

type Sig = typeof schema.signals.$inferSelect;
const articleKey = (s: Sig) => s.urlKey ?? `${s.source}:${s.externalId}`;
const trimWords = (s: string, n = 16) => { const w = s.split(/\s+/); return w.length <= n ? s : `${w.slice(0, n).join(" ")}…`; };

/** Up to 3 distinct recent articles for the story, widening to the same province when the town is quiet. */
async function storyArticles(category: CategoryId, place: Place | null, since: Date): Promise<Sig[]> {
  const near = place ? PLACES.filter((p) => p.province === place.province).map((p) => p.slug) : [];
  const rows = await db().select().from(schema.signals)
    .where(and(eq(schema.signals.category, category), gte(schema.signals.publishedAt, since), sql`${schema.signals.source} <> 'trends'`,
      place ? inArray(schema.signals.placeSlug, near) : sql`true`))
    .orderBy(desc(schema.signals.publishedAt)).limit(30);
  const rank = (s: Sig) => (s.placeSlug === place?.slug ? 0 : 1);
  const picked: Sig[] = [];
  const titles = new Set<string>();
  for (const s of [...rows].sort((a, b) => rank(a) - rank(b))) {
    const k = s.title.toLowerCase().slice(0, 60);
    if (titles.has(k)) continue;
    titles.add(k);
    picked.push(s);
    if (picked.length === 3) break;
  }
  return picked;
}

export async function buildScript(card: ProblemCard, now = new Date()): Promise<VideoScript | null> {
  const place = card.placeSlug ? PLACE_BY_SLUG.get(card.placeSlug) ?? null : null;
  const arts = await storyArticles(card.category, place, new Date(now.getTime() - 36 * HOUR));
  if (!arts.length) return null;
  const places = [...new Map(arts.map((a) => [a.placeSlug, a.placeSlug ? PLACE_BY_SLUG.get(a.placeSlug)! : null])).values()].filter(Boolean) as Place[];
  const spotPlaces = places.length ? places : place ? [place] : [];
  const cat = CATEGORY_BY_ID.get(card.category)!;
  const n = arts.length;
  const tags = hashtags(card.category, place ? [place, ...places.filter((p) => p.slug !== place.slug)] : places, arts.map((a) => a.title));
  const hook = hookLines(card.category, place, card);
  const hookSentence = hook.join(" ").replace(/\s+/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const region = place ? (place.kind === "province" ? place.name : `${place.name}, ${PROVINCE_TAG[place.province] ?? place.province}`) : "South Africa";
  return {
    storyKey: card.id, day: saDay(now), category: card.category, title: card.title, color: cat.color,
    hook, where: place?.name ?? "South Africa", sub: `${n} ${cat.label.toLowerCase()} ${n === 1 ? "story" : "stories"} in the last day`,
    spots: spotPlaces.slice(0, 4).map((p, i) => ({ name: p.name, lat: p.lat, lon: p.lon, w: Math.max(0.45, 1 - i * 0.2) })),
    cards: arts.map((a) => {
      const p = a.placeSlug ? PLACE_BY_SLUG.get(a.placeSlug) ?? place : place;
      const words = PHOTO_WORDS[card.category];
      const pn = p?.name ?? "South Africa";
      return {
        source: a.publisher ?? "News", text: trimWords(a.title), emphasis: emphasis(a.title, card.category),
        place: pn, lat: p?.lat ?? -29, lon: p?.lon ?? 25,
        photoQueries: [`${pn} ${words[0]}`, `${pn} ${words[1] ?? words[0]}`, `${pn} skyline`, `${pn} city`, `South Africa ${words[0]}`],
      };
    }),
    caption: `${hookSentence} ⚡ ${n} ${n === 1 ? "story" : "stories"} from ${region} in the last day. Is your area affected? Comment your suburb 👇\n\n${tags.join(" ")}`,
    hashtags: tags,
    articleKeys: arts.map(articleKey),
  };
}

/** Why a script would repeat an earlier video, or null when it's fresh. */
export async function repeatReason(storyKey: string, articleKeys: string[], day: string, now = new Date()): Promise<string | null> {
  const since = new Date(now.getTime() - REPEAT_WINDOW_DAYS * 24 * HOUR);
  const earlier = await db().select({ day: schema.clips.day, keys: schema.clips.articleKeys }).from(schema.clips)
    .where(and(eq(schema.clips.storyKey, storyKey), gte(schema.clips.createdAt, since)));
  for (const e of earlier) {
    if (e.day === day) return "already made a video for this story today";
    const old = new Set(e.keys);
    const overlap = articleKeys.filter((k) => old.has(k)).length / Math.max(1, articleKeys.length);
    if (overlap >= REPEAT_OVERLAP) return `${Math.round(overlap * 100)}% of its articles were already used on ${e.day}`;
  }
  return null;
}

export async function logSkip(storyKey: string, reason: string) {
  await db().insert(schema.posts).values({ storyKey, platform: "all", status: "skipped_duplicate", detail: reason });
}

/** Today's video scripts: the top stories, minus repeats (repeats are written to the post log). */
export async function videoPlan(max = 3, now = new Date(), log = true): Promise<{ scripts: VideoScript[]; skipped: { storyKey: string; reason: string }[] }> {
  const scripts: VideoScript[] = [];
  const skipped: { storyKey: string; reason: string }[] = [];
  for (const card of await problemCards(now, 15)) {
    if (scripts.length >= max) break;
    const s = await buildScript(card, now);
    if (!s) continue;
    const why = await repeatReason(s.storyKey, s.articleKeys, s.day, now);
    if (why) { skipped.push({ storyKey: s.storyKey, reason: why }); continue; }
    // Two stories in today's plan built from mostly the same articles (e.g. Joburg + Gauteng power) = one video.
    const twin = scripts.find((x) => s.articleKeys.filter((k) => x.articleKeys.includes(k)).length / s.articleKeys.length >= REPEAT_OVERLAP);
    if (twin) { skipped.push({ storyKey: s.storyKey, reason: `same articles as today's ${twin.storyKey} video` }); continue; }
    scripts.push(s);
  }
  if (log) for (const k of skipped) await logSkip(k.storyKey, k.reason);
  return { scripts, skipped };
}

// ---------------------------------------------------------------- storage

export const fingerprint = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export async function storeClip(meta: { storyKey: string; day: string; title: string; caption: string; hashtags: string[]; articleKeys: string[]; credits: string[]; durationSec: number }, mp4: Buffer, poster: Buffer | null) {
  const fp = fingerprint(mp4);
  const [same] = await db().select({ id: schema.clips.id }).from(schema.clips).where(eq(schema.clips.fingerprint, fp)).limit(1);
  if (same) return { ok: false as const, reason: "this exact video was already uploaded" };
  const why = await repeatReason(meta.storyKey, meta.articleKeys, meta.day);
  if (why) { await logSkip(meta.storyKey, why); return { ok: false as const, reason: why }; }
  const [row] = await db().insert(schema.clips).values({ ...meta, fingerprint: fp, mp4, poster, bytes: mp4.length }).returning({ id: schema.clips.id });
  return { ok: true as const, id: row.id };
}

export async function pruneClips(now = new Date()) {
  await db().delete(schema.clips).where(lt(schema.clips.createdAt, new Date(now.getTime() - CLIP_RETAIN_DAYS * 24 * HOUR)));
  await db().delete(schema.posts).where(lt(schema.posts.createdAt, new Date(now.getTime() - 30 * 24 * HOUR)));
}

export type ClipInfo = { id: string; storyKey: string; day: string; title: string; caption: string; hashtags: string[]; credits: string[]; durationSec: number; bytes: number; createdAt: string; videoUrl: string; posterUrl: string; posted: string[] };

export async function listClips(base: string, limit = 12): Promise<ClipInfo[]> {
  const rows = await db().select({
    id: schema.clips.id, storyKey: schema.clips.storyKey, day: schema.clips.day, title: schema.clips.title, caption: schema.clips.caption,
    hashtags: schema.clips.hashtags, credits: schema.clips.credits, durationSec: schema.clips.durationSec, bytes: schema.clips.bytes, createdAt: schema.clips.createdAt,
  }).from(schema.clips).orderBy(desc(schema.clips.createdAt)).limit(limit);
  const posted = rows.length ? await db().select({ clipId: schema.posts.clipId, platform: schema.posts.platform }).from(schema.posts)
    .where(and(inArray(schema.posts.clipId, rows.map((r) => r.id)), inArray(schema.posts.status, ["shared", "posted"]))) : [];
  return rows.map((r) => ({
    ...r, createdAt: r.createdAt.toISOString(),
    videoUrl: `${base}/api/clips/${r.id}/video`, posterUrl: `${base}/api/clips/${r.id}/poster`,
    posted: [...new Set(posted.filter((p) => p.clipId === r.id).map((p) => p.platform))],
  }));
}
