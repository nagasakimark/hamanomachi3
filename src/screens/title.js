import { h, btn } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { composeLook, previewCanvas, randomLook } from '../avatar/compositor.js';
import { iconBtn, ICONS, showQR, showSettings } from '../ui/hud.js';
import { MAPS } from '../data/maps.js';
import { sfx } from '../audio/sfx.js';

export const GAME_NAME = 'Map Quest';

export async function titleScreen() {
  const s = save.get();
  const hero = previewCanvas(250, { dir: 2 });
  hero.setSheet(await composeLook(s.look));

  // townspeople strolling along the grass
  const walkers = h('div.title-walkers');
  for (let i = 0; i < 5; i++) {
    const c = previewCanvas(100, { dir: i % 2 ? 1 : 3 });
    composeLook(randomLook(i * 0.21 + 0.13, { female: i % 2 === 0 })).then(sh => c.setSheet(sh));
    walkers.append(h('div.walker' + (i % 2 ? '.rtl' : ''), { style: { animationDelay: `${-i * 3.6}s`, bottom: `${(i % 3) * 22 + 6}px` } }, c));
  }

  // the towns hang around the logo like photos pinned to an adventure board
  const towns = MAPS.filter(m => !m.isTest).slice(0, 6);
  const spots = [[2, 7, -8], [1, 38, 6], [3, 66, -5], [84, 9, 7], [86, 40, -6], [83, 68, 5]];
  const photos = towns.map((m, i) => {
    const [x, y, r] = spots[i];
    return h('div.t-photo', { style: { left: x + '%', top: y + '%', '--r': r + 'deg', animationDelay: `${-i * 0.7}s` } },
      h('div.t-img', { style: { backgroundImage: `url(${m.thumbUrl})` } }), h('span', {}, m.name));
  });

  const word = (t, cls) => h('div.lg-word.' + cls, {}, ...t.split('').map((ch, i) => h('span', { style: { animationDelay: `${i * 0.08}s` } }, ch)));
  const sparkle = (l, t, d) => h('i.spark', { style: { left: l + '%', top: t + '%', animationDelay: d + 's' } }, '✦');

  const go = () => {
    sfx.unlock(); sfx.play('run');
    if (!s.madeCharacter) app.go('wardrobe', { create: true });
    else app.go('towns');
  };

  const el = h('div.title-screen', {},
    h('div.t-rays'),
    h('div.t-sun'),
    h('div.t-cloud.c1'), h('div.t-cloud.c2'), h('div.t-cloud.c3'),
    ...photos,
    sparkle(30, 12, 0), sparkle(66, 18, .8), sparkle(24, 52, 1.5), sparkle(74, 58, .4), sparkle(50, 8, 1.1),
    h('div.title-top', {}, iconBtn(ICONS.qr, 'QRコード', showQR), iconBtn(ICONS.gear, 'せってい', () => showSettings())),
    h('div.title-center', {},
      h('div.logo', {},
        h('div.logo-pin', {}, h('i'), h('b', {}, '★')),
        h('div.logo-words', {}, word('Map', 'a'), word('Quest', 'b')),
      ),
      h('div.tagline', {}, 'みちあんない ぼうけん！'),
      h('div.hero-spot', {}, hero, h('div.hero-shadow')),
      btn('primary huge play-btn', [h('span.play-tri', {}, '▶'), h('span', {}, 'スタート！')], go),
    ),
    h('div.t-hills', {}, h('i.h1'), h('i.h2'), h('i.h3')),
    walkers,
  );
  return { el };
}
