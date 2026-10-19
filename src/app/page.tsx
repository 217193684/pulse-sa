import { desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { problemCards } from "@/server/problems";

export const dynamic = "force-dynamic";

/** A plain status page: is data flowing, and what's on top right now. The real UI is the Android app. */
export default async function Home() {
  let cards: Awaited<ReturnType<typeof problemCards>> = [];
  let runs: (typeof schema.collectorRuns.$inferSelect)[] = [];
  let error = "";
  try {
    cards = await problemCards(new Date(), 10);
    runs = await db().select().from(schema.collectorRuns).orderBy(desc(schema.collectorRuns.startedAt)).limit(8);
  } catch (e) { error = (e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "[db]"); }
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ margin: 0 }}>Pulse <span style={{ color: "#2DD4BF" }}>SA</span></h1>
      <p style={{ color: "#8FA3B3" }}>Server for the Pulse SA Android app. API: /api/feed, /api/map?category=water, /api/problems/&lt;id&gt;, /api/top3, /api/health</p>
      {error && <p style={{ color: "#F87171" }}>Database not ready: {error}</p>}
      <h2>Top right now</h2>
      {cards.length === 0 && <p style={{ color: "#8FA3B3" }}>Nothing collected yet.</p>}
      <ol>{cards.map((c) => <li key={c.id} style={{ marginBottom: 8 }}><b style={{ color: c.color }}>{c.categoryLabel}</b> · {c.title} <span style={{ color: "#8FA3B3" }}>({c.trend}, {c.signals} signals)</span></li>)}</ol>
      <h2>Latest collection runs</h2>
      <ul>{runs.map((r) => <li key={r.id} style={{ color: r.ok ? "#EAF2F7" : "#F87171" }}>{r.source}: {r.ok ? "ok" : "failed"}, {r.inserted} new · {r.startedAt.toISOString()}{r.error ? ` · ${r.error.slice(0, 160)}` : ""}</li>)}</ul>
    </main>
  );
}
