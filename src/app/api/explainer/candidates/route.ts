import { newsStories } from "@/server/video";
import { noStore } from "@/server/http";

export const dynamic = "force-dynamic";

/** The day's biggest stories, for the daily explainer to choose from: headline, outlets and article links. */
export async function GET(req: Request) {
  const hours = Math.min(72, Number(new URL(req.url).searchParams.get("hours") ?? 36) || 36);
  const stories = await newsStories(new Date(), hours);
  return noStore({
    stories: stories.slice(0, 15).map((s) => ({
      key: s.key, category: s.category, score: Math.round(s.score * 10) / 10, publishers: s.publishers, place: s.place?.name ?? null,
      articles: s.arts.slice(0, 6).map((a) => ({ title: a.title, url: a.url, outlet: a.publisher ?? a.source, publishedAt: a.publishedAt })),
    })),
  });
}
