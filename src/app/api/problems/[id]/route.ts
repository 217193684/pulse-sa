import { problemDetail } from "@/server/problems";
import { json, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = await problemDetail(decodeURIComponent((await params).id));
  return d ? json(d, 120) : noStore({ error: "Not found" }, 404);
}
