/** The newsroom: headlines grouped into stories, which stories deserve a video, forecasts labelled, daily cap. */
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../src/server/db";
import { storeSignals } from "../src/server/collect";
import { newsStories, newsPlan, buildNewsScript, saDay, DAILY_VIDEO_CAP } from "../src/server/video";
import { PLACE_BY_SLUG } from "../src/server/geo/places";
import { classify } from "../src/server/classify";
import type { NewSignal } from "../src/server/sources/common";

const now = new Date();
let n = 0;
const sig = (title: string, publisher: string, hoursAgo: number, place: string | null = null): NewSignal => {
  const p = place ? PLACE_BY_SLUG.get(place)! : null;
  n++;
  return { source: "news", externalId: `nr${n}`, urlKey: `news.example/nr${n}`, title, url: `https://news.example/nr${n}`, publisher,
    category: classify(title) ?? "general", placeSlug: p?.slug ?? null, lat: p?.lat ?? null, lon: p?.lon ?? null, weight: 1,
    publishedAt: new Date(now.getTime() - hoursAgo * 3600_000) };
};

beforeAll(async () => {
  await db().delete(schema.clips);
  await db().delete(schema.signals);
  await storeSignals([
    // one taxi story, three outlets
    sig("SANTACO announces taxi fare increase for Gauteng commuters", "SABC News", 0.5, "gauteng"),
    sig("Taxi fare increase: SANTACO says Gauteng commuters will pay more", "IOL", 1, "gauteng"),
    sig("Gauteng taxi fares going up, SANTACO confirms increase", "The Citizen", 1.5, "gauteng"),
    // a fuel forecast from one outlet, fresh: priority category, so it counts on its own
    sig("Petrol price expected to drop by 40c in November, mid-month data shows", "BusinessTech", 1),
    // sport, two outlets
    sig("Bafana Bafana coach names squad for World Cup qualifiers", "SABC News", 2),
    sig("World Cup qualifiers: Bafana Bafana coach names his squad", "The South African", 3),
    // a lone general headline: not enough for a video
    sig("Book review: a new novel about Johannesburg", "Mail & Guardian", 1),
  ]);
});

describe("news stories", () => {
  it("groups the same event from different outlets into one story", async () => {
    const st = await newsStories(now);
    const taxi = st.find((s) => s.category === "transport")!;
    expect(taxi.arts).toHaveLength(3);
    expect(taxi.publishers.sort()).toEqual(["IOL", "SABC News", "The Citizen"]);
    expect(st.find((s) => s.category === "sport")!.arts).toHaveLength(2);
  });
  it("leaves out lone stories nobody else reports, unless they're fresh and important", async () => {
    const st = await newsStories(now);
    expect(st.some((s) => s.arts.some((a) => /Book review/.test(a.title)))).toBe(false);
    expect(st.some((s) => s.category === "cost" && s.forecast)).toBe(true);
  });
  it("ranks the most-covered story first", async () => {
    expect((await newsStories(now))[0].category).toBe("transport");
  });
});

describe("news scripts", () => {
  it("credit every outlet and label forecasts as expected", async () => {
    const st = await newsStories(now);
    const taxi = buildNewsScript(st.find((s) => s.category === "transport")!, now);
    expect(taxi.hook).toEqual(["TAXI", "INDUSTRY", "UPDATE", "RIGHT NOW"]);
    expect(taxi.sub).toMatch(/^Reported by /);
    expect(new Set(taxi.cards.map((c) => c.source)).size).toBe(3);
    expect(taxi.hashtags).toEqual(expect.arrayContaining(["#TaxiIndustry", "#SANTACO"]));
    const fuel = buildNewsScript(st.find((s) => s.category === "cost")!, now);
    expect(fuel.hook).toEqual(["PETROL", "PRICE", "FORECAST", "NOVEMBER"]);   // the month the forecast is about, not today's
    expect(fuel.cards[0].source).toBe("Expected · BusinessTech");
    expect(fuel.sub).toMatch(/^Forecast reported by /);
    expect(fuel.caption).toMatch(/forecast, not final/);
  });
});

describe("news plan", () => {
  it("plans the next videos, never the same story twice, within the daily cap", async () => {
    const first = await newsPlan(5, now, false);
    expect(first.scripts.length).toBe(3);
    expect(DAILY_VIDEO_CAP).toBe(20);
    // pretend the taxi video was made: it must not come back
    const taxi = first.scripts.find((s) => s.category === "transport")!;
    await db().insert(schema.clips).values({ storyKey: taxi.storyKey, day: saDay(now), title: taxi.title, caption: "", hashtags: [], articleKeys: taxi.articleKeys,
      credits: [], durationSec: 13, fingerprint: "x1", mp4: Buffer.from("x"), poster: null, bytes: 1 });
    const second = await newsPlan(5, now, false);
    expect(second.scripts.some((s) => s.category === "transport")).toBe(false);
    expect(second.madeToday).toBe(1);
  });
});
