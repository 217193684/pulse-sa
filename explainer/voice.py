"""
Voices an explainer script and times every line.

  python explainer/voice.py explainer/episodes/<id>

Reads script.json, speaks each narration line (ElevenLabs when ELEVENLABS_API_KEY is set, otherwise the free
local Kokoro voice), and writes into the episode folder:
  public/voice.wav   the whole narration, 48 kHz, about -16 LUFS
  timing.json        start/end second of every scene and line, which the animation hangs off
"""
import json, os, re, subprocess, sys, urllib.request, wave
from pathlib import Path

import numpy as np

SR = 48000
LINE_GAP = 0.32      # pause between sentences
SCENE_GAP = 0.75     # pause between scenes
LEAD_IN = 0.6        # silence before the first word
TAIL = 2.5           # silence after the last word (end card)
MODEL_DIR = Path(os.environ.get("KOKORO_DIR", "/tmp/tts"))

# how the voice should say things it would otherwise read wrongly
SAY = [
    (r"\bSRD\b", "S R D"), (r"\bSASSA\b", "Sassa"), (r"\bSA\b", "S A"), (r"\bPIN\b", "pin"),
    (r"\bs r d dot sassa dot gov dot za\b", "S R D dot Sassa dot gov dot Z A"),
]


def say(text):
    for a, b in SAY: text = re.sub(a, b, text)
    return text


_K = None
def kokoro(text, voice, speed):
    global _K
    from kokoro_onnx import Kokoro
    if _K is None:
        _K = Kokoro(str(MODEL_DIR / "kokoro-v1.0.int8.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))
    audio, sr = _K.create(text, voice=voice, speed=speed, lang="en-us")
    return resample(np.asarray(audio, dtype=np.float32), sr)


def eleven(text, voice_id):
    body = json.dumps({"text": text, "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
                       "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.25}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=pcm_44100", data=body, method="POST",
                                 headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "content-type": "application/json"})
    pcm = np.frombuffer(urllib.request.urlopen(req, timeout=120).read(), dtype=np.int16).astype(np.float32) / 32768
    return resample(pcm, 44100)


def resample(x, sr):
    if sr == SR: return x
    t = np.arange(int(len(x) * SR / sr)) * sr / SR
    return np.interp(t, np.arange(len(x)), x).astype(np.float32)


def trim(x, thr=0.004):
    """Cuts the silence a TTS engine leaves around a sentence, keeping 40 ms either side."""
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    pad = int(0.04 * SR)
    return x[max(0, idx[0] - pad): idx[-1] + pad]


def main(ep_dir):
    ep = Path(ep_dir)
    script = json.loads((ep / "script.json").read_text())
    voice, speed = script.get("voice", "af_heart"), float(script.get("speed", 1.0))
    el_voice = os.environ.get("ELEVENLABS_VOICE_ID") if os.environ.get("ELEVENLABS_API_KEY") else None
    parts, t = [np.zeros(int(LEAD_IN * SR), np.float32)], LEAD_IN
    timing = {"scenes": []}
    for si, sc in enumerate(script["scenes"]):
        if si: parts.append(np.zeros(int(SCENE_GAP * SR), np.float32)); t += SCENE_GAP
        st = {"type": sc["type"], "start": round(t, 3), "lines": []}
        for li, line in enumerate(sc["lines"]):
            if li: parts.append(np.zeros(int(LINE_GAP * SR), np.float32)); t += LINE_GAP
            a = trim(eleven(say(line), el_voice) if el_voice else kokoro(say(line), voice, speed))
            st["lines"].append({"text": line, "start": round(t, 3), "end": round(t + len(a) / SR, 3)})
            parts.append(a); t += len(a) / SR
            print(f"  {si:02d}.{li} {len(a) / SR:5.2f}s  {line[:70]}")
        st["end"] = round(t, 3)
        timing["scenes"].append(st)
    parts.append(np.zeros(int(TAIL * SR), np.float32)); t += TAIL
    timing["duration"] = round(t, 3)
    timing["voice"] = "elevenlabs" if el_voice else f"kokoro:{voice}"
    pub = ep / "public"; pub.mkdir(exist_ok=True)
    raw = pub / "voice_raw.wav"
    y = np.concatenate(parts)
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    # loudness to about -16 LUFS, stereo
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "2",
                    str(pub / "voice.wav")], check=True)
    raw.unlink()
    (ep / "timing.json").write_text(json.dumps(timing, indent=1))
    print(f"voice: {t:.1f}s ({t / 60:.1f} min), {timing['voice']}")


if __name__ == "__main__":
    main(sys.argv[1])
