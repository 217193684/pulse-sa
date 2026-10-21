import { noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";
import { configured, uploadToken } from "@/server/ytauth";

export const dynamic = "force-dynamic";
/** The newsroom (a GitHub run of this repo) gets a 1-hour upload token. 404 = no channel connected yet. */
export async function POST(req: Request) {
  const auth = await verifyGithubRun(req); if (!auth.ok) return noStore({ error: auth.error }, 401);
  if (!configured()) return noStore({ error: "YouTube isn't set up" }, 404);
  try {
    const t = await uploadToken();
    return t ? noStore({ access_token: t.accessToken, channel: t.channel }) : noStore({ error: "No channel connected" }, 404);
  } catch (e) { return noStore({ error: (e as Error).message }, 502); }
}
