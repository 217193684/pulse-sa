"""
Uploads a finished explainer to the Pulse SA News channel as PRIVATE, so it can be watched before it goes public.

  python explainer/upload.py <episode id> <video.mp4> <thumbnail.jpg>

Then sends a phone notification (ntfy topic in NTFY_TOPIC) with the YouTube Studio link.
"""
import json, os, re, sys, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "video"))
from make import API, github_token, http  # noqa: E402

NAMES = {"hook": "Intro", "timeline": "How it started", "stats": "The numbers", "suspects": "Why it happens", "verdict": "The verdict",
         "checklist": "What you can do", "outro": "What happens next", "court": "The process", "bankcheck": "How the check works",
         "scenario": "A real-life example", "voices": "What people are saying", "moneytrail": "Follow the money", "howto": "Check it yourself"}


BASE_TAGS = ["#SouthAfrica", "#PulseSANews", "#Explained"]


def hashtags(script):
    """Topic hashtags people actually search (written by Claude), then the channel's own. Max 8."""
    out, seen = [], set()
    for h in list(script.get("hashtags") or []) + BASE_TAGS:
        h = "#" + re.sub(r"[^0-9A-Za-z_]", "", str(h))
        if len(h) > 2 and h.lower() not in seen:
            seen.add(h.lower()); out.append(h)
    return out[:8]


def description(script, timing=None):
    """Short, for search: the question, one line that hooks, a comment question, hashtags and 3 sources."""
    hook = " ".join(script["scenes"][0]["lines"][:2])
    ask = (script["scenes"][-1].get("lines") or [""])[-1] if script["scenes"][-1].get("type") == "outro" else ""
    src = "\n".join(f"• {x['name'].split(':')[0].split(',')[0].strip()}: {x['url']}" for x in script.get("sources", [])[:3])
    parts = [script["title"], hook, ask if "?" in ask else "", " ".join(hashtags(script)), f"Sources:\n{src}" if src else ""]
    return "\n\n".join(x for x in parts if x)[:4900]


def token():
    _, body = http(f"{API}/api/youtube/token", data=b"", headers={"authorization": f"Bearer {github_token()}"}, method="POST", timeout=60)
    return json.loads(body)["access_token"]


def upload(path, meta, tok):
    """Resumable upload in 32 MB pieces (big files and shaky networks are fine)."""
    req = urllib.request.Request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                                 data=json.dumps(meta).encode(), method="POST",
                                 headers={"authorization": f"Bearer {tok}", "content-type": "application/json; charset=UTF-8",
                                          "x-upload-content-type": "video/mp4", "x-upload-content-length": str(path.stat().st_size)})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            loc = r.headers["location"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"YouTube refused the upload ({e.code}): {e.read()[:600].decode('utf-8', 'replace')}")
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


def report(ep_id, data):
    try:
        http(f"{API}/api/explainers/{ep_id}/status", data=json.dumps(data).encode(),
             headers={"authorization": f"Bearer {github_token()}", "content-type": "application/json"}, method="POST", timeout=60)
    except Exception as e:
        print("couldn't update the app:", e)


def main(ep_id, video, thumb, privacy="public"):
    """Uploads as a normal (long) video with the thumbnail chosen in the app."""
    ep = HERE / "episodes" / ep_id
    script = json.loads((ep / "script.json").read_text())
    timing = json.loads((ep / "timing.json").read_text())
    title = script["title"].strip()
    title = (title if len(title) <= 80 else title[:79] + "…") + " | Explained"
    meta = {"snippet": {"title": title[:100], "description": description(script, timing), "categoryId": "25", "defaultLanguage": "en",
                        "tags": [re.sub(r"(?<=[a-z])(?=[A-Z])", " ", h[1:]) for h in hashtags(script)] + ["South Africa", "SA News"]},
            "status": {"privacyStatus": privacy if privacy in ("public", "unlisted", "private") else "public", "selfDeclaredMadeForKids": False, "embeddable": True}}
    try:
        tok = token()
        vid = upload(Path(video), meta, tok)
    except Exception as e:
        msg = str(e)
        friendly = "YouTube's daily upload limit is used up. Press Send again later." if "uploadLimitExceeded" in msg else msg[:300]
        report(ep_id, {"status": "failed", "error": friendly})
        notify("Explainer not sent", f"{script['title']}: {friendly}", "https://studio.youtube.com")
        raise
    print("uploaded:", vid)
    try:
        urllib.request.urlopen(urllib.request.Request(f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}", data=Path(thumb).read_bytes(),
                                                      method="POST", headers={"authorization": f"Bearer {tok}", "content-type": "image/jpeg"}), timeout=120)
        thumb_ok = True
    except urllib.error.HTTPError as e:
        thumb_ok = False
        print(f"thumbnail not set ({e.code}): {e.read()[:200]!r}")
    try:
        http(f"{API}/api/youtube/posted", data=json.dumps({"clipId": None, "storyKey": f"explainer~{ep_id}"[:80], "ok": True, "detail": f"https://youtu.be/{vid}"}).encode(),
             headers={"authorization": f"Bearer {github_token()}", "content-type": "application/json"}, method="POST", timeout=60)
    except Exception as e:
        print("couldn't log the upload:", e)
    report(ep_id, {"status": "on_youtube", "youtubeId": vid, **({} if thumb_ok else {"error": "Thumbnail not set: choose one in YouTube Studio."})})
    notify("Explainer is on YouTube", f"{script['title']} is now {meta['status']['privacyStatus']} on Pulse SA News."
           + ("" if thumb_ok else " The thumbnail couldn't be set; choose one in YouTube Studio."), f"https://youtu.be/{vid}")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(f"### {script['title']}\n\nOn YouTube ({meta['status']['privacyStatus']}): https://youtu.be/{vid}\n")


if __name__ == "__main__":
    main(*sys.argv[1:5])
