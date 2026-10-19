/**
 * GDELT DOC 2.0: a free, open index of world news. We ask for recent articles from
 * South African outlets (GDELT country code "SF") about the problems we track, and keep
 * headline + link only. Articles also seen in an RSS feed are de-duplicated by URL.
 */
import { asArray, cleanText, fetchText, sha, tag, urlKey, type NewSignal } from "./common";

const TOPICS = '("water outage" OR "no water" OR "load shedding" OR "power outage" OR NSFAS OR SASSA OR "taxi strike" OR "service delivery" OR retrenchments OR "fuel price" OR cholera OR "burst pipe")';
export const GDELT_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`${TOPICS} sourcecountry:SF`)}&mode=ArtList&maxrecords=150&format=json&timespan=24h&sort=DateDesc`;

/** GDELT dates look like 20261019T094500Z */
export function parseGdeltDate(s: unknown): Date {
  const m = String(s ?? "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date();
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

export function parseGdelt(body: string): NewSignal[] {
  let data: { articles?: { url?: string; title?: string; seendate?: string; domain?: string; language?: string }[] };
  try { data = JSON.parse(body); } catch { throw new Error("GDELT returned something that isn't JSON (often a rate-limit message)"); }
  const out: NewSignal[] = [];
  for (const a of asArray(data.articles)) {
    if (a.language && a.language !== "English") continue;
    const title = cleanText(a.title);
    if (!title || !a.url) continue;
    const t = tag(title);
    if (!t) continue;
    const key = urlKey(a.url);
    out.push({ source: "gdelt", externalId: sha(key ?? a.url), urlKey: key, title, url: a.url, publisher: a.domain ?? null, ...t, weight: 1, publishedAt: parseGdeltDate(a.seendate) });
  }
  return out;
}

export async function collectGdelt(): Promise<{ signals: NewSignal[]; errors: string[] }> {
  try { return { signals: parseGdelt(await fetchText(GDELT_URL, 25_000)), errors: [] }; }
  catch (e) { return { signals: [], errors: [`GDELT: ${(e as Error).message}`] }; }
}
