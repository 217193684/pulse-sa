/**
 * Eskom's public load-shedding status. The endpoint returns a single number:
 * 1 = not load-shedding, 2 = stage 1, 3 = stage 2 … (negative or other = unknown).
 * A signal is recorded only while load-shedding is on, once per hour, weighted by stage.
 */
import { fetchText, sha, type NewSignal } from "./common";

export const ESKOM_URL = "https://loadshedding.eskom.co.za/LoadShedding/GetStatus";

/** Returns the stage (0 = none) or null when the answer is not a valid status. */
export function parseEskomStatus(body: string): number | null {
  const n = Number(String(body).trim().replace(/^"|"$/g, ""));
  if (!Number.isInteger(n) || n < 1 || n > 9) return null;
  return n - 1;
}

export function eskomSignal(stage: number, now = new Date()): NewSignal | null {
  if (stage <= 0) return null;
  const hour = now.toISOString().slice(0, 13);
  return {
    source: "eskom", externalId: sha(`stage:${hour}`), urlKey: null,
    title: `Load-shedding stage ${stage}`, url: "https://loadshedding.eskom.co.za/", publisher: "Eskom",
    category: "power", placeSlug: null, lat: null, lon: null, weight: Math.min(stage, 8), extra: { stage }, publishedAt: now,
  };
}

export async function collectEskom(): Promise<{ signals: NewSignal[]; errors: string[]; stage: number | null }> {
  try {
    const stage = parseEskomStatus(await fetchText(ESKOM_URL));
    if (stage == null) return { signals: [], errors: ["Eskom: unexpected status value"], stage: null };
    const s = eskomSignal(stage);
    return { signals: s ? [s] : [], errors: [], stage };
  } catch (e) {
    return { signals: [], errors: [`Eskom: ${(e as Error).message}`], stage: null };
  }
}
