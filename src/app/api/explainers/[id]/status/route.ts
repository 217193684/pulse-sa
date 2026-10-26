import { z } from "zod";
import { noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";
import { saveExplainer } from "@/server/explainers";

export const dynamic = "force-dynamic";
const body = z.object({
  title: z.string().max(200).optional(), topic: z.string().max(500).optional(), status: z.enum(["queued", "making", "ready", "send", "sending", "on_youtube", "failed"]).optional(),
  minutes: z.number().optional(), videoUrl: z.string().url().optional(), previewUrl: z.string().url().optional(), thumbs: z.array(z.string().url()).max(6).optional(),
  description: z.string().max(5000).optional(), youtubeId: z.string().max(40).optional(), source: z.string().max(20).optional(), error: z.string().max(500).optional(),
  replaces: z.string().max(80).optional(),
});

/** The GitHub workflows report progress here. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyGithubRun(req); if (!auth.ok) return noStore({ error: auth.error }, 401);
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return noStore({ error: p.error.message }, 400);
  const { id } = await params;
  await saveExplainer(id, p.data);
  return noStore({ ok: true });
}
