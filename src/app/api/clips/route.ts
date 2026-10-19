import { z } from "zod";
import { listClips, storeClip } from "@/server/video";
import { appUrl, json, noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  return json({ clips: await listClips(appUrl() || new URL(req.url).origin) }, 60);
}

const meta = z.object({
  storyKey: z.string().min(3).max(80), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(3).max(200),
  caption: z.string().max(2200), hashtags: z.array(z.string().max(40)).max(30), articleKeys: z.array(z.string().max(300)).max(10),
  credits: z.array(z.string().max(200)).max(10), durationSec: z.number().positive().max(120),
});

/** Upload from the video job: multipart with "meta" (JSON), "video" (mp4) and optional "poster" (jpg). */
export async function POST(req: Request) {
  const auth = await verifyGithubRun(req);
  if (!auth.ok) return noStore({ error: auth.error }, 401);
  const form = await req.formData().catch(() => null);
  const video = form?.get("video");
  const m = meta.safeParse(JSON.parse(String(form?.get("meta") ?? "null")));
  if (!(video instanceof Blob) || !m.success) return noStore({ error: "send meta + video" }, 400);
  if (video.size > 4_000_000) return noStore({ error: "video too large (max 4 MB)" }, 413);
  const poster = form?.get("poster");
  const res = await storeClip(m.data, Buffer.from(await video.arrayBuffer()), poster instanceof Blob ? Buffer.from(await poster.arrayBuffer()) : null);
  return res.ok ? noStore(res, 201) : noStore(res, 409);
}
