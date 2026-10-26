import React from 'react';
import {H} from './kit/theme';

/**
 * Simple flat everyday people for scenario scenes, drawn in the case-file style (thick ink outline, flat colour).
 * They are clearly illustrations: no real person is ever drawn.
 */
export type Look = 'gogo' | 'woman' | 'man' | 'youngman' | 'child' | 'worker';
export type Mood = 'happy' | 'worried' | 'angry' | 'thinking' | 'calm';

const SKIN = ['#8d5524', '#a0662d', '#6b3e1f', '#c68642'];
const SHIRT: Record<Look, string> = {gogo: '#e8873a', woman: '#ec5077', man: '#2f4fc8', youngman: '#3fb59b', child: '#f2b62f', worker: '#f2b62f'};

export const Person: React.FC<{look?: Look; mood?: Mood; size?: number; f?: number; seed?: number; talking?: boolean}> = ({look = 'man', mood = 'calm', size = 420, f = 0, seed = 0, talking}) => {
  const skin = SKIN[seed % SKIN.length];
  const shirt = SHIRT[look];
  const s = size / 420;
  const bob = Math.sin(f / 9) * 3;
  const mouthOpen = talking ? Math.abs(Math.sin(f / 2.6)) : 0;
  const ink = H.ink;
  const brow = mood === 'angry' ? 'M178 132 L206 142 M262 142 L290 132' : mood === 'worried' ? 'M178 140 L206 132 M262 132 L290 140' : mood === 'thinking' ? 'M178 134 L206 134 M262 130 L290 136' : '';
  const mouth = mood === 'happy' ? `M208 196 Q234 ${222 + mouthOpen * 8} 260 196` : mood === 'angry' || mood === 'worried' ? `M210 ${206 - mouthOpen * 3} Q234 ${190 + mouthOpen * 10} 258 ${206 - mouthOpen * 3}` : `M212 200 Q234 ${206 + mouthOpen * 12} 256 200`;
  const small = look === 'child' ? 0.8 : 1;
  return (
    <svg width={420 * s} height={560 * s} viewBox="0 0 468 620" style={{overflow: 'visible'}}>
      <g transform={`translate(${(1 - small) * 234} ${(1 - small) * 560 + bob}) scale(${small})`}>
        {/* body */}
        <path d="M84 600 Q90 330 234 318 Q378 330 384 600 Z" fill={shirt} stroke={ink} strokeWidth={9} strokeLinejoin="round" />
        {look === 'worker' && <path d="M150 360 L318 360 L330 430 L138 430 Z" fill="#e8873a" stroke={ink} strokeWidth={6} opacity={0.9} />}
        {look === 'gogo' && <path d="M120 600 L130 470 Q234 500 338 470 L348 600 Z" fill="#2f4fc8" stroke={ink} strokeWidth={7} />}
        {/* neck + head */}
        <rect x={210} y={270} width={48} height={60} fill={skin} stroke={ink} strokeWidth={8} />
        <ellipse cx={234} cy={160} rx={104} ry={120} fill={skin} stroke={ink} strokeWidth={9} />
        {/* hair / headwear */}
        {look === 'gogo' && <path d="M126 140 Q120 40 234 34 Q350 40 342 140 Q300 92 234 96 Q168 92 126 140 Z M330 70 Q392 40 380 110" fill="#ec5077" stroke={ink} strokeWidth={8} strokeLinejoin="round" />}
        {look === 'woman' && <path d="M124 150 Q110 36 234 34 Q358 36 344 150 Q330 80 234 76 Q138 80 124 150 Z" fill="#1c2340" stroke={ink} strokeWidth={8} />}
        {(look === 'man' || look === 'child') && <path d="M134 116 Q146 44 234 42 Q322 44 334 116 Q290 82 234 82 Q178 82 134 116 Z" fill="#1c2340" stroke={ink} strokeWidth={8} />}
        {look === 'youngman' && <path d="M128 112 Q140 30 240 36 Q336 44 340 112 L340 90 Q300 64 234 70 Q170 66 128 112 Z M180 50 L300 50" fill="#1c2340" stroke={ink} strokeWidth={8} />}
        {look === 'worker' && <path d="M120 120 Q124 30 234 28 Q344 30 348 120 Z M100 122 L368 122" fill="#f2b62f" stroke={ink} strokeWidth={9} strokeLinejoin="round" />}
        {/* face */}
        <circle cx={194} cy={168} r={11} fill={ink} />
        <circle cx={274} cy={168} r={11} fill={ink} />
        {look === 'gogo' && <><circle cx={194} cy={168} r={26} fill="none" stroke={ink} strokeWidth={5} /><circle cx={274} cy={168} r={26} fill="none" stroke={ink} strokeWidth={5} /><path d="M220 168 L248 168" stroke={ink} strokeWidth={5} /></>}
        {brow && <path d={brow} stroke={ink} strokeWidth={8} strokeLinecap="round" fill="none" />}
        <path d={mouth} stroke={ink} strokeWidth={8} strokeLinecap="round" fill={talking ? '#7a2a3a' : 'none'} />
        <circle cx={168} cy={206} r={14} fill={H.pink} opacity={0.35} />
        <circle cx={300} cy={206} r={14} fill={H.pink} opacity={0.35} />
        {mood === 'thinking' && <circle cx={360} cy={60} r={12} fill={H.paperLight} stroke={ink} strokeWidth={5} />}
        {mood === 'worried' && <path d="M330 110 q8 18 0 26 q-8 -8 0 -26" fill="#8fd3ff" stroke={ink} strokeWidth={4} />}
      </g>
    </svg>
  );
};
