import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import './fonts';
import {clamp01, easeIn} from './kit/anim';
import {CaseHeader, DateChip, DotWipe, NightBg, PaperBg, PrintGrain} from './kit/stage';
import {H, HF, popScale} from './kit/theme';
import {SCENES, DARK} from './scenes';
import {captionText} from './numbers';

export const FPS = 30;

export type Line = {text: string; start: number; end: number};
export type SceneTiming = {type: string; start: number; end: number; lines: Line[]};
export type SceneData = {type: string; lines: string[]; tag?: [string, string]; [k: string]: any};
export type Script = {id: string; title: string; caseNo: string; date: string; scenes: SceneData[]; sources: {name: string; url: string}[]; voice?: string};
export type Props = {script: Script; timing: {duration: number; scenes: SceneTiming[]}};

/** Everything a scene needs: the global frame, its own window, when each line starts, and a word-time finder. */
export type Ctx = {
  f: number;
  a: number; // first frame the scene is on screen
  b: number; // first frame of the next scene
  L: number[]; // frame each narration line starts
  E: number[]; // frame each narration line ends
  d: SceneData;
  at: (spec: number | [number, string] | undefined, fallback?: number) => number;
  k: number; // scene index
};

export type Sfx = [name: string, frame: number, vol?: number];

const fr = (s: number) => Math.round(s * FPS);
const WIPES = [H.yellow, H.pink, H.blue];
const CORNERS = ['tl', 'br', 'tr', 'bl'] as const;

/** cut frames: a scene appears ~10 frames before its first word; the dot wipe covers the cut */
export const cuts = (t: Props['timing']) => t.scenes.map((s, i) => (i === 0 ? 0 : fr(s.start) - 10));

export const makeCtx = (p: Props, k: number, f: number): Ctx => {
  const c = cuts(p.timing);
  const st = p.timing.scenes[k];
  const total = fr(p.timing.duration);
  const L = st.lines.map((l) => fr(l.start));
  const E = st.lines.map((l) => fr(l.end));
  const at = (spec: number | [number, string] | undefined, fallback = 0): number => {
    if (spec === undefined) return L[Math.min(fallback, L.length - 1)];
    if (typeof spec === 'number') return L[Math.min(spec, L.length - 1)];
    const [li, word] = spec;
    const line = st.lines[Math.min(li, st.lines.length - 1)];
    const i = line.text.toLowerCase().indexOf(word.toLowerCase());
    const share = i < 0 ? 0 : i / Math.max(1, line.text.length);
    return fr(line.start + (line.end - line.start) * share);
  };
  return {f, a: c[k], b: k + 1 < c.length ? c[k + 1] : total, L, E, d: p.script.scenes[k], at, k};
};

/** Subtitles: the line being spoken, numbers as digits, wrapped to at most two rows */
const Caption: React.FC<{f: number; at: number; out: number; text: string; dark: boolean}> = ({f, at, out, text, dark}) => {
  if (f < at || f >= out) return null;
  const {s, o} = popScale(f, at, 5, 0.85);
  const k = 1 - easeIn(clamp01((f - (out - 4)) / 4));
  const parts = captionText(text).split(/(R\d[\d.,]*(?:\s?(?:bn|billion|million|M))?|\d[\d.,]*%?(?:\s?(?:million|billion))?)/);
  return (
    <div style={{position: 'absolute', left: 0, width: 1920, bottom: 54, display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          maxWidth: 1480,
          transform: `scale(${s})`,
          opacity: o * k,
          padding: '12px 28px 14px',
          borderRadius: 10,
          background: H.ink,
          color: H.paperLight,
          fontFamily: HF.sans,
          fontSize: 36,
          lineHeight: 1.3,
          textAlign: 'center',
          boxShadow: `7px 7px 0 ${dark ? H.nightDeep : H.pink}`,
          border: dark ? `2px solid rgba(236,229,211,0.14)` : undefined,
        }}
      >
        {parts.map((p, i) => (i % 2 ? <span key={i} style={{color: H.yellow}}>{p}</span> : <span key={i}>{p}</span>))}
      </div>
    </div>
  );
};

/** Little channel badge, bottom right, so clips that get reposted still say where they came from */
const Badge: React.FC<{dark: boolean}> = ({dark}) => (
  <div style={{position: 'absolute', right: 40, top: 112, display: 'flex', alignItems: 'center', gap: 10, fontFamily: HF.sans, fontSize: 20, color: dark ? H.paper : H.ink, opacity: 0.85}}>
    <div style={{width: 12, height: 12, borderRadius: 6, background: '#2DD4BF'}} />
    PULSE SA NEWS
  </div>
);

export const Explainer: React.FC<Props> = (props) => {
  const f = useCurrentFrame();
  const {script, timing} = props;
  if (!timing.scenes.length) return <AbsoluteFill style={{background: H.paper}} />;
  const c = cuts(timing);
  let k = 0;
  while (k + 1 < c.length && f >= c[k + 1]) k++;
  const ctx = makeCtx(props, k, f);
  const type = script.scenes[k].type;
  const Scene = SCENES[type]?.View;
  const dark = DARK.has(type);

  // all sound effects for the whole film, collected once per frame (cheap: plain arrays)
  const sfx: Sfx[] = [];
  timing.scenes.forEach((_, i) => {
    const s = SCENES[script.scenes[i].type];
    if (s?.sfx) sfx.push(...s.sfx(makeCtx(props, i, 0)));
    if (i > 0) sfx.push(['whoosh', c[i] - 8, 0.35]);
  });

  // which line is being spoken (keep the caption up through the short gaps between lines)
  const lines = timing.scenes.flatMap((s) => s.lines);
  let li = -1;
  for (let i = 0; i < lines.length; i++) if (f >= fr(lines[i].start) - 2) li = i;
  const cur = li >= 0 ? lines[li] : null;
  const capOut = cur ? (li + 1 < lines.length ? Math.min(fr(lines[li + 1].start) - 2, fr(cur.end) + 20) : fr(cur.end) + 20) : 0;

  return (
    <AbsoluteFill style={{background: dark ? H.night : H.paper, overflow: 'hidden'}}>
      {dark ? <NightBg f={f} /> : <PaperBg />}
      {Scene && <Scene {...ctx} />}
      {script.scenes[k].tag && <CaseHeader f={f} at={ctx.a} no={`No.${script.caseNo}`} tag={script.scenes[k].tag as [string, string]} accent={k % 2 ? 'pink' : 'yellow'} dark={dark} />}
      <DateChip f={f} text={script.date} dark={dark} />
      <Badge dark={dark} />
      {cur && <Caption key={li} f={f} at={fr(cur.start) - 2} out={capOut} text={cur.text} dark={dark} />}
      {c.slice(1).map((cf, i) => (
        <DotWipe key={i} f={f} at={cf - 7} color={WIPES[i % 3]} from={CORNERS[i % 4]} />
      ))}
      <PrintGrain f={f} opacity={0.7} />
      <Audio src={staticFile('voice.wav')} />
      <Audio src={staticFile('bgm.wav')} volume={0.9} />
      {sfx.map(([name, at, vol = 0.5], i) => (
        <Sequence key={i} from={Math.max(0, at)} durationInFrames={60} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
