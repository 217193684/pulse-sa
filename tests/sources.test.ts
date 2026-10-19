/** Each source's parser against saved sample responses. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFeed } from "../src/server/sources/news";
import { parseTrends, parseTraffic, trafficWeight } from "../src/server/sources/trends";
import { eskomSignal, parseEskomStatus } from "../src/server/sources/eskom";
import { parseGdelt, parseGdeltDate } from "../src/server/sources/gdelt";
import { cleanText, urlKey } from "../src/server/sources/common";

const fx = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");

describe("news RSS/Atom", () => {
  it("keeps only problem headlines, tagged and placed, with links", () => {
    const s = parseFeed(fx("news24.xml"), "News24");
    expect(s.map((x) => x.category)).toEqual(["water", "education", "power"]);
    expect(s[0]).toMatchObject({ placeSlug: "ethekwini", publisher: "News24", source: "news" });
    expect(s[0].urlKey).toBe("news24.com/news24/southafrica/news/umlazi-without-water-20261019");
    expect(s[2].title).toBe("Eskom: Stage 2 load shedding from 16:00 & through the evening");
    expect(s[1].publishedAt.toISOString()).toBe("2026-10-19T05:30:00.000Z");
  });
  it("reads Atom feeds too", () => {
    const s = parseFeed(fx("atom.xml"), "GroundUp");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ category: "transport", placeSlug: "cape-town", url: "https://groundup.org.za/article/taxi-strike-cape-town/" });
  });
  it("normalises URLs and text", () => {
    expect(urlKey("https://WWW.News24.com/a/b/?utm=1#x")).toBe("news24.com/a/b");
    expect(urlKey("javascript:alert(1)")).toBeNull();
    expect(cleanText("<b>Hi</b> &amp;   there &#8217;s")).toBe("Hi & there 's");
  });
});

describe("Google Trends", () => {
  it("keeps every search, weights by traffic, categorises when it can", () => {
    const s = parseTrends(fx("trends.xml"));
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ title: "sassa payment dates", category: "grants", weight: 3 });
    expect(s[0].extra).toMatchObject({ traffic: 50000 });
    expect(s[1]).toMatchObject({ title: "kaizer chiefs", category: "trending", weight: 4 });
    expect(parseTraffic("1,000,000+")).toBe(1000000);
    expect(trafficWeight(0)).toBe(1);
  });
});

describe("Eskom", () => {
  it("reads the status number", () => {
    expect(parseEskomStatus("1")).toBe(0);
    expect(parseEskomStatus("3")).toBe(2);
    expect(parseEskomStatus('"5"')).toBe(4);
    expect(parseEskomStatus("-1")).toBeNull();
    expect(parseEskomStatus("<html>")).toBeNull();
  });
  it("records a signal only while load-shedding", () => {
    expect(eskomSignal(0)).toBeNull();
    expect(eskomSignal(3, new Date("2026-10-19T10:20:00Z"))).toMatchObject({ category: "power", weight: 3, title: "Load-shedding stage 3" });
  });
});

describe("GDELT", () => {
  it("keeps English problem articles, with dates and places", () => {
    const s = parseGdelt(fx("gdelt.json"));
    expect(s.map((x) => x.placeSlug)).toEqual(["ethekwini", "msunduzi"]);
    expect(s[1].publishedAt.toISOString()).toBe("2026-10-19T06:30:00.000Z");
    expect(parseGdeltDate("bad").getTime()).toBeGreaterThan(0);
  });
  it("explains a non-JSON answer", () => {
    expect(() => parseGdelt("Please limit requests to one every 5 seconds")).toThrow(/isn't JSON/);
  });
});
