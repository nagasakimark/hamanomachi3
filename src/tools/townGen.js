// Town generator for the Map Composer.
//
// Makes a busy, irregular town from a list of places:
//  1. Streets: an outer ring road (with cut corners), then blocks are split again
//     and again at uneven positions, sometimes at a slant, until there are about
//     enough blocks for the buildings. No dead ends, lots of T-junctions.
//  2. Optional row of buildings outside the ring along one side.
//  3. Buildings are placed big ones first, hugging a street, turned to follow
//     slanted streets, with a label that fits beside them and a pin + walkway to
//     the road. Doors stay well away from junctions (needed for "a little bit").
//  4. Bus stops go outside the ring with an arrow on the road.
// The result is plain Composer data (nodes, edges, paths, items), so it can be
// edited by hand afterwards. Same seed = same town.
//
// generateTown({ places: [{ name, lib, iw, ih, box }], seed, w, h, measure, ... })
//   iw, ih = picture size; box = { w, h, cx, cy } opaque part of the picture (pixels)
//   measure(text) -> { w, h } of a label box

const BIG = /stadium|dome|department|hospital|castle|museum|mall|airport|aquarium|amusement|zoo|factory|city hall|station|school|temple|church|planetarium|hotel|dam|farm|theater|kindergarten|library/;
const SMALL = /flower|ice cream|house|castella|convenience|ramen|soba|sushi|tonkatsu|chawanmushi|bookstore|gas|bank|post office|police|shrine|garden/;

function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const V = (x, y) => ({ x, y });
const sub = (a, b) => V(a.x - b.x, a.y - b.y);
const add = (a, b) => V(a.x + b.x, a.y + b.y);
const mul = (a, k) => V(a.x * k, a.y * k);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = a => Math.hypot(a.x, a.y);
const norm = a => { const l = len(a) || 1; return V(a.x / l, a.y / l); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function projSeg(p, a, b) {
  const d = sub(b, a), L = dot(d, d) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / L));
  const q = add(a, mul(d, t));
  return { t, x: q.x, y: q.y, d: dist(p, q) };
}
function segSegDist(a, b, c, d) {
  const d1 = sub(b, a), d2 = sub(d, c), den = cross(d1, d2);
  if (Math.abs(den) > 1e-9) {
    const t = cross(sub(c, a), d2) / den, u = cross(sub(c, a), d1) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(projSeg(a, c, d).d, projSeg(b, c, d).d, projSeg(c, a, b).d, projSeg(d, a, b).d);
}
function polyArea(P) { let s = 0; for (let i = 0; i < P.length; i++) s += cross(P[i], P[(i + 1) % P.length]); return s / 2; }
function bbox(P) { const xs = P.map(p => p.x), ys = P.map(p => p.y); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; }
// Is point inside a convex polygon (any winding), with a margin?
function insideConvex(P, p, m = 0) {
  const s = Math.sign(polyArea(P));
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], e = sub(b, a), l = len(e) || 1;
    if (s * cross(e, sub(p, a)) / l < m) return false;
  }
  return true;
}
// Split a convex polygon by the line through p with direction d. Vertex i carries
// the kind of the edge i -> i+1; the cut edge gets `cutKind`.
function splitPoly(P, p, d, cutKind) {
  const A = [], B = [], X = [], side = v => cross(d, sub(v, p));
  for (let i = 0; i < P.length; i++) {
    const v = P[i], w = P[(i + 1) % P.length], sv = side(v), sw = side(w);
    (sv >= 0 ? A : B).push({ ...v });
    if ((sv >= 0) !== (sw >= 0)) {
      const t = sv / (sv - sw), q = add(v, mul(sub(w, v), t));
      X.push(q);
      if (sv >= 0) { A.push({ ...q, kind: cutKind }); B.push({ ...q, kind: v.kind }); } else { B.push({ ...q, kind: cutKind }); A.push({ ...q, kind: v.kind }); }
    }
  }
  return [A, B, X];
}
// Move every edge of a convex polygon inwards by off(kind).
function inset(P, off) {
  const s = Math.sign(polyArea(P)), n = P.length, lines = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], e = norm(sub(b, a));
    const inward = s > 0 ? V(-e.y, e.x) : V(e.y, -e.x);
    const o = off(a.kind);
    lines.push({ p: add(a, mul(inward, o)), d: e });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const L1 = lines[(i + n - 1) % n], L2 = lines[i], den = cross(L1.d, L2.d);
    if (Math.abs(den) < 1e-6) { out.push(L2.p); continue; }
    const t = cross(sub(L2.p, L1.p), L2.d) / den;
    out.push(add(L1.p, mul(L1.d, t)));
  }
  return polyArea(out) * s > 0 ? out : null;
}
// Oriented rectangle helpers.
function obb(c, hw, hh, rotDeg) {
  const r = rotDeg * Math.PI / 180, u = V(Math.cos(r), Math.sin(r)), v = V(-Math.sin(r), Math.cos(r));
  return { c, hw, hh, u, v, pts: [add(add(c, mul(u, -hw)), mul(v, -hh)), add(add(c, mul(u, hw)), mul(v, -hh)), add(add(c, mul(u, hw)), mul(v, hh)), add(add(c, mul(u, -hw)), mul(v, hh))] };
}
function obbOverlap(A, B, pad = 0) {
  for (const ax of [A.u, A.v, B.u, B.v]) {
    const pa = A.pts.map(p => dot(p, ax)), pb = B.pts.map(p => dot(p, ax));
    if (Math.max(...pa) + pad < Math.min(...pb) || Math.max(...pb) + pad < Math.min(...pa)) return false;
  }
  return true;
}
const rectBox = (x, y, w, h) => obb(V(x + w / 2, y + h / 2), w / 2, h / 2, 0);
function boxRoadDist(B, roads) {
  let m = 1e9;
  for (const r of roads) {
    let d = 1e9;
    for (let i = 0; i < 4; i++) d = Math.min(d, segSegDist(B.pts[i], B.pts[(i + 1) % 4], r.a, r.b));
    if (insideConvex(B.pts, r.a) || insideConvex(B.pts, r.b)) d = 0;
    m = Math.min(m, d - r.hw);
  }
  return m;
}

export function generateTown(opt) {
  // Try a few variations of this layout number until every place fits.
  let best = null;
  for (let k = 0; k < 10; k++) {
    const r = generateOnce({ ...opt, seed: (opt.seed || 1) * 7919 + k * 104729 });
    const score = r.missing.length * 10 + Math.max(0, (opt.busStops || 4) - r.items.filter(i => i.type === 'bus').length);
    if (!best || score < best.score) best = { ...r, score };
    if (!score) break;
  }
  return best;
}
function generateOnce(opt) {
  const W = opt.w || 1600, H = opt.h || 1130;
  const R = rng(opt.seed || 1);
  const rr = (a, b) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const rwMain = opt.rwMain || 60, rwStreet = opt.rwStreet || 44;
  const places = opt.places.slice();
  const N = places.length;
  const D = opt.size || Math.round(Math.min(W, H * 1.42) * 0.11); // typical building size
  const halfW = k => (k === 'main' ? rwMain / 2 : k === 'street' ? rwStreet / 2 : 0);

  // ---- 1. outer ring -------------------------------------------------------
  const stripSide = opt.outsideRow === false ? null : pick(['top', 'top', 'bottom']);
  const M = { l: 150, r: 150, t: 142, b: 142 };
  if (stripSide === 'top') { M.t = D * 1.55; M.b = 160; } if (stripSide === 'bottom') { M.b = D * 1.55; M.t = 160; }
  const x0 = M.l, y0 = M.t, x1 = W - M.r, y1 = H - M.b;
  const corners = [V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)];
  const chamf = [0, 1, 2, 3].map(() => (R() < 0.45 ? rr(80, 150) : 0));
  if (!chamf.some(Boolean)) chamf[Math.floor(R() * 4)] = rr(90, 150);
  const outer = [];
  corners.forEach((c, i) => {
    const prev = corners[(i + 3) % 4], next = corners[(i + 1) % 4], k = chamf[i];
    if (!k) outer.push({ ...c, kind: 'main' });
    else { outer.push({ ...add(c, mul(norm(sub(prev, c)), k)), kind: 'main' }); outer.push({ ...add(c, mul(norm(sub(next, c)), k)), kind: 'main' }); }
  });

  // ---- 2. split into blocks -----------------------------------------------
  const stripCount = stripSide ? Math.max(2, Math.round(N * 0.2)) : 0;
  const innerN = N - stripCount;
  const target = Math.max(3, Math.round(innerN / (opt.perBlock || 1.15)) + 1);
  let blocks = [outer];
  const cuts = [];                                  // [{a, b, kind}]
  const junctions = outer.map(p => V(p.x, p.y));    // every road node so far
  const MINSIDE = D * 1.18;
  let slants = 0, guard = 0;
  while (blocks.length < target && guard++ < 400) {
    blocks.sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)));
    let done = false;
    for (let bi = 0; bi < blocks.length && !done; bi++) {
      const P = blocks[bi], bb = bbox(P), bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
      for (let tries = 0; tries < 14 && !done; tries++) {
        const vertical = bw / bh > 1.2 ? true : bh / bw > 1.2 ? false : R() < 0.5;
        const f = rr(0.32, 0.68);
        const slant = slants < (opt.slants ?? 2) && R() < (opt.slantChance ?? 0.3) ? (R() < 0.5 ? -1 : 1) * rr(0.25, 0.5) : 0;
        const p = vertical ? V(bb.x0 + bw * f, (bb.y0 + bb.y1) / 2) : V((bb.x0 + bb.x1) / 2, bb.y0 + bh * f);
        const d = vertical ? norm(V(slant, 1)) : norm(V(1, slant));
        const kind = cuts.length === 0 && opt.avenue !== false ? 'main' : 'street';
        const [A, B, ce] = splitPoly(P, p, d, kind);
        if (A.length < 3 || B.length < 3 || ce.length !== 2) continue;
        if (dist(ce[0], ce[1]) < MINSIDE * 0.8) continue;
        if (ce.some(q => junctions.some(j => dist(j, q) < D * 0.62))) continue;
        const ok = [A, B].every(Q => {
          const b2 = bbox(Q), ins = inset(Q, k => halfW(k) + 10);
          // no slivers: a building-sized square must still fit inside
          const core = inset(Q, k => halfW(k) + D * 0.4);
          const cb = core && bbox(core);
          return Math.abs(polyArea(Q)) > MINSIDE * MINSIDE * 0.9 && Math.min(b2.x1 - b2.x0, b2.y1 - b2.y0) > MINSIDE && ins && core && Math.min(cb.x1 - cb.x0, cb.y1 - cb.y0) > D * 0.25 && Math.abs(polyArea(core)) > D * D * 0.12;
        });
        if (!ok) continue;
        blocks.splice(bi, 1, A, B);
        cuts.push({ a: V(ce[0].x, ce[0].y), b: V(ce[1].x, ce[1].y), kind });
        junctions.push(V(ce[0].x, ce[0].y), V(ce[1].x, ce[1].y));
        if (slant) slants++;
        done = true;
      }
    }
    if (!done) break;
  }

  // ---- 3. road graph (split segments at every node lying on them) ----------
  const segs = [];
  outer.forEach((p, i) => segs.push({ a: V(p.x, p.y), b: V(outer[(i + 1) % outer.length].x, outer[(i + 1) % outer.length].y), kind: 'main' }));
  segs.push(...cuts);
  const nodes = [];
  const nodeAt = p => { let n = nodes.find(q => dist(q, p) < 2); if (!n) { n = { id: 'n' + (nodes.length + 1), x: Math.round(p.x), y: Math.round(p.y) }; nodes.push(n); } return n; };
  segs.forEach(s => { nodeAt(s.a); nodeAt(s.b); });
  const edges = [];
  for (const s of segs) {
    const on = nodes.map(n => ({ n, ps: projSeg(n, s.a, s.b) })).filter(o => o.ps.d < 2).sort((p, q) => p.ps.t - q.ps.t);
    for (let i = 0; i + 1 < on.length; i++) if (on[i].n !== on[i + 1].n) edges.push({ id: 'e' + (edges.length + 1), a: on[i].n.id, b: on[i + 1].n.id, w: s.kind });
  }
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const roads = edges.map(e => ({ a: nodeById.get(e.a), b: nodeById.get(e.b), hw: halfW(e.w) + 6 }));

  // ---- 4. places ----------------------------------------------------------
  const stripPoly = stripSide === 'top'
    ? [{ ...V(x0 + chamf[0], 18), kind: 'none' }, { ...V(x1 - chamf[1], 18), kind: 'none' }, { ...V(x1 - chamf[1], y0), kind: 'main' }, { ...V(x0 + chamf[0], y0), kind: 'none' }]
    : stripSide === 'bottom'
      ? [{ ...V(x0 + chamf[3], y1), kind: 'main' }, { ...V(x1 - chamf[2], y1), kind: 'none' }, { ...V(x1 - chamf[2], H - 18), kind: 'none' }, { ...V(x0 + chamf[3], H - 18), kind: 'none' }]
      : null;
  // the strip's road edge must run left->right on top/bottom the same way: fix winding so 'main' marks the road side
  const areas = blocks.map(P => ({ P, poly: P, ins: inset(P, k => halfW(k) + 12), cap: 0, n: 0, strip: false }));
  areas.forEach(a => { a.cap = Math.max(1, Math.min(3, Math.round(Math.abs(polyArea(a.P)) / (D * D * 2.6)))); });
  if (stripPoly) areas.push({ P: stripPoly, ins: inset(stripPoly, k => (k === 'main' ? halfW(k) + 12 : 4)), cap: stripCount, n: 0, strip: true });
  // leave a block or two open (a park, a pond: the background art fills it)
  const capTotal = areas.reduce((t, a) => t + a.cap, 0);

  const placed = [];   // { place, box, rot, door, proj, label }
  const labels = [];   // obb of labels
  const pinProj = [];  // points on roads used by doors / bus stops
  const nodePts = nodes.map(n => V(n.x, n.y));
  const sizeOf = pl => {
    const k = BIG.test(pl.name) ? 1.22 : SMALL.test(pl.name) ? 0.92 : 1;
    const bw = pl.box?.w || pl.iw, bh = pl.box?.h || pl.ih;
    const s = D * k / Math.max(bw, bh);
    return { s, w: bw * s, h: bh * s, ox: ((pl.box?.cx ?? pl.iw / 2) - pl.iw / 2) * s, oy: ((pl.box?.cy ?? pl.ih / 2) - pl.ih / 2) * s };
  };
  const order = places.map(pl => ({ pl, sz: sizeOf(pl), r: R() })).sort((a, b) => b.sz.w * b.sz.h - a.sz.w * a.sz.h + (a.r - b.r) * 400);
  const canvasBox = { x0: 8, y0: 8, x1: W - 8, y1: H - 8 };
  const inCanvas = B => B.pts.every(p => p.x >= canvasBox.x0 && p.x <= canvasBox.x1 && p.y >= canvasBox.y0 && p.y <= canvasBox.y1);

  function labelFor(name, bld, door) {
    const m = opt.measure ? opt.measure(name) : { w: name.length * 11 + 20, h: 30 };
    const bb = bbox(bld.pts), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, g = 10;
    const cands = [
      V(bb.x1 + g + m.w / 2, cy + rr(-10, 10)), V(bb.x0 - g - m.w / 2, cy + rr(-10, 10)),
      V(bb.x1 + g + m.w / 2 - 10, bb.y1 - m.h / 2), V(bb.x0 - g - m.w / 2 + 10, bb.y1 - m.h / 2),
      V(cx, bb.y1 + g + m.h / 2), V(cx, bb.y0 - g - m.h / 2),
      V(bb.x1 + g + m.w / 2 - 10, bb.y0 + m.h / 2), V(bb.x0 - g - m.w / 2 + 10, bb.y0 + m.h / 2),
      // overlapping the building's own edge a little, like a shop sign
      V(bb.x1 - m.w * 0.25, bb.y1 - m.h * 0.2), V(bb.x0 + m.w * 0.25, bb.y1 - m.h * 0.2),
      V(bb.x1 - m.w * 0.2, cy + m.h * 0.8), V(bb.x0 + m.w * 0.2, cy + m.h * 0.8), V(cx, bb.y1 - m.h * 0.3),
    ];
    let best = null;
    for (const c of cands) {
      const L = rectBox(c.x - m.w / 2, c.y - m.h / 2, m.w, m.h);
      if (!inCanvas(L)) continue;
      if (placed.some(o => o.box !== bld && obbOverlap(o.box, L, 4)) || labels.some(o => obbOverlap(o, L, 8))) continue;
      const overOwn = obbOverlap(bld, L, 0);
      const rd = boxRoadDist(L, roads);
      if (rd < -4) continue;
      const sc = -dist(c, door) * 0.6 + Math.min(rd, 20) + R() * 8 - (overOwn ? (relax ? 20 : 220) : 0);
      if (!best || sc > best.sc) best = { L, c, sc };
    }
    return best;
  }

  let relax = 0;   // 0 strict .. 2 loose (used only when a place does not fit)
  function tryArea(area, pl, sz) {
    if (!area.ins) return null;
    const P = area.P, s = Math.sign(polyArea(P)), cands = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (a.kind === 'none') continue;
      const e = sub(b, a), L = len(e), ue = norm(e);
      if (L < D) continue;
      const inward = s > 0 ? V(-ue.y, ue.x) : V(ue.y, -ue.x);
      // follow the street: stay upright, but lean with slanted streets
      let ang = Math.atan2(ue.y, ue.x) * 180 / Math.PI;
      let dev = ((ang % 90) + 90) % 90; if (dev > 45) dev -= 90;
      const rot = Math.abs(dev) < 6 ? 0 : Math.max(-24, Math.min(24, dev)); // lean with the street, never tip over
      const B0 = obb(V(0, 0), sz.w / 2, sz.h / 2, rot);
      const ext = Math.abs(sz.w / 2 * dot(B0.u, inward)) + Math.abs(sz.h / 2 * dot(B0.v, inward));
      const off = halfW(a.kind) + (opt.setback ?? 30);
      for (let t = relax ? 0.04 : 0.08; t <= (relax ? 0.96 : 0.92); t += 0.03) {
        const q = add(a, mul(e, t)), c = add(q, mul(inward, off + ext + rr(0, 8)));
        const B = obb(c, sz.w / 2, sz.h / 2, rot);
        if (!B.pts.every(p => insideConvex(area.ins, p, 2))) continue;
        if (!inCanvas(B)) continue;
        if (placed.some(o => obbOverlap(o.box, B, 18)) || labels.some(o => obbOverlap(o, B, 6))) continue;
        const door = add(c, mul(inward, -(ext + 4)));
        const pj = projSeg(door, a, b), proj = V(pj.x, pj.y);
        const gapN = relax > 1 ? 66 : 84;
        if (nodePts.some(n => dist(n, proj) < gapN)) continue;
        if (pinProj.some(o => dist(o, proj) < gapN)) continue;
        let sc = 0;
        if (inward.y < -0.7) sc += 34;            // street below the building: front faces the road
        else if (Math.abs(inward.x) > 0.7) sc += 16;
        if (area.strip) sc += 10;
        sc -= Math.abs(t - 0.5) * 18;
        const near = placed.filter(o => o.area === area).map(o => dist(o.box.c, c));
        if (near.length) sc += Math.min(...near) * 0.08;
        if (rot) sc += 12;                         // slanted streets look nice with buildings on them
        sc += R() * 14;
        cands.push({ sc, B, rot, door, proj, edge: [a, b] });
      }
    }
    cands.sort((p, q) => q.sc - p.sc);
    for (const cd of cands.slice(0, 60)) {
      placed.push({ box: cd.B, area }); // reserve while testing the label
      const lab = labelFor(pl.name, cd.B, cd.door);
      placed.pop();
      if (!lab) continue;
      return { ...cd, lab };
    }
    return null;
  }

  const missing = [];
  for (const { pl, sz } of order) {
    const pref = areas.filter(a => a.n < a.cap).sort((a, b) => (a.strip - b.strip) * 0 + a.n / a.cap - b.n / b.cap + (R() - 0.5) * 0.3);
    const rest = areas.filter(a => !pref.includes(a)).sort(() => R() - 0.5);
    let got = null;
    for (relax = 0; relax < 3 && !got; relax++) {
      const s2 = relax > 1 ? { ...sz, w: sz.w * 0.88, h: sz.h * 0.88, s: sz.s * 0.88, ox: sz.ox * 0.88, oy: sz.oy * 0.88 } : sz;
      for (const area of relax ? [...areas].sort((a, b) => a.n - b.n) : [...pref, ...rest]) {
        if (area.strip && !relax && area.n >= area.cap) continue;
        got = tryArea(area, pl, s2);
        if (got) { area.n++; got.area = area; got.sz = s2; break; }
      }
    }
    relax = 0;
    if (!got) { missing.push(pl.name); continue; }
    placed.push({ pl, sz: got.sz, box: got.B, rot: got.rot, door: got.door, proj: got.proj, area: got.area });
    labels.push(got.lab.L);
    pinProj.push(got.proj);
    got.lab.place = pl.name;
    placed[placed.length - 1].lab = got.lab;
  }

  // ---- 5. bus stops ---------------------------------------------------------
  const busItems = [];
  const sides = outer.map((p, i) => ({ a: V(p.x, p.y), b: V(outer[(i + 1) % outer.length].x, outer[(i + 1) % outer.length].y) }))
    .filter(s => dist(s.a, s.b) > D * 2.2);
  const wantSides = sides.map(s => ({ s, side: Math.abs(s.a.x - s.b.x) < 1 ? (s.a.x < W / 2 ? 'l' : 'r') : Math.abs(s.a.y - s.b.y) < 1 ? (s.a.y < H / 2 ? 't' : 'b') : 'x' }))
    .filter(o => o.side !== 'x' && !(stripSide === 'top' && o.side === 't') && !(stripSide === 'bottom' && o.side === 'b'));
  const nStops = Math.min(opt.busStops || 4, 4);
  const letters = 'ABCD';
  const cx0 = W / 2, cy0 = H / 2;
  const orderSides = wantSides.sort(() => R() - 0.5);
  const stops = [];
  for (let round = 0; round < 3 && stops.length < nStops; round++) {
    for (const { s } of orderSides) {
      if (stops.length >= nStops) break;
      const e = sub(s.b, s.a), ue = norm(e);
      let outward = V(-ue.y, ue.x); if (dot(outward, sub(V(cx0, cy0), s.a)) > 0) outward = mul(outward, -1);
      const ts = [0.3, 0.5, 0.7, 0.22, 0.78, 0.4, 0.6, 0.15, 0.85, 0.35, 0.65].map(t => t + rr(-0.04, 0.04));
      for (const t of ts) {
        const q = add(s.a, mul(e, t));
        if (stops.some(o => dist(o, q) < 300)) continue;
        if (nodePts.some(n => dist(n, q) < 92) || pinProj.some(o => dist(o, q) < 92)) continue;
        const sh = add(q, mul(outward, rwMain / 2 + 46));
        const SB = rectBox(sh.x - 56, sh.y - 36, 112, 110);
        if (!inCanvas(SB) || placed.some(o => obbOverlap(o.box, SB, 6)) || labels.some(o => obbOverlap(o, SB, 6))) continue;
        const dir = R() < 0.5 ? ue : mul(ue, -1);
        const ar = add(q, mul(dir, 78));
        if (nodePts.some(n => dist(n, ar) < 70)) continue;
        stops.push(q);
        const letter = letters[busItems.length / 2];
        busItems.push({ id: 'bus' + letter, type: 'bus', text: letter, x: Math.round(sh.x), y: Math.round(sh.y) });
        busItems.push({ id: 'arrow' + letter, type: 'arrow', x: Math.round(ar.x), y: Math.round(ar.y), rot: Math.round(Math.atan2(dir.y, dir.x) * 180 / Math.PI) });
        pinProj.push(q);
        labels.push(SB);
        break;
      }
    }
  }

  // ---- 6. title -----------------------------------------------------------
  const items = [];
  if (opt.title) {
    const m = opt.measure ? opt.measure(opt.title, true) : { w: 300, h: 60 };
    const spots = [V(W - m.w / 2 - 24, m.h / 2 + 20), V(m.w / 2 + 24, m.h / 2 + 20), V(W - m.w / 2 - 24, H - m.h / 2 - 20), V(m.w / 2 + 24, H - m.h / 2 - 20)];
    for (const c of spots) {
      const L = rectBox(c.x - m.w / 2, c.y - m.h / 2, m.w, m.h);
      if (placed.some(o => obbOverlap(o.box, L, 6)) || labels.some(o => obbOverlap(o, L, 6)) || boxRoadDist(L, roads) < 0) continue;
      items.push({ id: 'title', type: 'label', kind: 'title', text: opt.title, x: Math.round(c.x), y: Math.round(c.y) });
      break;
    }
  }

  // ---- 7. Composer data -----------------------------------------------------
  const paths = [];
  placed.forEach((o, i) => {
    const pl = o.pl, sz = o.sz;
    // picture centre = box centre minus the opaque-box offset (rotated)
    const r = o.rot * Math.PI / 180, off = V(sz.ox * Math.cos(r) - sz.oy * Math.sin(r), sz.ox * Math.sin(r) + sz.oy * Math.cos(r));
    const c = sub(o.box.c, off);
    items.push({ id: 'b' + i, type: 'image', lib: pl.lib, x: Math.round(c.x), y: Math.round(c.y), s: +sz.s.toFixed(4), rot: Math.round(o.rot), flip: false, under: false });
    paths.push({ id: 'w' + i, w: opt.pathW || 18, pts: [{ x: Math.round(o.proj.x), y: Math.round(o.proj.y) }, { x: Math.round(o.door.x), y: Math.round(o.door.y) }] });
    items.push({ id: 'p' + i, type: 'place', text: pl.name, px: Math.round(o.door.x), py: Math.round(o.door.y), lx: Math.round(o.lab.c.x), ly: Math.round(o.lab.c.y) });
  });
  items.push(...busItems);
  return { nodes, edges, paths, items, missing, stats: { blocks: blocks.length, open: areas.filter(a => !a.n).length, capTotal } };
}
