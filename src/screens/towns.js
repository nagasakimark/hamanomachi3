import { h, btn } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { MAPS } from '../data/maps.js';
import { coinPill, iconBtn, ICONS, showQR, showSettings, starPill } from '../ui/hud.js';
import { composeLook, previewCanvas } from '../avatar/compositor.js';
import { sfx } from '../audio/sfx.js';

export function topBar(title, { back, extra = [] } = {}) {
  return h('div.topbar', {},
    back ? iconBtn(ICONS.back, 'もどる', back, 'back') : null,
    h('h2.screen-title', {}, title),
    h('div.spacer'),
    ...extra,
    starPill(save.totalStars()),
    coinPill(),
    iconBtn(ICONS.qr, 'QRコード', showQR),
    iconBtn(ICONS.gear, 'せってい', () => showSettings()),
  );
}

export async function townsScreen() {
  const total = save.totalStars();
  const me = previewCanvas(260, { dir: 2 });
  composeLook(save.get().look).then(s => me.setSheet(s));
  let dir = 2;
  // turn around every few seconds so you can see your whole outfit
  const turner = setInterval(() => { dir = [2, 3, 0, 1][([2, 3, 0, 1].indexOf(dir) + 1) % 4]; me.setDir(dir); }, 2200);

  const cards = MAPS.map((m, i) => {
    const locked = !m.isTest && total < (m.unlockStars || 0);
    const got = save.mapStars(m.id), max = m.missions.length * 3;
    const card = h('div.town-card' + (locked ? '.locked' : ''), { style: { animationDelay: `${i * 0.08}s` } },
      h('div.town-img', { style: { backgroundImage: `url(${m.thumbUrl})` } }, locked ? h('div.lock', {}, '🔒', h('span', {}, `★ ${m.unlockStars}`)) : null),
      h('div.town-info', {},
        h('h3', {}, m.name),
        m.subtitle ? h('div.sub', {}, m.subtitle) : null,
        h('div.progress', {}, h('div.bar', { style: { width: `${max ? (got / max) * 100 : 0}%` } })),
        h('div.count', {}, `★ ${got} / ${max}`),
      ),
    );
    card.addEventListener('click', () => {
      if (locked) { sfx.play('error'); card.animate([{ transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }, { transform: 'none' }], { duration: 250 }); return; }
      sfx.play('press');
      app.go('missions', { mapId: m.id });
    });
    return card;
  });
  // Placeholder cards so the screen hints that more towns are coming.
  while (cards.length < 2) cards.push(h('div.town-card.soon', {}, h('div.town-img'), h('div.town-info', {}, h('h3', {}, 'もうすぐ！'), h('div.sub', {}, '新しい町'))));

  const el = h('div.towns-screen', {},
    topBar('町をえらぼう', { back: () => app.go('title') }),
    h('div.towns-body', {},
      h('div.me-panel', {},
        h('div.me-stage', {}, h('div.w-spot'), me),
        btn('dock wardrobe', [h('span.dock-icon', { html: ICONS.shirt }), 'きせかえ・ショップ'], () => app.go('wardrobe')),
        btn('dock stickers', [h('span.dock-icon', { html: ICONS.sticker }), 'シールちょう'], () => app.go('stickers')),
      ),
      h('div.towns-row', {}, ...cards),
    ),
  );
  return { el, destroy() { clearInterval(turner); } };
}
