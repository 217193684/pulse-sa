/**
 * Narration is written the way it's spoken ("three hundred and seventy rand") so the voice reads it right;
 * subtitles should show "R370". This turns spoken numbers back into digits for the caption only.
 */
const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};
const ORD: Record<string, [number, string]> = {
  first: [1, 'st'], second: [2, 'nd'], third: [3, 'rd'], fourth: [4, 'th'], fifth: [5, 'th'], sixth: [6, 'th'], seventh: [7, 'th'], eighth: [8, 'th'], ninth: [9, 'th'],
};
const BIG = new Set(['million', 'billion']);
const WORD = [...Object.keys(UNITS), ...Object.keys(TENS), 'hundred', 'thousand', 'million', 'billion'].join('|');
const RUN = new RegExp(`\\b(?:${WORD})\\b(?:(?:\\s+and)?\\s+(?:${WORD}|a half)\\b)*(?:\\s+(?:${Object.keys(ORD).join('|')})\\b)?`, 'gi');

function value(words: string[]): {n: number; scale: string; ord: string} {
  let total = 0, cur = 0, scale = '', ord = '', half = false, prevUnit = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (w === 'and') continue;
    if (w === 'a' && words[i + 1]?.toLowerCase() === 'half') { half = true; i++; continue; }
    if (w in UNITS) { cur += UNITS[w]; prevUnit = UNITS[w] < 10; continue; }
    if (w in TENS) {
      // "three seventy" (spoken R370): a lone digit followed by tens means hundreds
      if (prevUnit && cur < 10) cur *= 100;
      cur += TENS[w]; prevUnit = false; continue;
    }
    if (w in ORD) { cur += ORD[w][0]; ord = ORD[w][1]; continue; }
    if (w === 'hundred') { cur *= 100; prevUnit = false; continue; }
    if (w === 'thousand') { total += cur * 1000; cur = 0; continue; }
    if (BIG.has(w)) { total += cur + (half ? 0.5 : 0); cur = 0; half = false; scale = w; continue; }
  }
  return {n: total + cur, scale, ord};
}

export function captionText(text: string): string {
  return text.replace(RUN, (run, offset: number, all: string) => {
    const words = run.split(/\s+/);
    const {n, scale, ord} = value(words);
    const after = all.slice(offset + run.length);
    const rand = /^\s+rand\b/i.test(after);
    const small = n < 10 && !scale && !rand && !ord;
    if (small) return run; // "one", "three" read better as words
    const num = `${n}${ord}${scale ? ' ' + scale : ''}`;
    return rand ? `R${num}\u0000` : num;
  }).replace(/\u0000\s+rand\b/gi, '');
}
