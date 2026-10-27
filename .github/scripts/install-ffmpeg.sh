#!/usr/bin/env bash
# Makes sure ffmpeg is installed, without depending on Ubuntu's download server (which sometimes hangs).
#   bash .github/scripts/install-ffmpeg.sh [extra apt packages, e.g. fonts-inter]
# 1. Ubuntu packages (quick try, 2 attempts)  2. backup: the same ffmpeg from PyPI (imageio-ffmpeg, very reliable)
# Fails the step if there is still no ffmpeg, so nothing else (like paid Claude calls) runs for nothing.
set -uo pipefail
EXTRA="$*"
have() { command -v ffmpeg >/dev/null 2>&1 && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264; }
if ! have || [ -n "$EXTRA" ]; then
  for i in 1 2; do
    timeout 120 sudo apt-get update -qq -o Acquire::Retries=2 -o Acquire::http::Timeout=20 \
      && timeout 180 sudo apt-get install -y -qq -o Acquire::http::Timeout=20 ffmpeg $EXTRA && break
    echo "Ubuntu's download server was slow (try $i)"; sleep 5
  done
fi
if ! have; then
  echo "Using the backup ffmpeg from PyPI"
  for i in 1 2 3; do python3 -m pip install -q imageio-ffmpeg && break; sleep 10; done
  BIN=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())") && sudo ln -sf "$BIN" /usr/local/bin/ffmpeg
fi
if ! have; then echo "::error::ffmpeg could not be installed (Ubuntu and PyPI both failed). Nothing was made; try again later."; exit 1; fi
ffmpeg -version | head -1
