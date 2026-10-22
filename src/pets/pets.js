// Pets: little followers you buy in the wardrobe. Each sheet is 4 rows
// (up, left, down, right - same order as the avatar sheets) x `frames` walking
// frames, 64x64 cells. Art from itch.io / CraftPix free packs (see credits).
const urls = import.meta.glob('./sheets/*.png', { eager: true, query: '?url', import: 'default' });

import { PETS, PET_COLORS } from './petsData.js';
export { PETS, PET_COLORS };

export const petById = id => PETS.find(p => 'pet-' + p.id === id || p.id === id);
const imgs = new Map();
export const petColorById = id => PET_COLORS.find(c => c.id === id) || PET_COLORS[0];

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hsl2rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Recolour: keep each pixel's lightness (so shading and outlines survive) and
// swap hue/saturation. Very dark and very light pixels stay mostly neutral.
function recolor(img, fx) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const y = ((i / 4) / c.width | 0) % 64;
    let [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const mid = 1 - Math.pow(Math.abs(2 * l - 1), 2);
    h = fx.rainbow ? (y / 64) * 300 : fx.hue;
    s = Math.min(1, s * 0.3 + fx.sat * mid);
    l = Math.min(0.97, l * (fx.light || 1));
    if (fx.ghost) { l = 0.62 + l * 0.38; d[i + 3] *= 0.65; }
    const [r, g, b] = hsl2rgb(h, s, l);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(id, 0, 0);
  return new Promise(res => { const o = new Image(); o.onload = () => res(o); o.onerror = () => res(img); o.src = c.toDataURL(); });
}

// Image for a pet in a colour ('natural' = the original art).
export function loadPetImage(id, color = 'natural') {
  const p = petById(id);
  if (!p) return Promise.resolve(null);
  const k = p.id + '|' + color;
  if (!imgs.has(k)) imgs.set(k, new Promise(async res => {
    const base = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = urls['./sheets/' + p.id + '.png']; });
    const fx = petColorById(color).fx;
    res(base && fx ? await recolor(base, fx) : base);
  }));
  return imgs.get(k);
}

// A small animated preview (wardrobe). row: 0 up, 1 left, 2 down, 3 right.
export function petCanvas(size = 96) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64; c.className = 'pet-canvas';
  c.style.width = size + 'px'; c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  let img = null, pet = null, frame = 0, last = 0, raf = 0, seen = false;
  const draw = t => {
    if (c.isConnected) seen = true; else if (seen) { cancelAnimationFrame(raf); return; }
    if (t - last > 120 && pet) { last = t; frame = (frame + 1) % pet.frames; }
    ctx.clearRect(0, 0, 64, 64);
    if (img && pet) ctx.drawImage(img, frame * 64, 2 * 64, 64, 64, 0, 0, 64, 64);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  c.setPet = async (id, color) => { pet = petById(id) || null; img = pet ? await loadPetImage(id, color) : null; c.style.visibility = pet ? 'visible' : 'hidden'; };
  return c;
}
