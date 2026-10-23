// Sunken treasure (Sandy Shores): chests sit on some corners. Walk over them for
// extra coins, but a detour costs blocks, so it is a trade-off against the stars.
// map.json:  "gimmickData": { "chests": ["p3","p9",...], "count": 3, "coins": 15 }
import { toast } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { makePickups, pickRandom, freePoints } from './pickups.js';

export const intro = {
  icon: '🪙',
  title: 'しずんだ たからばこ',
  lines: [
    ['🧰', 'みちの ちゅうに たからばこが あるよ。'],
    ['🪙', 'とおると コインが もらえるよ！'],
    ['⭐', 'まわりみちを すると ブロックが ふえるよ。きをつけて！'],
  ],
};

export function session(map, mission) {
  const d = map.gimmickData || {};
  let pk = null;
  return {
    mount(mv) {
      const spots = freePoints(map.graph, mission, d.chests);
      const list = pickRandom(spots, d.count ?? 3).map(at => ({ at, emoji: '🧰', img: 'chest', kind: 'chest', value: d.coins ?? 15, label: `+${d.coins ?? 15}` }));
      pk = makePickups(mv, list);
    },
    reset() { pk?.reset(); },
    async onNode(id, mv) { await pk?.onNode(id, mv); },
    async afterWin({ coins }) {
      const got = pk?.collected() || [];
      if (!got.length) return;
      const total = got.reduce((t, i) => t + i.value, 0);
      const s = save.get();
      s.chests[map.id] = (s.chests[map.id] || 0) + got.length;
      save.addCoins(total); save.write();
      coins?.bump(s.coins - total, s.coins);
      toast(`🧰 たからばこ ${got.length}こ！ コイン +${total}`);
    },
    destroy() { pk?.destroy(); pk = null; },
  };
}
