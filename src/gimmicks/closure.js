// Picks roads to close for one mission, only keeping a closure if the place can still be reached.
// Pure logic (no DOM) so it can be tested in node.
import { MapGraph } from '../engine/engine.js';
import { solve } from '../engine/solver.js';

const roadKey = (a, b) => [a, b].sort().join('|');

export function graphWithout(map, closed) {
  const keys = new Set(closed.map(([a, b]) => roadKey(a, b)));
  return new MapGraph({ ...map, roads: map.roads.filter(([a, b]) => !keys.has(roadKey(a, b))) });
}

export function chooseClosed(map, mission, candidates, n, rand = Math.random) {
  const order = candidates.slice().sort(() => rand() - 0.5);
  let closed = [];
  for (const r of order) {
    if (closed.length >= n) break;
    const trial = [...closed, r];
    if (solve(graphWithout(map, trial), mission.start, mission.destination)) closed = trial;
  }
  return closed;
}

// ---- Automatic closures (when the map has no roads marked as closable) ----
// A "block" is the whole stretch of road between two corners: little-bit points and gentle bends
// in the middle belong to it. Closing a block closes every road piece of that stretch.
const chainCache = new WeakMap();
export function autoChains(map) {
  if (chainCache.has(map)) return chainCache.get(map);
  const g = new MapGraph(map);
  const seen = new Set(), chains = [];
  for (const u of map.points) {
    if (g.passThrough(u.id)) continue;
    for (const first of g.neighbors(u.id)) {
      if (seen.has(roadKey(u.id, first))) continue;
      const nodes = [u.id, first];
      while (g.passThrough(nodes[nodes.length - 1]) && g.neighbors(nodes[nodes.length - 1]).length === 2) {
        const cur = nodes[nodes.length - 1], prev = nodes[nodes.length - 2];
        nodes.push(g.neighbors(cur).find(n => n !== prev));
        if (nodes[nodes.length - 1] === u.id) break;
      }
      const edges = nodes.slice(1).map((n, i) => [nodes[i], n]);
      edges.forEach(([a, b]) => seen.add(roadKey(a, b)));
      const ends = [g.point(nodes[0]), g.point(nodes[nodes.length - 1])];
      // only real streets: not the little stub from a bus stop or a place to its road
      if (ends.some(p => p.type === 'start' || p.type === 'destination')) continue;
      if (nodes.slice(1, -1).some(id => ['start', 'destination'].includes(g.point(id).type))) continue;
      const mid = edges[Math.floor(edges.length / 2)];
      chains.push({ edges, mid, key: edges.map(e => roadKey(...e)).sort().join(',') });
    }
  }
  chainCache.set(map, chains);
  return chains;
}

// Road pieces on the quickest walk from the start to the place.
function routeKeys(map, mission) {
  const g = new MapGraph(map), a = mission.start, b = mission.destination;
  const dist = new Map([[a, 0]]), prev = new Map(), todo = [a], done = new Set();
  while (todo.length) {
    todo.sort((x, y) => dist.get(x) - dist.get(y));
    const u = todo.shift(); if (done.has(u)) continue; done.add(u); if (u === b) break;
    for (const v of g.neighbors(u)) {
      const d = dist.get(u) + Math.hypot(g.point(u).x - g.point(v).x, g.point(u).y - g.point(v).y);
      if (!dist.has(v) || d < dist.get(v)) { dist.set(v, d); prev.set(v, u); todo.push(v); }
    }
  }
  const keys = new Set();
  for (let n = b; prev.has(n); n = prev.get(n)) keys.add(roadKey(n, prev.get(n)));
  return keys;
}

// Closes up to n whole blocks, preferring ones on the quickest walk (so the way really changes),
// and only keeps a closure if the place can still be reached.
export function chooseClosedChains(map, mission, chains, n, rand = Math.random, maxTries = 14) {
  const route = routeKeys(map, mission);
  const onRoute = c => c.edges.some(e => route.has(roadKey(...e)));
  const order = chains.slice().sort(() => rand() - 0.5);
  order.sort((a, b) => onRoute(b) - onRoute(a));
  let edges = [], mids = [], tried = 0;
  for (const c of order) {
    if (mids.length >= n || tried++ >= maxTries) break;
    const trial = [...edges, ...c.edges];
    if (solve(graphWithout(map, trial), mission.start, mission.destination)) { edges = trial; mids.push(c.mid); }
  }
  return { edges, mids };
}
