import { feed, type FeedCard } from "@/server/problems";
import { listClips } from "@/server/video";
import { appUrl, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** The feed with today's videos mixed in: a video first, then one after every two other cards. */
export async function GET(req: Request) {
  const base = appUrl() || new URL(req.url).origin;
  const [cards, clips] = await Promise.all([feed(), listClips(base, 8)]);
  const fresh = clips.filter((c) => Date.now() - Date.parse(c.createdAt) < 48 * 3600_000);
  const clipCards = fresh.map((c) => ({
    type: "clip" as const, id: `clip-${c.id}`, clipId: c.id, storyKey: c.storyKey, title: c.title, caption: c.caption,
    hashtags: c.hashtags, credits: c.credits, videoUrl: c.videoUrl, posterUrl: c.posterUrl, posted: c.posted, updatedAt: c.createdAt,
  }));
  const out: (FeedCard | (typeof clipCards)[number])[] = [];
  let v = 0;
  if (clipCards.length) out.push(clipCards[v++]);
  cards.forEach((c, i) => {
    out.push(c);
    if ((i + 1) % 2 === 0 && v < clipCards.length) out.push(clipCards[v++]);
  });
  while (v < clipCards.length) out.push(clipCards[v++]);
  return json({ generatedAt: new Date().toISOString(), cards: out }, 120);
}
