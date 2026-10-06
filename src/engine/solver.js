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
