import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

export const dynamic = "force-dynamic";

/** Streams the MP4 with HTTP Range support, so phones can start playing and seek. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db().select({ mp4: schema.clips.mp4 }).from(schema.clips).where(eq(schema.clips.id, id)).limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  const buf = row.mp4, size = buf.length;
  const base = { "content-type": "video/mp4", "accept-ranges": "bytes", "cache-control": "public, max-age=86400, immutable" };
  const m = (req.headers.get("range") ?? "").match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return new Response(new Uint8Array(buf), { headers: { ...base, "content-length": String(size) } });
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  if (!m[1]) end = size - 1;
  start = Math.max(0, start); end = Math.min(size - 1, end);
  if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
    status: 206, headers: { ...base, "content-length": String(end - start + 1), "content-range": `bytes ${start}-${end}/${size}` },
  });
}
