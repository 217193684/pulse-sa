import { NextResponse } from "next/server";
import { connect, stateOk } from "@/server/ytauth";

export const dynamic = "force-dynamic";
const page = (title: string, msg: string) => new NextResponse(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px system-ui;background:#06080B;color:#fff;padding:32px;max-width:560px"><h1 style="font-size:28px">${title}</h1><p style="color:#B8C7D3">${msg}</p></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("error")) return page("Not connected", "Google sign-in was cancelled.");
  if (!stateOk(u.searchParams.get("state"))) return page("Not connected", "This sign-in link expired or wasn't started with your admin key. Open the connect link again.");
  try {
    const name = await connect(u.searchParams.get("code") ?? "");
    return page(`Connected to ${name.replace(/[<>&]/g, "")} ✓`, "Pulse SA will now upload every new news video to this channel as a YouTube Short. You can close this page.");
  } catch (e) {
    return page("Not connected", (e as Error).message.replace(/[<>&]/g, ""));
  }
}
