/**
 * South African news headlines from public RSS feeds. We keep only the headline and the link
 * back to the publisher (never the article text), and only headlines that match a problem
 * category. Feeds can be changed with the NEWS_FEEDS env var: "Name|url,Name|url".
 */
import { asArray, cleanText, fetchText, parseDate, sha, tag, urlKey, xml, type NewSignal } from "./common";

export const DEFAULT_FEEDS: { name: string; url: string }[] = [
  // News24 blocks automated readers and TimesLIVE/EWN have no working public feed: left out on purpose.
  { name: "SABC News", url: "https://www.sabcnews.com/sabcnews/feed/" },
  { name: "The Citizen", url: "https://www.citizen.co.za/feed/" },
  { name: "GroundUp", url: "https://groundup.org.za/sitenews/rss/" },
  { name: "Daily Maverick", url: "https://www.dailymaverick.co.za/dmrss/" },
  { name: "IOL", url: "https://iol.co.za/rss/iol/news" },
  { name: "Mail & Guardian", url: "https://mg.co.za/feed/" },
  { name: "BusinessTech", url: "https://businesstech.co.za/news/feed/" },
  { name: "The South African", url: "https://www.thesouthafrican.com/feed/" },
];

export function feeds() {
  const env = process.env.NEWS_FEEDS?.trim();
  if (!env) return DEFAULT_FEEDS;
  return env.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [name, url] = s.includes("|") ? s.split("|") : [new URL(s).hostname, s];
    return { name: name.trim(), url: url.trim() };
  });
}

/** Parse one RSS 2.0 or Atom document into signals (only items that match a category). */
export function parseFeed(body: string, publisher: string): NewSignal[] {
  const doc = xml.parse(body);
  const rssItems = asArray(doc?.rss?.channel?.item);
  const atomItems = asArray(doc?.feed?.entry);
  const out: NewSignal[] = [];
  for (const it of [...rssItems, ...atomItems] as Record<string, unknown>[]) {
    const title = cleanText(it.title && typeof it.title === "object" ? (it.title as Record<string, unknown>)["#text"] : it.title);
    if (!title) continue;
    const linkField = it.link as unknown;
    const link = typeof linkField === "string" ? linkField
      : asArray(linkField as Record<string, string>[]).find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"] ?? null;
    const t = tag(title);
    if (!t) continue;
    const key = urlKey(link);
    out.push({
      source: "news", externalId: sha(key ?? `${publisher}:${title}`), urlKey: key, title, url: link, publisher,
      ...t, weight: 1, publishedAt: parseDate(it.pubDate ?? it.published ?? it.updated),
    });
  }
  return out;
}

export async function collectNews(): Promise<{ signals: NewSignal[]; errors: string[] }> {
  const signals: NewSignal[] = [];
  const errors: string[] = [];
  await Promise.all(feeds().map(async (f) => {
    try { signals.push(...parseFeed(await fetchText(f.url), f.name)); }
    catch (e) { errors.push(`${f.name}: ${(e as Error).message}`); }
  }));
  return { signals, errors };
}
