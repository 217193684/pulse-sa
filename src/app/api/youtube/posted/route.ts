import { z } from "zod";
import { db, schema } from "@/server/db";
import { noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";

const body = z.object({ clipId: z.string().uuid().nullable(), storyKey: z.string().max(80), ok: z.boolean(), detail: z.string().max(400) });
/** The newsroom reports each YouTube upload to the post log. */
export async function POST(req: Request) {
  const auth = await verifyGithubRun(req); if (!auth.ok) return noStore({ error: auth.error }, 401);
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return noStore({ error: "bad request" }, 400);
  await db().insert(schema.posts).values({ clipId: p.data.clipId, storyKey: p.data.storyKey, platform: "youtube", status: p.data.ok ? "posted" : "failed", detail: p.data.detail });
  return noStore({ ok: true });
}
