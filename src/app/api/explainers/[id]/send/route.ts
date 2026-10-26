import { noStore } from "@/server/http";
import { getExplainer, requestSend } from "@/server/explainers";
import { adminKeyOk } from "@/server/ytauth";

export const dynamic = "force-dynamic";

/** The owner picked a thumbnail and pressed "Send to YouTube". The newsroom starts the upload within a few minutes. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminKeyOk(req.headers.get("x-owner-key"))) return noStore({ error: "Owner key missing or wrong. Add it in the app under Me." }, 401);
  const { id } = await params;
  const e = await getExplainer(id);
  if (!e) return noStore({ error: "No such explainer" }, 404);
  if (!["ready", "failed", "on_youtube"].includes(e.status) || !e.videoUrl) return noStore({ error: `It can't be sent right now (${e.status}).` }, 409);
  const body = await req.json().catch(() => ({})) as { thumb?: number; privacy?: string };
  const thumb = Math.max(0, Math.min(e.thumbs.length - 1, Number(body.thumb ?? 0) || 0));
  const privacy = ["public", "unlisted", "private"].includes(body.privacy ?? "") ? body.privacy! : "public";
  await requestSend(id, thumb, privacy);
  return noStore({ ok: true });
}
