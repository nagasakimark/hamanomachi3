// Mushroom-Kingdom-style town: ? blocks give coins, and some roads are walled off
// with bricks so the shortest way changes. Closed roads are drawn before the run;
// the block budget for the stars is worked out for the new road map.
// map.json:  "gimmickData": { "qblocks": ["p3",...], "count": 3, "coins": 5, "closable": [["p1","p2"],...], "closed": 1 }
import { h } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { sfx } from '../audio/sfx.js';
import { chooseClosed, chooseClosedChains, autoChains, graphWithout } from './closure.js';
import { makePickups, pickRandom, freePoints, addArt, pxUrl, loadTex, floatText } from './pickups.js';

export const intro = {
  theme: 'blocks',
  icon: () => h('img.gi-px.gi-bump', { src: pxUrl('qblock') }),
  title: 'はてなブロックの まち',
  lines: [
    [() => h('img.gi-li', { src: pxUrl('qblock') }), 'はてなブロックの したを とおると コインが とびだすよ！'],
    [() => h('img.gi-li', { src: pxUrl('brick') }), 'レンガで とおれない みちが あるよ。よく みてね。'],
    [() => h('img.gi-li', { src: pxUrl('coin0') }), 'ちかみちが かわるよ。コインも ねらおう！'],
  ],
};

export function session(map, mission) {
  const d = map.gimmickData || {};
  let pk = null, walls = [];
  // Roads marked "can be closed" in the map editor are used if there are any; otherwise whole blocks
  // (the stretch between two corners) are closed automatically.
  const marked = (d.closable || []).filter(([a, b]) => map.roads.some(r => (r[0] === a && r[1] === b) || (r[0] === b && r[1] === a)));
  let closed, wallAt;
  if (marked.length) { closed = chooseClosed(map, mission, marked, d.closed ?? 1); wallAt = closed; }
  else { const r = chooseClosedChains(map, mission, autoChains(map), d.closed ?? 1); closed = r.edges; wallAt = r.mids; }
  const graph = closed.length ? graphWithout(map, closed) : map.graph;
  const value = d.coins ?? 5;
  return {
    graph,           // the town as it is for this mission (play.js uses it for the solver and the walk)
    closed,
    mount(mv) {
      const sc = mv.scene, g = map.graph;
      // a little brick wall across each closed road
      walls = wallAt.flatMap(([a, b]) => {
        const pa = g.point(a), pb = g.point(b);
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) + Math.PI / 2;
        return [-1, 0, 1].map(k => addArt(sc, pxUrl('brick'), mx + Math.cos(ang) * k * 30, my + Math.sin(ang) * k * 30 - 6, 32, 6 + k * 0.01, true));
      });
      const spots = freePoints(map.graph, mission, d.qblocks);
      const coinFrames = [0, 1, 2, 3].map(i => pxUrl('coin' + i));
      coinFrames.forEach(u => loadTex(sc, u, true));
      loadTex(sc, pxUrl('qblock-used'), true);
      pk = makePickups(mv, pickRandom(spots, d.count ?? 3).map(at => ({
        at, kind: 'q', value, src: [pxUrl('qblock'), pxUrl('qblock'), pxUrl('qblock2')], frameMs: 260, pixel: true, size: 40, anim: 'still',
        onReset: (scene, s) => s.setTexture('tx:' + pxUrl('qblock')),
        collect: async (scene, s, { rec }) => {
          // bonk! the block jumps, turns into an empty block, and a coin spins out
          sfx.play('bonk');
          s.setTexture('tx:' + pxUrl('qblock-used'));
          scene.tweens.add({ targets: s, y: s.y - 14, duration: 90, yoyo: true, ease: 'Quad.out' });
          const coin = scene.add.image(s.x, s.y - 10, 'tx:' + coinFrames[0]).setDepth(6).setScale(2.6);
          let f = 0;
          const spin = scene.time.addEvent({ delay: 60, loop: true, callback: () => { f = (f + 1) % 4; if (scene.textures.exists('tx:' + coinFrames[f])) coin.setTexture('tx:' + coinFrames[f]); } });
          sfx.play('coin');
          scene.tweens.add({ targets: coin, y: s.y - 90, duration: 260, ease: 'Quad.out', yoyo: true, hold: 40, onComplete: () => { spin.remove(); coin.destroy(); } });
          floatText(scene, s.x, s.y - 60, `+${value}`, { delay: 200 });
          (rec.extra ||= []).push(coin);
        },
      })));
    },
    debugItems: () => pk?.items || [],
    reset() { pk?.reset(); },
    async onNode(id, mv) { await pk?.onNode(id, mv); },
    async afterWin({ coins }) {
      const got = pk?.collected() || [];
      if (!got.length) return;
      const total = got.reduce((t, i) => t + i.value, 0);
      const s = save.get();
      save.addCoins(total); save.write();
      coins?.bump(s.coins - total, s.coins);
      platToast(got.length, total);
    },
    destroy() { pk?.destroy(); pk = null; walls.forEach(x => x.destroy()); walls = []; },
  };
}

function platToast(n, total) {
  const t = h('div.pf-toast', {}, h('img', { src: pxUrl('coin0') }), h('span', {}, `× ${n}`), h('b', {}, `+${total}`));
  document.getElementById('overlay').append(t);
  setTimeout(() => t.classList.add('out'), 2200);
  setTimeout(() => t.remove(), 2700);
}
