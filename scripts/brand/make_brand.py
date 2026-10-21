"""Pulse SA News channel artwork: banner (2560x1440), profile picture (800x800) and video watermark (300x300 PNG).

  python scripts/brand/make_brand.py   -> public/brand/*.png|jpg

Dark radar/pulse look matching the Pulse SA app: navy background, radar rings, a heartbeat/pulse
line sweeping across a map of South Africa, teal + amber accents.
"""
import math, random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "brand"
GROUND, TEAL, AMBER, TEXT = "#0B0F14", "#2DD4BF", "#F59E0B", "#EAF2F7"
FONT = "-apple-system, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif"

# A very rough South Africa outline (normalised 0..1 coords), enough to read as "a map" at small size.
SA_OUTLINE = [
    (.08, .62), (.03, .50), (.10, .33), (.22, .18), (.38, .08), (.55, .05), (.72, .10),
    (.86, .22), (.95, .38), (.97, .52), (.90, .66), (.92, .78), (.80, .88), (.62, .93),
    (.48, .90), (.44, .78), (.30, .80), (.18, .74), (.08, .62),
]


def sa_path(cx, cy, scale):
    pts = [(cx + (x - .5) * scale, cy + (y - .5) * scale * .78) for x, y in SA_OUTLINE]
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"


def radar_rings(cx, cy, n, r0, step, color):
    return "".join(f'<circle cx="{cx}" cy="{cy}" r="{r0 + i * step:.0f}" fill="none" stroke="{color}" stroke-width="2" opacity="{.5 - i * .5 / n:.2f}"/>' for i in range(n))


def sweep(cx, cy, r, angle, color, id_):
    a0, a1 = math.radians(angle - 55), math.radians(angle)
    x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    return f"""<defs><radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="{color}" stop-opacity=".55"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient></defs>
<path d="M{cx},{cy} L{x0:.1f},{y0:.1f} A{r},{r} 0 0 1 {x1:.1f},{y1:.1f} Z" fill="url(#{id_})"/>"""


def dots(cx, cy, n, r, seed, color):
    rnd = random.Random(seed); s = ""
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(.15, 1) * r
        s += f'<circle cx="{cx + d * math.cos(a):.0f}" cy="{cy + d * math.sin(a) * .78:.0f}" r="{rnd.uniform(2, 4.5):.1f}" fill="{color}" opacity="{rnd.uniform(.4, .95):.2f}"/>'
    return s


def pulse_line(w, y, amp, color, width=5):
    pts = []
    x = -40
    while x < w + 40:
        pts.append((x, y)); x += 46
        if random.Random(int(x)).random() < .18:
            seg = [0, -amp * .3, amp * 1.5, -amp * 1.1, amp * .25, 0]
            for i, dy in enumerate(seg):
                pts.append((x + i * 7, y - dy))
            x += len(seg) * 7
    path = "M" + " L".join(f"{x:.0f},{y:.1f}" for x, y in pts)
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)"/>'


def bg(w, h):
    return f"""<rect width="{w}" height="{h}" fill="{GROUND}"/>
<rect width="{w}" height="{h}" fill="url(#vign)"/>
<pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
 <path d="M56 0H0V56" fill="none" stroke="#16212B" stroke-width="1"/></pattern>
<rect width="{w}" height="{h}" fill="url(#grid)"/>"""


def defs(w, h):
    return f"""<defs>
<radialGradient id="vign" cx="{w/2}" cy="{h/2}" r="{max(w,h)*.75}" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="#162430" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
 <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>"""


def page(body, w, h):
    return f"""<!doctype html><html><head><style>
html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:{GROUND}}}
.wrap{{position:relative;width:{w}px;height:{h}px;font-family:{FONT}}} .wrap>svg{{position:absolute;inset:0}}
</style></head><body><div class="wrap">{body}</div></body></html>"""


def banner():
    # YouTube's "always visible" safe area on a 2560x1440 banner is the centered 1546x423 band
    # (x 507..2053, y 508..931). Everything that matters has to live inside that box.
    w, h = 2560, 1440
    cx, cy = w * .5, h * .5
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
{defs(w, h)}{bg(w, h)}
{radar_rings(cx, cy, 5, 60, 48, TEAL)}
{sweep(cx, cy, 330, -150, TEAL, 'sw1')}
<path d="{sa_path(cx, cy, 420)}" fill="none" stroke="{AMBER}" stroke-width="2.5" opacity=".35"/>
{dots(cx, cy, 8, 360, 7, AMBER)}
{pulse_line(w, h * .5 + 150, 40, TEAL, 5)}
</svg>"""
    text = f"""<div style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:{TEXT}">
  <div style="font-weight:800;font-size:112px;line-height:1;letter-spacing:-1px;text-shadow:0 6px 30px rgba(0,0,0,.7)">Pulse <span style="color:{TEAL}">SA</span> News</div>
  <div style="font-weight:500;font-size:34px;margin-top:20px;opacity:.9;text-shadow:0 3px 16px rgba(0,0,0,.7)">Breaking news, prices &amp; problems across Mzansi &mdash; as it happens</div>
  <div style="display:inline-flex;align-items:center;gap:12px;margin-top:22px;padding:10px 26px;border-radius:999px;background:{AMBER};color:{GROUND};font-weight:800;font-size:24px;letter-spacing:2px;box-shadow:0 6px 24px rgba(0,0,0,.45)">● LIVE NEWS RADAR</div>
</div>"""
    return page(svg + text, w, h), w, h


def avatar(size=800):
    cx, cy = size * .5, size * .5
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
{defs(size, size)}{bg(size, size)}
{radar_rings(cx, cy, 4, 70, 60, TEAL)}
{sweep(cx, cy, size * .46, 20, TEAL, 'sw2')}
<path d="{sa_path(cx, cy, size * .58)}" fill="none" stroke="{AMBER}" stroke-width="5" opacity=".92"/>
{dots(cx, cy, 8, size * .4, 11, AMBER)}
<circle cx="{cx}" cy="{cy}" r="10" fill="{TEAL}" filter="url(#glow)"/>
</svg>"""
    return page(svg, size, size), size, size


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, (html, w, h), kind in [("banner", banner(), "jpeg"), ("avatar", avatar(), "png")]:
            pg = b.new_page(viewport={"width": w, "height": h}); pg.set_content(html)
            pg.wait_for_timeout(300)
            path = OUT / f"{name}.{'jpg' if kind == 'jpeg' else 'png'}"
            pg.screenshot(path=str(path), type=kind, **({"quality": 92} if kind == "jpeg" else {})); pg.close(); print("made", path)
        b.close()
    from PIL import Image, ImageDraw
    a = Image.open(OUT / "avatar.png").convert("RGBA").resize((300, 300), Image.LANCZOS)
    m = Image.new("L", (1200, 1200), 0); ImageDraw.Draw(m).ellipse([0, 0, 1199, 1199], fill=255); m = m.resize((300, 300), Image.LANCZOS)
    a.putalpha(m); a.save(OUT / "watermark.png"); print("made watermark")


if __name__ == "__main__":
    main()
