/**
 * A 1080×1350 share image for one problem (Instagram/TikTok/X/Facebook/WhatsApp friendly):
 * the category, the plain-language title, how unusual today is, and the heat map.
 */
import { ImageResponse } from "next/og";
import { problemCards } from "@/server/problems";
import { mapSvg } from "@/server/geo/svg";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const card = (await problemCards(new Date(), 200)).find((c) => c.id === id);
  if (!card) return new Response("Not found", { status: 404 });
  const svg = `data:image/svg+xml;utf8,${encodeURIComponent(mapSvg(card.hotspots, card.color))}`;
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, background: "#0B0F14", color: "#EAF2F7", display: "flex", flexDirection: "column", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 700 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, border: "5px solid #2DD4BF", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: "#F59E0B" }} />
            </div>
            Pulse<span style={{ color: "#2DD4BF", marginLeft: 10 }}>SA</span>
          </div>
          <div style={{ fontSize: 28, color: "#8FA3B3" }}>{new Date().toISOString().slice(0, 10)}</div>
        </div>
        <div style={{ display: "flex", marginTop: 56 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#0B0F14", background: card.color, padding: "10px 24px", borderRadius: 999 }}>{card.categoryLabel}</div>
          <div style={{ fontSize: 30, color: "#B7C6D2", border: "2px solid #2C3E4E", padding: "8px 24px", borderRadius: 999, marginLeft: 16 }}>{card.trend}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 32, letterSpacing: -2 }}>{card.title}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svg} width={816} height={720} alt="" />
        </div>
        <div style={{ fontSize: 30, color: "#B7C6D2", marginTop: "auto", lineHeight: 1.35 }}>{card.headline ? `“${card.headline}”${card.publisher ? ` — ${card.publisher}` : ""}` : ""}</div>
        <div style={{ fontSize: 28, color: "#8FA3B3", marginTop: 24 }}>Live map of what South Africa is struggling with · Pulse SA</div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "cache-control": "public, s-maxage=600" } },
  );
}
