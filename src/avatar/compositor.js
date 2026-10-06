// Builds a character spritesheet at runtime by stacking LPC layers and
// recolouring them. Output: a 576x256 canvas (9 frames x 4 directions).
// Rows: 0 = up, 1 = left, 2 = down, 3 = right. Frame 0 = standing.
import { ITEMS, BODY_LAYER, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, itemById, SLOTS, REQUIRED } from './items.js';

const layerUrls = import.meta.glob('./layers/*.png', { eager: true, query: '?url', import: 'default' });
const urlFor = path => layerUrls['./layers/' + path.replace(/\//g, '__')];

export const FRAME = 64, COLS = 9, ROWS = 4;
const W = FRAME * COLS, H = FRAME * ROWS;

const imgCache = new Map();
function loadImage(path) {
  if (!imgCache.has(path)) {
    imgCache.set(path, new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('layer missing: ' + path));
      img.src = urlFor(path);
    }));
  }
  return imgCache.get(path);
}
export function preloadLayers() {
  return Promise.all([BODY_LAYER.path, ...ITEMS.flatMap(i => i.layers.map(l => l.path))].map(p => loadImage(p).catch(() => null)));
}

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Recolour cache: path|mode|colour -> canvas
const tintCache = new Map();
async function tinted(path, mode, color) {
  const k = `${path}|${mode}|${color}`;
  if (tintCache.has(k)) return tintCache.get(k);
  const img = await loadImage(path);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  if (mode && color) {
    const d = x.getImageData(0, 0, W, H), p = d.data;
    const [tr, tg, tb] = hex(color);
    if (mode === 'skin') {
      // Shift the LPC light skin ramp (brightest 249,213,186) to the chosen tone.
      const base = [249, 213, 186];
      const k2 = [tr / base[0], tg / base[1], tb / base[2]];
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const r = p[i], g = p[i + 1], b = p[i + 2];
        if (lum(r, g, b) < 50) continue;             // outline
        if (!(r > g && g >= b - 10 && r - b > 40)) continue; // eyes, whites
        p[i] = Math.min(255, r * k2[0]); p[i + 1] = Math.min(255, g * k2[1]); p[i + 2] = Math.min(255, b * k2[2]);
      }
    } else {
      let maxL = 1;
      for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 200) maxL = Math.max(maxL, lum(p[i], p[i + 1], p[i + 2]));
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const L = lum(p[i], p[i + 1], p[i + 2]);
        if (mode === 'cloth' && L < 48) continue; // keep outlines
        let f = 0.18 + (L / maxL) * (mode === 'hair' ? 1.0 : 0.95);
        const mix = (t) => f <= 1 ? t * f : t + (255 - t) * Math.min(1, (f - 1) * 1.4);
        p[i] = mix(tr); p[i + 1] = mix(tg); p[i + 2] = mix(tb);
      }
    }
    x.putImageData(d, 0, 0);
  }
  tintCache.set(k, c);
  return c;
}

// look = { skin, face, hair, hairColor, top, topColor, topColor2, ... }
export async function composeLook(look) {
  look = { ...look };
  if (!itemById(look.face)) look.face = 'face-a';
  const skin = SKIN_TONES[look.skin ?? 0] || SKIN_TONES[0];
  const parts = [{ ...BODY_LAYER, mode: 'skin', color: skin }];
  for (const slot of SLOTS) {
    if (slot.id === 'skin') continue;
    const item = itemById(look[slot.id]);
    if (!item) continue;
    item.layers.forEach((l, idx) => {
      let mode = null, color = null;
      if (item.skin) { mode = 'skin'; color = skin; }
      else if (item.color === 'hair') { mode = 'hair'; color = HAIR_COLORS[look.hairColor ?? 0]; }
      else if (item.color === 'cloth') {
        mode = 'cloth';
        const ci = idx > 0 && item.color2 ? look[slot.id + 'Color2'] : look[slot.id + 'Color'];
        color = CLOTH_COLORS[ci ?? 0];
      }
      parts.push({ ...l, mode, color });
    });
  }
  parts.sort((a, b) => a.z - b.z);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  for (const part of parts) {
    try { ctx.drawImage(await tinted(part.path, part.mode, part.color), 0, 0); } catch (e) { /* missing layer */ }
  }
  return out;
}

// A random townsperson. The person asking the way is always female, to
// match the recorded voice.
const ASKER_HATS = ['hat-headband', 'hat-bandana', 'hat-cap', 'hat-bowler', 'hat-bonnie', 'hat-kerchief', 'hat-tied'];
export function randomLook(seed = Math.random(), { female = false } = {}) {
  let s = Math.floor(seed * 1e9) || 1;
  const rnd = n => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
  const pick = (slot, filter = () => true) => { const list = ITEMS.filter(i => i.slot === slot && !i.badge && filter(i)); return list[rnd(list.length)].id; };
  const fem = female || rnd(2) === 0;
  return {
    skin: rnd(SKIN_TONES.length),
    face: fem ? 'face-b' : 'face-a',
    hair: pick('hair', i => (fem ? i.feminine : !i.feminine || rnd(3) === 0)), hairColor: rnd(6),
    top: pick('top'), topColor: rnd(CLOTH_COLORS.length), topColor2: rnd(CLOTH_COLORS.length),
    bottom: pick('bottom', i => (fem && rnd(5) < 3 ? i.feminine : true)), bottomColor: rnd(CLOTH_COLORS.length),
    shoes: pick('shoes'), shoesColor: rnd(CLOTH_COLORS.length),
    hat: rnd(4) === 0 ? ASKER_HATS[rnd(ASKER_HATS.length)] : null, hatColor: rnd(CLOTH_COLORS.length),
    glasses: rnd(5) === 0 ? pick('glasses', i => i.id !== 'glasses-patch') : null,
    neck: rnd(5) === 0 ? pick('neck') : null, neckColor: rnd(CLOTH_COLORS.length),
    back: null,
  };
}

// A still head-and-shoulders portrait (for the top bar).
export function portraitCanvas(size = 56) {
  const c = document.createElement('canvas');
  c.width = 36; c.height = 36;
  c.className = 'avatar-canvas portrait';
  c.style.width = size + 'px'; c.style.height = size + 'px';
  c.setSheet = sheet => {
    const x = c.getContext('2d');
    x.clearRect(0, 0, 36, 36);
    x.drawImage(sheet, 14, 2 * FRAME + 4, 36, 36, 0, 0, 36, 36);
  };
  return c;
}

// Draws an animated preview of a sheet into a small canvas element.
export function previewCanvas(size = 128, { dir = 2, walk = true } = {}) {
  const c = document.createElement('canvas');
  c.width = FRAME; c.height = FRAME;
  c.className = 'avatar-canvas';
  c.style.width = size + 'px'; c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  let sheet = null, frame = 0, raf = 0, last = 0, d = dir, seen = false;
  const draw = t => {
    if (c.isConnected) seen = true;
    else if (seen) { cancelAnimationFrame(raf); return; }
    if (t - last > 90) { last = t; frame = walk ? (frame % 8) + 1 : 0; }
    ctx.clearRect(0, 0, FRAME, FRAME);
    if (sheet) ctx.drawImage(sheet, frame * FRAME, d * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  c.setSheet = s => { sheet = s; };
  c.setDir = v => { d = v; };
  c.setWalk = v => { walk = v; };
  return c;
}

export { REQUIRED };
