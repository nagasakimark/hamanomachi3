// Hamanomachi movement engine.
// Pure JavaScript: no Phaser, no DOM. The game, the map editor and the
// solver all use these rules, so they can never disagree.
//
// The rules are ported from the original game-hamanomachi.js:
//  - "go straight for N blocks" follows the road closest to your facing
//    direction (within 30 degrees) for N points. "Little bit" points do not
//    count as a block.
//  - "go straight for a little bit" stops at a little-bit point (preferring
//    one that is next to the destination), or at the next normal point.
//  - "turn left/right" faces the road closest to a 90 degree turn.
//  - "you can see it on your left/right" = turn, then go straight 1 block.
//  - Reaching the destination during any move wins straight away.

export const STRAIGHT_TOLERANCE = Math.PI / 6;

export function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

export class MapGraph {
  constructor(map) {
    this.map = map;
    this.points = new Map();
    for (const p of map.points) this.points.set(p.id, p);
    this.adj = new Map();
    for (const p of map.points) this.adj.set(p.id, []);
    for (const [a, b] of map.roads) {
      if (!this.points.has(a) || !this.points.has(b) || a === b) continue;
      if (!this.adj.get(a).includes(b)) this.adj.get(a).push(b);
      if (!this.adj.get(b).includes(a)) this.adj.get(b).push(a);
    }
  }
  point(id) { return this.points.get(id); }
  neighbors(id) { return this.adj.get(id) || []; }
  angle(fromId, toId) {
    const a = this.point(fromId), b = this.point(toId);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  isLittleBit(id) {
    const p = this.point(id);
    return !!(p && (p.type === 'littlebit' || p.littlebit));
  }
  starts() { return this.map.points.filter(p => p.type === 'start'); }
  destinations() { return this.map.points.filter(p => p.type === 'destination'); }
  // Initial facing: the start's `facing` neighbour, else its first road.
  initialState(startId) {
    const p = this.point(startId);
    const nb = this.neighbors(startId);
    let target = p.facing && nb.includes(p.facing) ? p.facing : nb[0];
    const angle = target ? this.angle(startId, target) : 0;
    return { node: startId, angle };
  }
  // Road from `node` closest to `angle` within tolerance.
  bestForward(node, angle) {
    let best = null, bestDiff = STRAIGHT_TOLERANCE;
    for (const n of this.neighbors(node)) {
      const d = Math.abs(normalizeAngle(this.angle(node, n) - angle));
      if (d < bestDiff) { bestDiff = d; best = n; }
    }
    return best;
  }
}

function segAngle(g, path) {
  const n = path.length;
  return g.angle(path[n - 2], path[n - 1]);
}

// ---- Single commands. Each returns { ok, state, path?, turnTo? } ----

export function goStraight(g, state, steps, destId) {
  if (steps <= 0 || g.neighbors(state.node).length === 0) return { ok: false, state, reason: 'noroad' };
  let node = state.node, angle = state.angle, remaining = steps;
  const path = [node];
  while (remaining > 0) {
    const next = g.bestForward(node, angle);
    if (!next) return { ok: false, state, reason: 'noroad', partial: path };
    path.push(next);
    if (!g.isLittleBit(next)) remaining--;
    angle = segAngle(g, path);
    node = next;
    if (next === destId) break;
  }
  return { ok: true, path, state: { node, angle } };
}

export function goLittleBit(g, state, destId) {
  if (g.neighbors(state.node).length === 0) return { ok: false, state, reason: 'noroad' };
  let node = state.node, angle = state.angle;
  const path = [node];
  const found = [];
  for (;;) {
    const next = g.bestForward(node, angle);
    if (!next) return { ok: false, state, reason: 'noroad', partial: path };
    if (next === destId) { path.push(next); break; }
    if (g.isLittleBit(next)) {
      path.push(next);
      found.push(path.slice());
      angle = segAngle(g, path);
      node = next;
    } else {
      path.push(next);
      break;
    }
  }
  const finish = p => ({ ok: true, path: p, state: { node: p[p.length - 1], angle: segAngle(g, p) } });
  for (const p of found) {
    if (g.neighbors(p[p.length - 1]).includes(destId)) return finish(p);
  }
  if (found.length) return finish(found[0]);
  return finish(path);
}

export function turn(g, state, dir) {
  const nb = g.neighbors(state.node);
  if (nb.length === 0) return { ok: false, state, reason: 'noturn' };
  const cur = normalizeAngle(state.angle);
  let options = nb.map(n => {
    const a = g.angle(state.node, n);
    let d = normalizeAngle(a - cur);
    if (dir === 'left' && d > 0) d -= 2 * Math.PI;
    if (dir === 'right' && d < 0) d += 2 * Math.PI;
    return { a, d };
  });
  if (dir === 'left') {
    options = options.filter(o => o.d < -0.1).sort((x, y) => y.d - x.d);
  } else {
    options = options.filter(o => o.d > 0.1).sort((x, y) => x.d - y.d);
  }
  if (!options.length) return { ok: false, state, reason: 'noturn' };
  const ideal = options.find(o => dir === 'left'
    ? (o.d <= -Math.PI / 4 && o.d >= -3 * Math.PI / 4)
    : (o.d >= Math.PI / 4 && o.d <= 3 * Math.PI / 4));
  const pick = ideal || options[0];
  return { ok: true, state: { node: state.node, angle: pick.a }, turnBy: pick.d };
}

// ---- Programs ----
// A program is an array of blocks: { type, n? } with type one of
// straight | littlebit | left | right | lookLeft | lookRight

export const BLOCK_TYPES = ['straight', 'littlebit', 'right', 'left', 'lookLeft', 'lookRight'];
export const TERMINAL = new Set(['lookLeft', 'lookRight']);

export function blockLabel(b) {
  switch (b.type) {
    case 'straight': return `go straight for ${b.n || 1} ${(b.n || 1) === 1 ? 'block' : 'blocks'}`;
    case 'littlebit': return 'go straight for a little bit';
    case 'right': return 'turn right';
    case 'left': return 'turn left';
    case 'lookLeft': return 'you can see it on your left';
    case 'lookRight': return 'you can see it on your right';
  }
  return b.type;
}

// Detects the original "spin" easter egg: 4+ turns in a row that all go the
// same way, or that alternate left/right. Moving resets the sequence.
function spinCheck(seq) {
  if (seq.length > 6) seq.splice(0, seq.length - 6);
  if (seq.length < 4) return false;
  let alternating = true;
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) { alternating = false; break; }
  const last = seq[seq.length - 1];
  let repeating = true;
  for (let i = seq.length - 4; i < seq.length; i++) if (seq[i] !== last) { repeating = false; break; }
  return alternating || repeating;
}

// Runs a whole program and returns a list of animation steps plus the result.
// Stops at the first block that cannot be done, or when the destination is
// reached.
export function simulate(g, program, startId, destId) {
  let state = g.initialState(startId);
  const steps = [];
  const turns = [];
  const result = { won: false, failIndex: -1, dizzy: false, steps, endState: state };
  for (let i = 0; i < program.length; i++) {
    const b = program[i];
    const sub = [];
    const doTurn = dir => {
      const r = turn(g, state, dir);
      if (r.ok) { sub.push({ kind: 'turn', from: state.angle, to: r.state.angle, by: r.turnBy, node: state.node }); state = r.state; }
      return r.ok;
    };
    const doMove = r => {
      if (r.ok) { sub.push({ kind: 'move', path: r.path }); state = r.state; }
      return r.ok;
    };
    let ok = true;
    if (b.type === 'straight') { turns.length = 0; ok = doMove(goStraight(g, state, b.n || 1, destId)); }
    else if (b.type === 'littlebit') { turns.length = 0; ok = doMove(goLittleBit(g, state, destId)); }
    else if (b.type === 'left' || b.type === 'right') {
      ok = doTurn(b.type);
      if (ok) { turns.push(b.type); if (spinCheck(turns)) { steps.push({ block: i, sub, ok: true }); result.dizzy = true; result.failIndex = i; result.endState = state; return result; } }
    } else if (b.type === 'lookLeft' || b.type === 'lookRight') {
      const dir = b.type === 'lookLeft' ? 'left' : 'right';
      ok = doTurn(dir);
      if (ok) { turns.length = 0; ok = doMove(goStraight(g, state, 1, destId)); }
    }
    steps.push({ block: i, sub, ok });
    if (!ok) { result.failIndex = i; result.endState = state; return result; }
    if (state.node === destId) { result.won = true; result.endState = state; return result; }
  }
  result.endState = state;
  return result;
}
