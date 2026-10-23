// Minecraft: crafting materials may lie on the roads (you can see them before you
// run, so you can plan to walk that way). Collect them by winning, then use the
// crafting bench to make special hats.
// map.json:  "gimmickData": { "spots": ["p3","p9",...], "chance": 0.4 }
import { h, btn, modal, toast } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { itemById } from '../avatar/items.js';
import { sfx } from '../audio/sfx.js';
import { makePickups, freePoints, artUrl } from './pickups.js';

export const intro = {
  icon: '⛏️',
  title: 'ざいりょうを あつめよう',
  lines: [
    ['🪵', 'みちに ざいりょうが おちていることが あるよ。'],
    ['👣', 'とおると ゲット！ みてから みちを えらぼう。'],
    ['🛠️', 'クラフトだいで とくべつな ぼうしを つくろう！'],
  ],
};

export const MATERIALS = {
  wood: { emoji: '🪵', name: 'き', weight: 40 },
  stone: { emoji: '🪨', name: 'いし', weight: 30 },
  iron: { emoji: '⛓️', name: 'てつ', weight: 15 },
  gold: { emoji: '🥇', name: 'きん', weight: 10 },
  diamond: { emoji: '💎', name: 'ダイヤ', weight: 5 },
};

// Hats are placeholders that reuse existing sprites until real crafted art is added.
export const RECIPES = [
  { item: 'hat-craft-cap', cost: { wood: 3, stone: 2 } },
  { item: 'hat-craft-hood', cost: { iron: 3, stone: 2 } },
  { item: 'hat-craft-bonnie', cost: { gold: 3, wood: 2 } },
  { item: 'hat-craft-horns', cost: { diamond: 2, iron: 2 } },
];

function randomMaterial() {
  const total = Object.values(MATERIALS).reduce((t, m) => t + m.weight, 0);
  let r = Math.random() * total;
  for (const [id, m] of Object.entries(MATERIALS)) { if ((r -= m.weight) < 0) return id; }
  return 'wood';
}

export function session(map, mission) {
  const d = map.gimmickData || {};
  let pk = null;
  return {
    mount(mv) {
      const spots = freePoints(map.graph, mission, d.spots);
      const list = spots.filter(() => Math.random() < (d.chance ?? 0.4)).map(at => {
        const mat = randomMaterial();
        return { at, emoji: MATERIALS[mat].emoji, img: 'mat-' + mat, kind: mat, label: MATERIALS[mat].emoji };
      });
      pk = makePickups(mv, list);
    },
    reset() { pk?.reset(); },
    async onNode(id, mv) { await pk?.onNode(id, mv); },
    async afterWin() {
      const got = pk?.collected() || [];
      if (!got.length) return;
      const inv = save.get().materials;
      for (const i of got) inv[i.kind] = (inv[i.kind] || 0) + 1;
      save.write();
      toast(`ゲット！ ${got.map(i => MATERIALS[i.kind].emoji).join(' ')}`);
    },
    destroy() { pk?.destroy(); pk = null; },
  };
}

export function missionsExtra(map) {
  return btn('secondary free-btn extra-btn', [h('img.bench-ico', { src: artUrl('bench'), alt: '' }), 'クラフトだい'], () => showBench());
}

export function showBench() {
  const s = save.get();
  const body = h('div.bench');
  const render = () => {
    const inv = s.materials;
    body.replaceChildren(
      h('div.bench-inv', {}, ...Object.entries(MATERIALS).map(([id, m]) => h('div.mat', {}, h('img.mat-e', { src: artUrl('mat-' + id), alt: '' }), h('span.mat-n', {}, m.name), h('b', {}, `×${inv[id] || 0}`)))),
      h('div.bench-list', {}, ...RECIPES.map(r => {
        const it = itemById(r.item);
        const owned = save.owns(r.item);
        const can = Object.entries(r.cost).every(([k, n]) => (inv[k] || 0) >= n);
        return h('div.recipe' + (owned ? '.owned' : ''), {},
          h('div.r-name', {}, it?.name || r.item),
          h('div.r-cost', {}, ...Object.entries(r.cost).map(([k, n]) => h('span' + ((inv[k] || 0) >= n ? '.ok' : '.no'), {}, h('img.mat-s', { src: artUrl('mat-' + k), alt: '' }), `×${n}`))),
          owned ? h('div.r-have', {}, '✔ もっている') : btn('primary small' + (can ? '' : ' poor'), 'つくる', () => {
            if (!can) { sfx.play('error'); toast('ざいりょうが たりないよ', 'warn'); return; }
            for (const [k, n] of Object.entries(r.cost)) inv[k] -= n;
            s.owned.push(r.item); save.write();
            sfx.play('buy'); toast(`${it.name} を つくった！ きせかえで つけよう`);
            render();
          }));
      })),
    );
  };
  render();
  const m = modal(h('div.stamp-card', {}, h('h2', {}, h('img.bench-ico', { src: artUrl('bench'), alt: '' }), ' クラフトだい'), body, btn('primary', 'とじる', () => m.close())), { cls: 'gimmick-intro' });
}
