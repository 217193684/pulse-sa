import { feed } from "@/server/problems";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ generatedAt: new Date().toISOString(), cards: await feed() }, 120);
}
