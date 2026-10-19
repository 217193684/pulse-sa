/** "https://youtu.be/ID", "…watch?v=ID", "…/shorts/ID" or a bare 11-char ID → ID */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host === "youtube.com") {
      const v = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
  } catch { /* not a URL */ }
  return null;
}
