import { h, btn } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { composeLook, previewCanvas, randomLook } from '../avatar/compositor.js';
import { iconBtn, ICONS, showQR, showSettings } from '../ui/hud.js';
import { MAPS } from '../data/maps.js';
import { sfx } from '../audio/sfx.js';

export async function titleScreen() {
  const s = save.get();
  const hero = previewCanvas(200, { dir: 3 });
  hero.setSheet(await composeLook(s.look));
  const walkers = h('div.title-walkers');
  // a few townspeople strolling across the bottom
  for (let i = 0; i < 4; i++) {
    const c = previewCanvas(110, { dir: i % 2 ? 1 : 3 });
    composeLook(randomLook(i * 0.21 + 0.13, { female: i % 2 === 0 })).then(sh => c.setSheet(sh));
    const w = h('div.walker' + (i % 2 ? '.rtl' : ''), { style: { animationDelay: `${-i * 4.2}s`, bottom: `${(i % 2) * 40 + 10}px` } }, c);
    walkers.append(w);
  }
  const letters = 'Hamanomachi'.split('').map((ch, i) => h('span', { style: { animationDelay: `${i * 0.06}s` } }, ch));
  const el = h('div.title-screen', {},
    h('div.title-bg', { style: { backgroundImage: `url(${MAPS[0]?.imageUrl})` } }),
    h('div.title-top', {}, iconBtn(ICONS.qr, 'QRコード', showQR), iconBtn(ICONS.gear, 'せってい', () => showSettings())),
    h('div.title-center', {},
      h('div.logo', {}, h('div.logo-pin', {}, '📍'), h('h1', {}, ...letters)),
      h('div.tagline', {}, 'みちあんない アドベンチャー'),
      h('div.hero-spot', {}, hero),
      btn('primary huge play-btn', h('span', {}, 'スタート！'), () => {
        sfx.unlock();
        sfx.play('run');
        if (!s.madeCharacter) app.go('wardrobe', { create: true });
        else app.go('towns');
      }),
    ),
    walkers,
  );
  return { el };
}
