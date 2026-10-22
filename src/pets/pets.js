// Pets: little followers you buy in the wardrobe. Each sheet is 4 rows
// (up, left, down, right - same order as the avatar sheets) x `frames` walking
// frames, 64x64 cells. Art from itch.io / CraftPix free packs (see credits).
const urls = import.meta.glob('./sheets/*.png', { eager: true, query: '?url', import: 'default' });

import { PETS } from './petsData.js';
export { PETS };

export const petById = id => PETS.find(p => 'pet-' + p.id === id || p.id === id);
const imgs = new Map();
export function loadPetImage(id) {
  const p = petById(id);
  if (!p) return Promise.resolve(null);
  if (!imgs.has(p.id)) imgs.set(p.id, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = urls['./sheets/' + p.id + '.png']; }));
  return imgs.get(p.id);
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
  c.setPet = async id => { pet = petById(id) || null; img = pet ? await loadPetImage(id) : null; c.style.visibility = pet ? 'visible' : 'hidden'; };
  return c;
}
