import { h } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { BADGES } from '../progress/badges.js';
import { topBar } from './towns.js';
import { sfx } from '../audio/sfx.js';

export async function stickersScreen() {
  const s = save.get();
  const got = BADGES.filter(b => s.badges[b.id]).length;
  const cards = BADGES.map((b, i) => {
    const have = !!s.badges[b.id];
    const card = h('div.sticker-card' + (have ? '.have' : ''), { style: { animationDelay: `${i * 0.05}s` } },
      h('div.sticker', { style: { '--c': have ? b.color : '#cfd6dd' } }, h('span', {}, have ? b.icon : (b.secret ? '?' : b.icon))),
      h('h3', {}, have || !b.secret ? b.name : '???'),
      h('p', {}, have || !b.secret ? b.desc : 'あそんでいると 見つかるかも…'),
      b.reward ? h('div.reward-tag', {}, `🎁 ${b.reward}`) : null,
    );
    if (have) card.addEventListener('click', () => { sfx.play('badge'); card.querySelector('.sticker').animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-12deg) scale(1.15)' }, { transform: 'rotate(8deg)' }, { transform: 'none' }], { duration: 500 }); });
    return card;
  });
  const el = h('div.stickers-screen', {},
    topBar('シールちょう', { back: () => app.go('towns') }),
    h('div.sb-count', {}, `${got} / ${BADGES.length} まい`),
    h('div.sticker-grid', {}, ...cards),
  );
  return { el };
}
