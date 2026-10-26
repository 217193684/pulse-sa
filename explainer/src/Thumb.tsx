import React from 'react';
import {AbsoluteFill} from 'remotion';
import './fonts';
import {BigNumeral, RubberStamp} from './kit/props';
import {Halftone, NightBg, PaperBg, PrintGrain} from './kit/stage';
import {Person, type Look, type Mood} from './people';
import {H, HF, chunky, misprint} from './kit/theme';
import type {Props} from './Explainer';

/**
 * 1280x720 YouTube thumbnails, three looks to choose from in the app:
 * 0 paper (big number + question), 1 night (bold, high contrast), 2 person (an everyday person reacting).
 */
export const Thumb: React.FC<Props & {variant?: number}> = ({script, variant = 0}) => {
  const t = (script as any).thumb ?? {big: script.title.split(' ')[0], line: script.title, stamp: 'EXPLAINED'};
  const sc = (script.scenes || []).find((x) => x.type === 'scenario');
  const badge = (dark: boolean) => (
    <div style={{position: 'absolute', left: 60, top: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 22px', background: dark ? H.paperLight : H.ink, borderRadius: 8, fontFamily: HF.sans, fontSize: 34, color: dark ? H.ink : H.paperLight}}>
      <div style={{width: 18, height: 18, borderRadius: 9, background: '#2DD4BF'}} /> PULSE SA NEWS · EXPLAINED
    </div>
  );
  const line = (color: string, shadow: string, x = 70, top = 600, size = 150, width = 1800) => (
    <div style={{position: 'absolute', left: x, top, width, fontFamily: HF.serif, fontWeight: 900, fontSize: size, lineHeight: 1.0, color, textShadow: misprint(shadow, 9), fontVariantNumeric: 'lining-nums'}}>{t.line}</div>
  );
  return (
    <AbsoluteFill style={{background: H.paper, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'scale(0.6667)', transformOrigin: '0 0'}}>
        {variant === 1 ? (
          <>
            <NightBg f={0} />
            <Halftone color={H.pink} cx={1650} cy={300} radius={520} step={26} opacity={0.5} />
            <div style={{position: 'absolute', left: 80, top: 120}}>
              <BigNumeral text={t.big} size={440} dot={H.orange} base={H.yellow} id="thumb-num1" />
            </div>
            {line(H.paperLight, H.pink)}
            <div style={{position: 'absolute', right: 90, top: 260}}>
              <RubberStamp f={100} at={0} text={t.stamp} size={84} rot={-8} color={H.yellow} />
            </div>
            {badge(true)}
            {t.sub && <div style={{position: 'absolute', left: 74, top: 930, fontFamily: HF.round, fontSize: 72, ...chunky(H.yellow, 2)}}>{t.sub}</div>}
          </>
        ) : variant === 2 ? (
          <>
            <PaperBg fold={false} />
            <Halftone color={H.pink} cx={1450} cy={560} radius={640} step={26} opacity={0.75} />
            <Halftone color={H.yellow} cx={260} cy={260} radius={360} step={24} opacity={0.7} />
            <div style={{position: 'absolute', left: 1140, top: 200}}>
              <Person look={(sc?.look as Look) ?? 'man'} mood={(sc?.mood as Mood) ?? 'worried'} size={620} seed={2} />
            </div>
            <div style={{position: 'absolute', left: 90, top: 140}}>
              <BigNumeral text={t.big} size={300} dot={H.orangeDeep} base={H.yellow} id="thumb-num2" />
            </div>
            {line(H.ink, H.pink, 70, 470, 132, 1060)}
            {badge(false)}
            {t.sub && <div style={{position: 'absolute', left: 74, top: 930, fontFamily: HF.round, fontSize: 72, ...chunky(H.blue, 2)}}>{t.sub}</div>}
          </>
        ) : (
          <>
            <PaperBg fold={false} />
            <Halftone color={H.blue} cx={480} cy={330} radius={560} step={26} opacity={0.55} />
            <Halftone color={H.pink} cx={1800} cy={120} radius={360} step={24} opacity={0.6} />
            <div style={{position: 'absolute', left: 80, top: 110}}>
              <BigNumeral text={t.big} size={430} dot={H.orangeDeep} base={H.yellow} id="thumb-num" />
            </div>
            {line(H.ink, H.pink)}
            <div style={{position: 'absolute', right: 90, top: 250}}>
              <RubberStamp f={100} at={0} text={t.stamp} size={84} rot={-8} />
            </div>
            {badge(false)}
            {t.sub && <div style={{position: 'absolute', left: 74, top: 930, fontFamily: HF.round, fontSize: 72, ...chunky(H.blue, 2)}}>{t.sub}</div>}
          </>
        )}
        <PrintGrain f={0} still opacity={0.6} />
      </div>
    </AbsoluteFill>
  );
};
