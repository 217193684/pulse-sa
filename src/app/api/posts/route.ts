import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { noStore } from "@/server/http";

export const dynamic = "force-dynamic";

/** The post log: what went where, and which stories were skipped as repeats. */
export async function GET() {
  const rows = await db().select({
    id: schema.posts.id, clipId: schema.posts.clipId, storyKey: schema.posts.storyKey, platform: schema.posts.platform,
    status: schema.posts.status, detail: schema.posts.detail, createdAt: schema.posts.createdAt, title: schema.clips.title,
  }).from(schema.posts).leftJoin(schema.clips, eq(schema.clips.id, schema.posts.clipId)).orderBy(desc(schema.posts.createdAt)).limit(60);
  return noStore({ log: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
}
