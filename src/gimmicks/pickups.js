// Things lying on the map that you collect by walking over them
// (treasure chests, ? blocks, crafting materials). They are shown before the
// run so the student can plan a route; what you collect is only kept if you win.
import { sfx } from '../audio/sfx.js';

const art = import.meta.glob('../assets/gimmick/{chest,bench,qblock,roadsign,mat-*,stamp*}.png', { eager: true, query: '?url', import: 'default' });
export const artUrl = name => art[`../assets/gimmick/${name}.png`];

export function makePickups(mv, list) {
  const scene = mv.scene, g = mv.pack.graph;
  const objs = new Map();     // pointId -> { item, obj, shadow }
  const got = new Set();
  const make = item => {
    const p = g.point(item.at);
    const obj = scene.add.text(p.x, p.y - 22, item.emoji, { fontFamily: 'Noto Color Emoji, Apple Color Emoji, sans-serif', fontSize: '46px' }).setOrigin(0.5).setDepth(5);
    const ring = scene.add.ellipse(p.x, p.y + 6, 44, 14, 0x000000, 0.22).setDepth(4);
    const rec = { item, obj, ring };
    const bob = () => scene.tweens.add({ targets: rec.obj, y: p.y - 32, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    obj.bob = bob();
    objs.set(item.at, rec);
    // A picture (when the item has one) replaces the emoji once it has loaded.
    if (item.img) {
      const im = new Image();
      im.onload = () => {
        if (!scene.sys?.isActive() || !objs.has(item.at) || rec.dead) return;
        const key = 'pk-' + item.img;
        if (!scene.textures.exists(key)) scene.textures.addImage(key, im);
        rec.obj.bob.stop(); rec.obj.destroy();
        rec.obj = scene.add.image(p.x, p.y - 22, key).setDepth(5).setScale(46 / im.height * 1.3);
        rec.obj.bob = bob();
      };
      im.src = artUrl(item.img);
    }
  };
  list.forEach(make);
  return {
    items: list,
    // Walk onto a point: collect what is there. Returns the item or null.
    async onNode(id, mvv) {
      const o = objs.get(id);
      if (!o || got.has(id)) return null;
      got.add(id);
      sfx.play('coin');
      o.obj.bob.stop();
      scene.tweens.add({ targets: o.obj, y: o.obj.y - 60, scale: 1.5, alpha: 0, duration: 500, ease: 'Quad.out' });
      o.ring.setVisible(false);
      scene.sparkle.explode(10, o.obj.x, o.obj.y);
      mvv?.bubble(scene.player, o.item.label || '+', 900, '#d98e00');
      return o.item;
    },
    collected: () => list.filter(i => got.has(i.at)),
    // New attempt: everything is back on the map.
    reset() {
      got.clear();
      for (const o of objs.values()) {
        o.obj.setAlpha(1).setScale(o.obj.type === 'Image' ? o.baseScale ?? (o.baseScale = 46 / o.obj.height * 1.3) : 1).setY(mv.pack.graph.point(o.item.at).y - 22);
        o.ring.setVisible(true);
        o.obj.bob.restart?.();
      }
    },
    destroy() { for (const o of objs.values()) { o.dead = true; o.obj.bob?.stop(); o.obj.destroy(); o.ring.destroy(); } objs.clear(); },
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
export function addArt(scene, name, x, y, size = 60, depth = 5) {
  const holder = { obj: null, dead: false, destroy() { this.dead = true; this.obj?.destroy(); } };
  const im = new Image();
  im.onload = () => {
    if (holder.dead || !scene.sys?.isActive()) return;
    const key = 'art-' + name;
    if (!scene.textures.exists(key)) scene.textures.addImage(key, im);
    holder.obj = scene.add.image(x, y, key).setDepth(depth).setScale(size / Math.max(im.width, im.height));
  };
  im.src = artUrl(name);
  return holder;
}

export const stampArt = (map, destId) => 'stamp' + (1 + Math.max(0, map.graph.destinations().findIndex(d => d.id === destId)) % 8);
