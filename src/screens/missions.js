import { h, btn } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { mapById } from '../data/maps.js';
import { TIERS } from '../engine/missions.js';
import { topBar } from './towns.js';
import { sfx } from '../audio/sfx.js';

// Stars needed in this town to open each tier.
export const TIER_UNLOCK = { 1: 0, 2: 12, 3: 27, 4: 42 };

export function tierOpen(map, tier) {
  if (map.isTest) return true;
  return save.mapStars(map.id) >= TIER_UNLOCK[tier];
}

export async function missionsScreen({ mapId }) {
  const map = mapById(mapId);
  const got = save.mapStars(map.id);
  const g = map.graph;
  const rows = TIERS.map(t => {
    const list = map.missions.filter(m => m.tier === t.id);
    if (!list.length) return null;
    const open = tierOpen(map, t.id);
    const tiles = list.map((m, i) => {
      const stars = save.starsFor(map.id, m.id);
      const dest = g.point(m.destination);
      const showName = t.hint !== 'none';
      const tile = h('button.mission' + (open ? '' : '.locked') + (stars ? '.done' : ''), { style: { animationDelay: `${i * 0.04}s` } },
        h('div.m-num', {}, String(i + 1)),
        h('div.m-name', {}, showName ? dest.name : '🔊 ?'),
        h('div.m-stars', {}, [1, 2, 3].map(k => h('span' + (k <= stars ? '.on' : ''), {}, '★'))),
      );
      tile.addEventListener('click', () => {
        if (!open) { sfx.play('error'); tile.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 200 }); return; }
        sfx.play('press');
        app.go('play', { mapId: map.id, missionId: m.id });
      });
      return tile;
    });
    return h('div.tier' + (open ? '' : '.locked'), {},
      h('div.tier-head', {},
        h('div.tier-badge.t' + t.id, {}, String(t.id)),
        h('div', {}, h('h3', {}, t.ja), h('div.tier-desc', {}, open ? t.jaDesc : `${map.name} で ★${TIER_UNLOCK[t.id]} あつめると ひらくよ`)),
        !open ? h('div.tier-lock', {}, '🔒') : null,
      ),
      h('div.tier-tiles', {}, ...tiles),
    );
  });
  const el = h('div.missions-screen', {},
    topBar(map.name, { back: () => app.go(map.isTest ? 'title' : 'towns') }),
    h('div.missions-body', {},
      h('div.town-banner', { style: { backgroundImage: `url(${map.imageUrl})` } },
        h('div.banner-inner', {}, h('div.banner-stars', {}, `★ ${got} / ${map.missions.length * 3}`),
          btn('secondary free-btn', ['🚶 フリープレイ', h('small', {}, 'いちばん むずかしい！')], () => app.go('play', { mapId: map.id, free: true })),
        )),
      h('div.tiers', {}, ...rows.filter(Boolean)),
    ),
  );
  return { el };
}
