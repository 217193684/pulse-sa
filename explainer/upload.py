"""
Uploads a finished explainer to the Pulse SA News channel as PRIVATE, so it can be watched before it goes public.

  python explainer/upload.py <episode id> <video.mp4> <thumbnail.jpg>

Then sends a phone notification (ntfy topic in NTFY_TOPIC) with the YouTube Studio link.
"""
import json, os, sys, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "video"))
from make import API, github_token, http  # noqa: E402

NAMES = {"hook": "Intro", "timeline": "How it started", "stats": "The numbers", "suspects": "Why it happens", "verdict": "The verdict",
         "checklist": "What you can do", "outro": "What happens next", "court": "The process", "bankcheck": "How the check works"}


def description(script, timing):
    chap, seen = [], set()
    for sc, t in zip(script["scenes"], timing["scenes"]):
        name = NAMES.get(sc["type"]) or (sc.get("tag") or ["", ""])[1].title() or sc.get("headline", "")
        if not name or name in seen or sc["type"] == "title": continue
        seen.add(name)
        s = 0 if sc["type"] == "hook" else int(t["start"])
        chap.append(f"{s // 60}:{s % 60:02d} {name}")
    hook = " ".join(script["scenes"][0]["lines"][:2])
    src = "\n".join(f"• {x['name']}: {x['url']}" for x in script.get("sources", []))
    return (f"{script['title']}\n\n{hook}\n\n" + "\n".join(chap) + f"\n\nSources:\n{src}\n\n"
            "Pulse SA News explains the stories behind the headlines. Facts come from the sources above; "
            "examples on screen are illustrations.\n\n#SouthAfrica #PulseSA #Explained #SANews")[:4900]


def token():
    _, body = http(f"{API}/api/youtube/token", data=b"", headers={"authorization": f"Bearer {github_token()}"}, method="POST", timeout=60)
    return json.loads(body)["access_token"]


def upload(path, meta, tok):
    """Resumable upload in 32 MB pieces (big files and shaky networks are fine)."""
    req = urllib.request.Request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                                 data=json.dumps(meta).encode(), method="POST",
                                 headers={"authorization": f"Bearer {tok}", "content-type": "application/json; charset=UTF-8",
                                          "x-upload-content-type": "video/mp4", "x-upload-content-length": str(path.stat().st_size)})
    with urllib.request.urlopen(req, timeout=60) as r:
        loc = r.headers["location"]
    size, pos, chunk = path.stat().st_size, 0, 32 * 1024 * 1024
    with path.open("rb") as f:
        while pos < size:
            data = f.read(chunk)
            end = pos + len(data) - 1
            r = urllib.request.Request(loc, data=data, method="PUT", headers={"authorization": f"Bearer {tok}", "content-range": f"bytes {pos}-{end}/{size}"})
            try:
                with urllib.request.urlopen(r, timeout=600) as resp:
                    return json.loads(resp.read())["id"]
            except urllib.error.HTTPError as e:
                if e.code != 308: raise RuntimeError(f"YouTube said {e.code}: {e.read()[:300]!r}")
                rng = e.headers.get("range")
                pos = int(rng.split("-")[1]) + 1 if rng else 0
                f.seek(pos)
            print(f"  uploaded {pos / size:.0%}")
    raise RuntimeError("upload ended without a video id")


def notify(title, text, link):
    topic = os.environ.get("NTFY_TOPIC")
    if not topic: return
    body = json.dumps({"topic": topic, "title": title, "message": text, "click": link, "tags": ["clapper"]}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request("https://ntfy.sh/", data=body, method="POST", headers={"content-type": "application/json"}), timeout=30)
    except Exception as e:
        print("notification failed:", e)


def main(ep_id, video, thumb):
    ep = HERE / "episodes" / ep_id
    script = json.loads((ep / "script.json").read_text())
    timing = json.loads((ep / "timing.json").read_text())
    tok = token()
    title = script["title"].strip()
    title = (title if len(title) <= 80 else title[:79] + "…") + " | Explained"
    meta = {"snippet": {"title": title[:100], "description": description(script, timing), "categoryId": "25", "defaultLanguage": "en",
                        "tags": ["South Africa", "Explained", "Pulse SA", "SA News"]},
            "status": {"privacyStatus": os.environ.get("EXPLAINER_PRIVACY", "private"), "selfDeclaredMadeForKids": False, "embeddable": True}}
    vid = upload(Path(video), meta, tok)
    print("uploaded:", vid)
    try:
        urllib.request.urlopen(urllib.request.Request(f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}", data=Path(thumb).read_bytes(),
                                                      method="POST", headers={"authorization": f"Bearer {tok}", "content-type": "image/jpeg"}), timeout=120)
        thumb_ok = True
    except urllib.error.HTTPError as e:
        thumb_ok = False
        print(f"thumbnail not set ({e.code}): {e.read()[:200]!r} — custom thumbnails need a phone-verified channel")
    try:
        http(f"{API}/api/youtube/posted", data=json.dumps({"clipId": None, "storyKey": f"explainer~{ep_id}"[:80], "ok": True, "detail": f"https://youtu.be/{vid}"}).encode(),
             headers={"authorization": f"Bearer {github_token()}", "content-type": "application/json"}, method="POST", timeout=60)
    except Exception as e:
        print("couldn't log the upload:", e)
    mins = timing["duration"] / 60
    notify("New explainer ready to check", f"{script['title']} ({mins:.1f} min). It's PRIVATE: watch it, then set it to Public in YouTube Studio."
           + ("" if thumb_ok else " (Thumbnail not set: verify the channel by phone.)"), f"https://studio.youtube.com/video/{vid}/edit")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(f"### {script['title']}\n\nPrivate on YouTube: https://youtu.be/{vid} · edit: https://studio.youtube.com/video/{vid}/edit\n\n"
                    f"Length {mins:.1f} min · Claude tokens in {script.get('usage', {}).get('input_tokens')} / out {script.get('usage', {}).get('output_tokens')}\n")


if __name__ == "__main__":
    main(*sys.argv[1:4])
