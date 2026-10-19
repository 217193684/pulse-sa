"""
Pulse SA daily video maker.

  python video/make.py                    # GitHub Actions: plan → photos → render → beat → encode → upload
  python video/make.py --plan p.json --no-upload --out /tmp/v   # local test from a saved plan

Each video: 13 s, 1080×1920, 30 fps, original beat, real photos from Wikimedia Commons
(freely licensed, credited on screen). In GitHub Actions the upload is authorised with the
run's own GitHub-signed token, so no passwords are stored anywhere.
"""
import argparse, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request, uuid, zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = os.environ.get("API_URL", "https://pulse-sa.vercel.app").rstrip("/")
UA = "PulseSA-video/0.1 (https://github.com/217193684/pulse-sa; public-interest news videos)"
FPS, TOTAL, CARD0, CARD1 = 30, 13.0, 5.4, 11.2
# Licences that allow reuse with credit. CC0/PD/CC BY first; CC BY-SA only when nothing else fits.
GOOD = [re.compile(r"^(cc0|public domain|pd\b)", re.I), re.compile(r"^cc by \d", re.I), re.compile(r"^cc by-sa \d", re.I)]
BAD_TITLE = re.compile(r"\b(map|logo|flag|coat of arms|seal|diagram|chart|locator|svg|emblem|signature|plan)\b", re.I)


def http(url, data=None, headers=None, method=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers={"user-agent": UA, **(headers or {})}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def github_token():
    """The run's GitHub-signed identity token (needs `permissions: id-token: write`)."""
    u, t = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"), os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not u or not t:
        return None
    _, body = http(u + "&audience=pulse-sa", headers={"authorization": f"Bearer {t}"})
    return json.loads(body)["value"]


def get_plan(args, token):
    if args.plan:
        return json.loads(Path(args.plan).read_text())
    url = f"{API}/api/video-plan?max={args.max}"
    if token:
        _, body = http(url, data=b"", headers={"authorization": f"Bearer {token}"}, method="POST")
    else:
        _, body = http(url)
    return json.loads(body)


# ------------------------------------------------------------------ photos

def find_photo(queries, used, dest: Path):
    """First good freely-licensed photo for the queries, saved to dest. Returns credit text or None."""
    best = None
    for q in queries:
        params = {"action": "query", "format": "json", "generator": "search", "gsrnamespace": "6", "gsrlimit": "12",
                  "gsrsearch": f"{q} filetype:bitmap", "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": "1600"}
        try:
            _, body = http("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), timeout=30)
        except Exception as e:  # network hiccup: try the next query
            print(f"  photo search failed for {q!r}: {e}")
            continue
        pages = sorted(json.loads(body).get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        for p in pages:
            title = p.get("title", "")
            ii = (p.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = (meta.get("LicenseShortName") or {}).get("value", "")
            rank = next((i for i, rx in enumerate(GOOD) if rx.search(lic)), None)
            if rank is None or title in used or BAD_TITLE.search(title) or ii.get("width", 0) < 1000 or ii.get("height", 0) < 650:
                continue
            if re.search(r"\b(nc|nd)\b", lic, re.I):
                continue
            artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", "")).strip() or "Unknown"
            cand = (rank, title, ii.get("thumburl") or ii.get("url"), f"Photo: {artist[:48]} · {lic} · Wikimedia Commons")
            if best is None or cand[0] < best[0]:
                best = cand
            if rank < 2:
                break
        if best and best[0] < 2:
            break
    if not best:
        return None
    _, img = http(best[2], timeout=60)
    dest.write_bytes(img)
    used.add(best[1])
    return best[3]


# ------------------------------------------------------------------ render

def render(script, workdir: Path):
    from playwright.sync_api import sync_playwright
    outline = (HERE / "sa-outline.json").read_text()
    frames = workdir / "frames"
    frames.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.add_init_script(f"window.OUTLINE={outline};window.S={json.dumps(script)};")
        pg.goto((HERE / "scene.html").as_uri())
        pg.wait_for_function("typeof window.render === 'function'")
        # warm up images so the first reveal frame isn't blank
        pg.evaluate("Promise.all([...new Set(window.S.cards.map(c=>c.photo).filter(Boolean))].map(u=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=u})))")
        for i in range(int(FPS * TOTAL)):
            pg.evaluate(f"render({i / FPS})")
            pg.screenshot(path=str(frames / f"{i:04d}.jpg"), type="jpeg", quality=92)
        b.close()
    return frames


def encode(workdir: Path, frames: Path, music: Path):
    out = workdir / "video.mp4"
    for crf in (23, 27, 30):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames / "%04d.jpg"), "-i", str(music),
                        "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-maxrate", "2M", "-bufsize", "4M", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
        if out.stat().st_size <= 3_800_000:
            break
    poster = workdir / "poster.jpg"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.3", "-i", str(out), "-frames:v", "1", "-vf", "scale=540:960", "-q:v", "4", str(poster)], check=True)
    return out, poster


def upload(token, script, credits, video: Path, poster: Path):
    meta = {k: script[k] for k in ("storyKey", "day", "title", "caption", "hashtags", "articleKeys")}
    meta.update(credits=credits, durationSec=TOTAL)
    boundary = uuid.uuid4().hex
    parts = []
    def field(name, value, filename=None, ctype=None):
        head = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "") + "\r\n"
        if ctype:
            head += f"Content-Type: {ctype}\r\n"
        parts.append(head.encode() + b"\r\n" + (value if isinstance(value, bytes) else value.encode()) + b"\r\n")
    field("meta", json.dumps(meta))
    field("video", video.read_bytes(), "video.mp4", "video/mp4")
    field("poster", poster.read_bytes(), "poster.jpg", "image/jpeg")
    body = b"".join(parts) + f"--{boundary}--\r\n".encode()
    try:
        status, res = http(f"{API}/api/clips", data=body, method="POST",
                           headers={"authorization": f"Bearer {token}", "content-type": f"multipart/form-data; boundary={boundary}"}, timeout=120)
    except urllib.error.HTTPError as e:
        status, res = e.code, e.read()
    return status, res.decode(errors="replace")


# ------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan"); ap.add_argument("--out"); ap.add_argument("--max", type=int, default=3)
    ap.add_argument("--no-upload", action="store_true")
    args = ap.parse_args()
    token = None if args.no_upload else github_token()
    if not args.no_upload and not token:
        sys.exit("No GitHub run token: run inside GitHub Actions with id-token: write, or use --no-upload")
    plan = get_plan(args, token)
    for s in plan.get("skipped", []):
        print(f"skip (repeat) {s['storyKey']}: {s['reason']}")
    scripts = plan.get("scripts", [])
    print(f"{len(scripts)} video(s) to make")
    failures = 0
    for n, script in enumerate(scripts):
        t0 = time.time()
        workdir = Path(args.out or tempfile.mkdtemp(prefix="pulse-")) / script["storyKey"].replace("~", "_")
        workdir.mkdir(parents=True, exist_ok=True)
        print(f"[{n + 1}/{len(scripts)}] {script['storyKey']}: {script['title']}")
        script["national"] = script["storyKey"].endswith("~za")
        used, credits = set(), []
        for i, card in enumerate(script["cards"]):
            dest = workdir / f"photo{i}.jpg"
            credit = card.get("credit") if card.get("photo") else find_photo(card["photoQueries"], used, dest)
            if credit and not card.get("photo"):
                card["photo"], card["credit"] = dest.as_uri(), credit
            if card.get("credit"):
                credits.append(card["credit"])
            print(f"  card {i + 1}: {'photo ✓ ' + card['credit'] if card.get('photo') else 'no photo (map only)'}")
        frames = render(script, workdir)
        k = len(script["cards"]); slot = (CARD1 - CARD0) / max(1, k)
        impacts = ",".join(f"{CARD0 + i * slot:.2f}" for i in range(k))
        seed = zlib.crc32((script["storyKey"] + script["day"]).encode()) % 10_000
        shift = {"water": 0, "power": -2, "transport": 2, "education": 3, "jobs": -3, "grants": 1, "cost": -1, "health": 4, "safety": -4}.get(script["category"], 0)
        music = workdir / "music.wav"
        subprocess.run([sys.executable, str(HERE / "music.py"), str(music), str(seed), str(shift), impacts], check=True)
        video, poster = encode(workdir, frames, music)
        print(f"  encoded {video.stat().st_size / 1e6:.1f} MB in {time.time() - t0:.0f}s → {video}")
        if args.no_upload:
            continue
        status, res = upload(token, script, credits, video, poster)
        print(f"  upload: {status} {res[:300]}")
        if status not in (201, 409):
            failures += 1
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
