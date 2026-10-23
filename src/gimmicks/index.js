// Map gimmicks: a small extra rule or reward that gives a town its own flavour.
// A map turns one on with  "gimmick": "stamps" | "treasure" | "crafting" | "blocks" | "monsters"  in map.json.
// The Hamanomachi map has none, so nothing here runs for it.
import { h, btn, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { MAPS } from '../data/maps.js';
import { sfx } from '../audio/sfx.js';
import * as stamps from './stamps.js';
import * as treasure from './treasure.js';
import * as crafting from './crafting.js';
import * as blocks from './blocks.js';
import * as monsters from './monsters.js';
import './monsters.css';
import './gimmicks.css';

export const GIMMICKS = { stamps, treasure, crafting, blocks, monsters };

export const gimmickOf = map => (map && GIMMICKS[map.gimmick]) || null;

// Wild monsters only appear on a town whose gimmick is "monsters" (the Pokémon town).
// The monster dex button shows once such a town exists.
export const monstersActive = () => MAPS.some(m => !m.isTest && m.gimmick === 'monsters');

// The short "how this town works" popup, shown the first time a town is opened.
export function maybeShowIntro(map) {
  const gm = gimmickOf(map);
  if (!gm || map.isTest) return Promise.resolve();
  const s = save.get(), key = 'gimmick:' + map.id;
  if (s.seen[key]) return Promise.resolve();
  s.seen[key] = true; save.write();
  return showIntro(gm.intro);
}

// Each town's intro is dressed in its own world's style (see gimmicks.css).
const ART = { treasure: 'treasure', stamps: 'stamps', crafting: 'crafting', blocks: 'blocks', monsters: 'monsters' };
const el = x => (typeof x === 'function' ? x(h) : x);
export function showIntro(intro, { button = 'わかった！' } = {}) {
  return new Promise(res => {
    sfx.play(intro.theme === 'monsters' ? 'encounter' : intro.theme === 'stamps' ? 'stamp' : intro.theme === 'treasure' ? 'chest' : intro.theme === 'blocks' ? 'coin' : 'win');
    const theme = ART[intro.theme] || 'plain';
    const deco = theme === 'treasure' ? Array.from({ length: 10 }, (_, i) => h('i.gi-bub', { style: { left: `${5 + i * 9.5}%`, animationDelay: `${(i * 0.37) % 2.4}s`, '--s': `${10 + (i * 7) % 18}px` } }))
      : theme === 'blocks' ? [h('div.gi-cloud.c1'), h('div.gi-cloud.c2'), h('div.gi-ground')]
      : theme === 'stamps' ? [h('div.gi-bow.l', {}, '🎀'), h('div.gi-bow.r', {}, '🎀')]
      : [];
    const m = modal(h('div.gi.gi-' + theme, {},
      ...deco,
      h('div.gi-icon', {}, el(intro.icon)),
      h('h2.gi-title', {}, intro.title),
      h('ul.gi-lines', {}, ...intro.lines.map(([ic, t]) => h('li', {}, h('span.gi-i', {}, el(ic)), h('span.gi-t', {}, t)))),
      h('button.gi-btn', { onclick: () => { sfx.play('press'); m.close(); } }, button),
    ), { cls: 'gi-modal gi-m-' + theme, onClose: () => res() });
  });
}

// One per mission. All hooks are optional and safe to call.
export function createSession(map, mission, ctx) {
  const gm = gimmickOf(map);
  if (!gm?.session) return null;
  return gm.session(map, mission, ctx);
}
