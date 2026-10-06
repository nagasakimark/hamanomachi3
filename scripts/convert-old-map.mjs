// Converts the original assets/map_data.json (points + connections that copy
// x/y values) into the new map pack format (points with ids, roads by id).
// Usage: node scripts/convert-old-map.mjs legacy/map_data.json maps/hamanomachi
import fs from 'node:fs';
import path from 'node:path';
import { generateMissions } from '../src/engine/missions.js';

const [, , inFile, outDir] = process.argv;
const old = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const TOL = 1;
const points = [];
const startNames = { start1: 'A bus stop', start2: 'B bus stop', start3: 'C bus stop', start4: 'D bus stop' };
let n = 0;
for (const p of old.points) {
  const id = p.type === 'start' && p.id ? p.id : `p${++n}`;
  const np = { id, x: p.x, y: p.y, type: p.type === 'littlebit' ? 'littlebit' : p.type };
  if (p.type === 'destination') {
    np.name = p.name;
    const audio = p.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.mp3';
    if (fs.existsSync(path.join(outDir, 'audio', audio))) np.audio = audio;
  }
  if (p.type === 'start') np.name = startNames[p.id] || p.id;
  // The old code treated start3 like a little-bit point when walking.
  if (p.id === 'start3') np.littlebit = true;
  points.push(np);
}
const find = c => {
  let best = null, bd = Infinity;
  for (const p of points) {
    const d = Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y));
    if (d <= TOL && d < bd) { bd = d; best = p; }
  }
  return best;
};
const roads = [];
let missing = 0;
for (const c of old.connections) {
  const a = find(c.p1), b = find(c.p2);
  if (!a || !b) { missing++; continue; }
  roads.push([a.id, b.id]);
}
// Facing = the first road touching each start (same as the old game).
for (const p of points.filter(p => p.type === 'start')) {
  const r = roads.find(r => r.includes(p.id));
  if (r) p.facing = r[0] === p.id ? r[1] : r[0];
}
const img = 'map.png';
const map = {
  format: 1,
  id: 'hamanomachi',
  name: 'Hamanomachi',
  subtitle: 'Nagasaki',
  order: 1,
  unlockStars: 0,
  image: img,
  width: 1587,
  height: 1123,
  points,
  roads,
};
map.missions = generateMissions(map);
fs.writeFileSync(path.join(outDir, 'map.json'), JSON.stringify(map, null, 1));
console.log(`points ${points.length}, roads ${roads.length}, unmatched ${missing}, missions ${map.missions.length}`);
console.log('destinations without audio:', points.filter(p => p.type === 'destination' && !p.audio).map(p => p.name));
