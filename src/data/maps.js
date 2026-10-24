// Finds every map pack in /maps/<id>/ automatically at build time.
// To add a town: export a pack from the map editor, unzip it into
// maps/<id>/, and rebuild. No code changes needed.
import { MapGraph } from '../engine/engine.js';

const jsons = import.meta.glob('../../maps/*/map.json', { eager: true, import: 'default' });
const files = import.meta.glob('../../maps/*/**/*.{png,jpg,jpeg,webp,mp3,ogg,m4a,wav}', { eager: true, query: '?url', import: 'default' });

function packFiles(dir) {
  const out = {};
  const prefix = `../../maps/${dir}/`;
  for (const [k, url] of Object.entries(files)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = url;
  return out;
}

// Every town shares the voice clips in maps/hamanomachi/audio (one recording per
// place name), so a new town only needs its own clip if it wants a different one.
const SHARED = packFiles('hamanomachi');
const slugAudio = name => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.mp3';

function makePack(map, fileUrls, extra = {}) {
  for (const p of map.points || []) if (p.type === 'destination' && !p.audio && p.name) p.audio = slugAudio(p.name);
  return {
    ...map,
    ...extra,
    imageUrl: fileUrls[map.image],
    bannerUrl: fileUrls['banner.webp'] || fileUrls['thumb.webp'] || fileUrls[map.image],
    thumbUrl: fileUrls['thumb.webp'] || fileUrls['thumb.png'] || fileUrls[map.image],
    audioUrl: name => (name ? fileUrls['audio/' + name] || SHARED['audio/' + name] || null : null),
    graph: new MapGraph(map),
  };
}

export const MAPS = Object.entries(jsons)
  .map(([k, map]) => makePack(map, packFiles(k.split('/')[3])))
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

export const mapById = id => MAPS.find(m => m.id === id);

// Map sent over from the map editor's "Test play" button (stored in IndexedDB).
export async function loadTestMap() {
  const { idbGet } = await import('../tools/idb.js');
  const pack = await idbGet('testpack');
  if (!pack) return null;
  const urls = { [pack.map.image]: pack.image };
  for (const [name, dataUrl] of Object.entries(pack.audio || {})) urls['audio/' + name] = dataUrl;
  const m = makePack(pack.map, urls, { isTest: true, id: 'test-' + pack.map.id, unlockStars: 0, name: 'TEST: ' + pack.map.name });
  MAPS.unshift(m);
  return m;
}
