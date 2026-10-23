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
