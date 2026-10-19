import { videoPlan } from "@/server/video";
import { noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";

export const dynamic = "force-dynamic";

/** Preview of today's video scripts (read-only, repeats not logged). */
export async function GET(req: Request) {
  const max = Math.min(5, Number(new URL(req.url).searchParams.get("max") ?? 3) || 3);
  return noStore(await videoPlan(max, new Date(), false));
}

/** The video job asks for today's scripts; skipped repeats are written to the post log. */
export async function POST(req: Request) {
  const auth = await verifyGithubRun(req);
  if (!auth.ok) return noStore({ error: auth.error }, 401);
  const max = Math.min(5, Number(new URL(req.url).searchParams.get("max") ?? 3) || 3);
  return noStore(await videoPlan(max));
}
