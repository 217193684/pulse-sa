import { and, eq, gte, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";
import { configured, uploadToken } from "@/server/ytauth";

export const dynamic = "force-dynamic";

/** YouTube videos uploaded in the last 24 hours (new channels may only upload about 10 a day). */
async function uploads24h() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.posts).where(and(
    eq(schema.posts.platform, "youtube"), eq(schema.posts.status, "posted"), gte(schema.posts.createdAt, since),
    or(like(schema.posts.detail, "https://youtube.com/%"), like(schema.posts.detail, "https://youtu.be/%"))));
  return r?.n ?? 0;
}

/** The newsroom (a GitHub run of this repo) gets a 1-hour upload token. 404 = no channel connected yet. */
export async function POST(req: Request) {
  const auth = await verifyGithubRun(req); if (!auth.ok) return noStore({ error: auth.error }, 401);
  if (!configured()) return noStore({ error: "YouTube isn't set up" }, 404);
  try {
    const t = await uploadToken();
    return t ? noStore({ access_token: t.accessToken, channel: t.channel, uploads24h: await uploads24h() }) : noStore({ error: "No channel connected" }, 404);
  } catch (e) { return noStore({ error: (e as Error).message }, 502); }
}
