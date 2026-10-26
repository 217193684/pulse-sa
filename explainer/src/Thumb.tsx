import React from 'react';
import {AbsoluteFill} from 'remotion';
import './fonts';
import {BigNumeral, RubberStamp} from './kit/props';
import {Halftone, PaperBg, PrintGrain} from './kit/stage';
import {H, HF, chunky, misprint} from './kit/theme';
import type {Props} from './Explainer';

/** 1280x720 YouTube thumbnail: one huge number, a short question, a stamp */
export const Thumb: React.FC<Props> = ({script}) => {
  const t = (script as any).thumb ?? {big: script.title.split(' ')[0], line: script.title, stamp: 'EXPLAINED'};
  return (
    <AbsoluteFill style={{background: H.paper, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'scale(0.6667)', transformOrigin: '0 0'}}>
        <PaperBg fold={false} />
        <Halftone color={H.blue} cx={480} cy={330} radius={560} step={26} opacity={0.55} />
        <Halftone color={H.pink} cx={1800} cy={120} radius={360} step={24} opacity={0.6} />
        <div style={{position: 'absolute', left: 40, top: 110}}>
          <BigNumeral text={t.big} size={430} dot={H.orangeDeep} base={H.yellow} id="thumb-num" />
        </div>
        <div style={{position: 'absolute', left: 70, top: 600, width: 1800, fontFamily: HF.serif, fontWeight: 900, fontSize: 150, lineHeight: 1.0, color: H.ink, textShadow: misprint(H.pink, 9), fontVariantNumeric: 'lining-nums'}}>{t.line}</div>
        <div style={{position: 'absolute', right: 90, top: 250}}>
          <RubberStamp f={100} at={0} text={t.stamp} size={84} rot={-8} />
        </div>
        <div style={{position: 'absolute', left: 60, top: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 22px', background: H.ink, borderRadius: 8, fontFamily: HF.sans, fontSize: 34, color: H.paperLight}}>
          <div style={{width: 18, height: 18, borderRadius: 9, background: '#2DD4BF'}} /> PULSE SA NEWS · EXPLAINED
        </div>
        {t.sub && <div style={{position: 'absolute', left: 74, top: 930, fontFamily: HF.round, fontSize: 72, ...chunky(H.blue, 2)}}>{t.sub}</div>}
        <PrintGrain f={0} still opacity={0.6} />
      </div>
    </AbsoluteFill>
  );
};
