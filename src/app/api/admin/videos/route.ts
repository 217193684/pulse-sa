import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { bearerOk, noStore } from "@/server/http";
import { youtubeId } from "@/server/youtube";

export const dynamic = "force-dynamic";

const body = z.object({ url: z.string().min(5), title: z.string().trim().min(3).max(140), creator: z.string().trim().max(60).optional(), category: z.string().max(20).optional() });

export async function GET(req: Request) {
  if (!bearerOk(req, process.env.ADMIN_TOKEN)) return noStore({ error: "Unauthorized" }, 401);
  return noStore(await db().select().from(schema.videos).orderBy(desc(schema.videos.createdAt)));
}

export async function POST(req: Request) {
  if (!bearerOk(req, process.env.ADMIN_TOKEN)) return noStore({ error: "Unauthorized" }, 401);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return noStore({ error: "Send {url, title, creator?, category?}" }, 400);
  const id = youtubeId(p.data.url);
  if (!id) return noStore({ error: "That isn't a YouTube link" }, 400);
  const [v] = await db().insert(schema.videos).values({ youtubeId: id, title: p.data.title, creator: p.data.creator, category: p.data.category })
    .onConflictDoUpdate({ target: schema.videos.youtubeId, set: { title: p.data.title, creator: p.data.creator, category: p.data.category, active: 1 } }).returning();
  return noStore(v, 201);
}

export async function DELETE(req: Request) {
  if (!bearerOk(req, process.env.ADMIN_TOKEN)) return noStore({ error: "Unauthorized" }, 401);
  const id = new URL(req.url).searchParams.get("youtubeId") ?? "";
  await db().update(schema.videos).set({ active: 0 }).where(eq(schema.videos.youtubeId, id));
  return noStore({ ok: true });
}
