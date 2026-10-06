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

function makePack(map, fileUrls, extra = {}) {
  return {
    ...map,
    ...extra,
    imageUrl: fileUrls[map.image],
    thumbUrl: fileUrls['thumb.png'] || fileUrls[map.image],
    audioUrl: name => (name ? fileUrls['audio/' + name] : null),
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
  const m = makePack(pack.map, urls, { isTest: true, unlockStars: 0, name: 'TEST: ' + pack.map.name });
  MAPS.unshift(m);
  return m;
}
