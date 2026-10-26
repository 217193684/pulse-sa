import { noStore } from "@/server/http";
import { verifyGithubRun } from "@/server/oidc";
import { pendingJobs } from "@/server/explainers";

export const dynamic = "force-dynamic";

/** The newsroom asks: any explainers to make, or videos to send to YouTube? */
export async function POST(req: Request) {
  const auth = await verifyGithubRun(req); if (!auth.ok) return noStore({ error: auth.error }, 401);
  return noStore({ jobs: await pendingJobs() });
}
