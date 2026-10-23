// Things lying on the map that you collect by walking over them
// (treasure chests, ? blocks, crafting materials). They are shown before the
// run so the student can plan a route; what you collect is only kept if you win.
//
// item = { at: pointId, src: url | [url, url...] (frames), size: px, pixel: bool,
//          anim: 'bob' | 'spin' | 'still', collect(scene, sprite, ctx) -> Promise (optional) }
import { sfx } from '../audio/sfx.js';

const px = import.meta.glob('../assets/gimmick/px/*.png', { eager: true, query: '?url', import: 'default' });
export const pxUrl = n => px[`../assets/gimmick/px/${n}.png`];
const svgs = import.meta.glob('../assets/gimmick/svg/*.svg', { eager: true, query: '?url', import: 'default' });
export const svgUrl = n => svgs[`../assets/gimmick/svg/${n}.svg`];

// Load a picture into a Phaser scene once. Pixel art keeps hard edges.
const loading = new Map();
export function loadTex(scene, url, pixel = false) {
  const key = 'tx:' + url;
  if (scene.textures.exists(key)) return Promise.resolve(key);
  if (!loading.has(key)) loading.set(key, new Promise(res => {
    const im = new Image();
    im.onload = () => {
      if (!scene.sys?.isActive()) return res(null);
      if (!scene.textures.exists(key)) {
        scene.textures.addImage(key, im);
        if (pixel) scene.textures.get(key).setFilter(1); // Phaser.Textures.FilterMode.NEAREST
      }
      res(key);
    };
    im.onerror = () => res(null);
    im.src = url;
  }).finally(() => loading.delete(key)));
  return loading.get(key);
}

export function makePickups(mv, list) {
  const scene = mv.scene, g = mv.pack.graph;
  const objs = new Map();     // pointId -> record
  const got = new Set();
  const make = async item => {
    const p = g.point(item.at);
    const size = item.size || 48;
    const rec = { item, home: { x: p.x, y: p.y - size * 0.55 }, tweens: [] };
    rec.ring = scene.add.ellipse(p.x, p.y + 6, size * 0.8, size * 0.26, 0x000000, 0.22).setDepth(4);
    objs.set(item.at, rec);
    const frames = [].concat(item.src);
    const keys = await Promise.all(frames.map(u => loadTex(scene, u, item.pixel)));
    if (rec.dead || !keys[0]) return;
    const s = rec.obj = scene.add.image(rec.home.x, rec.home.y, keys[0]).setDepth(5);
    rec.scale = size / Math.max(s.width, s.height);
    s.setScale(rec.scale);
    rec.start = () => {
      rec.tweens.forEach(t => t.stop()); rec.tweens = [];
      if (item.anim !== 'still' && item.anim !== 'spin') rec.tweens.push(scene.tweens.add({ targets: s, y: rec.home.y - 8, duration: 800 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
      if (item.anim === 'spin') {
        // dropped items slowly turn and float, like in a block game
        rec.tweens.push(scene.tweens.add({ targets: s, y: rec.home.y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
        const st = { t: Math.random() * 6 };
        rec.tweens.push(scene.tweens.add({ targets: st, t: st.t + Math.PI * 2, duration: 2600, repeat: -1, onUpdate: () => s.setScale(rec.scale * Math.max(0.15, Math.abs(Math.cos(st.t))), rec.scale) }));
      }
      if (keys.length > 1) {
        let i = 0;
        rec.tweens.push(scene.time.addEvent({ delay: item.frameMs || 220, loop: true, callback: () => { i = (i + 1) % keys.length; s.setTexture(keys[i]); } }));
      }
    };
    rec.start();
    item.onShow?.(scene, s, rec);
  };
  list.forEach(make);
  return {
    items: list,
    // Walk onto a point: collect what is there. Returns the item or null.
    async onNode(id, mvv) {
      const o = objs.get(id);
      if (!o || got.has(id) || !o.obj) return null;
      got.add(id);
      o.tweens.forEach(t => t.stop?.() ?? t.remove?.());
      if (o.item.collect) await o.item.collect(scene, o.obj, { mv: mvv, ring: o.ring, rec: o });
      else {
        sfx.play('coin');
        scene.tweens.add({ targets: o.obj, y: o.obj.y - 60, scale: o.scale * 1.5, alpha: 0, duration: 500, ease: 'Quad.out' });
        o.ring.setVisible(false);
        scene.sparkle?.explode(10, o.obj.x, o.obj.y);
        if (o.item.label) mvv?.bubble(scene.player, o.item.label, 900, '#d98e00');
      }
      return o.item;
    },
    collected: () => list.filter(i => got.has(i.at)),
    // New attempt: everything is back on the map.
    reset() {
      got.clear();
      for (const o of objs.values()) {
        if (!o.obj) continue;
        scene.tweens.killTweensOf(o.obj);
        o.obj.setAlpha(1).setScale(o.scale).setPosition(o.home.x, o.home.y).setAngle(0).setVisible(true);
        o.item.onReset?.(scene, o.obj, o);
        o.ring.setVisible(true);
        o.start();
      }
    },
    destroy() { for (const o of objs.values()) { o.dead = true; o.tweens.forEach(t => t.stop?.() ?? t.remove?.()); o.obj?.destroy(); o.ring.destroy(); o.extra?.forEach(x => x.destroy()); } objs.clear(); },
  };
}

export const pickRandom = (arr, n) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};

// Points that may hold something: normal corners that are not the start or the place asked about.
// Marked "gimmick spot" points (editor) win; otherwise every corner is used.
export const freePoints = (g, mission, ids) => {
  const marked = g.map.points.filter(p => p.spot).map(p => p.id);
  const all = marked.length ? marked : (ids || g.map.points.filter(p => p.type === 'normal').map(p => p.id));
  return all.filter(id => id !== mission.start && id !== mission.destination && g.point(id));
};

// Put a picture on the map; the result is filled in once the image has loaded.
export function addArt(scene, url, x, y, size = 60, depth = 5, pixel = false) {
  const holder = { obj: null, dead: false, destroy() { this.dead = true; this.obj?.destroy(); } };
  loadTex(scene, url, pixel).then(key => {
    if (holder.dead || !key) return;
    holder.obj = scene.add.image(x, y, key).setDepth(depth);
    holder.obj.setScale(size / Math.max(holder.obj.width, holder.obj.height));
    holder.onReady?.(holder.obj);
  });
  return holder;
}

// A little floating text that rises and fades (e.g. "+1", "+5").
export function floatText(scene, x, y, text, style = {}) {
  const t = scene.add.text(x, y, text, { fontFamily: 'Fredoka, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 6, ...style }).setOrigin(0.5).setDepth(41);
  scene.tweens.add({ targets: t, y: y - 50, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  return t;
}
