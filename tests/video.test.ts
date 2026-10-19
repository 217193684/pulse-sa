/** Video scripts, hashtags, duplicate rules, uploads and the GitHub-token check. */
import { beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { db, schema } from "../src/server/db";
import { storeSignals } from "../src/server/collect";
import { hashtags, videoPlan, storeClip, repeatReason, saDay, listClips } from "../src/server/video";
import { verifyGithubRun, GITHUB_ISSUER, AUDIENCE } from "../src/server/oidc";
import { PLACE_BY_SLUG } from "../src/server/geo/places";
import type { NewSignal } from "../src/server/sources/common";

const now = new Date();
let n = 0;
const sig = (category: NewSignal["category"], place: string | null, hoursAgo: number, title: string, publisher = "The Citizen"): NewSignal => {
  const p = place ? PLACE_BY_SLUG.get(place)! : null;
  n++;
  return { source: "news", externalId: `v${n}`, urlKey: `example.co.za/v${n}`, title, url: `https://example.co.za/v${n}`, publisher, category,
    placeSlug: p?.slug ?? null, lat: p?.lat ?? null, lon: p?.lon ?? null, weight: 1, publishedAt: new Date(now.getTime() - hoursAgo * 3600_000) };
};

beforeAll(async () => {
  await storeSignals([
    sig("power", "johannesburg", 1, "Underground tour reveals scale of problems plaguing Joburg's power infrastructure", "Daily Maverick"),
    sig("power", "gauteng", 2, "Gauteng load reduction schedule for this week: find your block"),
    sig("power", "ekurhuleni", 3, "Plan to free Ekurhuleni from Eskom gets the green light"),
    sig("power", "johannesburg", 4, "City Power crews battle cable theft in Soweto"),
    sig("water", "ethekwini", 2, "Umlazi residents without water for third day"),
  ]);
});

describe("hashtags", () => {
  it("are made from the place, the headlines and the topic", () => {
    const t = hashtags("power", [PLACE_BY_SLUG.get("johannesburg")!, PLACE_BY_SLUG.get("ekurhuleni")!], ["Gauteng load reduction this week", "Eskom plan approved"]);
    expect(t.slice(0, 4)).toEqual(["#Johannesburg", "#Joburg", "#Gauteng", "#Ekurhuleni"]);
    expect(t).toEqual(expect.arrayContaining(["#LoadReduction", "#Eskom", "#PowerCuts", "#Mzansi", "#PulseSA"]));
    expect(new Set(t.map((x) => x.toLowerCase())).size).toBe(t.length);
    expect(t.length).toBeLessThanOrEqual(12);
  });
});

describe("video plan", () => {
  it("writes a script per story from real headlines, with places to zoom to", async () => {
    const { scripts } = await videoPlan(3, now, false);
    const s = scripts.find((x) => x.storyKey === "power~johannesburg")!;
    expect(s.hook).toEqual(["JOHANNESBURG’S", "POWER", "PROBLEM", "RIGHT NOW"]);
    expect(s.cards).toHaveLength(3);
    expect(s.cards[0]).toMatchObject({ source: "Daily Maverick", place: "Johannesburg" });
    expect(s.cards.map((c) => c.place)).toEqual(expect.arrayContaining(["Johannesburg"]));
    expect(s.spots.length).toBeGreaterThan(1);
    expect(s.caption).toContain("Is your area affected?");
    expect(s.caption).toContain("#Johannesburg");
    expect(s.articleKeys).toHaveLength(3);
    expect(s.cards[0].photoQueries[0]).toBe("Johannesburg power station");
  });
});

describe("duplicates", () => {
  const mp4 = (x: string) => Buffer.from(`fake-mp4-${x}`);
  const meta = (storyKey: string, keys: string[], day = saDay(now)) => ({ storyKey, day, title: "t", caption: "c", hashtags: ["#a"], articleKeys: keys, credits: [], durationSec: 13 });

  it("same story twice in a day is refused, and logged", async () => {
    expect((await storeClip(meta("water~ethekwini", ["a", "b", "c"]), mp4("1"), null)).ok).toBe(true);
    const again = await storeClip(meta("water~ethekwini", ["x", "y", "z"]), mp4("2"), null);
    expect(again).toMatchObject({ ok: false, reason: "already made a video for this story today" });
    const log = await db().select().from(schema.posts);
    expect(log.some((l) => l.status === "skipped_duplicate" && l.storyKey === "water~ethekwini")).toBe(true);
  });

  it("a later day only counts as new when most articles are new", async () => {
    const earlier = new Date(now.getTime() - 26 * 3600_000);
    await db().insert(schema.clips).values({ ...meta("transport~cape-town", ["k1", "k2", "k3"], saDay(earlier)), fingerprint: "fp-old", mp4: mp4("old"), bytes: 7, createdAt: earlier });
    expect(await repeatReason("transport~cape-town", ["k1", "k2", "k9"], saDay(now))).toMatch(/67% of its articles/);
    expect(await repeatReason("transport~cape-town", ["k1", "k8", "k9"], saDay(now))).toBeNull();
  });

  it("the exact same file is refused", async () => {
    expect((await storeClip(meta("health~polokwane", ["h1"]), mp4("same"), null)).ok).toBe(true);
    expect(await storeClip(meta("health~limpopo", ["h2"]), mp4("same"), null)).toMatchObject({ ok: false, reason: "this exact video was already uploaded" });
  });

  it("the plan skips stories already made today", async () => {
    const { scripts, skipped } = await videoPlan(5, now, false);
    expect(scripts.map((s) => s.storyKey)).not.toContain("water~ethekwini");
    expect(skipped.map((s) => s.storyKey)).toContain("water~ethekwini");
  });

  it("clips list with links, no video bytes", async () => {
    const list = await listClips("https://pulse.example");
    expect(list[0].videoUrl).toMatch(/^https:\/\/pulse\.example\/api\/clips\/[0-9a-f-]{36}\/video$/);
    expect(list[0]).not.toHaveProperty("mp4");
  });
});

describe("GitHub run token", () => {
  it("accepts only this repo's main branch, signed by GitHub, for our audience", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
    const getKey = createLocalJWKSet({ keys: [jwk] });
    const sign = (claims: Record<string, unknown>, aud = AUDIENCE) => new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(GITHUB_ISSUER).setAudience(aud).setIssuedAt().setExpirationTime("5m").sign(privateKey);
    const req = (t: string) => new Request("http://x", { headers: { authorization: `Bearer ${t}` } });
    const good = await sign({ repository: "217193684/pulse-sa", ref: "refs/heads/main", run_id: "42" });
    expect(await verifyGithubRun(req(good), { getKey })).toEqual({ ok: true, run: "42" });
    expect(await verifyGithubRun(req(await sign({ repository: "someone/else", ref: "refs/heads/main" })), { getKey })).toMatchObject({ ok: false, error: "wrong repository" });
    expect(await verifyGithubRun(req(await sign({ repository: "217193684/pulse-sa", ref: "refs/heads/dev" })), { getKey })).toMatchObject({ ok: false });
    expect(await verifyGithubRun(req(await sign({ repository: "217193684/pulse-sa", ref: "refs/heads/main" }, "other")), { getKey })).toMatchObject({ ok: false });
    expect(await verifyGithubRun(new Request("http://x"), { getKey })).toMatchObject({ ok: false, error: "missing token" });
  });
});
