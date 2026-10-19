/** Draws South Africa (real outline) with heat spots as an SVG string, for share images. */
import outline from "./sa-outline.json";
import type { Hotspot } from "../problems";

const W = 340, H = 300;
const LON0 = 16.2, LON1 = 33.1, LAT0 = -21.9, LAT1 = -35.0;
const KX = Math.cos((28.5 * Math.PI) / 180); // squash longitude so the country isn't stretched sideways
const sx = W / ((LON1 - LON0) * KX), sy = H / (LAT0 - LAT1);
const s = Math.min(sx, sy);
export const project = (lon: number, lat: number): [number, number] => [(lon - LON0) * KX * s, (LAT0 - lat) * s];

const ring = (pts: number[][]) => pts.map(([lon, lat], i) => { const [x, y] = project(lon, lat); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";
export const SA_PATH = ring(outline.southAfrica);
const LS_PATH = ring(outline.lesotho), SZ_PATH = ring(outline.eswatini);

export function mapSvg(hotspots: Hotspot[], color: string): string {
  const spots = hotspots.slice(0, 10).map((h, i) => {
    const [x, y] = project(h.lon, h.lat);
    const r = 14 + 46 * h.intensity;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#g)" opacity="${(0.45 + 0.55 * h.intensity).toFixed(2)}"/>` +
      (i === 0 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${color}"/>` : "");
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><radialGradient id="g"><stop offset="0" stop-color="${color}" stop-opacity=".95"/><stop offset=".5" stop-color="${color}" stop-opacity=".4"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="c"><path d="${SA_PATH}"/></clipPath></defs>` +
    `<path d="${SA_PATH}" fill="#132029" stroke="#35506A" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<g clip-path="url(#c)">${spots}</g>` +
    `<path d="${LS_PATH}" fill="#0B0F14" stroke="#35506A"/><path d="${SZ_PATH}" fill="#0B0F14" stroke="#35506A"/></svg>`;
}
