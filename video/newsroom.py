"""
Pulse SA newsroom: runs all day. Every few minutes it asks the server to collect the latest news,
then makes and uploads a video for each new story straight away (up to the daily cap the server enforces).

  python video/newsroom.py            # GitHub Actions (needs id-token: write)

One GitHub run lasts ~5h45m; the workflow then starts the next run, so it never stops.
"""
import json, os, sys, time, traceback, urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make import API, github_token, http, make_one, note  # noqa: E402

CHECK_EVERY = int(os.environ.get("CHECK_EVERY", 180))          # seconds between news checks
RUN_FOR = int(os.environ.get("RUN_FOR", 5 * 3600 + 45 * 60))     # stop before GitHub's 6-hour limit
PER_ROUND = int(os.environ.get("PER_ROUND", 4))
SHORTS_PER_DAY = int(os.environ.get("YT_SHORTS_PER_DAY", 8))   # new channels can upload ~10 videos a day; 2 stay free for the explainer                  # at most this many videos per check (the rest come next round)


def collect():
    try:
        _, body = http(f"{API}/api/cron/collect", timeout=90)
        d = json.loads(body)
        if d.get("skipped"): return "collected moments ago"
        return ", ".join(f"{r['source']} +{r.get('inserted', 0)}" for r in d.get("results", []))
    except Exception as e:
        return f"collect failed: {e}"


def youtube_upload(script, clip_id):
    """Uploads the finished video to the connected news channel as a Short. Quietly skips when no channel is connected."""
    try:
        _, body = http(f"{API}/api/youtube/token", data=b"", headers={"authorization": f"Bearer {github_token()}"}, method="POST", timeout=60)
        d = json.loads(body); tok = d["access_token"]
        if d.get("uploads24h", 0) >= SHORTS_PER_DAY:
            return f"skipped: {d['uploads24h']} uploads in 24h, keeping room for the daily explainer (YouTube allows about 10 a day)"
    except urllib.error.HTTPError as e:
        if e.code == 404: return "no channel connected"
        return f"no upload token ({e.code})"
    title = script["title"].strip()
    if len(title) > 88: title = title[:87].rsplit(" ", 1)[0] + "…"
    title += " #Shorts"
    links = "\n".join(f"• {l['outlet']}: {l['url']}" for l in script.get("links", []))
    description = f"{script['caption']}\n\nSources:\n{links}" if links else script["caption"]
    tags = [t.lstrip("#") for t in script.get("hashtags", [])][:15]
    info = {"snippet": {"title": title, "description": description[:4900], "tags": tags, "categoryId": "25", "defaultLanguage": "en"},
            "status": {"privacyStatus": os.environ.get("YT_PRIVACY", "public"), "selfDeclaredMadeForKids": False, "embeddable": True}}
    video = Path(script["_video"]).read_bytes()
    try:
        _, res = http("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
                      data=multipart_related(json.dumps(info).encode(), video), method="POST", timeout=300,
                      headers={"authorization": f"Bearer {tok}", "content-type": "multipart/related; boundary=pulsesa-yt"})
        vid = json.loads(res)["id"]; ok, detail = True, f"https://youtube.com/shorts/{vid}"
    except urllib.error.HTTPError as e:
        ok, detail = False, f"YouTube said {e.code}: {e.read()[:250].decode('utf-8', 'replace')}"
    try:
        http(f"{API}/api/youtube/posted", data=json.dumps({"clipId": clip_id, "storyKey": script["storyKey"], "ok": ok, "detail": detail[:400]}).encode(),
             headers={"authorization": f"Bearer {github_token()}", "content-type": "application/json"}, method="POST", timeout=60)
    except Exception as e:
        print("  couldn't log the YouTube post:", e)
    return detail


def multipart_related(meta, video):
    b = b"--pulsesa-yt\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n" + meta + b"\r\n"
    b += b"--pulsesa-yt\r\ncontent-type: video/mp4\r\n\r\n" + video + b"\r\n--pulsesa-yt--\r\n"
    return b


def plan(token):
    _, body = http(f"{API}/api/video-plan?max={PER_ROUND}", data=b"", headers={"authorization": f"Bearer {token}"}, method="POST", timeout=90)
    return json.loads(body)


def main():
    start = time.time(); made = failed = rounds = 0
    note(f"newsroom on: checking every {CHECK_EVERY // 60} min for {RUN_FOR // 3600}h{RUN_FOR % 3600 // 60:02d}")
    while time.time() - start < RUN_FOR - 600:                 # leave 10 min to finish a video
        rounds += 1; t0 = time.time()
        got = collect()
        try:
            token = github_token()                               # fresh each round: these tokens are short-lived
            p = plan(token)
            scripts = p.get("scripts", [])
            print(f"round {rounds} ({time.strftime('%H:%M', time.gmtime(time.time() + 7200))} SAST): {got}; "
                  f"{len(scripts)} new stor{'y' if len(scripts) == 1 else 'ies'}, {p.get('madeToday', '?')}/{p.get('cap', '?')} made today")
            for s in scripts:
                try:
                    if make_one(s, github_token(), label="  ▶ "):
                        made += 1
                        try: clip_id = json.loads(s.get("_upload") or "{}").get("id")
                        except ValueError: clip_id = None
                        if clip_id: print("  YouTube:", youtube_upload(s, clip_id))   # only brand-new clips, never repeats
                    else: failed += 1
                except Exception:
                    failed += 1; traceback.print_exc()
        except urllib.error.HTTPError as e:
            print(f"round {rounds}: server said {e.code}: {e.read()[:200]!r}")
        except Exception:
            traceback.print_exc()
        time.sleep(max(15, CHECK_EVERY - (time.time() - t0)))
    note(f"newsroom shift over: {made} video(s) made, {failed} failed, {rounds} checks")


if __name__ == "__main__":
    main()
