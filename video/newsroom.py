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
PER_ROUND = int(os.environ.get("PER_ROUND", 4))                  # at most this many videos per check (the rest come next round)


def collect():
    try:
        _, body = http(f"{API}/api/cron/collect", timeout=90)
        d = json.loads(body)
        if d.get("skipped"): return "collected moments ago"
        return ", ".join(f"{r['source']} +{r.get('inserted', 0)}" for r in d.get("results", []))
    except Exception as e:
        return f"collect failed: {e}"


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
                    if make_one(s, github_token(), label="  ▶ "): made += 1
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
