/**
 * Google Trends "Trending now" for South Africa (public RSS feed, no key).
 * Every trending search is kept: it feeds the "What SA is searching" card. Searches whose title
 * or attached news headlines match a problem category also count toward that category.
 */
import { asArray, cleanText, fetchText, parseDate, sha, tag, xml, type NewSignal } from "./common";

export const TRENDS_URL = "https://trends.google.com/trending/rss?geo=ZA";

/** "20,000+" → 20000 */
export function parseTraffic(s: unknown): number {
  const n = Number(String(s ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Weight 1 for small searches, up to 5 for 500k+; keeps one huge search from drowning a map. */
export const trafficWeight = (t: number) => (t >= 500_000 ? 5 : t >= 100_000 ? 4 : t >= 20_000 ? 3 : t >= 5_000 ? 2 : 1);

export function parseTrends(body: string, now = new Date()): NewSignal[] {
  const doc = xml.parse(body);
  const out: NewSignal[] = [];
  for (const it of asArray(doc?.rss?.channel?.item) as Record<string, unknown>[]) {
    const query = cleanText(it.title);
    if (!query) continue;
    const traffic = parseTraffic(it["ht:approx_traffic"]);
    const news = asArray(it["ht:news_item"] as Record<string, unknown>[]).map((n) => ({
      title: cleanText(n["ht:news_item_title"]), url: String(n["ht:news_item_url"] ?? "") || null, source: cleanText(n["ht:news_item_source"]),
    }));
    // Categorise by the search itself. Related headlines are too broad (a search for "tax" can
    // carry a hospital story) so they only decide the category when the search alone is unclear
    // AND at least two headlines agree.
    let t = tag(query);
    if (!t) {
      const votes = new Map<string, number>();
      for (const n of news) { const c = tag(n.title); if (c) votes.set(c.category, (votes.get(c.category) ?? 0) + 1); }
      const [best] = [...votes.entries()].sort((a, b) => b[1] - a[1]);
      t = best && best[1] >= 2 ? tag(news.map((n) => n.title).join(" · "), best[0] as never) : null;
    }
    t ??= { ...tag(query, "trending")!, category: "trending" };
    const publishedAt = parseDate(it.pubDate, now);
    out.push({
      source: "trends",
      // the same search can trend again another day: one row per search per day
      externalId: sha(`${query.toLowerCase()}:${publishedAt.toISOString().slice(0, 10)}`),
      urlKey: null, title: query, url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, publisher: "Google Trends",
      ...t!, weight: trafficWeight(traffic), extra: { traffic, news: news.slice(0, 3) }, publishedAt,
    });
  }
  return out;
}

export async function collectTrends(): Promise<{ signals: NewSignal[]; errors: string[] }> {
  try { return { signals: parseTrends(await fetchText(TRENDS_URL)), errors: [] }; }
  catch (e) { return { signals: [], errors: [`Google Trends: ${(e as Error).message}`] }; }
}
