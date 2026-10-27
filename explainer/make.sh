#!/usr/bin/env bash
# Makes one explainer video from explainer/episodes/<id>/script.json
#   bash explainer/make.sh <id>
# Steps: voice (Kokoro, or ElevenLabs if ELEVENLABS_API_KEY is set) -> music + sfx -> Remotion render -> thumbnail
# -> out/<id>-upload.mp4 (light denoise so the print-grain texture doesn't blow up the file size).
set -euo pipefail
command -v ffmpeg >/dev/null || { echo "::error::ffmpeg is not installed"; exit 1; }
ID="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
EP="$HERE/episodes/$ID"
python3 "$HERE/voice.py" "$EP"
node "$HERE/audio/build.mjs" "$EP"
python3 - "$EP" <<'EOF'
import json, sys, pathlib
ep = pathlib.Path(sys.argv[1])
json.dump({"script": json.loads((ep / "script.json").read_text()), "timing": json.loads((ep / "timing.json").read_text())}, open(ep / "props.json", "w"))
EOF
cd "$HERE"
mkdir -p out
ARGS=(--props="$EP/props.json" --public-dir="$EP/public")
[ -n "${REMOTION_BROWSER:-}" ] && ARGS+=(--browser-executable="$REMOTION_BROWSER")
npx remotion render src/index.ts Explainer "out/$ID-master.mp4" "${ARGS[@]}" --concurrency="${RENDER_THREADS:-$(nproc)}" --crf=18
for v in 0 1 2; do
  python3 -c "import json,sys; p=json.load(open('$EP/props.json')); p['variant']=$v; json.dump(p, open('$EP/props-thumb.json','w'))"
  npx remotion still src/index.ts Thumb "out/$ID-thumb-$v.jpg" --props="$EP/props-thumb.json" --public-dir="$EP/public" ${REMOTION_BROWSER:+--browser-executable="$REMOTION_BROWSER"} --image-format=jpeg
done
cp "out/$ID-thumb-0.jpg" "out/$ID.jpg"
# full quality for YouTube; a light denoise keeps the print-grain texture from blowing up the file size
ffmpeg -y -loglevel error -i "out/$ID-master.mp4" -vf "hqdn3d=2:2:8:8" -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 160k "out/$ID-upload.mp4"
# a small copy for watching in the app and posting by hand (WhatsApp, Facebook, X, TikTok)
ffmpeg -y -loglevel error -i "out/$ID-master.mp4" -vf "scale=1280:720,hqdn3d=1.5:1.5:6:6" -c:v libx264 -preset veryfast -crf 27 -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 128k "out/$ID-preview.mp4"
ls -la out/
echo "made out/$ID-upload.mp4 and out/$ID.jpg"
