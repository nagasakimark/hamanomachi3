// Finds the shortest program (fewest blocks) from a start to a destination,
// using exactly the same rules as the game. Used for star targets, mission
// generation and the map editor's checker.
import { goStraight, goLittleBit, turn } from './engine.js';

const MAX_STRAIGHT = 10;
const key = s => `${s.node}|${s.angle.toFixed(3)}`;

export function solve(g, startId, destId, { maxDepth = 12 } = {}) {
  const start = g.initialState(startId);
  const seen = new Map([[key(start), null]]);
  let frontier = [{ state: start, program: [] }];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next = [];
    for (const { state, program } of frontier) {
      const tryMove = (block, r) => {
        if (!r || !r.ok) return null;
        const prog = [...program, block];
        if (r.state.node === destId) return prog;
        const k = key(r.state);
        if (!seen.has(k)) { seen.set(k, true); next.push({ state: r.state, program: prog }); }
        return null;
      };
      for (let n = 1; n <= MAX_STRAIGHT; n++) {
        const won = tryMove({ type: 'straight', n }, goStraight(g, state, n, destId));
        if (won) return won;
      }
      let won = tryMove({ type: 'littlebit' }, goLittleBit(g, state, destId));
      if (won) return won;
      for (const dir of ['left', 'right']) {
        const t = turn(g, state, dir);
        if (!t.ok) continue;
        won = tryMove({ type: dir }, t);
        if (won) return won;
        // look blocks: turn + straight 1. Terminal, so only useful if they win.
        const m = goStraight(g, t.state, 1, destId);
        if (m.ok && m.state.node === destId) return [...program, { type: dir === 'left' ? 'lookLeft' : 'lookRight' }];
      }
    }
    frontier = next;
  }
  return null;
}

// Reachable set of nodes from a start (ignoring destinations), for the checker.
export function reachableDestinations(g, startId) {
  return g.destinations().filter(d => solve(g, startId, d.id));
}

// How many corners (real blocks) lie between two points on the shortest road route.
// Little-bit points and gentle bends do not count. 0 = the place is on the same block as the start.
// Returns null when there is no route.
export function blocksAway(g, startId, destId) {
  const dist = new Map([[startId, 0]]), prev = new Map(), todo = [startId], done = new Set();
  while (todo.length) {
    todo.sort((a, b) => dist.get(a) - dist.get(b));
    const u = todo.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === destId) break;
    const pu = g.point(u);
    for (const v of g.neighbors(u)) {
      const pv = g.point(v), d = dist.get(u) + Math.hypot(pu.x - pv.x, pu.y - pv.y);
      if (!dist.has(v) || d < dist.get(v)) { dist.set(v, d); prev.set(v, u); todo.push(v); }
    }
  }
  if (!dist.has(destId)) return null;
  let corners = 0;
  for (let n = prev.get(destId); n !== undefined && n !== startId; n = prev.get(n)) if (!g.passThrough(n)) corners++;
  return corners;
}

// A trip must be at least one block long: places on the same block as the start are never chosen.
export const tooClose = (g, startId, destId) => g.neighbors(startId).includes(destId) || (blocksAway(g, startId, destId) ?? 1) < 1;
