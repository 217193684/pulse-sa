/**
 * Lets the daily video job on GitHub Actions upload videos without any stored password:
 * GitHub signs a short-lived token for the run; we check it was issued by GitHub, for this
 * repository, on the main branch, for the "pulse-sa" audience.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
export const AUDIENCE = "pulse-sa";
let remote: JWTVerifyGetKey | null = null;
const keys = () => (remote ??= createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`)));

export async function verifyGithubRun(req: Request, opts: { repo?: string; getKey?: JWTVerifyGetKey } = {}): Promise<{ ok: true; run: string } | { ok: false; error: string }> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, error: "missing token" };
  const repo = opts.repo ?? process.env.GITHUB_REPOSITORY_NAME ?? "217193684/pulse-sa";
  try {
    const { payload } = await jwtVerify(token, opts.getKey ?? keys(), { issuer: GITHUB_ISSUER, audience: AUDIENCE });
    if (payload.repository !== repo) return { ok: false, error: "wrong repository" };
    if (payload.ref !== "refs/heads/main") return { ok: false, error: "only the main branch may upload" };
    return { ok: true, run: String(payload.run_id ?? "") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
