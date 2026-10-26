#!/usr/bin/env bash
# Makes one explainer video from explainer/episodes/<id>/script.json
#   bash explainer/make.sh <id>
# Steps: voice (Kokoro, or ElevenLabs if ELEVENLABS_API_KEY is set) -> music + sfx -> Remotion render -> thumbnail.
set -euo pipefail
ID="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
EP="$HERE/episodes/$ID"
BROWSER="${REMOTION_BROWSER:-}"
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
[ -n "$BROWSER" ] && ARGS+=(--browser-executable="$BROWSER")
npx remotion render src/index.ts Explainer "out/$ID.mp4" "${ARGS[@]}" --crf=20
npx remotion still src/index.ts Thumb "out/$ID.jpg" "${ARGS[@]}" --image-format=jpeg
echo "made out/$ID.mp4 and out/$ID.jpg"
