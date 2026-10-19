import { top3 } from "@/server/problems";
import { appUrl, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = appUrl();
  const t = await top3(new Date(), base);
  return json({ ...t, cards: t.cards.map((c) => ({ ...c, imageUrl: `${base}/api/card/${encodeURIComponent(c.id)}` })) }, 300);
}
