import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** JSON with a short shared cache: phones refreshing the feed don't each hit the database. */
export function json(data: unknown, maxAge = 60) {
  return NextResponse.json(data, { headers: { "cache-control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}` } });
}

export function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Bearer-token check in constant time. Missing secret on the server = always refused. */
export function bearerOk(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function appUrl(): string {
  const u = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return u.replace(/\/$/, "");
}
