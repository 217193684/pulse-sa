import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { classify, type CategoryId } from "../classify";
import { findPlace } from "../geo/places";

/** A signal ready to store. */
export type NewSignal = {
  source: "news" | "trends" | "eskom" | "gdelt";
  externalId: string;
  urlKey: string | null;
  title: string;
  url: string | null;
  publisher: string | null;
  category: CategoryId;
  placeSlug: string | null;
  lat: number | null;
  lon: number | null;
  weight: number;
  extra?: Record<string, unknown>;
  publishedAt: Date;
};

const UA = "PulseSA/0.1 (+https://github.com/217193684/pulse-sa; public-interest problem radar)";

/** GET with a timeout and a polite User-Agent. Throws on non-2xx. */
export async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

export const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** Same article, same key: lower-case host + path, no query/hash, no trailing slash, no "www." */
export function urlKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch { return null; }
}

/** Decodes the few HTML entities that show up in feed titles, and squashes whitespace. */
export function cleanText(s: unknown): string {
  return String(s ?? "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'").replace(/&#822[01];|&[lr]dquo;/g, '"').replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

export function parseDate(s: unknown, fallback = new Date()): Date {
  const d = new Date(String(s ?? ""));
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 3600_000 ? fallback : d;
}

export const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true, processEntities: false });

export const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Classify + place-pin text; returns null when it fits no category (and there's no fallback). */
export function tag(text: string, fallbackCategory: CategoryId | null = null, problemsOnly = false) {
  const category = classify(text, problemsOnly) ?? fallbackCategory;
  if (!category) return null;
  const place = findPlace(text);
  return { category, placeSlug: place?.slug ?? null, lat: place?.lat ?? null, lon: place?.lon ?? null };
}
