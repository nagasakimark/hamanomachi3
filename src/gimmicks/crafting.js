// Block world (Minecraft-style town): crafting materials may lie on the roads
// (you can see them before you run, so you can plan to walk that way). Collect
// them by winning, then use the crafting table to make helmets.
// map.json:  "gimmickData": { "spots": ["p3","p9",...], "chance": 0.15 }
import { h, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { itemById } from '../avatar/items.js';
import { composeLook, FRAME } from '../avatar/compositor.js';
import { sfx } from '../audio/sfx.js';
import { makePickups, freePoints, pxUrl, floatText } from './pickups.js';

export const MATERIALS = {
  wood: { name: 'げんぼく', en: 'wood', weight: 40, art: 'mc-wood' },
  stone: { name: 'まるいし', en: 'stone', weight: 30, art: 'mc-stone' },
  iron: { name: 'てつ', en: 'iron', weight: 15, art: 'mc-iron' },
  gold: { name: 'きん', en: 'gold', weight: 10, art: 'mc-gold' },
  diamond: { name: 'ダイヤ', en: 'diamond', weight: 5, art: 'mc-diamond' },
};
const matImg = (id, cls = 'mc-ico') => h('img.' + cls, { src: pxUrl(MATERIALS[id].art), alt: MATERIALS[id].name, draggable: false });

export const intro = {
  theme: 'crafting',
  icon: () => h('img.gi-px', { src: pxUrl('mc-table') }),
  title: 'ざいりょうを あつめて クラフト！',
  lines: [
    [() => matImg('wood', 'gi-li'), 'みちに ざいりょうが おちていることが あるよ。'],
    [() => matImg('iron', 'gi-li'), 'とおると ゲット！ スタートの まえに みちを えらぼう。'],
    [() => h('img.gi-li', { src: pxUrl('mc-table') }), 'クラフトだいで かぶとを つくろう！'],
  ],
};

// Helmet-shaped recipes, like the real thing. null = empty slot.
const W = 'wood', S = 'stone', I = 'iron', G = 'gold', D = 'diamond';
export const RECIPES = [
  { item: 'hat-craft-leather', grid: [[W, W, W], [S, null, S], [null, null, null]] },
  { item: 'hat-craft-iron', grid: [[I, I, I], [I, null, I], [null, null, null]] },
  { item: 'hat-craft-gold', grid: [[G, G, G], [G, null, G], [null, null, null]] },
  { item: 'hat-craft-diamond', grid: [[D, D, D], [D, null, D], [null, null, null]] },
];
const costOf = r => r.grid.flat().filter(Boolean).reduce((c, k) => (c[k] = (c[k] || 0) + 1, c), {});

function randomMaterial() {
  const total = Object.values(MATERIALS).reduce((t, m) => t + m.weight, 0);
  let r = Math.random() * total;
  for (const [id, m] of Object.entries(MATERIALS)) { if ((r -= m.weight) < 0) return id; }
  return 'wood';
}

// How likely a spot is to hold a material. Free play (endless random trips) uses a quarter of the story chance.
export const DEFAULT_CHANCE = 0.15, FREE_PLAY_FACTOR = 0.25;

export function session(map, mission, ctx = {}) {
  const d = map.gimmickData || {};
  const chance = (d.chance ?? DEFAULT_CHANCE) * (ctx.free ? FREE_PLAY_FACTOR : 1);
  let pk = null;
  return {
    mount(mv) {
      const spots = freePoints(map.graph, mission, d.spots);
      const list = spots.filter(() => Math.random() < chance).map(at => {
        const mat = randomMaterial();
        return {
          at, kind: mat, src: pxUrl(MATERIALS[mat].art), pixel: true, size: mat === 'wood' || mat === 'stone' ? 52 : 48, anim: mat === 'wood' || mat === 'stone' ? 'bob' : 'spin',
          collect: async (scene, s, { ring }) => {
            sfx.play('pop');
            ring.setVisible(false);
            floatText(scene, s.x, s.y - 10, '+1', { fontFamily: 'DotGothic16, monospace', fontStyle: 'normal', color: '#ffffff', stroke: '#3f3f3f', strokeThickness: 5, shadow: { offsetX: 3, offsetY: 3, color: '#3f3f3f', fill: true } });
            // sucked into the player, like picking up a dropped item
            await new Promise(r => scene.tweens.add({ targets: s, x: scene.player.x, y: scene.player.y - 30, scale: s.scaleY * 0.4, duration: 220, ease: 'Quad.in', onComplete: () => { s.setVisible(false); r(); } }));
          },
        };
      });
      pk = makePickups(mv, list);
    },
    debugItems: () => pk?.items || [],
    reset() { pk?.reset(); },
    async onNode(id, mv) { await pk?.onNode(id, mv); },
    async afterWin() {
      const got = pk?.collected() || [];
      if (!got.length) return;
      const inv = save.get().materials;
      for (const i of got) inv[i.kind] = (inv[i.kind] || 0) + 1;
      save.write();
      mcToast('ざいりょうを ゲット！', got.map(i => i.kind));
    },
    destroy() { pk?.destroy(); pk = null; },
  };
}

// Achievement-style toast (dark panel, yellow title) in the corner.
function mcToast(title, mats = [], icon) {
  const t = h('div.mc-toast', {},
    icon || h('div.mc-toast-icons', {}, ...mats.slice(0, 4).map(k => matImg(k))),
    h('div', {}, h('div.mc-toast-title', {}, title), h('div.mc-toast-sub', {}, mats.length ? mats.map(k => MATERIALS[k].name).join('・') : 'きせかえで つけてみよう')));
  document.getElementById('overlay').append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

export function missionsExtra() {
  return h('button.mc-btn.mc-open', { onclick: () => { sfx.play('press'); showBench(); } }, h('img.mc-ico', { src: pxUrl('mc-table') }), 'クラフトだい');
}

// Head-and-shoulders preview of the student wearing the helmet.
async function helmetPreview(itemId) {
  const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.className = 'mc-preview';
  const sheet = await composeLook({ ...save.get().look, hat: itemId });
  c.getContext('2d').drawImage(sheet, 12, 2 * FRAME + 4, 40, 40, 0, 0, 40, 40);
  return c;
}

export function showBench() {
  const s = save.get();
  let sel = RECIPES.find(r => !save.owns(r.item)) || RECIPES[0];
  const book = h('div.mc-book');
  const table = h('div.mc-table');
  const inv = h('div.mc-inv');
  const slot = (content, cls = '') => h('div.mc-slot' + cls, {}, content);
  const count = n => (n > 1 ? h('span.mc-count', {}, String(n)) : null);

  async function render() {
    const have = s.materials;
    const cost = costOf(sel);
    const can = Object.entries(cost).every(([k, n]) => (have[k] || 0) >= n);
    const owned = save.owns(sel.item);
    // recipe book: one button per helmet; red when you cannot make it yet
    book.replaceChildren(h('div.mc-label', {}, 'レシピ'), h('div.mc-bookgrid', {}, ...await Promise.all(RECIPES.map(async r => {
      const c = costOf(r), ok = Object.entries(c).every(([k, n]) => (have[k] || 0) >= n);
      return h('button.mc-slot.mc-recipe' + (r === sel ? '.on' : '') + (save.owns(r.item) ? '.owned' : ok ? '' : '.cant'), { onclick: () => { sel = r; sfx.play('blip'); render(); } }, await helmetPreview(r.item));
    }))));
    // the 3x3 grid shows the recipe; missing materials are see-through
    const used = {};
    const cells = sel.grid.flat().map(k => {
      if (!k) return slot(null);
      used[k] = (used[k] || 0) + 1;
      return slot(matImg(k), used[k] > (have[k] || 0) ? '.ghost' : '');
    });
    const it = itemById(sel.item);
    const result = h('button.mc-slot.mc-result' + (can && !owned ? '.ready' : ''), {
      onclick: async () => {
        if (owned) { sfx.play('error'); return; }
        if (!can) { sfx.play('error'); result.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 200); return; }
        for (const [k, n] of Object.entries(cost)) have[k] -= n;
        s.owned.push(sel.item); save.write();
        sfx.play('craft');
        mcToast('あたらしい アイテム！', [], await helmetPreview(sel.item));
        render();
      },
    }, await helmetPreview(sel.item));
    table.replaceChildren(
      h('div.mc-label', {}, 'クラフト'),
      h('div.mc-craftrow', {},
        h('div.mc-grid3', {}, ...cells),
        h('div.mc-arrow' + (can && !owned ? '.on' : '')),
        h('div.mc-resultwrap', {}, result, h('div.mc-itemname', {}, it?.name || ''),
          h('div.mc-hint', {}, owned ? '✔ もっている' : can ? 'クリックで つくる！' : 'ざいりょうが たりない')),
      ),
    );
    // inventory: what you have
    const mats = Object.keys(MATERIALS);
    inv.replaceChildren(h('div.mc-label', {}, 'もちもの'), h('div.mc-hotbar', {},
      ...mats.map(k => slot(have[k] ? [matImg(k), count(have[k])] : null, have[k] ? '' : '.empty')),
      ...Array.from({ length: 9 - mats.length }, () => slot(null, '.empty'))),
      h('div.mc-legend', {}, ...mats.map(k => h('span', {}, matImg(k), `${MATERIALS[k].name} ×${have[k] || 0}`))));
  }
  render();
  sfx.play('pick');
  const m = modal(h('div.mc-panel', {},
    h('div.mc-top', {}, book, table),
    inv,
    h('button.mc-btn.mc-done', { onclick: () => { sfx.play('press'); m.close(); } }, 'とじる'),
  ), { cls: 'mc-modal' });
}
