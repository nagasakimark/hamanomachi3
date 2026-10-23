// Mushroom Kingdom: ? blocks give coins, and some roads may be closed so the
// shortest way changes. Closed roads are drawn before the run; the block budget for
// the stars is worked out for the new road map.
// map.json:  "gimmickData": { "qblocks": ["p3",...], "count": 3, "coins": 5, "closable": [["p1","p2"],...], "closed": 1 }
import { toast } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { chooseClosed, graphWithout } from './closure.js';
import { makePickups, pickRandom, freePoints, addArt } from './pickups.js';

export const intro = {
  icon: '❓',
  title: 'はてなブロック',
  lines: [
    ['❓', 'はてなブロックを とおると コインが もらえるよ！'],
    ['🚧', 'とおれない みちが あるよ。みてから えらんでね。'],
    ['🧭', 'ちかみちが かわるよ。'],
  ],
};

export function session(map, mission) {
  const d = map.gimmickData || {};
  let pk = null, signs = [];
  const closed = chooseClosed(map, mission, (d.closable || []).filter(([a, b]) => map.roads.some(r => (r[0] === a && r[1] === b) || (r[0] === b && r[1] === a))), d.closed ?? 1);
  const graph = closed.length ? graphWithout(map, closed) : map.graph;
  return {
    graph,           // the town as it is for this mission (play.js uses it for the solver and the walk)
    closed,
    mount(mv) {
      const sc = mv.scene, g = map.graph;
      signs = closed.map(([a, b]) => {
        const pa = g.point(a), pb = g.point(b);
        return addArt(sc, 'roadsign', (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 8, 70);
      });
      const spots = freePoints(map.graph, mission, d.qblocks);
      pk = makePickups(mv, pickRandom(spots, d.count ?? 3).map(at => ({ at, emoji: '❓', img: 'qblock', kind: 'q', value: d.coins ?? 5, label: `+${d.coins ?? 5}` })));
    },
    reset() { pk?.reset(); },
    async onNode(id, mv) { await pk?.onNode(id, mv); },
    async afterWin({ coins }) {
      const got = pk?.collected() || [];
      if (!got.length) return;
      const total = got.reduce((t, i) => t + i.value, 0);
      const s = save.get();
      save.addCoins(total); save.write();
      coins?.bump(s.coins - total, s.coins);
      toast(`❓ ブロック ${got.length}こ！ コイン +${total}`);
    },
    destroy() { pk?.destroy(); pk = null; signs.forEach(x => x.destroy()); signs = []; },
  };
}
