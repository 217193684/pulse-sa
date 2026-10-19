import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { noStore } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ platform: z.enum(["tiktok", "instagram", "youtube", "facebook", "whatsapp", "x", "linkedin", "other"]), status: z.enum(["shared", "posted", "failed"]).default("shared") });

/** The app records each time a video is sent to a platform (for the post log and "already posted" badges). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!/^[0-9a-f-]{36}$/.test(id) || !p.success) return noStore({ error: "bad request" }, 400);
  const [clip] = await db().select({ storyKey: schema.clips.storyKey }).from(schema.clips).where(eq(schema.clips.id, id)).limit(1);
  if (!clip) return noStore({ error: "Not found" }, 404);
  await db().insert(schema.posts).values({ clipId: id, storyKey: clip.storyKey, platform: p.data.platform, status: p.data.status });
  return noStore({ ok: true }, 201);
}
