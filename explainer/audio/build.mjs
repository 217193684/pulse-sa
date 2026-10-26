// Background music (ducks under the voice) + sound effects for one explainer episode.
//   node explainer/audio/build.mjs explainer/episodes/<id>
// Music and sfx are synthesised in code (synth.mjs / bgm.mjs, MIT, from weilanx-claude-videos), so there is nothing to license.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildBgm} from './bgm.mjs';
import {SFX_NAMES, SR, encodeWav, renderSfx} from './synth.mjs';

const ep = process.argv[2];
const timing = JSON.parse(readFileSync(join(ep, 'timing.json'), 'utf8'));
// the mood of each scene type: tense while we look at the problem, lighter for the fixes
const MOOD = {hook: 'bright', title: 'bright', timeline: 'light', stats: 'light', suspects: 'tense', bars: 'tense', calendar: 'tense', compare: 'tense',
  court: 'groove', bankcheck: 'tense', verdict: 'break', checklist: 'groove', outro: 'bright', scenario: 'light', voices: 'tense', moneytrail: 'tense', howto: 'groove'};
const sections = [];
for (const s of timing.scenes) {
  const m = MOOD[s.type] || 'light';
  if (!sections.length || sections[sections.length - 1][1] !== m) sections.push([Math.max(0, s.start - 0.4), m]);
}
sections.push([timing.duration - 2.2, 'end']);
const pub = join(ep, 'public');
mkdirSync(join(pub, 'sfx'), {recursive: true});
buildBgm({voice: join(pub, 'voice.wav'), out: join(pub, 'bgm.wav'), sections, level: 0.05, depth: 0.75});
for (const name of SFX_NAMES) writeFileSync(join(pub, 'sfx', `${name}.wav`), encodeWav(renderSfx(name), SR));
console.log('sections', JSON.stringify(sections));
