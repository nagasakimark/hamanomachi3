import { h, btn, toast } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { TYPE_DEFAULTS, ITEMS, SLOTS, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, REQUIRED, itemById, colorItem } from '../avatar/items.js';
import { composeLook, previewCanvas, FRAME } from '../avatar/compositor.js';
import { BADGES, checkBadges } from '../progress/badges.js';
import { coinPill, showBadges } from '../ui/hud.js';
import { sfx } from '../audio/sfx.js';
import { petCanvas, loadPetImage, petById, petColorById, PET_COLORS } from '../pets/pets.js';

export async function wardrobeScreen({ create = false } = {}) {
  const s = save.get();
  const look = { ...s.look };
  let slot = create ? 'face' : 'hair';
  const coins = coinPill();
  const preview = previewCanvas(300, { dir: 2 });
  let dir = 2;
  const petEl = petCanvas(110);
  const petCap = h('div.pet-cap');
  const owned = id => save.owns(id);
  const petColor = () => petColorById(look.petColor || 'natural');
  const capText = () => { const p = petById(look.pet); const c = petColor(); petCap.textContent = p ? (c.id === 'natural' ? p.en : `${c.en} ${p.en}`) : ''; };
  const refresh = async () => { preview.setSheet(await composeLook(look)); petEl.setPet(look.pet, look.petColor || 'natural'); capText(); };
  // Colours the student already chose before colours cost coins stay free.
  for (const [k, v] of Object.entries(s.look)) {
    if (/Color2?$/.test(k) && k !== 'skinColor' && v > 0) { const id = colorItem(k === 'hairColor' ? 'hair' : 'cloth', v).id; if (!s.owned.includes(id)) s.owned.push(id); }
  }
  save.write();
  await refresh();

  const available = item => item.price === 0 && !item.badge && !item.gate || save.owns(item.id) || (item.badge && s.badges[item.badge]);
  // Things being tried on that still cost coins: items, hair/cloth colours, pet colour.
  const unpaid = () => {
    const out = SLOTS.map(sl => itemById(look[sl.id])).filter(it => it && !available(it));
    const seen = new Set();
    const addCol = (kind, key) => {
      const i = look[key] ?? 0, c = colorItem(kind, i);
      if (i > 0 && !seen.has(c.id) && !owned(c.id)) { seen.add(c.id); out.push({ ...c, name: kind === 'hair' ? 'かみのいろ' : 'ふくのいろ', revert: () => { look[key] = s.look[key] ?? 0; } }); }
    };
    for (const sl of SLOTS) {
      const it = itemById(look[sl.id]);
      if (it?.color === 'hair') addCol('hair', 'hairColor');
      else if (it?.color === 'cloth') { addCol('cloth', sl.id + 'Color'); if (it.color2) addCol('cloth', sl.id + 'Color2'); }
    }
    const pc = petColor();
    if (look.pet && pc.price) {
      const id = `pc-${look.pet.replace('pet-', '')}-${pc.id}`;
      if (!owned(id)) out.push({ id, slot: 'pet', name: `${pc.jp} (${pc.en})`, price: pc.price, revert: () => { look.petColor = s.look.petColor || 'natural'; } });
    }
    return out;
  };

  const tabs = h('div.w-tabs');
  const grid = h('div.w-grid');
  const swatches = h('div.w-swatches');
  const buyBar = h('div.buy-bar');

  function renderTabs() {
    tabs.replaceChildren(...SLOTS.map(sl => h('button.w-tab' + (sl.id === slot ? '.on' : ''), {
      onclick: () => { slot = sl.id; sfx.play('press'); renderAll(); },
    }, h('span.w-tab-icon', {}, sl.icon), sl.name)));
  }

  async function thumb(itemId) {
    const c = document.createElement('canvas'); c.width = FRAME; c.height = FRAME; c.className = 'w-thumb';
    if (slot === 'pet') { const p = petById(itemId); loadPetImage(itemId).then(im => im && c.getContext('2d').drawImage(im, 0, 2 * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME)); return c; }
    const l = { ...look, [slot]: itemId };
    composeLook(l).then(sheet => c.getContext('2d').drawImage(sheet, 0, 2 * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME));
    return c;
  }

  const SOURCE = { rally: 'スタンプラリー', craft: 'クラフト', powerup: 'パワーアップ' };
  const special = it => !!(it.gate || it.badge);

  async function renderGrid() {
    const items = ITEMS.filter(i => i.slot === slot && (!i.gate || save.owns(i.id)));
    const cards = [];
    if (!REQUIRED.has(slot)) {
      const none = h('button.w-item' + (!look[slot] ? '.on' : ''), { onclick: () => wear(null) }, h('div.w-none', {}, '✖'), h('div.w-name', {}, 'なし'));
      cards.push(none);
    }
    const card = async it => {
      const ok = available(it);
      const lockedBadge = it.badge && !s.badges[it.badge];
      const badge = it.badge && BADGES.find(b => b.id === it.badge);
      const tag = ok ? (it.price || it.badge ? h('div.w-tag.owned', {}, '✔') : null)
        : lockedBadge ? h('div.w-tag.badge', {}, badge.icon)
        : h('div.w-tag.price', {}, String(it.price), h('span.coin-icon.small'));
      const el = h('button.w-item' + (special(it) ? '.special' : '') + (look[slot] === it.id ? '.on' : '') + (lockedBadge ? '.badge-locked' : ''), {
        onclick: () => {
          if (lockedBadge) { sfx.play('error'); toast(`「${badge.name}」シールをゲットすると つかえるよ！`, 'warn'); return; }
          wear(it.id);
        },
      }, await thumb(it.id), h('div.w-name', {}, it.name), it.en ? h('div.w-en', {}, it.en) : null, tag, special(it) ? h('div.w-src', {}, SOURCE[it.gate] || 'シール') : null);
      return el;
    };
    // Special unlocks (town rewards, sticker rewards) come first under their own heading, then the shop.
    const spec = items.filter(special), shop = items.filter(i => !special(i));
    if (spec.length) cards.unshift(h('div.w-sub.special', {}, '★ とくべつ アイテム', h('small', {}, 'ミッションや まちで ゲットしたもの')), ...await Promise.all(spec.map(card)), h('div.w-sub', {}, 'ショップ'));
    for (const it of shop) cards.push(await card(it));
    grid.replaceChildren(...cards);
  }

  function renderSwatches() {
    let list = null, key = null, key2 = null;
    const it = itemById(look[slot]);
    if (slot === 'skin') { list = SKIN_TONES; key = 'skin'; }
    else if (it?.color === 'hair') { list = HAIR_COLORS; key = 'hairColor'; }
    else if (it?.color === 'cloth') { list = CLOTH_COLORS; key = slot + 'Color'; if (it.color2) key2 = slot + 'Color2'; }
    const kind = key === 'hairColor' ? 'hair' : 'cloth';
    const row = (k, label) => h('div.sw-row', {}, label ? h('span.sw-label', {}, label) : null, ...list.map((c, i) => {
      const paid = slot === 'skin' || owned(colorItem(kind, i).id) || !colorItem(kind, i).price;
      return h('button.swatch' + ((look[k] ?? 0) === i ? '.on' : '') + (paid ? '' : '.locked'), {
        style: { background: c },
        onclick: () => { look[k] = i; sfx.play('pick'); refresh(); renderAll(); },
      }, paid ? null : h('span.sw-price', {}, String(colorItem(kind, i).price)));
    }));
    if (slot === 'pet') {
      const pid = look.pet && look.pet.replace('pet-', '');
      swatches.replaceChildren(...(pid ? [h('div.sw-row.pet-colors', {}, ...PET_COLORS.map(c => {
        const own = !c.price || owned(`pc-${pid}-${c.id}`);
        return h('button.pcol' + ((look.petColor || 'natural') === c.id ? '.on' : ''), {
          onclick: () => { look.petColor = c.id; sfx.play('pick'); refresh(); renderAll(); },
        }, h('span.pcol-dot', { style: { background: c.dot } }), h('span.pcol-en', {}, c.en), h('span.pcol-jp', {}, c.jp), own ? (c.price ? h('span.pcol-own', {}, '✔') : null) : h('span.pcol-price', {}, String(c.price)));
      }))] : [h('div.sw-empty', {}, 'ペットをえらぶと いろもえらべるよ！')]));
      return;
    }
    swatches.replaceChildren(...(list ? [row(key, key2 ? 'いろ1' : null), key2 ? row(key2, 'いろ2') : null].filter(Boolean) : [h('div.sw-empty', {}, slot === 'face' ? '男の子か女の子をえらんでね！' : '')]));
  }

  function renderBuy() {
    const need = unpaid();
    if (!need.length) { buyBar.replaceChildren(); buyBar.classList.remove('show'); return; }
    const total = need.reduce((t, i) => t + i.price, 0);
    const canAfford = s.coins >= total;
    buyBar.classList.add('show');
    buyBar.replaceChildren(
      h('div.buy-text', {}, 'しちゃく中: ', h('b', {}, need.map(i => i.name).join('、'))),
      create ? h('div.buy-hint', {}, 'ミッションでコインをあつめて買おう！') :
        btn('primary buy' + (canAfford ? '' : '.poor'), [`${total} `, h('span.coin-icon.small'), ' で買う'], async () => {
          if (!canAfford) { sfx.play('error'); toast('コインがたりないよ。ミッションであつめよう！', 'warn'); return; }
          const before = s.coins;
          save.addCoins(-total);
          need.forEach(i => s.owned.push(i.id));
          s.look = { ...look };
          save.write();
          sfx.play('buy');
          coins.bump(before, s.coins);
          preview.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15) rotate(-4deg)' }, { transform: 'scale(1)' }], { duration: 500 });
          toast('ジャジャーン！✨');
          renderAll();
          const b = checkBadges();
          if (b.length) { await showBadges(b); coins.num.textContent = s.coins; }
        }),
    );
  }

  function wear(id) {
    if (slot === 'face' && id !== look.face) {
      // Swap boy/girl defaults, but only over the other type's defaults.
      const from = TYPE_DEFAULTS[look.face] || {}, to = TYPE_DEFAULTS[id] || {};
      for (const k of ['hair', 'bottom']) if (!look[k] || look[k] === from[k]) look[k] = to[k];
    }
    look[slot] = id;
    sfx.play('snap');
    refresh();
    renderAll();
    preview.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
  }

  function renderAll() { renderTabs(); renderGrid(); renderSwatches(); renderBuy(); }
  renderAll();

  const done = () => {
    // Anything not paid for goes back to what was worn before.
    for (const it of unpaid()) if (it.revert) it.revert(); else look[it.slot] = s.look[it.slot] && available(itemById(s.look[it.slot])) ? s.look[it.slot] : ITEMS.find(i => i.slot === it.slot && i.price === 0 && !i.badge && !i.gate)?.id || null;
    if (!REQUIRED.has('hat')) { /* optional slots may stay empty */ }
    s.look = { ...look };
    if (create) s.madeCharacter = true;
    save.write();
    sfx.play('run');
    app.go('towns');
  };

  const turnBtn = d => btn('icon turn', d < 0 ? '⟲' : '⟳', () => { dir = (dir + (d < 0 ? 3 : 1)) % 4; preview.setDir([0, 1, 2, 3][dir]); });

  const el = h('div.wardrobe-screen', {},
    h('div.topbar', {},
      h('h2.screen-title', {}, create ? 'キャラクターをつくろう！' : 'きせかえ・ショップ'),
      h('div.spacer'),
      coins,
      btn('primary done', create ? 'しゅっぱつ！▶' : 'できた ✔', done),
    ),
    h('div.w-body', {},
      h('div.w-left', {},
        h('div.w-stage', {}, h('div.w-spot'), preview, petEl, petCap),
        h('div.w-turns', {}, turnBtn(-1), turnBtn(1)),
        buyBar,
      ),
      h('div.w-right', {}, tabs, swatches, grid),
    ),
  );
  return { el };
}
