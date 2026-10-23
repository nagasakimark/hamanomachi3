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

export function showIntro(intro, { button = 'わかった！' } = {}) {
  return new Promise(res => {
    sfx.play('win');
    const m = modal(h('div.gi', {},
      h('div.gi-icon', {}, intro.icon),
      h('h2', {}, intro.title),
      h('ul.gi-lines', {}, ...intro.lines.map(([ic, t]) => h('li', {}, h('span.gi-i', {}, ic), h('span', {}, t)))),
      btn('primary', button, () => m.close()),
    ), { cls: 'gimmick-intro', onClose: () => res() });
  });
}

// One per mission. All hooks are optional and safe to call.
export function createSession(map, mission, ctx) {
  const gm = gimmickOf(map);
  if (!gm?.session) return null;
  return gm.session(map, mission, ctx);
}
