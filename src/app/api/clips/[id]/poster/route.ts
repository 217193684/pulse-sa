import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db().select({ poster: schema.clips.poster }).from(schema.clips).where(eq(schema.clips.id, id)).limit(1);
  if (!row?.poster) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.poster), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400, immutable" } });
}
