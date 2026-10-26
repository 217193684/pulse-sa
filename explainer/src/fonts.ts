import {continueRender, delayRender} from 'remotion';
import serif from '../fonts/Playfair-900.woff2';
import round from '../fonts/Nunito-900.woff2';
import mono from '../fonts/Mono-700.woff2';
import sans from '../fonts/Inter-800.woff2';
import sansMid from '../fonts/Inter-600.woff2';
import num from '../fonts/Anton-400.woff';
import hand from '../fonts/Caveat-600.woff';

/** All fonts ship with the project (OFL), so renders look the same on any machine and need no internet. */
const FACES: [string, string, string?][] = [
  ['PSA Serif', serif],
  ['PSA Round', round],
  ['PSA Mono', mono],
  ['PSA Sans', sans],
  ['PSA SansMid', sansMid],
  ['PSA Num', num],
  ['PSA Hand', hand],
];

if (typeof document !== 'undefined') {
  const handle = delayRender('load fonts');
  Promise.all(FACES.map(([name, url]) => new FontFace(name, `url(${url})`).load().then((f) => document.fonts.add(f))))
    .catch((e) => console.error(e))
    .finally(() => continueRender(handle));
}
