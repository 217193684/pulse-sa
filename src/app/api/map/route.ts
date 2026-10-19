import { CATEGORY_BY_ID, type CategoryId } from "@/server/classify";
import { mapLayer } from "@/server/problems";
import { json, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const c = (new URL(req.url).searchParams.get("category") ?? "water") as CategoryId;
  if (!CATEGORY_BY_ID.has(c) || c === "trending") return noStore({ error: "Unknown category" }, 400);
  return json(await mapLayer(c), 120);
}
