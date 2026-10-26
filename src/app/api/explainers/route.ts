import { noStore } from "@/server/http";
import { listExplainers, requestExplainer, requestsToday } from "@/server/explainers";
import { adminKeyOk } from "@/server/ytauth";

export const dynamic = "force-dynamic";
const MAX_REQUESTS_PER_DAY = Number(process.env.EXPLAINER_REQUESTS_PER_DAY || 4);

/** All explainer videos, newest first (the app's Explain tab). */
export async function GET() {
  return noStore({ explainers: await listExplainers() });
}

/** The owner asks for an explainer about a topic. Needs the owner key (ADMIN_TOKEN) so nobody else can spend the Claude credit. */
export async function POST(req: Request) {
  if (!adminKeyOk(req.headers.get("x-owner-key"))) return noStore({ error: "Owner key missing or wrong. Add it in the app under Me." }, 401);
  const body = await req.json().catch(() => null) as { topic?: string } | null;
  const topic = (body?.topic ?? "").trim();
  if (topic.length < 5 || topic.length > 400) return noStore({ error: "Write the topic in a few words (5-400 characters)." }, 400);
  if (await requestsToday() >= MAX_REQUESTS_PER_DAY) return noStore({ error: `That's ${MAX_REQUESTS_PER_DAY} explainers asked for today already. Try again tomorrow.` }, 429);
  return noStore({ explainer: await requestExplainer(topic) });
}
