/** The Pulse SA YouTube channel, connected once with Google sign-in (admin key required).
 *  The long-lived Google token is stored encrypted; the newsroom only gets a 1-hour upload token per run. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { appUrl } from "./http";

export const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
export const configured = () => !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.ADMIN_TOKEN);
export const redirectUri = () => `${appUrl() || "https://pulse-sa.vercel.app"}/api/youtube/callback`;

const enc = new TextEncoder(), dec = new TextDecoder();
async function key() {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`${process.env.YOUTUBE_CLIENT_SECRET}|pulse-sa-youtube-v1`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(text)));
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(ct).toString("base64")}`;
}
async function open(sealed: string) {
  const [iv, ct] = sealed.split(".");
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(Buffer.from(iv, "base64")) }, await key(), new Uint8Array(Buffer.from(ct, "base64"))));
}

/** A signed, short-lived "state" so only a sign-in started with the admin key can connect a channel. */
export function makeState() {
  const body = `${Date.now()}.${randomBytes(8).toString("hex")}`;
  return `${body}.${createHmac("sha256", process.env.ADMIN_TOKEN!).update(body).digest("hex").slice(0, 32)}`;
}
export function stateOk(state: string | null) {
  if (!state || !process.env.ADMIN_TOKEN) return false;
  const [t, n, sig] = state.split(".");
  const want = createHmac("sha256", process.env.ADMIN_TOKEN).update(`${t}.${n}`).digest("hex").slice(0, 32);
  return !!sig && sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)) && Date.now() - Number(t) < 15 * 60_000;
}
export function adminKeyOk(k: string | null) {
  const a = Buffer.from(k ?? ""), b = Buffer.from(process.env.ADMIN_TOKEN ?? "");
  return !!process.env.ADMIN_TOKEN && a.length === b.length && timingSafeEqual(a, b);
}

async function ensureTable() {
  await db().execute(sql`create table if not exists youtube_auth (id integer primary key default 1, token text not null, channel_id text, channel_title text, updated_at timestamptz not null default now())`);
}

async function google(url: string, body: Record<string, string>) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.error || `Google said ${r.status}`);
  return d;
}

export async function connect(code: string) {
  const t = await google("https://oauth2.googleapis.com/token", { code, client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("Google didn't give a lasting sign-in. Remove the app at myaccount.google.com/permissions, then connect again.");
  const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
  const c = ch.items?.[0];
  if (!c) throw new Error("That Google account/channel has no YouTube channel. Choose the Pulse SA news channel when Google asks.");
  await ensureTable();
  await db().execute(sql`insert into youtube_auth (id, token, channel_id, channel_title, updated_at) values (1, ${await seal(t.refresh_token)}, ${c.id}, ${c.snippet?.title || "Your channel"}, now())
    on conflict (id) do update set token = excluded.token, channel_id = excluded.channel_id, channel_title = excluded.channel_title, updated_at = now()`);
  return c.snippet?.title as string;
}

export async function channel() {
  await ensureTable();
  const r = await db().execute<{ channel_id: string; channel_title: string }>(sql`select channel_id, channel_title from youtube_auth where id = 1`);
  return r.rows[0] ?? null;
}

export async function disconnect() { await ensureTable(); await db().execute(sql`delete from youtube_auth where id = 1`); }

/** A fresh 1-hour upload token, or null when no channel is connected. */
export async function uploadToken() {
  await ensureTable();
  const r = await db().execute<{ token: string; channel_title: string }>(sql`select token, channel_title from youtube_auth where id = 1`);
  const row = r.rows[0]; if (!row) return null;
  const t = await google("https://oauth2.googleapis.com/token", { refresh_token: await open(row.token), client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, grant_type: "refresh_token" });
  return { accessToken: t.access_token as string, channel: row.channel_title };
}
