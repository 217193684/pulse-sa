import { NextResponse } from "next/server";
import { SCOPES, adminKeyOk, configured, makeState, redirectUri } from "@/server/ytauth";

export const dynamic = "force-dynamic";
/** Open https://pulse-sa.vercel.app/api/youtube/connect?key=YOUR_ADMIN_TOKEN once, and pick the news channel at Google. */
export async function GET(req: Request) {
  if (!configured()) return new NextResponse("YouTube isn't set up: add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and ADMIN_TOKEN in Vercel, then redeploy.", { status: 503 });
  if (!adminKeyOk(new URL(req.url).searchParams.get("key"))) return new NextResponse("Wrong or missing key (it's the ADMIN_TOKEN you set in Vercel).", { status: 401 });
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: SCOPES.join(" "),
    access_type: "offline", prompt: "consent select_account", include_granted_scopes: "true", state: makeState() }).toString();
  return NextResponse.redirect(u.toString());
}
