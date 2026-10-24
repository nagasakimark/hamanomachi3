// Mushroom-Kingdom-style town. ? blocks hold power-ups that are STORED in the save. Monsters stand
// on some roads and will not let you through, unless you have a power-up to defeat them with.
// Without one the student has to find another way round. Power-ups collected or spent in a run only
// count if the mission is won (a reset puts everything back).
// map.json:  "gimmickData": { "qblocks": ["p3",...], "count": 5, "closable": [["p1","p2"],...], "closed": 1 }
import { h } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { sfx } from '../audio/sfx.js';
import { chooseClosed, chooseClosedChains, autoChains, graphWithout } from './closure.js';
import { makePickups, pickRandom, freePoints, addArt, pxUrl, loadTex, floatText } from './pickups.js';
import { KINDS, ORDER, pickKind, stored, nextKind, mountHud, grantUnlocks, announceUnlocks } from './powerups.js';

export { missionsExtra } from './powerups.js';
export const introVersion = 'v2';   // bump to show the intro again when the rules change

const foeFiles = import.meta.glob('../assets/gimmick/foe/*.png', { eager: true, query: '?url', import: 'default' });
const FOES = Object.values(foeFiles);

export const intro = {
  theme: 'blocks',
  icon: () => h('img.gi-px.gi-bump', { src: pxUrl('qblock') }),
  title: 'キノコの おうこく',
  lines: [
    [() => h('img.gi-li', { src: pxUrl('qblock') }), 'はてなブロックの したを とおると パワーアップが でてくるよ！'],
    [() => h('img.gi-li', { src: pxUrl('pw-mushroom') }), 'パワーアップは とっておけるよ。ひだりうえで かぞえられるよ。'],
    [() => h('img.gi-li', { src: FOES[0] }), 'モンスターが みちを ふさいでいるよ。パワーアップを つかうと たおして すすめる！'],
    [() => h('img.gi-li', { src: pxUrl('pw-star') }), 'もっていないときは ほかの みちを さがそう。ゴールしたときだけ ゲットできるよ。'],
  ],
};

const keyOf = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

export function session(map, mission) {
  const d = map.gimmickData || {};
  let pk = null, hud = null, foes = new Map();
  // Roads marked "can be closed" in the map editor hold a monster each; otherwise a whole block
  // (the stretch between two corners) is picked automatically.
  const marked = (d.closable || []).filter(([a, b]) => map.roads.some(r => (r[0] === a && r[1] === b) || (r[0] === b && r[1] === a)));
  let closed, spotAt;
  if (marked.length) { closed = chooseClosed(map, mission, marked, d.closed ?? 1); spotAt = closed; }
  else { const r = chooseClosedChains(map, mission, autoChains(map), d.closed ?? 1); closed = r.edges; spotAt = r.mids; }
  const bestGraph = closed.length ? graphWithout(map, closed) : null;
  const blockedKeys = new Set(spotAt.map(([a, b]) => keyOf(a, b)));

  const zero = () => Object.fromEntries(ORDER.map(k => [k, 0]));
  let gained = zero(), used = zero();
  const defeated = new Set();
  const held = () => Object.fromEntries(ORDER.map(k => [k, Math.max(0, (stored()[k] || 0) + gained[k] - used[k])]));
  const refresh = () => hud?.update();

  async function defeat(mv, f, kind) {
    const sc = mv.scene, p = sc.player, fx = f.base.x, fy = f.base.y;
    f.tweens.forEach(t => t.stop?.()); f.tweens = [];
    const tex = 'tx:' + pxUrl(KINDS[kind].art);
    await loadTex(sc, pxUrl(KINDS[kind].art), true);
    const pop = sc.add.image(p.x, p.y - 60, tex).setDepth(30).setScale(0.2);
    sfx.play('pick');
    await mv.tween({ targets: pop, scale: 4, y: p.y - 90, duration: 220, ease: 'Back.out' });
    if (kind === 'mushroom') {
      // grow big and stomp
      sfx.play('bonk');
      await mv.tween({ targets: p, scale: p.scale * 1.35, duration: 160, yoyo: true, ease: 'Quad.out' });
      await mv.tween({ targets: p, x: p.x + (fx - p.x) * 0.55, y: p.y + (fy - p.y) * 0.55 - 26, duration: 180, yoyo: true, ease: 'Quad.out' });
      sfx.play('bonk');
      await mv.tween({ targets: f.obj, scaleY: f.base.scale * 0.15, y: fy + 18, duration: 140 });
    } else if (kind === 'flower') {
      // throw a fireball
      const ball = sc.add.circle(p.x, p.y - 20, 11, 0xff7a1a).setDepth(30).setStrokeStyle(4, 0xffd23f);
      sfx.play('pop');
      await mv.tween({ targets: ball, x: fx, y: fy - 10, duration: 260, ease: 'Quad.in' });
      ball.destroy(); sc.sparkle?.explode(14, fx, fy);
      sfx.play('bonk');
      await mv.tween({ targets: f.obj, alpha: 0.2, duration: 80, yoyo: true, repeat: 2 });
    } else {
      // star power: rainbow flash, then the monster is knocked away
      sfx.play('win');
      const cols = [0xffd23f, 0xff6b6b, 0x6bd5ff, 0x9bf06b];
      for (let i = 0; i < 6; i++) { p.setTint(cols[i % 4]); await mv.delay(90); }
      p.clearTint();
      sc.sparkle?.explode(16, p.x, p.y - 20);
      await mv.tween({ targets: f.obj, x: fx + 160, y: fy - 140, angle: 540, alpha: 0, duration: 420, ease: 'Quad.out' });
    }
    pop.destroy();
    await mv.tween({ targets: f.obj, alpha: 0, scale: 0, duration: 120 });
    f.obj.setVisible(false); f.shadow?.setVisible(false);
    sc.sparkle?.explode(10, fx, fy);
  }

  return {
    graph: null,        // roads stay as they are for the simulation; monsters only stand in the way
    bestGraph,          // ...but the star budget is worked out for a trip that goes round them
    closed,
    mount(mv) {
      const sc = mv.scene, g = map.graph;
      hud = mountHud(sc.game.canvas.parentElement, held); refresh();
      const picks = pickRandom(FOES, FOES.length);
      spotAt.forEach(([a, b], i) => {
        const pa = g.point(a), pb = g.point(b);
        const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2;
        const f = { x, y, tweens: [], base: { x, y: y - 26 } };
        f.shadow = sc.add.ellipse(x, y + 6, 54, 16, 0x000000, 0.25).setDepth(4);
        const art = addArt(sc, picks[i % picks.length], x, y - 26, 72, 5);
        art.onReady = o => {
          f.obj = o; f.base.scale = o.scaleX;
          f.tweens.push(sc.tweens.add({ targets: o, y: f.base.y - 6, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
        };
        f.art = art;
        foes.set(keyOf(a, b), f);
      });
      const spots = freePoints(map.graph, mission, d.qblocks);
      loadTex(sc, pxUrl('qblock-used'), true);
      ORDER.forEach(k => loadTex(sc, pxUrl(KINDS[k].art), true));
      pk = makePickups(mv, pickRandom(spots, d.count ?? 5).map(at => ({
        at, kind: 'q', power: pickKind(), src: [pxUrl('qblock'), pxUrl('qblock'), pxUrl('qblock2')], frameMs: 260, pixel: true, size: 40, anim: 'still',
        onReset: (scene, s) => s.setTexture('tx:' + pxUrl('qblock')),
        collect: async (scene, s, { rec }) => {
          const item = rec.item, kind = item.power;
          // bonk! the block jumps, turns into an empty block, and the power-up pops out
          sfx.play('bonk');
          s.setTexture('tx:' + pxUrl('qblock-used'));
          scene.tweens.add({ targets: s, y: s.y - 14, duration: 90, yoyo: true, ease: 'Quad.out' });
          const pu = scene.add.image(s.x, s.y - 6, 'tx:' + pxUrl(KINDS[kind].art)).setDepth(6).setScale(1);
          (rec.extra ||= []).push(pu);
          sfx.play('pick');
          scene.tweens.add({ targets: pu, y: s.y - 70, scale: 3.4, duration: 300, ease: 'Back.out', onComplete: () => scene.tweens.add({ targets: pu, y: pu.y - 20, alpha: 0, duration: 450, delay: 250 }) });
          gained[kind]++; refresh();
          floatText(scene, s.x, s.y - 100, `+1 ${KINDS[kind].name}`, { delay: 200, fontSize: '24px' });
        },
      })));
    },
    // Something standing on this road? (play.js hands this to the walk)
    blockerAt(a, b, mv) {
      const k = keyOf(a, b), f = foes.get(k);
      if (!f || !f.obj || defeated.has(k)) return null;
      return {
        x: f.x, y: f.y,
        stop: async () => {
          const kind = nextKind(held());
          if (!kind) {
            sfx.play('bonk');
            mv.scene.tweens.add({ targets: f.obj, y: f.base.y - 22, duration: 120, yoyo: true, repeat: 1 });
            mv.bubble(mv.scene.player, 'パワーアップが ないよ！', 1800, '#e8514a');
            await mv.delay(1300);
            return false;
          }
          used[kind]++; refresh();
          defeated.add(k);
          await defeat(mv, f, kind);
          return true;
        },
      };
    },
    debugItems: () => pk?.items || [],
    reset() {
      pk?.reset();
      gained = zero(); used = zero(); defeated.clear();
      for (const f of foes.values()) {
        if (!f.obj) continue;
        f.obj.setVisible(true).setAlpha(1).setAngle(0).setScale(f.base.scale).setPosition(f.base.x, f.base.y);
        f.shadow?.setVisible(true);
        f.tweens.forEach(t => t.stop?.()); f.tweens = [mv0(f)];
      }
      refresh();
    },
    async onNode(id, mv) { await pk?.onNode(id, mv); },
    // The mission was won for the first time: keep what was collected, spend what was used.
    async afterWin({ coins }) {
      const s = save.get();
      let newHats = [];
      if (ORDER.some(k => gained[k] || used[k]) || defeated.size) {
        for (const k of ORDER) {
          s.powerups[k] = Math.max(0, (s.powerups[k] || 0) + gained[k] - used[k]);
          s.powerCollected[k] = (s.powerCollected[k] || 0) + gained[k];
        }
        s.foesDefeated = (s.foesDefeated || 0) + defeated.size;
        save.write();
        newHats = grantUnlocks();
        const n = ORDER.reduce((t, k) => t + gained[k], 0);
        if (n) powerToast(gained, used);
      }
      void coins;
      gained = zero(); used = zero(); defeated.clear();
      refresh();
      if (newHats.length) { await new Promise(r => setTimeout(r, 1200)); await announceUnlocks(newHats); }
    },
    destroy() {
      pk?.destroy(); pk = null; hud?.destroy(); hud = null;
      for (const f of foes.values()) { f.tweens.forEach(t => t.stop?.()); f.art?.destroy(); f.shadow?.destroy(); }
      foes.clear();
    },
  };

  function mv0(f) {
    return f.obj.scene.tweens.add({ targets: f.obj, y: f.base.y - 6, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

function powerToast(gained, used) {
  const parts = ORDER.filter(k => gained[k]).flatMap(k => [h('img', { src: pxUrl(KINDS[k].art) }), h('span', {}, `× ${gained[k]}`)]);
  const t = h('div.pf-toast', {}, ...parts, h('b', {}, 'ゲット！'));
  document.getElementById('overlay').append(t);
  setTimeout(() => t.classList.add('out'), 2200);
  setTimeout(() => t.remove(), 2700);
}
