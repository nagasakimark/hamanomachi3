// Sunken treasure (undersea town): chests sit on some corners. Walk over them for
// extra coins, but a detour costs blocks, so it is a trade-off against the stars.
// map.json:  "gimmickData": { "chests": ["p3","p9",...], "count": 3, "coins": 15 }
import { h } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { sfx } from '../audio/sfx.js';
import { makePickups, pickRandom, freePoints, svgUrl, loadTex, floatText } from './pickups.js';

export const intro = {
  theme: 'treasure',
  icon: () => h('img.gi-svg', { src: svgUrl('chest-closed') }),
  title: 'しずんだ たからばこ',
  lines: [
    [() => h('img.gi-li', { src: svgUrl('chest-closed') }), 'うみの まちの みちに たからばこが しずんでいるよ。'],
    [() => h('img.gi-li', { src: svgUrl('doubloon') }), 'とおると あいて コインが もらえるよ！'],
    ['⭐', 'でも まわりみちを すると ブロックが ふえるよ。よく かんがえてね！'],
  ],
};

// Rising bubbles drawn with Phaser graphics.
function bubble(scene, x, y, r = 4 + Math.random() * 4) {
  const g = scene.add.graphics().setDepth(5.5);
  g.lineStyle(2, 0xffffff, 0.85).strokeCircle(0, 0, r).fillStyle(0xffffff, 0.8).fillCircle(-r * 0.35, -r * 0.35, r * 0.28);
  g.setPosition(x, y);
  scene.tweens.add({ targets: g, y: y - 70 - Math.random() * 40, x: x + (Math.random() - 0.5) * 30, alpha: { from: 0.9, to: 0 }, duration: 1400 + Math.random() * 600, ease: 'Sine.out', onComplete: () => g.destroy() });
}

export function session(map, mission) {
  const d = map.gimmickData || {};
  const value = d.coins ?? 15;
  let pk = null, timer = null;
  return {
    mount(mv) {
      const sc = mv.scene;
      loadTex(sc, svgUrl('chest-open')); loadTex(sc, svgUrl('doubloon'));
      const spots = freePoints(map.graph, mission, d.chests);
      const list = pickRandom(spots, d.count ?? 3).map(at => ({
        at, kind: 'chest', value, src: svgUrl('chest-closed'), size: 58, anim: 'bob',
        onReset: (scene, s) => s.setTexture('tx:' + svgUrl('chest-closed')),
        collect: async (scene, s) => {
          sfx.play('chest');
          s.setTexture('tx:' + svgUrl('chest-open'));
          scene.tweens.add({ targets: s, scale: s.scale * 1.25, duration: 160, yoyo: true, ease: 'Back.out' });
          const glow = scene.add.circle(s.x, s.y - 6, 20, 0xfff3a0, 0.8).setDepth(4.9);
          scene.tweens.add({ targets: glow, radius: 70, alpha: 0, duration: 600, onComplete: () => glow.destroy() });
          for (let i = 0; i < 5; i++) {
            if (!scene.textures.exists('tx:' + svgUrl('doubloon'))) break;
            const c = scene.add.image(s.x, s.y - 10, 'tx:' + svgUrl('doubloon')).setDepth(6).setScale(0.3);
            const dx = (i - 2) * 22;
            scene.tweens.add({ targets: c, x: s.x + dx, y: s.y - 70 - Math.abs(dx) * -0.4, duration: 320, ease: 'Quad.out', yoyo: true, delay: i * 50, onYoyo: () => sfx.play('coin'), onComplete: () => c.destroy() });
          }
          for (let i = 0; i < 6; i++) setTimeout(() => scene.sys?.isActive() && bubble(scene, s.x + (Math.random() - 0.5) * 40, s.y - 10), i * 80);
          floatText(scene, s.x, s.y - 50, `+${value}`, { color: '#ffe066', stroke: '#1a4a7a' });
        },
      }));
      pk = makePickups(mv, list);
      // closed chests let out a bubble now and then
      timer = sc.time.addEvent({ delay: 1500, loop: true, callback: () => {
        for (const it of list) if (!pk?.collected().includes(it) && Math.random() < 0.4) { const p = map.graph.point(it.at); bubble(sc, p.x + (Math.random() - 0.5) * 24, p.y - 30); }
      } });
    },
    debugItems: () => pk?.items || [],
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
      const t = h('div.sea-toast', {}, h('img', { src: svgUrl('chest-open') }), h('div', {}, h('b', {}, `たからばこ × ${got.length}`), h('span', {}, `コイン +${total}`)));
      document.getElementById('overlay').append(t);
      for (let i = 0; i < 8; i++) t.append(h('i.sea-bub', { style: { left: `${10 + i * 11}%`, animationDelay: `${i * 0.12}s` } }));
      setTimeout(() => t.classList.add('out'), 2400);
      setTimeout(() => t.remove(), 2900);
    },
    destroy() { timer?.remove(); timer = null; pk?.destroy(); pk = null; },
  };
}
