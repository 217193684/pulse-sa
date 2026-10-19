/** Storage, scoring, feed assembly, map, detail and top-3 against a real Postgres. */
import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "../src/server/db";
import { storeSignals, collectAll, RETAIN_DAYS } from "../src/server/collect";
import { feed, mapLayer, problemCards, problemDetail, top3 } from "../src/server/problems";
import { PLACE_BY_SLUG } from "../src/server/geo/places";
import type { NewSignal } from "../src/server/sources/common";
import type { CategoryId } from "../src/server/classify";

const now = new Date();
let n = 0;
function sig(source: NewSignal["source"], category: CategoryId, place: string | null, hoursAgo: number, extra: Partial<NewSignal> = {}): NewSignal {
  const p = place ? PLACE_BY_SLUG.get(place)! : null;
  n++;
  return {
    source, externalId: `t${n}`, urlKey: `example.co.za/story-${n}`, title: `${category} story ${n}${p ? ` in ${p.name}` : ""}`, url: `https://example.co.za/story-${n}`,
    publisher: n % 2 ? "News24" : "EWN", category, placeSlug: p?.slug ?? null, lat: p?.lat ?? null, lon: p?.lon ?? null, weight: 1,
    publishedAt: new Date(now.getTime() - hoursAgo * 3600_000), ...extra,
  };
}

beforeAll(async () => {
  const rows: NewSignal[] = [];
  for (let i = 0; i < 6; i++) rows.push(sig("news", "water", "ethekwini", 1 + i * 2));            // Durban water: new and busy
  rows.push(sig("gdelt", "water", "msunduzi", 3));                                                   // PMB water: smaller
  for (let d = 2; d <= 8; d++) rows.push(sig("news", "power", "johannesburg", d * 24 - 6), sig("news", "power", "johannesburg", d * 24 - 12)); // Joburg power: 2/day normally
  rows.push(sig("news", "power", "johannesburg", 2), sig("news", "power", "johannesburg", 5));      // …and 2 today = normal
  rows.push(sig("news", "transport", "cape-town", 4));
  rows.push(sig("trends", "trending", null, 2, { urlKey: null, title: "kaizer chiefs", weight: 4, extra: { traffic: 200000 } }));
  rows.push(sig("trends", "grants", null, 3, { urlKey: null, title: "sassa payment dates", weight: 3, extra: { traffic: 50000 } }));
  expect(await storeSignals(rows)).toBe(rows.length);
  await db().insert(schema.videos).values({ youtubeId: "dQw4w9WgXcQ", title: "Shrink your NSFAS documents", creator: "@pulsesa" });
});

describe("storage", () => {
  it("the same article from two sources is stored once", async () => {
    const a = sig("news", "health", "polokwane", 1, { urlKey: "example.co.za/dup" });
    const b = sig("gdelt", "health", "polokwane", 1, { urlKey: "example.co.za/dup" });
    expect(await storeSignals([a])).toBe(1);
    expect(await storeSignals([b, a])).toBe(0);
    await db().execute(sql`delete from signals where url_key = 'example.co.za/dup'`);
  });
});

describe("scoring and feed", () => {
  it("an unusual local spike outranks a busy-but-normal topic", async () => {
    const cards = await problemCards(now);
    expect(cards[0]).toMatchObject({ id: "water~ethekwini", title: "Water problems around Durban", trend: "New today", signals: 6 });
    const jhb = cards.find((c) => c.id === "power~johannesburg")!;
    expect(jhb.trend).toBe("Around normal");
    expect(jhb.ratio).toBe(1);
    expect(cards.indexOf(jhb)).toBeGreaterThan(0);
    expect(cards[0].spark.reduce((a, b) => a + b, 0)).toBe(6);
    expect(cards[0].hotspots.map((h) => h.slug)).toEqual(["ethekwini", "msunduzi"]);
    expect(cards[0].hotspots[0].intensity).toBe(1);
  });
  it("feed: top problem, then searches, a video after every third problem", async () => {
    const f = await feed(now);
    expect(f[0].type).toBe("problem");
    expect(f[1]).toMatchObject({ type: "trending" });
    expect((f[1] as { items: { query: string }[] }).items[0].query).toBe("kaizer chiefs");
    const vi = f.findIndex((c) => c.type === "video");
    expect(vi).toBe(4); // p1, trending, p2, p3, video
    expect(f[vi]).toMatchObject({ youtubeId: "dQw4w9WgXcQ", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
  });
  it("load-shedding headline uses the live Eskom stage", async () => {
    await storeSignals([sig("eskom", "power", null, 0.5, { urlKey: null, title: "Load-shedding stage 2", weight: 2 })]);
    await db().insert(schema.status).values({ key: "eskom", value: { stage: 2 } });
    const c = (await problemCards(now)).find((x) => x.id === "power~za")!;
    expect(c.title).toBe("Load-shedding: stage 2 right now");
  });
});

describe("map, detail, top 3", () => {
  it("map layer: hotspots with intensity and counts per layer", async () => {
    const m = await mapLayer("water", now);
    expect(m.hotspots[0]).toMatchObject({ slug: "ethekwini", intensity: 1 });
    expect(m.hotspots[1].intensity).toBeCloseTo(1 / 6, 2);
    expect(m.rising[0].id).toBe("water~ethekwini");
    expect(m.layers.find((l) => l.id === "water")!.signals).toBe(7);
  });
  it("detail: 7 days of counts and the headlines behind it", async () => {
    const d = (await problemDetail("power~johannesburg", now))!;
    expect(d.days).toHaveLength(7);
    expect(d.days.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(12);
    expect(d.signals.length).toBeGreaterThan(0);
    expect(await problemDetail("nope~za", now)).toBeNull();
  });
  it("top 3 with a ready-to-post caption", async () => {
    const t = await top3(now, "https://pulse.example");
    expect(t.cards).toHaveLength(3);
    expect(t.caption).toContain("1. Water problems around Durban");
    expect(t.caption).toContain("https://pulse.example");
  });
});

describe("collection pass", () => {
  it("records failed sources instead of crashing, and prunes old rows", async () => {
    await storeSignals([sig("news", "water", "ethekwini", (RETAIN_DAYS + 5) * 24)]);
    const results = await collectAll(); // the test machine can't reach the internet: every source should fail cleanly
    expect(results.map((r) => r.source)).toEqual(["news", "trends", "eskom", "gdelt"]);
    const runs = await db().select().from(schema.collectorRuns);
    expect(runs.length).toBeGreaterThanOrEqual(4);
    expect(runs.every((r) => r.finishedAt)).toBe(true);
    const [{ c }] = (await db().execute<{ c: string }>(sql`select count(*) as c from signals where published_at < now() - interval '${sql.raw(String(RETAIN_DAYS))} days'`)).rows;
    expect(Number(c)).toBe(0);
  }, 120_000);
});
