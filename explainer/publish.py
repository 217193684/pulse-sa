"""
Puts a finished explainer in the Pulse SA app and sends a phone notification.

  python explainer/publish.py <episode id>            # after a successful render
  python explainer/publish.py --failed <episode id>   # when the run failed (id may be empty)

The video files go to a GitHub release called explainer-<id> (public, free, big files are fine):
<id>-upload.mp4 (full quality, for YouTube), <id>-preview.mp4 (small, for watching in the app and posting by hand)
and three thumbnails to choose from. The app lists them via the Pulse SA server.
"""
import json, os, subprocess, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "video"))
sys.path.insert(0, str(HERE))
from make import API, github_token, http  # noqa: E402
from upload import description, notify  # noqa: E402

REPO = os.environ.get("GITHUB_REPOSITORY", "217193684/pulse-sa")


def status(ep_id, data):
    try:
        http(f"{API}/api/explainers/{ep_id}/status", data=json.dumps(data).encode(),
             headers={"authorization": f"Bearer {github_token()}", "content-type": "application/json"}, method="POST", timeout=60)
    except Exception as e:
        print("couldn't update the app:", e)


def main(args):
    request = os.environ.get("REQUEST_ID", "").strip()
    if args and args[0] == "--failed":
        ep_id = args[1] if len(args) > 1 else ""
        for i in {request, ep_id} - {""}:
            status(i, {"status": "failed", "error": "The video couldn't be made. Check the GitHub run."})
        notify("Explainer failed", f"Couldn't make the explainer {('about ' + os.environ.get('TOPIC')) if os.environ.get('TOPIC') else ''}. Try again from the app.",
               f"https://github.com/{REPO}/actions")
        return
    if args and args[0] == "--refresh":   # just rewrite the description the app copies
        script = json.loads((HERE / "episodes" / args[1] / "script.json").read_text())
        status(args[1], {"description": description(script)})
        print(description(script))
        return
    ep_id = args[0]
    ep = HERE / "episodes" / ep_id
    out = HERE / "out"
    script = json.loads((ep / "script.json").read_text())
    timing = json.loads((ep / "timing.json").read_text())
    files = [out / f"{ep_id}-upload.mp4", out / f"{ep_id}-preview.mp4"] + [out / f"{ep_id}-thumb-{v}.jpg" for v in range(3)]
    files = [f for f in files if f.exists()]
    desc = description(script, timing)
    (out / f"{ep_id}-description.txt").write_text(desc)
    files.append(out / f"{ep_id}-description.txt")
    tag = f"explainer-{ep_id}"
    subprocess.run(["gh", "release", "delete", tag, "--yes", "--cleanup-tag", "--repo", REPO], capture_output=True)
    subprocess.run(["gh", "release", "create", tag, *map(str, files), "--repo", REPO, "--title", f"Explainer: {script['title']}"[:120],
                    "--notes", desc[:3000], "--latest=false"], check=True)
    base = f"https://github.com/{REPO}/releases/download/{tag}"
    minutes = round(timing["duration"] / 60, 1)
    status(ep_id, {"title": script["title"], "topic": os.environ.get("TOPIC") or script["title"], "status": "ready", "minutes": minutes,
                   "videoUrl": f"{base}/{ep_id}-upload.mp4", "previewUrl": f"{base}/{ep_id}-preview.mp4",
                   "thumbs": [f"{base}/{ep_id}-thumb-{v}.jpg" for v in range(3) if (out / f"{ep_id}-thumb-{v}.jpg").exists()],
                   "description": desc, "source": "app" if request else "daily", **({"replaces": request} if request else {})})
    notify("New explainer ready", f"{script['title']} ({minutes} min). Open Pulse SA → Explain to watch it, pick a thumbnail and send it to YouTube.",
           f"https://github.com/{REPO}/releases/tag/{tag}")
    print(f"published {tag}: {minutes} min")


if __name__ == "__main__":
    main(sys.argv[1:])
