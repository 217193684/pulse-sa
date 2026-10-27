import { classify } from "./classify";
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
import { CATEGORY_BY_ID, FORECAST, type CategoryId } from "./classify";
import { PLACES, PLACE_BY_SLUG, type Place } from "./geo/places";
import { cleanText } from "./sources/common";
import { problemCards, type ProblemCard } from "./problems";

const HOUR = 3600_000;
export const CLIP_RETAIN_DAYS = 3;   // videos live in the free database: 20 a day for 3 days fits comfortably
export const REPEAT_WINDOW_DAYS = 3;
export const REPEAT_OVERLAP = 0.6;

/** South African calendar day, so "today" flips at midnight SAST, not UTC. */
export const saDay = (d = new Date()) => new Date(d.getTime() + 2 * HOUR).toISOString().slice(0, 10);

// ---------------------------------------------------------------- hashtags

export const PROVINCE_TAG: Record<string, string> = { GP: "Gauteng", KZN: "KZN", WC: "WesternCape", EC: "EasternCape", FS: "FreeState", LP: "Limpopo", MP: "Mpumalanga", NW: "NorthWest", NC: "NorthernCape" };
const CATEGORY_TAGS: Record<CategoryId, string[]> = {
  water: ["WaterCrisis", "WaterOutage"], power: ["PowerCuts", "Electricity"], transport: ["Transport", "Commuters"],
  education: ["Students", "Education"], jobs: ["Jobs", "Unemployment"], grants: ["SASSA", "Grants"],
  cost: ["CostOfLiving", "FuelPrice"], health: ["Health", "PublicHealth"], safety: ["Safety", "Protest"], trending: ["Trending"],
  good: ["GoodNews", "ProudlySA"], sport: ["SASport", "Sport"], politics: ["SAPolitics", "Politics"], business: ["SABusiness", "Money"],
  weather: ["SAWeather", "WeatherWarning"], entertainment: ["MzansiCelebs", "Entertainment"], general: ["SANews", "Breaking"],
};
/** Words in headlines that deserve their own hashtag when they appear. */
const KEYWORD_TAGS: [RegExp, string][] = [
  [/load[- ]?shedding/i, "LoadShedding"], [/load[- ]?reduction/i, "LoadReduction"], [/\bEskom\b/i, "Eskom"], [/City Power/i, "CityPower"],
  [/\bNSFAS\b/i, "NSFAS"], [/\bmatric\b/i, "Matric2026"], [/\bSASSA\b/i, "SASSA"], [/\bSRD\b/i, "SRDGrant"],
  [/taxi strike/i, "TaxiStrike"], [/fuel|petrol|diesel/i, "FuelPrice"], [/cholera/i, "Cholera"], [/Rand Water/i, "RandWater"],
  [/\bPRASA\b|Metrorail/i, "Metrorail"], [/taxi/i, "TaxiIndustry"], [/SANTACO/i, "SANTACO"], [/vacanc|hiring|recruit|learnership|internship/i, "JobsSA"],
  [/Bafana/i, "BafanaBafana"], [/Springbok|\bBoks\b/i, "Springboks"], [/Proteas/i, "Proteas"], [/Chiefs/i, "KaizerChiefs"], [/Pirates/i, "OrlandoPirates"], [/Sundowns/i, "Sundowns"],
  [/forecast|expected to|predict/i, "Forecast"], [/repo rate|interest rate/i, "InterestRates"], [/\brand\b/i, "Rand"], [/shutdown/i, "NationalShutdown"], [/retrench/i, "Retrenchments"], [/service delivery/i, "ServiceDelivery"],
];
const BASE_TAGS = ["Mzansi", "SouthAfrica", "PulseSA", "SANews"];
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
  good: ["city skyline", "landscape"], sport: ["stadium", "sports field"], politics: ["parliament", "city hall"], business: ["city skyline", "office buildings"],
  weather: ["clouds", "landscape"], entertainment: ["theatre", "city at night"], general: ["skyline", "city"],
};

export type VideoCard = { source: string; text: string; emphasis: string[]; place: string; lat: number; lon: number; photoQueries: string[] };
export type VideoScript = {
  storyKey: string; day: string; category: CategoryId; title: string; color: string;
  hook: string[]; where: string; sub: string;
  spots: { name: string; lat: number; lon: number; w: number }[];
  cards: VideoCard[]; caption: string; hashtags: string[]; articleKeys: string[];
  end?: { a: string; b: string; hl: string; ask: string };   // closing question (default: "Is your area affected?")
  links?: { outlet: string; url: string }[];                   // the articles, linked in the YouTube description
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


// ---------------------------------------------------------------- news stories (all kinds of news, as they break)

export const DAILY_VIDEO_CAP = Number(process.env.DAILY_VIDEO_CAP || 20);
const STOP = new Set("the a an and or of to in on at for from with by as is are was were be been has have had will would can could after before over into amid says said new more than its it this that his her their they he she we you who what why how not no up out about after says".split(" "));
// News categories people most want to hear about as soon as it happens.
// Polls, quizzes, opinion and "watch/listen" items aren't news stories.
const NOT_NEWS = /^(?:POLL|QUIZ|OPINION|EDITORIAL|LETTER|WATCH|LISTEN|PODCAST|LIVE BLOG|SPONSORED|ADVERTORIAL|COMMENT|ANALYSIS|CARTOON)\b|\b(?:sponsored|advertorial|horoscope|crossword|lotto results|powerball results)\b/i;
export const PER_HOUR = Number(process.env.VIDEOS_PER_HOUR || 4);
const PRIORITY = new Set<CategoryId>(["cost", "transport", "jobs", "grants", "power", "water", "weather", "good", "safety"]);

type Story = { key: string; category: CategoryId; arts: Sig[]; publishers: string[]; place: Place | null; forecast: boolean; score: number; words: string[]; rare: string[] };

const wordsOf = (t: string) => [...new Set(t.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const similar = (a: string[], b: string[]) => { const B = new Set(b); const n = a.filter((w) => B.has(w)).length; return n >= 2 && n / Math.min(a.length, b.length) >= 0.45; };

/** Groups the last hours of headlines into stories (the same event reported by several outlets = one story) and ranks them. */
export async function newsStories(now = new Date(), hours = 12): Promise<Story[]> {
  const since = new Date(now.getTime() - hours * HOUR);
  const rows = await db().select().from(schema.signals)
    .where(and(gte(schema.signals.publishedAt, since), inArray(schema.signals.source, ["news", "gdelt"])))
    .orderBy(desc(schema.signals.publishedAt)).limit(hours > 48 ? 3000 : 800);   // a week's news for the Friday explainer
  const trends = (await db().select({ title: schema.signals.title }).from(schema.signals)
    .where(and(eq(schema.signals.source, "trends"), gte(schema.signals.publishedAt, new Date(now.getTime() - 24 * HOUR))))).map((t) => wordsOf(t.title));
  const groups: { words: string[]; arts: Sig[] }[] = [];
  for (const r of rows) {
    r.title = cleanText(r.title);   // older rows may still carry HTML codes like &#124;
    if (NOT_NEWS.test(r.title)) continue;
    if (r.source === "news" || r.source === "gdelt") r.category = classify(r.title) ?? r.category;   // re-check with today's rules
    const w = wordsOf(r.title);
    if (w.length < 2) continue;
    const g = groups.find((x) => similar(x.words, w));
    if (g) { g.arts.push(r); if (g.words.length < 40) g.words = [...new Set([...g.words, ...w])]; } else groups.push({ words: w, arts: [r] });
  }
  const df = new Map<string, number>();
  for (const g of groups) for (const w of g.words) df.set(w, (df.get(w) ?? 0) + 1);
  const out: Story[] = [];
  for (const g of groups) {
    const counts = new Map<CategoryId, number>();
    for (const a of g.arts) if (a.category !== "general" && a.category !== "trending") counts.set(a.category as CategoryId, (counts.get(a.category as CategoryId) ?? 0) + 1);
    const category = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "general";
    const publishers = [...new Set(g.arts.map((a) => a.publisher ?? a.source))];
    const placeCounts = new Map<string, number>();
    for (const a of g.arts) if (a.placeSlug) placeCounts.set(a.placeSlug, (placeCounts.get(a.placeSlug) ?? 0) + 1);
    const placeSlug = [...placeCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    const newest = Math.max(...g.arts.map((a) => a.publishedAt.getTime()));
    const ageH = (now.getTime() - newest) / HOUR;
    const forecast = g.arts.some((a) => FORECAST.test(a.title));
    const trending = trends.some((t) => t.filter((w) => g.words.includes(w)).length >= 2);
    // Worth a video: several outlets on it, or one fresh report in a category people care about.
    const worthy = publishers.length >= 2 || (category !== "general" && PRIORITY.has(category) && ageH < 6) || (category !== "general" && trending);
    if (!worthy) continue;
    const score = publishers.length * 3 + Math.min(g.arts.length, 6) + (ageH < 2 ? 4 : ageH < 6 ? 2 : 0) + (PRIORITY.has(category) ? 2 : 0) + (trending ? 3 : 0) + (forecast ? 1 : 0);
    const top = wordsOf(g.arts[g.arts.length - 1].title).slice(0, 4).sort().join("-");
    const rare = g.words.filter((w) => (df.get(w) ?? 0) <= 3 && w.length > 3 && !/^\d+$/.test(w));
    out.push({ key: `n~${category}~${createHash("sha1").update(top).digest("hex").slice(0, 10)}`, category, arts: g.arts, publishers, place: placeSlug ? PLACE_BY_SLUG.get(placeSlug) ?? null : null, forecast, score, words: g.words, rare });
  }
  return out.sort((a, b) => b.score - a.score);
}

const MONTH = () => new Date(Date.now() + 2 * HOUR).toLocaleString("en-ZA", { month: "long", timeZone: "Africa/Johannesburg" }).toUpperCase();

/** The four big opening words: plain, accurate, never more than the headlines say. */
function newsHook(st: Story): string[] {
  const where = st.place ? st.place.name.toUpperCase() : "MZANSI";
  const text = st.arts.map((a) => a.title).join(" ");
  const fresh = (Date.now() - Math.max(...st.arts.map((a) => a.publishedAt.getTime()))) / HOUR < 3;
  if (/petrol|diesel|fuel price/i.test(text)) {
    const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i)?.[1]?.toUpperCase();
    return st.forecast ? ["PETROL", "PRICE", "FORECAST", m ?? "NEXT MONTH"] : ["PETROL", "PRICE", "NEWS", m ?? MONTH()];
  }
  if (/\btaxi|SANTACO/i.test(text)) return ["TAXI", "INDUSTRY", "UPDATE", fresh ? "RIGHT NOW" : "TODAY"];
  if (st.forecast) return ["WHAT", "TO", "EXPECT", where];
  switch (st.category) {
    case "jobs": return /vacanc|hiring|recruit|learnership|internship|apply/i.test(text) ? ["JOBS", "ARE", "OPEN", "APPLY NOW"] : ["JOBS", "NEWS", "FROM", where];
    case "good": return ["GOOD", "NEWS", "FROM", where];
    case "sport": return ["SPORT", "NEWS", fresh ? "JUST IN" : "TODAY"];
    case "politics": return ["POLITICS", "UPDATE", fresh ? "JUST IN" : "TODAY"];
    case "business": return ["MONEY", "NEWS", "YOU", "NEED"];
    case "weather": return ["WEATHER", "ALERT", where];
    case "entertainment": return ["MZANSI", "CELEB", "NEWS"];
    case "general": return ["LATEST", "NEWS", where, fresh ? "JUST IN" : "TODAY"];
    default: return hookLines(st.category, st.place, { trend: fresh ? "New today" : "Usual" } as ProblemCard);
  }
}

/** The closing question, fitted to the kind of story. */
function newsEnd(st: Story): { a: string; b: string; hl: string; ask: string } {
  const text = st.arts.map((a) => a.title).join(" ");
  if (st.forecast) return { a: "Will this", b: "help", hl: "you?", ask: "Tell us in the comments ⬇" };
  if (/petrol|diesel|fuel/i.test(text)) return { a: "How does", b: "this hit", hl: "you?", ask: "Tell us in the comments ⬇" };
  if (/\btaxi|SANTACO/i.test(text)) return { a: "Does this", b: "affect your", hl: "route?", ask: "Comment your taxi route ⬇" };
  switch (st.category) {
    case "jobs": return { a: "Know", b: "someone who", hl: "needs this?", ask: "Share it with them ⬇" };
    case "good": return { a: "Mzansi", b: "can be", hl: "proud!", ask: "Share the good news ⬇" };
    case "sport": return { a: "What's", b: "your", hl: "prediction?", ask: "Drop it in the comments ⬇" };
    case "politics": case "business": case "entertainment": case "general": return { a: "What do", b: "you", hl: "think?", ask: "Tell us in the comments ⬇" };
    case "weather": return { a: "Stay safe.", b: "Is it bad", hl: "where you are?", ask: "Comment your area ⬇" };
    default: return { a: "Is your", b: "area", hl: "affected?", ask: "Comment your suburb ⬇" };
  }
}

/** A video script for one news story: up to 3 headlines from different outlets, each credited on screen. */
export function buildNewsScript(st: Story, now = new Date()): VideoScript {
  const seenPub = new Set<string>(); const picked: Sig[] = [];
  const sorted = [...st.arts].sort((a, b) => (FORECAST.test(b.title) ? 1 : 0) - (FORECAST.test(a.title) ? 1 : 0) || b.publishedAt.getTime() - a.publishedAt.getTime());
  for (const a of sorted) { const p = a.publisher ?? a.source; if (seenPub.has(p)) continue; seenPub.add(p); picked.push(a); if (picked.length === 3) break; }
  for (const a of sorted) { if (picked.length >= Math.min(3, st.arts.length)) break; if (!picked.includes(a)) picked.push(a); }
  const cat = CATEGORY_BY_ID.get(st.category) ?? CATEGORY_BY_ID.get("general")!;
  const places = [...new Map(picked.map((a) => [a.placeSlug, a.placeSlug ? PLACE_BY_SLUG.get(a.placeSlug) ?? null : null])).values()].filter(Boolean) as Place[];
  const tags = hashtags(st.category, st.place ? [st.place, ...places.filter((p) => p.slug !== st.place!.slug)] : places, picked.map((a) => a.title));
  const hook = newsHook(st);
  const lead = picked[0];
  const outlets = st.publishers.slice(0, 3).join(", ");
  const words = PHOTO_WORDS[st.category] ?? PHOTO_WORDS.general;
  return {
    storyKey: st.key, day: saDay(now), category: st.category, title: lead.title, color: cat.color,
    hook, where: st.place?.name ?? "South Africa",
    sub: st.forecast ? `Forecast reported by ${outlets}` : `Reported by ${outlets}`,
    spots: (places.length ? places : st.place ? [st.place] : []).slice(0, 4).map((p, i) => ({ name: p.name, lat: p.lat, lon: p.lon, w: Math.max(0.45, 1 - i * 0.2) })),
    cards: picked.map((a) => {
      const p = a.placeSlug ? PLACE_BY_SLUG.get(a.placeSlug) ?? st.place : st.place;
      const pn = p?.name ?? "South Africa";
      return {
        source: FORECAST.test(a.title) ? `Expected · ${a.publisher ?? "News"}` : a.publisher ?? "News",
        text: trimWords(a.title), emphasis: emphasis(a.title, st.category), place: pn, lat: p?.lat ?? -29, lon: p?.lon ?? 25,
        photoQueries: [`${pn} ${words[0]}`, `${pn} ${words[1] ?? words[0]}`, `${pn} skyline`, `South Africa ${words[0]}`],
      };
    }),
    end: newsEnd(st),
    links: picked.filter((a) => a.url).map((a) => ({ outlet: a.publisher ?? "News", url: a.url! })),
    caption: `${lead.title}${st.forecast ? " (forecast, not final)" : ""}\n\nSource: ${outlets}. ${newsEnd(st).ask.replace(" ⬇", "")} 👇\n\n${tags.join(" ")}`,
    hashtags: tags,
    articleKeys: st.arts.map(articleKey),
  };
}

/** Videos made today (SAST). */
async function madeToday(now: Date) {
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.clips).where(eq(schema.clips.day, saDay(now)));
  return r?.n ?? 0;
}

/** Why a news script would repeat ANY earlier video (not only the same story key), or null. */
async function newsRepeat(articleKeys: string[], now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - REPEAT_WINDOW_DAYS * 24 * HOUR);
  const earlier = await db().select({ key: schema.clips.storyKey, keys: schema.clips.articleKeys }).from(schema.clips).where(gte(schema.clips.createdAt, since));
  for (const e of earlier) {
    const old = new Set(e.keys);
    const overlap = articleKeys.filter((k) => old.has(k)).length / Math.max(1, articleKeys.length);
    if (overlap >= REPEAT_OVERLAP) return `${Math.round(overlap * 100)}% of its articles were already in the ${e.key} video`;
  }
  return null;
}

/** The next news videos to make right now: the best fresh stories, minus repeats, within today's cap. */
export async function newsPlan(max = 3, now = new Date(), log = true) {
  const room = Math.max(0, DAILY_VIDEO_CAP - (await madeToday(now)));
  // spread the day's videos out: at most PER_HOUR an hour, except stories 3+ outlets are covering
  const [h] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.clips).where(gte(schema.clips.createdAt, new Date(now.getTime() - HOUR)));
  let hourRoom = Math.max(0, PER_HOUR - (h?.n ?? 0));
  const scripts: VideoScript[] = []; const skipped: { storyKey: string; reason: string }[] = [];
  // what today's videos were about, to catch follow-ups of the same event worded differently
  const recent = (await db().select({ key: schema.clips.storyKey, title: schema.clips.title }).from(schema.clips)
    .where(gte(schema.clips.createdAt, new Date(now.getTime() - 20 * HOUR)))).map((c) => ({ key: c.key, words: new Set(wordsOf(c.title)) }));
  const followUp = (st: Story, against: { key: string; words: Set<string> }[]) => against.find((c) => {
    const shared = st.words.filter((w) => c.words.has(w));
    return shared.some((w) => st.rare.includes(w)) && (shared.length >= 2 || shared.some((w) => w.length >= 5));   // e.g. both about "mtbps"
  });
  const planned: { key: string; words: Set<string> }[] = [];
  if (room > 0) for (const st of await newsStories(now)) {
    if (scripts.length >= Math.min(max, room)) break;
    const s = buildNewsScript(st, now);
    const fu = followUp(st, [...recent, ...planned]);
    const why = (await repeatReason(s.storyKey, s.articleKeys, s.day, now)) ?? (await newsRepeat(s.articleKeys, now))
      ?? (fu ? `same event as the ${fu.key} video made earlier` : null);
    if (why) { skipped.push({ storyKey: s.storyKey, reason: why }); continue; }
    if (scripts.some((x) => s.articleKeys.filter((k) => x.articleKeys.includes(k)).length / s.articleKeys.length >= REPEAT_OVERLAP)) continue;
    if (hourRoom <= 0 && st.publishers.length < 3) continue;   // waits for the next hour (it stays in the running)
    hourRoom--;
    scripts.push(s); planned.push({ key: s.storyKey, words: new Set(st.words) });
  }
  if (log) for (const k of skipped.slice(0, 5)) await logSkip(k.storyKey, k.reason);
  return { scripts, skipped, madeToday: DAILY_VIDEO_CAP - room, cap: DAILY_VIDEO_CAP };
}
