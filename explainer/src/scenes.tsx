import React from 'react';
import {clamp01, easeOut, easeOutBack, rand} from './kit/anim';
import {BigNumeral, BurstLabel, Bubble, EvidenceCard, RubberStamp, StickyNote} from './kit/props';
import {Confetti, Halftone, Headline, Pop, Rays} from './kit/stage';
import {H, HF, chunky, misprint, popScale, shake} from './kit/theme';
import type {Ctx, Sfx} from './Explainer';
import {Person} from './people';

/**
 * One component per scene type. A script (written by hand or by Claude) picks a type for each part of the story
 * and fills in its data; every animation hangs off the frame where a line (or a word in it) is spoken.
 */

const COL: Record<string, string> = {yellow: H.yellow, pink: H.pink, blue: H.blue, orange: H.orange};
const col = (c?: string) => COL[c ?? 'yellow'] ?? c ?? H.yellow;
/** dark scenes sit on the navy night background, the rest on paper */
export const DARK = new Set(['hook', 'stats', 'calendar', 'court', 'verdict', 'outro', 'voices']);

type SceneDef = {View: React.FC<Ctx>; sfx?: (c: Ctx) => Sfx[]};

/** a gentle 1-2% push-in over the scene, the only camera move in this style */
const Push: React.FC<{c: Ctx; children: React.ReactNode}> = ({c, children}) => {
  const p = clamp01((c.f - c.a) / Math.max(1, c.b - c.a));
  const s = 1 + 0.02 * p;
  return <div style={{position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: '50% 45%'}}>{children}</div>;
};

const Title: React.FC<{c: Ctx; text: string; y?: number; size?: number; dark?: boolean}> = ({c, text, y = 150, size = 84, dark}) => (
  <Headline f={c.f} at={c.a + 4} text={text} x={960} y={y} size={size} align="center" per={1} color={dark ? H.paperLight : H.ink} shadow={dark ? H.blueDeep : H.pink} />
);

// ---------------------------------------------------------------- hook: one huge number
const Hook: React.FC<Ctx> = (c) => {
  const {f, d, L, at} = c;
  const t0 = L[0];
  const up = (d.ups as string[] | undefined) ?? [];
  const sh = shake(f, t0 + 5, 12);
  return (
    <>
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.42} step={24} maxR={14} opacity={0.9} />
      <Halftone color={H.yellow} cx={1500} cy={260} radius={260} step={20} opacity={0.55} f={f} breathe={0.04} />
      <Push c={c}>
        <div style={{position: 'absolute', left: 0, width: 1920, top: 170, display: 'flex', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)`}}>
          <Pop f={f} at={t0} dur={8} from={0.2} style={{position: 'relative'}}>
            <BigNumeral text={d.value} size={460} dot={H.orange} base={H.yellow} id="hook-num" />
          </Pop>
        </div>
        <Pop f={f} at={t0 + 16} x={1240} y={610} rot={-6}>
          <div style={{fontFamily: HF.hand, fontSize: 84, color: H.paperLight, textShadow: misprint(H.pink, 4)}}>{d.label}</div>
        </Pop>
        {d.was && (
          <Pop f={f} at={L[2] ?? t0} x={70} y={190} rot={-8}>
            <StickyNote f={f} at={L[2] ?? t0} title={d.was} sub={d.wasNote} w={260} />
          </Pop>
        )}
        {up.map((u, i) => (
          <Pop key={u} f={f} at={at(L.length > 3 ? [3, u.split(' ')[0]] : 0) } x={250 + i * 470} y={760}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', background: H.paperLight, border: `4px solid ${H.ink}`, borderRadius: 999, boxShadow: misprint(H.pink, 5), fontFamily: HF.sans, fontSize: 36, color: H.ink}}>
              {u} <span style={{color: H.red, fontSize: 40}}>▲</span>
            </div>
          </Pop>
        ))}
        <div style={{position: 'absolute', left: 1540, top: 120}}>
          <BurstLabel f={f} at={L[L.length - 1]} text="WHY?" size={230} rot={10} />
        </div>
      </Push>
    </>
  );
};

// ---------------------------------------------------------------- title card with a stamp
const TitleCard: React.FC<Ctx> = (c) => {
  const {f, d, a} = c;
  const st = a + 28;
  const sh = shake(f, st + 5, 10);
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)`}}>
      <Halftone color={H.yellow} cx={1700} cy={180} radius={520} step={22} opacity={0.9} f={f} breathe={0.03} />
      <Halftone color={H.pink} cx={150} cy={950} radius={360} step={22} opacity={0.7} />
      <Headline f={f} at={a + 4} text={d.headline} x={960} y={330} size={170} align="center" per={2} />
      <Pop f={f} at={a + 14} x={0} y={560} style={{width: 1920, textAlign: 'center'}}>
        <div style={{fontFamily: HF.sans, fontSize: 46, color: H.inkSoft}}>{d.sub}</div>
      </Pop>
      <div style={{position: 'absolute', left: 1080, top: 640}}>
        <RubberStamp f={f} at={st} text={d.stamp} size={64} rot={-8} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- timeline
const Timeline: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const pts = d.points as {year: string; value: string; note: string; at?: number}[];
  const x0 = 220, x1 = 1700, y = 520;
  const xs = pts.map((_, i) => x0 + ((x1 - x0) * i) / Math.max(1, pts.length - 1));
  const ats = pts.map((p, i) => at(p.at, i));
  const reached = ats.reduce((m, t, i) => (f >= t ? i : m), -1);
  const lineTo = reached < 0 ? x0 : xs[reached] + (reached < pts.length - 1 ? clamp01((f - ats[reached]) / 20) * 60 : 0);
  return (
    <Push c={c}>
      <Halftone color={H.blue} cx={1800} cy={980} radius={420} step={22} opacity={0.5} />
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <line x1={x0 - 60} y1={y} x2={x1 + 60} y2={y} stroke={H.paperDark} strokeWidth={10} strokeLinecap="round" />
        <line x1={x0 - 60} y1={y} x2={lineTo} y2={y} stroke={H.ink} strokeWidth={10} strokeLinecap="round" />
      </svg>
      {pts.map((p, i) => {
        const t = ats[i];
        const last = i === pts.length - 1;
        return (
          <React.Fragment key={i}>
            <Pop f={f} at={t} x={xs[i] - 22} y={y - 22}>
              <div style={{width: 44, height: 44, borderRadius: 22, background: last ? H.pink : H.yellow, border: `6px solid ${H.ink}`}} />
            </Pop>
            <Pop f={f} at={t + 3} x={xs[i] - 160} y={y - 170} style={{width: 320, textAlign: 'center'}}>
              <div style={{fontFamily: HF.mono, fontWeight: 700, fontSize: 64, color: H.ink}}>{p.year}</div>
            </Pop>
            <Pop f={f} at={t + 6} x={xs[i] - 170} y={y + 60} rot={i % 2 ? 3 : -3} style={{width: 340}}>
              <div style={{background: H.paperLight, border: `5px solid ${H.ink}`, borderRadius: 8, padding: '16px 14px 18px', textAlign: 'center', boxShadow: `8px 8px 0 ${last ? H.blue : H.pink}`}}>
                <div style={{fontFamily: HF.round, fontSize: 92, lineHeight: 1, ...chunky(last ? H.pink : H.ink, 3)}}>{p.value}</div>
                <div style={{fontFamily: HF.sans, fontSize: 30, color: H.inkSoft, marginTop: 10, lineHeight: 1.2}}>{p.note}</div>
              </div>
            </Pop>
          </React.Fragment>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- stats: up to three big numbers
const Stats: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const items = d.items as {value: string; label: string; color?: string; at?: number}[];
  const w = 1700 / items.length;
  return (
    <Push c={c}>
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.45} step={24} maxR={14} opacity={0.9} />
      {items.map((it, i) => {
        const t = at(it.at, i);
        const cx = 110 + w * i + w / 2;
        return (
          <React.Fragment key={i}>
            <Halftone color={col(it.color)} cx={cx} cy={450} radius={250} step={20} opacity={f >= t ? 0.35 : 0} />
            <Pop f={f} at={t} x={cx - w / 2} y={300} style={{width: w, textAlign: 'center'}}>
              <div style={{fontFamily: HF.round, fontSize: items.length > 2 ? 190 : 240, lineHeight: 1, ...chunky(col(it.color), 6), textShadow: misprint(H.nightDeep, 10)}}>{it.value}</div>
              <div style={{fontFamily: HF.sans, fontSize: 40, color: H.paperLight, marginTop: 30, lineHeight: 1.2, padding: '0 30px'}}>{it.label}</div>
            </Pop>
          </React.Fragment>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- suspects: three pinned evidence cards
const Suspects: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const cards = d.cards as {n: string; title: string; sub: string; color?: string; at?: any}[];
  return (
    <Push c={c}>
      <Halftone color={H.ink} cx={960} cy={560} radius={[1200, 760]} mode="in" inner={0.5} step={26} maxR={10} opacity={0.18} />
      <Title c={c} text={d.headline} />
      {cards.map((k, i) => {
        const t = at(k.at, i);
        const x = 960 + (i - (cards.length - 1) / 2) * 560 - 230;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: 330}}>
            <EvidenceCard f={f} at={t} color={col(k.color)} label={k.title} rot={[-4, 3, -2][i % 3]} w={460}>
              <span style={{fontFamily: HF.round, fontSize: 170, ...chunky(H.ink, 4), textShadow: misprint(H.paperLight, 7)}}>{k.n}</span>
            </EvidenceCard>
            <Pop f={f} at={t + 8} x={0} y={500} style={{width: 460, textAlign: 'center'}}>
              <div style={{fontFamily: HF.sans, fontSize: 30, color: H.inkSoft, lineHeight: 1.25}}>{k.sub}</div>
            </Pop>
          </div>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- bars: horizontal bar chart
const Bars: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const bars = d.bars as {label: string; value: number; show: string; color?: string; at?: any}[];
  const max = Math.max(...bars.map((b) => b.value));
  const x0 = 640, full = 700;
  return (
    <Push c={c}>
      <Halftone color={H.yellow} cx={1820} cy={120} radius={360} step={22} opacity={0.6} />
      <Title c={c} text={d.headline} />
      {bars.map((b, i) => {
        const t = at(b.at, i);
        const p = easeOut(clamp01((f - t) / 24));
        const w = Math.max(18, (full * b.value) / max) * p;
        const y = 330 + i * 190;
        return (
          <React.Fragment key={i}>
            <Pop f={f} at={t} x={120} y={y + 10} style={{width: 490, textAlign: 'right'}}>
              <div style={{fontFamily: HF.sans, fontSize: 36, color: H.ink, lineHeight: 1.15}}>{b.label}</div>
            </Pop>
            {f >= t && (
              <div style={{position: 'absolute', left: x0, top: y, width: w, height: 110, background: col(b.color), border: `5px solid ${H.ink}`, borderRadius: 6, boxShadow: `8px 8px 0 rgba(28,35,64,0.3)`}} />
            )}
            <Pop f={f} at={t + 18} x={x0 + w + 24} y={y + 12}>
              <div style={{fontFamily: HF.round, fontSize: 72, lineHeight: 1, whiteSpace: 'nowrap', ...chunky(H.ink, 3)}}>{b.show}</div>
            </Pop>
          </React.Fragment>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- calendar: renewed one year at a time
const Calendar: React.FC<Ctx> = (c) => {
  const {f, d, L, a} = c;
  const years = d.years as string[];
  const t0 = L[1] ?? a + 20;
  const step = Math.max(6, Math.min(16, Math.round(((L[2] ?? t0 + 90) - t0) / years.length)));
  const w = 210;
  const x0 = 960 - (years.length * (w + 20)) / 2;
  const q = L[L.length - 1];
  return (
    <Push c={c}>
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.45} step={24} maxR={14} opacity={0.9} />
      <Title c={c} text={d.headline} dark />
      {years.map((y, i) => {
        const t = c.a + 12 + i * 4;
        const st = t0 + i * step;
        return (
          <Pop key={y} f={f} at={t} x={x0 + i * (w + 20)} y={300}>
            <div style={{width: w, height: 230, background: H.paperLight, border: `5px solid ${H.ink}`, borderRadius: 10, overflow: 'hidden', position: 'relative'}}>
              <div style={{height: 54, background: H.pink, borderBottom: `5px solid ${H.ink}`}} />
              <div style={{fontFamily: HF.mono, fontWeight: 700, fontSize: 52, color: H.ink, textAlign: 'center', marginTop: 34}}>{y}</div>
              <div style={{position: 'absolute', left: 6, top: 150}}>
                <RubberStamp f={f} at={st} text={d.stampText ?? 'RENEWED'} size={28} rot={-14} seed={i + 2} />
              </div>
            </div>
          </Pop>
        );
      })}
      {d.law && (
        <Pop f={f} at={L[4] ?? q} x={1500} y={600} rot={6}>
          <StickyNote f={f} at={L[4] ?? q} title={d.law} sub={d.lawSub} w={300} />
        </Pop>
      )}
      <Pop f={f} at={q} x={360} y={600}>
        <Bubble w={1000} tail={120}>
          <div style={{fontFamily: HF.serif, fontSize: 40, lineHeight: 1.3}}>“{d.quote}”</div>
          <div style={{fontFamily: HF.sans, fontSize: 24, color: H.pink, marginTop: 10}}>{d.quoteBy}</div>
        </Bubble>
      </Pop>
    </Push>
  );
};

// ---------------------------------------------------------------- compare: two columns and the gap between them
const Compare: React.FC<Ctx> = (c) => {
  const {f, d, L, at} = c;
  const l = d.left as {label: string; value: number; show: string};
  const r = d.right as {label: string; value: number; show: string};
  const max = Math.max(l.value, r.value);
  const base = 830, hmax = 470;
  const tl = at(d.leftAt, 0), tr = at(d.rightAt, 1);
  const hl = (hmax * l.value) / max * easeOut(clamp01((f - tl) / 22));
  const hr = (hmax * r.value) / max * easeOut(clamp01((f - tr) / 22));
  const tg = at(d.gapAt, 2);
  return (
    <Push c={c}>
      <Halftone color={H.pink} cx={150} cy={160} radius={340} step={22} opacity={0.55} />
      <Title c={c} text={d.headline} />
      {[[l, hl, tl, 520, H.blue], [r, hr, tr, 900, H.orange]].map(([s, h, t, x, color]: any, i) => (
        <React.Fragment key={i}>
          {f >= t && <div style={{position: 'absolute', left: x, top: base - h, width: 240, height: h, background: color, border: `5px solid ${H.ink}`, borderRadius: '8px 8px 0 0'}} />}
          <Pop f={f} at={t + 14} x={x - 60} y={base - h - 110} style={{width: 360, textAlign: 'center'}}>
            <div style={{fontFamily: HF.round, fontSize: 84, lineHeight: 1, ...chunky(H.ink, 3)}}>{s.show}</div>
          </Pop>
          <Pop f={f} at={t} x={x - 80} y={base + 16} style={{width: 400, textAlign: 'center'}}>
            <div style={{fontFamily: HF.sans, fontSize: 32, color: H.ink}}>{s.label}</div>
          </Pop>
        </React.Fragment>
      ))}
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <line x1={460} y1={base} x2={1200} y2={base} stroke={H.ink} strokeWidth={6} />
        {f >= tg && <line x1={790} y1={base - (hmax * l.value) / max} x2={1140} y2={base - (hmax * l.value) / max} stroke={H.red} strokeWidth={4} strokeDasharray="14 10" />}
      </svg>
      <div style={{position: 'absolute', left: 1180, top: base - hmax - 30}}>
        <BurstLabel f={f} at={tg} text={d.gap} size={290} rot={8} color={H.yellow} />
      </div>
      {d.note && (
        <Pop f={f} at={L[3] ?? tg + 30} x={1430} y={560} rot={-5}>
          <StickyNote f={f} at={L[3] ?? tg + 30} title={d.noteTitle ?? 'Note!'} sub={d.note} w={340} rot={0} />
        </Pop>
      )}
    </Push>
  );
};

// ---------------------------------------------------------------- court: steps along a path
const Court: React.FC<Ctx> = (c) => {
  const {f, d, at, L} = c;
  const steps = d.steps as {date: string; title: string; text: string; at?: any}[];
  const w = 470, gap = 90;
  const x0 = 960 - (steps.length * w + (steps.length - 1) * gap) / 2;
  const last = at(steps[steps.length - 1].at, steps.length - 1);
  return (
    <Push c={c}>
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.45} step={24} maxR={14} opacity={0.9} />
      <Rays f={f} at={last} cx={x0 + (steps.length - 1) * (w + gap) + w / 2} cy={480} />
      {steps.map((s, i) => {
        const t = at(s.at, i);
        const x = x0 + i * (w + gap);
        return (
          <React.Fragment key={i}>
            <Pop f={f} at={t} x={x} y={300}>
              <div style={{width: w, minHeight: 330, background: H.paperLight, border: `5px solid ${H.ink}`, borderRadius: 10, boxShadow: `10px 10px 0 ${[H.yellow, H.pink, H.blue][i % 3]}`, padding: '26px 28px'}}>
                <div style={{display: 'inline-block', fontFamily: HF.mono, fontWeight: 700, fontSize: 30, color: H.paperLight, background: H.ink, padding: '4px 12px', borderRadius: 4}}>{s.date}</div>
                <div style={{fontFamily: HF.serif, fontSize: 52, color: H.ink, lineHeight: 1.1, marginTop: 22}}>{s.title}</div>
                <div style={{fontFamily: HF.sans, fontSize: 32, color: H.inkSoft, lineHeight: 1.25, marginTop: 16}}>{s.text}</div>
              </div>
            </Pop>
            {i > 0 && (
              <Pop f={f} at={t - 4} x={x - gap + 8} y={430}>
                <div style={{fontFamily: HF.round, fontSize: 70, color: H.yellow}}>➜</div>
              </Pop>
            )}
          </React.Fragment>
        );
      })}
      {d.stamp && (
        <div style={{position: 'absolute', left: x0 + (steps.length - 1) * (w + gap) - 30, top: 690}}>
          <RubberStamp f={f} at={(L[L.length - 1] ?? last) + 40} text={d.stamp} size={44} rot={-7} color={H.yellow} />
        </div>
      )}
    </Push>
  );
};

// ---------------------------------------------------------------- bank check: money in, limit crossed, declined
const BankCheck: React.FC<Ctx> = (c) => {
  const {f, d, at, L} = c;
  const rows = d.inflows as string[];
  const ats = rows.map((_, i) => at(d.inflowAt?.[i], 2));
  const tot = ats[ats.length - 1] + 26;
  const stampAt = L[3] ?? tot + 30;
  const sh = shake(f, stampAt + 5, 12);
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)`}}>
      <Halftone color={H.yellow} cx={1750} cy={250} radius={420} step={22} opacity={0.7} />
      <Title c={c} text={d.headline} />
      <Pop f={f} at={L[1] ?? c.a + 10} x={300} y={280}>
        <div style={{width: 900, background: H.paperLight, border: `6px solid ${H.ink}`, borderRadius: 14, overflow: 'hidden', boxShadow: `10px 10px 0 rgba(28,35,64,0.25)`}}>
          <div style={{height: 60, background: H.blue, display: 'flex', alignItems: 'center', padding: '0 24px', fontFamily: HF.sans, fontSize: 28, color: H.paperLight}}>
            Your bank account · money in this month
          </div>
          <div style={{padding: '18px 34px 26px'}}>
            {rows.map((r, i) => (
              <div key={i} style={{opacity: f >= ats[i] ? 1 : 0, transform: `translateX(${(1 - easeOutBack(clamp01((f - ats[i]) / 8))) * -40}px)`, display: 'flex', justifyContent: 'space-between', fontFamily: HF.mono, fontWeight: 700, fontSize: 40, color: H.ink, padding: '14px 0', borderBottom: `3px dashed ${H.paperDark}`}}>
                <span>+ {r.split(' ').slice(1).join(' ')}</span>
                <span style={{color: '#2a8f6a'}}>{r.split(' ')[0]}</span>
              </div>
            ))}
            <div style={{opacity: f >= tot ? 1 : 0, display: 'flex', justifyContent: 'space-between', fontFamily: HF.mono, fontWeight: 700, fontSize: 48, color: H.ink, paddingTop: 18}}>
              <span>Total</span>
              <span style={{color: H.red}}>{d.total}</span>
            </div>
          </div>
        </div>
      </Pop>
      <Pop f={f} at={tot + 6} x={1290} y={340} rot={5}>
        <StickyNote f={f} at={tot + 6} title={`Limit ${d.limit}`} sub="per month" w={330} rot={0} />
      </Pop>
      <div style={{position: 'absolute', left: 520, top: 520}}>
        <RubberStamp f={f} at={stampAt} text="DECLINED" size={120} rot={-12} />
      </div>
      {L[4] !== undefined && d.note && (
        <Pop f={f} at={L[4]} x={1260} y={620} rot={-3}>
          <div style={{width: 520, background: H.ink, color: H.paperLight, fontFamily: HF.sans, fontSize: 32, lineHeight: 1.3, padding: '22px 26px', borderRadius: 10, boxShadow: misprint(H.pink, 7)}}>
            {d.note}
            {d.noteBy && <div style={{fontSize: 22, color: H.yellow, marginTop: 8}}>{d.noteBy}</div>}
          </div>
        </Pop>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- verdict
const Verdict: React.FC<Ctx> = (c) => {
  const {f, d, at, L} = c;
  const pts = d.points as string[];
  const st = (L[2] ?? L[L.length - 1]) + 10;
  const sh = shake(f, st + 5, 12);
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)`}}>
      <Rays f={f} at={c.a + 4} cy={330} />
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.45} step={24} maxR={14} opacity={0.9} />
      <Headline f={f} at={c.a + 6} text={d.headline} x={960} y={190} size={150} align="center" per={2} color={H.yellow} shadow={H.blueDeep} />
      {pts.map((p, i) => {
        const t = at(d.pointAt?.[i], 1);
        return (
          <Pop key={i} f={f} at={t} x={380} y={430 + i * 110}>
            <div style={{display: 'flex', alignItems: 'center', gap: 22, fontFamily: HF.sans, fontSize: 50, color: H.paperLight}}>
              <span style={{width: 50, height: 50, borderRadius: 25, background: [H.yellow, H.pink, H.blue][i % 3], border: `4px solid ${H.paperLight}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: HF.round, fontSize: 30, color: H.ink}}>{i + 1}</span>
              {p}
            </div>
          </Pop>
        );
      })}
      <div style={{position: 'absolute', left: 1330, top: 720}}>
        <RubberStamp f={f} at={st} text={d.stamp} size={70} rot={-10} color={H.pink} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- checklist: what you can do
const Checklist: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const items = d.items as {title: string; sub?: string; at?: any}[];
  const rowH = Math.min(140, 610 / items.length);
  return (
    <Push c={c}>
      <Halftone color={H.yellow} cx={1780} cy={900} radius={420} step={22} opacity={0.7} />
      <Halftone color={H.pink} cx={100} cy={160} radius={260} step={22} opacity={0.5} />
      <Title c={c} text={d.headline ?? 'What you can do'} y={140} size={76} />
      {items.map((it, i) => {
        const t = at(it.at, i);
        const tick = clamp01((f - t - 10) / 8);
        const y = 245 + i * rowH;
        return (
          <Pop key={i} f={f} at={t} x={300} y={y}>
            <div style={{display: 'flex', alignItems: 'center', gap: 30, width: 1320, padding: '7px 26px', background: H.paperLight, border: `4px solid ${H.ink}`, borderRadius: 10, boxShadow: `7px 7px 0 ${[H.yellow, H.pink, H.blue][i % 3]}`}}>
              <svg width={74} height={74}>
                <rect x={5} y={5} width={64} height={64} rx={10} fill={tick > 0 ? H.yellow : 'none'} stroke={H.ink} strokeWidth={6} />
                <path d="M18 38 L32 52 L58 22" fill="none" stroke={H.ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={70} strokeDashoffset={70 * (1 - tick)} />
              </svg>
              <div>
                <div style={{fontFamily: HF.sans, fontSize: 40, color: H.ink, lineHeight: 1.1}}>{it.title}</div>
                {it.sub && <div style={{fontFamily: HF.sans, fontSize: 28, color: H.pink, marginTop: 4}}>{it.sub}</div>}
              </div>
            </div>
          </Pop>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- outro
const Outro: React.FC<Ctx> = (c) => {
  const {f, d, a, L} = c;
  const t = L[1] ?? a + 40;
  return (
    <>
      <Rays f={f} at={a + 4} cy={420} />
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.45} step={24} maxR={14} opacity={0.9} />
      <Headline f={f} at={a + 6} text={d.headline} x={960} y={250} size={150} align="center" per={2} color={H.paperLight} shadow={H.pink} />
      <Pop f={f} at={a + 20} x={0} y={470} style={{width: 1920, textAlign: 'center'}}>
        <div style={{fontFamily: HF.sans, fontSize: 46, color: H.yellow}}>{d.sub}</div>
      </Pop>
      <Pop f={f} at={t} x={660} y={600}>
        <div style={{display: 'flex', alignItems: 'center', gap: 20, padding: '20px 44px', background: H.paperLight, border: `5px solid ${H.ink}`, borderRadius: 999, boxShadow: misprint(H.pink, 8)}}>
          <div style={{width: 46, height: 46, borderRadius: 23, background: '#0B0F14', border: `5px solid #2DD4BF`}} />
          <div style={{fontFamily: HF.sans, fontSize: 48, color: H.ink}}>Follow Pulse SA News</div>
        </div>
      </Pop>
      <Confetti f={f} at={t + 4} cy={640} />
    </>
  );
};


// ---------------------------------------------------------------- scenario: an everyday person living the story (always an EXAMPLE)
const Scenario: React.FC<Ctx> = (c) => {
  const {f, d, at, L, E} = c;
  const bubbles = d.bubbles as {text: string; at?: any; who?: 'person' | 'narrator'}[];
  // the person talks while any of their bubbles' lines are being spoken
  const talking = bubbles.some((b, i) => {
    const t = at(b.at, i);
    const li = L.indexOf(t);
    return f >= t && f < (li >= 0 ? E[li] : t + 60);
  });
  const shown = bubbles.map((b, i) => ({...b, t: at(b.at, i)})).filter((b) => f >= b.t).slice(-3);
  return (
    <Push c={c}>
      <Halftone color={H.yellow} cx={420} cy={560} radius={520} step={22} opacity={0.65} />
      <Halftone color={H.blue} cx={1820} cy={160} radius={300} step={22} opacity={0.4} />
      <Pop f={f} at={c.a + 6} x={150} y={300} from={0.6}>
        <Person look={d.look} mood={d.mood} f={f} seed={c.k} talking={talking} size={430} />
      </Pop>
      <Pop f={f} at={c.a + 10} x={170} y={190} rot={-3}>
        <div style={{display: 'inline-block', background: H.ink, color: H.paperLight, fontFamily: HF.sans, fontSize: 34, padding: '8px 20px', borderRadius: 8, boxShadow: misprint(H.pink, 5)}}>
          {d.name}{d.place ? <span style={{color: H.yellow}}> · {d.place}</span> : null}
        </div>
      </Pop>
      <div style={{position: 'absolute', left: 1500, top: 150}}>
        <RubberStamp f={f} at={c.a + 18} text="EXAMPLE" size={34} rot={8} color={H.blue} />
      </div>
      {shown.map((b, i) => {
        const narrator = b.who === 'narrator';
        return (
          <Pop key={b.t} f={f} at={b.t} x={720 + (narrator ? 120 : 0)} y={260 + i * 190} rot={i % 2 ? 1.5 : -1.5}>
            <div style={{width: 960, padding: '20px 30px', background: narrator ? H.ink : H.paperLight, color: narrator ? H.paperLight : H.ink, border: `5px solid ${H.ink}`, borderRadius: 22, boxShadow: `8px 8px 0 ${narrator ? H.pink : H.ink}`, fontFamily: narrator ? HF.sans : HF.hand, fontSize: narrator ? 36 : 50, lineHeight: 1.2}}>
              {b.text}
            </div>
          </Pop>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- voices: what people are saying (real quotes or common questions)
const Voices: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const items = d.items as {text: string; who: string; at?: any}[];
  const cols = items.length > 2 ? 2 : items.length;
  return (
    <Push c={c}>
      <Halftone color={H.blueDeep} cx={960} cy={520} radius={[1100, 700]} mode="in" inner={0.45} step={24} maxR={14} opacity={0.9} />
      <Title c={c} text={d.headline ?? 'What people are saying'} dark />
      {items.map((it, i) => {
        const t = at(it.at, i);
        const x = cols === 1 ? 460 : 150 + (i % 2) * 830;
        const y = 290 + Math.floor(i / 2) * 300;
        return (
          <Pop key={i} f={f} at={t} x={x} y={y} rot={[-2, 1.5, 1, -1.5][i % 4]}>
            <div style={{position: 'relative', width: 780}}>
              <div style={{padding: '22px 30px', background: H.paperLight, border: `5px solid ${H.ink}`, borderRadius: 22, boxShadow: `8px 8px 0 ${[H.yellow, H.pink, H.blue, H.orange][i % 4]}`}}>
                <div style={{fontFamily: HF.serif, fontSize: 38, color: H.ink, lineHeight: 1.25}}>“{it.text}”</div>
                <div style={{fontFamily: HF.sans, fontSize: 24, color: H.pink, marginTop: 10}}>{it.who}</div>
              </div>
            </div>
          </Pop>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- moneytrail: promised vs delivered, and where the rest might have gone
const MoneyTrail: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const p = d.promised as {label: string; show: string; value: number};
  const g = d.delivered as {label: string; show: string; value: number};
  const reasons = (d.reasons ?? []) as {title: string; status: string; color?: string; at?: any}[];
  const tp = at(d.promisedAt, 0), tg = at(d.deliveredAt, 1), tq = at(d.gapAt, 2);
  const max = Math.max(p.value, g.value);
  const W = 1100;
  const wp = (W * p.value) / max * easeOut(clamp01((f - tp) / 24));
  const wg = (W * g.value) / max * easeOut(clamp01((f - tg) / 24));
  return (
    <Push c={c}>
      <Halftone color={H.pink} cx={1800} cy={140} radius={360} step={22} opacity={0.5} />
      <Title c={c} text={d.headline ?? 'Follow the money'} />
      {[[p, wp, tp, 280, H.blue], [g, wg, tg, 420, H.yellow]].map(([s, w, t, y, color]: any, i) => (
        <React.Fragment key={i}>
          <Pop f={f} at={t} x={110} y={y + 16} style={{width: 380, textAlign: 'right'}}>
            <div style={{fontFamily: HF.sans, fontSize: 34, color: H.ink, lineHeight: 1.1}}>{s.label}</div>
          </Pop>
          {f >= t && <div style={{position: 'absolute', left: 520, top: y, width: w, height: 100, background: color, border: `5px solid ${H.ink}`, borderRadius: 6}} />}
          <Pop f={f} at={t + 16} x={i === 0 ? 540 : 520 + (W * s.value) / max + 24} y={y + 14}>
            <div style={{fontFamily: HF.round, fontSize: 64, lineHeight: 1, whiteSpace: 'nowrap', ...chunky(i === 0 ? H.paperLight : H.ink, 3)}}>{s.show}</div>
          </Pop>
        </React.Fragment>
      ))}
      {f >= tq && (
        <div style={{position: 'absolute', left: 520 + (W * g.value) / max, top: 420, width: Math.max(0, W - (W * g.value) / max), height: 100, border: `5px dashed ${H.red}`, borderRadius: 6, opacity: clamp01((f - tq) / 8)}} />
      )}
      <div style={{position: 'absolute', left: 1440, top: 330}}>
        <BurstLabel f={f} at={tq} text={d.gap ?? '?'} size={260} rot={-8} color={H.yellow} />
      </div>
      {reasons.map((r, i) => {
        const t = at(r.at, 3 + i);
        return (
          <Pop key={i} f={f} at={t} x={200 + i * 520} y={600}>
            <div style={{width: 480, padding: '16px 22px', background: H.paperLight, border: `4px solid ${H.ink}`, borderRadius: 10, boxShadow: `6px 6px 0 rgba(28,35,64,0.3)`}}>
              <div style={{fontFamily: HF.sans, fontSize: 36, color: H.ink}}>{r.title}</div>
              <div style={{display: 'inline-block', marginTop: 10, fontFamily: HF.mono, fontWeight: 700, fontSize: 22, color: H.paperLight, background: col(r.color ?? 'pink'), padding: '4px 10px', borderRadius: 4}}>{r.status}</div>
            </div>
          </Pop>
        );
      })}
    </Push>
  );
};

// ---------------------------------------------------------------- howto: numbered practical steps (check, report, organise)
const HowTo: React.FC<Ctx> = (c) => {
  const {f, d, at} = c;
  const steps = d.steps as {title: string; sub?: string; at?: any}[];
  const rowH = Math.min(150, 620 / steps.length);
  return (
    <Push c={c}>
      <Halftone color={H.blue} cx={1780} cy={900} radius={420} step={22} opacity={0.5} />
      <Title c={c} text={d.headline} y={140} size={76} />
      {steps.map((s, i) => {
        const t = at(s.at, i);
        return (
          <Pop key={i} f={f} at={t} x={260} y={250 + i * rowH}>
            <div style={{display: 'flex', alignItems: 'center', gap: 28, width: 1400}}>
              <div style={{width: 88, height: 88, borderRadius: 44, background: [H.yellow, H.pink, H.blue, H.orange][i % 4], border: `5px solid ${H.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HF.round, fontSize: 52, color: H.ink, flexShrink: 0}}>{i + 1}</div>
              <div style={{flex: 1, padding: '10px 24px', background: H.paperLight, border: `4px solid ${H.ink}`, borderRadius: 10, boxShadow: '6px 6px 0 rgba(28,35,64,0.25)'}}>
                <div style={{fontFamily: HF.sans, fontSize: 40, color: H.ink, lineHeight: 1.15}}>{s.title}</div>
                {s.sub && <div style={{fontFamily: HF.sans, fontSize: 28, color: H.inkSoft, marginTop: 4}}>{s.sub}</div>}
              </div>
            </div>
          </Pop>
        );
      })}
    </Push>
  );
};

const pops = (c: Ctx, frames: number[], vol = 0.35): Sfx[] => frames.map((t) => ['pop', t, vol] as Sfx);

export const SCENES: Record<string, SceneDef> = {
  hook: {View: Hook, sfx: (c) => [['stamp', c.L[0] + 5, 0.6], ['pop', c.L[2] ?? c.L[0], 0.35], ['boing', c.L[c.L.length - 1], 0.4]]},
  title: {View: TitleCard, sfx: (c) => [['stamp', c.a + 33, 0.6]]},
  timeline: {View: Timeline, sfx: (c) => pops(c, (c.d.points as any[]).map((p, i) => c.at(p.at, i)))},
  stats: {View: Stats, sfx: (c) => pops(c, (c.d.items as any[]).map((p, i) => c.at(p.at, i)), 0.4)},
  suspects: {View: Suspects, sfx: (c) => (c.d.cards as any[]).map((p, i) => ['paper', c.at(p.at, i), 0.5] as Sfx)},
  bars: {View: Bars, sfx: (c) => pops(c, (c.d.bars as any[]).map((p, i) => c.at(p.at, i)))},
  calendar: {View: Calendar, sfx: (c) => {
    const n = (c.d.years as string[]).length;
    const t0 = c.L[1] ?? c.a + 20;
    const step = Math.max(6, Math.min(16, Math.round(((c.L[2] ?? t0 + 90) - t0) / n)));
    return [...Array.from({length: n}, (_, i) => ['stamp', t0 + i * step + 5, 0.3] as Sfx), ['pop', c.L[c.L.length - 1], 0.35]];
  }},
  compare: {View: Compare, sfx: (c) => [['pop', c.at(c.d.leftAt, 0), 0.35], ['pop', c.at(c.d.rightAt, 1), 0.35], ['boing', c.at(c.d.gapAt, 2), 0.45]]},
  court: {View: Court, sfx: (c) => [...pops(c, (c.d.steps as any[]).map((p, i) => c.at(p.at, i))), ...(c.d.stamp ? [['stamp', c.L[c.L.length - 1] + 45, 0.55] as Sfx] : [])]},
  bankcheck: {View: BankCheck, sfx: (c) => [...(c.d.inflows as string[]).map((_, i) => ['ding', c.at(c.d.inflowAt?.[i], 2), 0.3] as Sfx), ['stamp', (c.L[3] ?? 0) + 5, 0.65]]},
  verdict: {View: Verdict, sfx: (c) => [...pops(c, (c.d.points as string[]).map((_, i) => c.at(c.d.pointAt?.[i], 1))), ['stamp', (c.L[2] ?? c.L[c.L.length - 1]) + 15, 0.65]]},
  checklist: {View: Checklist, sfx: (c) => (c.d.items as any[]).flatMap((p, i) => [['pop', c.at(p.at, i), 0.3], ['ding', c.at(p.at, i) + 12, 0.3]] as Sfx[])},
  scenario: {View: Scenario, sfx: (c) => [['pop', c.a + 6, 0.3], ['stamp', c.a + 23, 0.35], ...(c.d.bubbles as any[]).map((b, i) => ['pop', c.at(b.at, i), 0.3] as Sfx)]},
  voices: {View: Voices, sfx: (c) => pops(c, (c.d.items as any[]).map((p, i) => c.at(p.at, i)))},
  moneytrail: {View: MoneyTrail, sfx: (c) => [['pop', c.at(c.d.promisedAt, 0), 0.35], ['pop', c.at(c.d.deliveredAt, 1), 0.35], ['boing', c.at(c.d.gapAt, 2), 0.45], ...((c.d.reasons ?? []) as any[]).map((r, i) => ['paper', c.at(r.at, 3 + i), 0.4] as Sfx)]},
  howto: {View: HowTo, sfx: (c) => (c.d.steps as any[]).flatMap((p, i) => [['pop', c.at(p.at, i), 0.3]] as Sfx[])},
  outro: {View: Outro, sfx: (c) => [['confetti', (c.L[1] ?? c.a + 40) + 4, 0.45]]},
};

// keep rand referenced for scenes that add sparkle later
void rand;
void popScale;
