// Mushroom Kingdom power-ups: stored in the save, used to defeat monsters that block roads,
// and counted toward hat unlocks. Also the little on-screen counter and the unlock book.
import { h, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { itemById } from '../avatar/items.js';
import { composeLook, FRAME } from '../avatar/compositor.js';
import { sfx } from '../audio/sfx.js';
import { pxUrl } from './pickups.js';

export const KINDS = {
  mushroom: { name: 'スーパーキノコ', art: 'pw-mushroom', weight: 55 },
  flower: { name: 'ファイアフラワー', art: 'pw-flower', weight: 30 },
  star: { name: 'スター', art: 'pw-star', weight: 15 },
};
export const ORDER = ['mushroom', 'flower', 'star'];   // the order they are spent in (rarest last)

export const UNLOCKS = [
  { item: 'hat-pw-mushroom', text: 'スーパーキノコを 3こ あつめる', have: s => s.powerCollected.mushroom, need: 3 },
  { item: 'hat-pw-flower', text: 'ファイアフラワーを 3こ あつめる', have: s => s.powerCollected.flower, need: 3 },
  { item: 'hat-pw-star', text: 'スターを 2こ あつめる', have: s => s.powerCollected.star, need: 2 },
  { item: 'hat-pw-crown', text: 'モンスターを 10ひき たおす', have: s => s.foesDefeated, need: 10 },
];

export const icon = (k, cls = 'pw-ico') => h('img.' + cls, { src: pxUrl(KINDS[k].art), alt: KINDS[k].name, draggable: false });

export function pickKind() {
  let r = Math.random() * ORDER.reduce((t, k) => t + KINDS[k].weight, 0);
  for (const k of ORDER) if ((r -= KINDS[k].weight) < 0) return k;
  return 'mushroom';
}

export const stored = () => save.get().powerups;
export const totalOf = counts => ORDER.reduce((t, k) => t + (counts[k] || 0), 0);
// The kind spent first: the most common one.
export const nextKind = counts => ORDER.find(k => (counts[k] || 0) > 0) || null;

// Give any hats the student has now earned. Returns the item ids that are new.
export function grantUnlocks() {
  const s = save.get(), got = [];
  for (const u of UNLOCKS) if (u.have(s) >= u.need && !s.owned.includes(u.item)) { s.owned.push(u.item); got.push(u.item); }
  if (got.length) save.write();
  return got;
}

async function hatPreview(itemId) {
  const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.className = 'pw-preview';
  try {
    const sheet = await composeLook({ ...save.get().look, hat: itemId });
    c.getContext('2d').drawImage(sheet, 12, 2 * FRAME + 4, 40, 40, 0, 0, 40, 40);
  } catch (e) { /* preview is optional */ }
  return c;
}

// Counter shown on the map while playing. counts() is read on every update().
export function mountHud(parent, counts) {
  const cells = {};
  const el = h('div.pw-hud', {}, ...ORDER.map(k => {
    const n = h('b', {}, '0');
    cells[k] = { n, box: h('div.pw-cell', {}, icon(k), h('span', {}, '×'), n) };
    return cells[k].box;
  }));
  parent.append(el);
  let last = {};
  return {
    el,
    update() {
      const c = counts();
      for (const k of ORDER) {
        const v = c[k] || 0;
        cells[k].n.textContent = String(v);
        cells[k].box.classList.toggle('zero', v === 0);
        if (last[k] !== undefined && v !== last[k]) { cells[k].box.classList.remove('pop'); void cells[k].box.offsetWidth; cells[k].box.classList.add('pop'); }
      }
      last = { ...c };
    },
    destroy() { el.remove(); },
  };
}

export function toastHat(itemId, preview) {
  const it = itemById(itemId);
  const t = h('div.pf-toast.pw-unlock', {}, preview, h('span', {}, 'あたらしい ぼうし！'), h('b', {}, it?.name || ''));
  document.getElementById('overlay').append(t);
  sfx.play('win');
  setTimeout(() => t.classList.add('out'), 3000);
  setTimeout(() => t.remove(), 3500);
}
export async function announceUnlocks(ids) {
  for (const id of ids) { toastHat(id, await hatPreview(id)); await new Promise(r => setTimeout(r, 1800)); }
}

export function missionsExtra() {
  return h('button.pw-open', { onclick: () => { sfx.play('press'); showBook(); } }, icon('star'), 'パワーアップブック');
}

export async function showBook() {
  const s = save.get();
  const rows = await Promise.all(UNLOCKS.map(async u => {
    const have = Math.min(u.have(s), u.need), done = s.owned.includes(u.item);
    return h('div.pw-row' + (done ? '.done' : ''), {},
      h('div.pw-prev', {}, await hatPreview(u.item)),
      h('div.pw-info', {}, h('b', {}, itemById(u.item)?.name || ''), h('div', {}, u.text),
        h('div.pw-bar', {}, h('i', { style: { width: (have / u.need * 100) + '%' } })), h('small', {}, done ? '✔ もっている' : `${have} / ${u.need}`)));
  }));
  const m = modal(h('div.pw-book', {},
    h('h2', {}, 'パワーアップブック'),
    h('div.pw-stock', {}, ...ORDER.map(k => h('div.pw-cell' + (s.powerups[k] ? '' : '.zero'), {}, icon(k, 'pw-ico big'), h('div', {}, KINDS[k].name), h('b', {}, '× ' + (s.powerups[k] || 0))))),
    h('p.pw-tip', {}, 'パワーアップは とっておけるよ。みちを ふさぐ モンスターを たおして すすめる！'),
    h('div.pw-rows', {}, ...rows),
    h('button.pw-close', { onclick: () => { sfx.play('press'); m.close(); } }, 'とじる')), { cls: 'pw-modal' });
}
