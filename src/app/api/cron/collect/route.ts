import { collectAll } from "@/server/collect";
import { bearerOk, noStore } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called by Vercel Cron and GitHub Actions with "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) return noStore({ error: "Unauthorized" }, 401);
  const results = await collectAll();
  return noStore({ ok: results.some((r) => r.ok), results });
}
