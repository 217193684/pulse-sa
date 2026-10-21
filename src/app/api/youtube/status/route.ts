import { noStore } from "@/server/http";
import { channel, configured } from "@/server/ytauth";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!configured()) return noStore({ setup: false, connected: false });
  const c = await channel().catch(() => null);
  return noStore({ setup: true, connected: !!c, channel: c?.channel_title ?? null });
}
