// Town generator for the Map Composer (v2).
//
// Streets: a frame (ring road, maybe tilted and with cut corners), several
// cross-town streets that run at slightly different angles, and in every band
// between them short side streets at their own positions, so junctions are
// staggered (lots of T-junctions, few plain crossroads). One or two diagonal
// avenues cut through, and some short pieces are removed to make long blocks.
// Every seed picks its own row count, spacing, tilt and number of diagonals.
//
// Buildings: smaller than before, spread over the whole town, each one turned
// so its FRONT (the bottom of the picture, where the door is) faces its street:
// upright on a street below it, sideways on a street beside it, leaning on a
// slanted street. The walkway runs straight from the road to the door.
//
// The result is plain Composer data (nodes, edges, paths, items), so it can be
// edited by hand afterwards. Same seed = same town.
//
// generateTown({ places: [{ name, lib, iw, ih, box }], seed, w, h, measure, ... })
//   iw, ih = picture size; box = { w, h, cx, cy } opaque part of the picture (pixels)
//   measure(text, title?) -> { w, h } of a label box

const BIG = /stadium|dome|department|hospital|castle|museum|mall|airport|aquarium|amusement|zoo|factory|city hall|school|temple|church|planetarium|hotel|dam|farm|theater|kindergarten|library|station/;
const SMALL = /flower|ice cream|house|castella|convenience|ramen|soba|tonkatsu|chawanmushi|bookstore|gas|bank|post office|shrine|garden|tower/;

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
const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
function projSeg(p, a, b) {
  const d = sub(b, a), L = dot(d, d) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / L));
  const q = add(a, mul(d, t));
  return { t, x: q.x, y: q.y, d: dist(p, q) };
}
function segX(a, b, c, d) {
  const d1 = sub(b, a), d2 = sub(d, c), den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(c, a), d2) / den, u = cross(sub(c, a), d1) / den;
  return t > -1e-9 && t < 1 + 1e-9 && u > -1e-9 && u < 1 + 1e-9 ? { t, u, p: add(a, mul(d1, t)) } : null;
}
function segSegDist(a, b, c, d) {
  if (segX(a, b, c, d)) return 0;
  return Math.min(projSeg(a, c, d).d, projSeg(b, c, d).d, projSeg(c, a, b).d, projSeg(d, a, b).d);
}
// Oriented rectangles.
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
const inBox = (B, p) => Math.abs(dot(sub(p, B.c), B.u)) <= B.hw && Math.abs(dot(sub(p, B.c), B.v)) <= B.hh;
const rectBox = (x, y, w, h) => obb(V(x + w / 2, y + h / 2), w / 2, h / 2, 0);
function boxSegDist(B, a, b) {
  if (inBox(B, a) || inBox(B, b)) return 0;
  let d = 1e9;
  for (let i = 0; i < 4; i++) d = Math.min(d, segSegDist(B.pts[i], B.pts[(i + 1) % 4], a, b));
  return d;
}
function aabb(B) { const xs = B.pts.map(p => p.x), ys = B.pts.map(p => p.y); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; }
function pointInPoly(P, p) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if ((P[i].y > p.y) !== (P[j].y > p.y) && p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c;
  }
  return c;
}

export function generateTown(opt) {
  // Try variations of this layout number until every place fits.
  let best = null;
  for (let k = 0; k < 14; k++) {
    const r = generateOnce({ ...opt, seed: (opt.seed || 1) * 7919 + k * 104729 });
    if (!r) continue;
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
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const rwMain = opt.rwMain || 54, rwStreet = opt.rwStreet || 38;
  const D = opt.size || 118;                       // typical building size (px)
  const places = opt.places.slice();
  const N = places.length;

  // ---- 1. the frame -----------------------------------------------------------
  const outsideRow = opt.outsideRow !== false && R() < 0.75;
  const rowSide = outsideRow ? (R() < 0.6 ? 'top' : 'bottom') : null;
  const mL = rr(140, 175), mR = rr(140, 175);
  const mT = rowSide === 'top' ? rr(185, 215) : rr(140, 165), mB = rowSide === 'bottom' ? rr(185, 215) : rr(140, 165);
  const x0 = mL, x1 = W - mR;
  const tiltT = rr(-28, 28), tiltB = rr(-28, 28);
  const yTop = x => mT + 14 + tiltT * ((x - x0) / (x1 - x0) - 0.5);
  const yBot = x => H - mB - 14 + tiltB * ((x - x0) / (x1 - x0) - 0.5);

  // cross-town streets (horizontal-ish lines), each with its own tilt
  const innerH = (yBot(W / 2) - yTop(W / 2));
  const rows = Math.max(2, Math.min(5, Math.round(innerH / rr(150, 230))));
  let lines;
  for (let tries = 0; ; tries++) {
    lines = [{ y: x => yTop(x), kind: 'main', frame: true }];
    for (let i = 1; i < rows; i++) {
      const f = (i + rr(-0.18, 0.18)) / rows, t = rr(-36, 36);
      lines.push({ y: x => yTop(x) + (yBot(x) - yTop(x)) * f + t * ((x - x0) / (x1 - x0) - 0.5), kind: 'street' });
    }
    lines.push({ y: x => yBot(x), kind: 'main', frame: true });
    let ok = true;
    for (let i = 0; i + 1 < lines.length; i++) for (const x of [x0, (x0 + x1) / 2, x1]) if (lines[i + 1].y(x) - lines[i].y(x) < 128) ok = false;
    if (ok) break;
    if (tries > 30) return null;
  }
  if (rows >= 3 && R() < 0.6) lines[ri(1, rows - 1)].kind = 'main';

  const segs = [];   // { a, b, kind }
  const P = (l, x) => V(x, l.y(x));
  // cut corners, but never so far that they reach the next street along the side
  const room = [lines[1].y(x0) - lines[0].y(x0), lines[1].y(x1) - lines[0].y(x1), lines.at(-1).y(x1) - lines.at(-2).y(x1), lines.at(-1).y(x0) - lines.at(-2).y(x0)];
  const cut = [0, 1, 2, 3].map(i => { const k = R() < 0.42 ? rr(70, 130) : 0; return k && k < room[i] - 64 ? k : 0; });
  const top = lines[0], bot = lines[lines.length - 1];
  const TL = P(top, x0), TR = P(top, x1), BR = P(bot, x1), BL = P(bot, x0);
  const corner = (c, a, b, k) => (k ? [add(c, mul(norm(sub(a, c)), k)), add(c, mul(norm(sub(b, c)), k))] : [c, c]);
  const [tlA, tlB] = corner(TL, BL, TR, cut[0]), [trA, trB] = corner(TR, TL, BR, cut[1]), [brA, brB] = corner(BR, TR, BL, cut[2]), [blA, blB] = corner(BL, BR, TL, cut[3]);
  const frame = [tlB, trA, trB, brA, brB, blA, blB, tlA].filter((p, i, arr) => i === 0 || dist(p, arr[i - 1]) > 1);
  for (let i = 0; i < frame.length; i++) segs.push({ a: frame[i], b: frame[(i + 1) % frame.length], kind: 'main', frame: true });
  for (const l of lines.slice(1, -1)) segs.push({ a: P(l, x0), b: P(l, x1), kind: l.kind });
  // side streets in each band, staggered against the band above
  let prevXs = [];
  const minGap = rr(165, 205), maxGap = rr(245, 320);
  for (let i = 0; i + 1 < lines.length; i++) {
    const A = lines[i], B = lines[i + 1], xs = [];
    let x = x0 + rr(minGap * 0.8, maxGap);
    while (x < x1 - minGap * 0.75) {
      // the top end meets the line shared with the band above: line up exactly or keep well apart
      let xa = x;
      const near = prevXs.find(p => Math.abs(p - xa) < 66);
      if (near !== undefined) xa = Math.abs(near - xa) < 16 || R() < 0.35 ? near : near + (xa > near ? 68 : -68);
      if (prevXs.some(p => p !== xa && Math.abs(p - xa) < 66)) { x += rr(minGap, maxGap); continue; }
      const lean = R() < 0.3 ? rr(-70, 70) : rr(-8, 8);
      const xb = xa + lean;
      const inCorner = (i === 0 && (xa < x0 + cut[0] + 50 || xa > x1 - cut[1] - 50)) || (i === lines.length - 2 && (xb < x0 + cut[3] + 50 || xb > x1 - cut[2] - 50));
      if (!inCorner && xa > x0 + 70 && xb > x0 + 70 && xa < x1 - 70 && xb < x1 - 70) { segs.push({ a: P(A, xa), b: P(B, xb), kind: 'street' }); xs.push(xb); }
      x += rr(minGap, maxGap);
    }
    prevXs = xs;
  }
  // one or two diagonal avenues
  const diags = opt.slants ?? ri(1, 2);
  for (let d = 0; d < diags; d++) {
    for (let tries = 0; tries < 20; tries++) {
      const li = ri(0, lines.length - 2), lj = Math.min(lines.length - 1, li + ri(1, 3));
      if (lj === li) continue;
      const xa = rr(x0 + 120, x1 - 120), xb = xa + (R() < 0.5 ? -1 : 1) * rr(140, 380);
      if (xb < x0 + 100 || xb > x1 - 100) continue;
      const a = P(lines[li], xa), b = P(lines[lj], xb);
      if (Math.abs(b.x - a.x) / Math.abs(b.y - a.y) < 0.35) continue;
      if (segs.some(s => !segX(a, b, s.a, s.b) && segSegDist(a, b, s.a, s.b) < 40)) continue;
      segs.push({ a, b, kind: 'street', diag: true });
      break;
    }
  }

  // ---- 2. planar graph (drop diagonals that make tiny pieces) --------------------
  let pts, edges;
  const build = list => {
    pts = [];
    const pointAt = p => { let n = pts.find(q => dist(q, p) < 3); if (!n) { n = V(p.x, p.y); pts.push(n); } return n; };
    const S = list.map(s => ({ ...s, a: pointAt(s.a), b: pointAt(s.b) }));
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const x = segX(S[i].a, S[i].b, S[j].a, S[j].b);
      if (x) pointAt(x.p);
    }
    edges = [];
    for (const s of S) {
      const on = pts.map(n => ({ n, ps: projSeg(n, s.a, s.b) })).filter(o => o.ps.d < 2.5).sort((p, q) => p.ps.t - q.ps.t);
      for (let i = 0; i + 1 < on.length; i++) if (on[i].n !== on[i + 1].n) edges.push({ a: on[i].n, b: on[i + 1].n, kind: s.kind, frame: !!s.frame });
    }
    return !edges.some(e => dist(e.a, e.b) < 52);
  };
  let segList = segs.slice();
  while (!build(segList)) {
    const di = segList.findIndex(s => s.diag);
    if (di < 0) { if (opt.debug) console.log('short', edges.filter(e => dist(e.a, e.b) < 52).map(e => [Math.round(e.a.x), Math.round(e.a.y), Math.round(e.b.x), Math.round(e.b.y)])); return null; }
    segList.splice(di, 1);
  }
  const deg = n => edges.filter(e => e.a === n || e.b === n).length;
  const connected = () => {
    const seen = new Set([edges[0].a]), st = [edges[0].a];
    while (st.length) { const n = st.pop(); for (const e of edges) { const m = e.a === n ? e.b : e.b === n ? e.a : null; if (m && !seen.has(m)) { seen.add(m); st.push(m); } } }
    return pts.filter(p => deg(p) > 0).every(p => seen.has(p));
  };
  // remove some short inner pieces to make longer blocks (never leave a dead end)
  const removeN = Math.round(edges.length * rr(0.06, 0.14));
  for (let k = 0, tries = 0; k < removeN && tries < 60; tries++) {
    const cand = edges.filter(e => !e.frame && e.kind !== 'main');
    const e = cand[Math.floor(R() * cand.length)];
    if (!e || deg(e.a) < 3 || deg(e.b) < 3) continue;
    edges = edges.filter(x => x !== e);
    if (!connected()) { edges.push(e); continue; }
    k++;
  }
  const used = pts.filter(p => deg(p) > 0);
  const nodes = used.map((p, i) => ({ id: 'n' + (i + 1), x: Math.round(p.x), y: Math.round(p.y), p }));
  const idOf = new Map(nodes.map(n => [n.p, n.id]));
  const halfW = k => (k === 'main' ? rwMain / 2 : rwStreet / 2);
  const roads = edges.map(e => ({ a: e.a, b: e.b, hw: halfW(e.kind) }));
  // real junctions/corners (not straight-through points): doors keep away from these
  const junc = used.filter(p => {
    const es = edges.filter(e => e.a === p || e.b === p);
    if (es.length !== 2) return true;
    const d1 = norm(sub(es[0].a === p ? es[0].b : es[0].a, p)), d2 = norm(sub(es[1].a === p ? es[1].b : es[1].a, p));
    return dot(d1, d2) > -0.995;
  });

  // ---- 3. buildings ------------------------------------------------------------
  const frameIn = p => pointInPoly(frame, p);
  const sizeOf = pl => {
    const k = BIG.test(pl.name) ? 1.2 : SMALL.test(pl.name) ? 0.88 : 1;
    const bw = pl.box?.w || pl.iw, bh = pl.box?.h || pl.ih;
    const s = D * k / Math.max(bw, bh);
    return { s, w: bw * s, h: bh * s, ox: ((pl.box?.cx ?? pl.iw / 2) - pl.iw / 2) * s, oy: ((pl.box?.cy ?? pl.ih / 2) - pl.ih / 2) * s };
  };
  const placed = [], labels = [], doorPts = [];
  const canvasOK = B => B.pts.every(p => p.x >= 10 && p.x <= W - 10 && p.y >= 10 && p.y <= H - 10);
  const order = places.map(pl => ({ pl, sz: sizeOf(pl), r: R() })).sort((a, b) => b.sz.w * b.sz.h * (0.7 + a.r * 0.6) - a.sz.w * a.sz.h * (0.7 + b.r * 0.6));
  const SET = opt.setback ?? 22;   // walkway length between road edge and door
  let outsideCount = 0;
  const maxOutside = rowSide ? Math.max(2, Math.round(N * 0.22)) : 0;

  function labelFor(name, bld, door, strict) {
    const m = opt.measure ? opt.measure(name) : { w: name.length * 9 + 18, h: 28 };
    const bb = aabb(bld), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, g = 6;
    const cands = [
      V(bb.x1 + g + m.w / 2, cy), V(bb.x0 - g - m.w / 2, cy), V(cx, bb.y1 + g + m.h / 2), V(cx, bb.y0 - g - m.h / 2),
      V(bb.x1 + g + m.w / 2, bb.y0 + m.h / 2), V(bb.x0 - g - m.w / 2, bb.y0 + m.h / 2), V(bb.x1 + g + m.w / 2, bb.y1 - m.h / 2), V(bb.x0 - g - m.w / 2, bb.y1 - m.h / 2),
      V(bb.x1 - m.w / 2 + 14, bb.y0 - g - m.h / 2), V(bb.x0 + m.w / 2 - 14, bb.y0 - g - m.h / 2),
    ];
    if (!strict) cands.push(V(cx, bb.y0 + m.h / 2 - 4), V(cx, bb.y1 - m.h / 2 + 4));
    let best = null;
    for (const c of cands) {
      const L = rectBox(c.x - m.w / 2, c.y - m.h / 2, m.w, m.h);
      if (!canvasOK(L)) continue;
      if (placed.some(o => obbOverlap(o.box, L, 3)) || labels.some(o => obbOverlap(o, L, 6))) continue;
      const overOwn = obbOverlap(bld, L, 0);
      let rd = 1e9;
      for (const r of roads) rd = Math.min(rd, boxSegDist(L, r.a, r.b) - r.hw);
      if (rd < (strict ? 2 : -6)) continue;
      const sc = -dist(c, door) * 0.5 - (overOwn ? 80 : 0) + R() * 10;
      if (!best || sc > best.sc) best = { L, c, sc };
    }
    return best;
  }

  function candidates(pl, sz, strict) {
    const out = [];
    for (const e of edges) {
      const L = dist(e.a, e.b), ue = norm(sub(e.b, e.a)), hw = halfW(e.kind);
      for (const side of [1, -1]) {
        const n = mul(V(-ue.y, ue.x), side);          // from road towards the building
        const f = mul(n, -1);                          // the building's front faces the road
        if (f.y < -0.35) continue;                     // never upside down
        if (sz.h > sz.w * 1.45 && f.y < 0.55) continue; // tall things (towers) stay standing
        const rot = Math.atan2(-f.x, f.y) * 180 / Math.PI;
        const depth = sz.h, half = sz.w / 2;
        for (let s = Math.max(58, half * 0.55); s <= L - Math.max(58, half * 0.55); s += 16) {
          const q = add(e.a, mul(ue, s));
          if (junc.some(j => dist(j, q) < (strict ? 62 : 52))) continue;
          if (doorPts.some(o => dist(o, q) < (strict ? 70 : 56))) continue;
          const door = add(q, mul(n, hw + SET));
          const c = add(door, mul(n, depth / 2));
          const B = obb(c, sz.w / 2, sz.h / 2, rot);
          if (!canvasOK(B)) continue;
          const inside = frameIn(c);
          if (!inside && (!rowSide || outsideCount >= maxOutside || c.x < x0 + 40 || c.x > x1 - 40 || !(rowSide === 'top' ? c.y < yTop(c.x) - 30 : c.y > yBot(c.x) + 30))) continue;
          let ok = true;
          for (const r of roads) if (boxSegDist(B, r.a, r.b) < r.hw + (r.a === e.a && r.b === e.b ? SET - 2 : 12)) { ok = false; break; }
          if (!ok) continue;
          if (placed.some(o => obbOverlap(o.box, B, 12)) || labels.some(o => obbOverlap(o, B, 4))) continue;
          let near = 1e9; for (const o of placed) near = Math.min(near, dist(o.box.c, c));
          let sc = Math.min(near, 420) * 0.25 + R() * 30;   // spread the town out
          if (Math.abs(rot) < 1) sc += 45;
          if (Math.abs(rot) > 1 && Math.abs(Math.abs(rot) - 90) > 1) sc += 14; // leaning on a slanted street
          if (!inside) sc += 10;
          out.push({ sc, B, rot, door, q, inside });
        }
      }
    }
    return out.sort((a, b) => b.sc - a.sc);
  }

  const missing = [];
  for (const { pl, sz: sz0 } of order) {
    let got = null;
    for (let relax = 0; relax < 3 && !got; relax++) {
      const sz = relax === 2 ? { ...sz0, w: sz0.w * 0.86, h: sz0.h * 0.86, s: sz0.s * 0.86, ox: sz0.ox * 0.86, oy: sz0.oy * 0.86 } : sz0;
      for (const cd of candidates(pl, sz, relax === 0).slice(0, 80)) {
        placed.push({ box: cd.B });
        const lab = labelFor(pl.name, cd.B, cd.door, relax === 0);
        placed.pop();
        if (lab) { got = { ...cd, lab, sz }; break; }
      }
    }
    if (!got) { missing.push(pl.name); continue; }
    placed.push({ pl, sz: got.sz, box: got.B, rot: got.rot, door: got.door, q: got.q, lab: got.lab });
    labels.push(got.lab.L);
    doorPts.push(got.q);
    if (!got.inside) outsideCount++;
  }

  // ---- 4. bus stops ------------------------------------------------------------
  const busItems = [];
  const frameSegs = edges.filter(e => e.frame);
  const nStops = Math.min(opt.busStops || 4, 4);
  const stops = [];
  const fc = V(W / 2, H / 2);
  const sideOf = e => { const m = lerp(e.a, e.b, 0.5); return Math.abs(e.a.x - e.b.x) < Math.abs(e.a.y - e.b.y) ? (m.x < W / 2 ? 'l' : 'r') : (m.y < H / 2 ? 't' : 'b'); };
  const sideOrder = ['l', 'r', 'b', 't'].sort(() => R() - 0.5);
  for (let round = 0; round < 3 && stops.length < nStops; round++) {
    for (const side of sideOrder) {
      if (stops.length >= nStops) break;
      if (stops.filter(s => s.side === side).length > round) continue;
      const cand = frameSegs.filter(e => sideOf(e) === side && dist(e.a, e.b) > 190).sort(() => R() - 0.5);
      let done = false;
      for (const e of cand) {
        if (done) break;
        const ue = norm(sub(e.b, e.a)); let out = V(-ue.y, ue.x); if (dot(out, sub(fc, e.a)) > 0) out = mul(out, -1);
        for (const t of [0.5, 0.35, 0.65, 0.25, 0.75].map(t => t + rr(-0.06, 0.06))) {
          const q = lerp(e.a, e.b, t);
          if (junc.some(j => dist(j, q) < 80) || doorPts.some(o => dist(o, q) < 80) || stops.some(o => dist(o.q, q) < 260)) continue;
          const sh = add(q, mul(out, rwMain / 2 + 44));
          const SB = rectBox(sh.x - 56, sh.y - 36, 112, 108);
          if (!canvasOK(SB) || placed.some(o => obbOverlap(o.box, SB, 6)) || labels.some(o => obbOverlap(o, SB, 6))) continue;
          const dir = R() < 0.5 ? ue : mul(ue, -1);
          const ar = add(q, mul(dir, 74));
          if (junc.some(j => dist(j, ar) < 64)) continue;
          stops.push({ q, side });
          const letter = 'ABCD'[busItems.length / 2];
          busItems.push({ id: 'bus' + letter, type: 'bus', text: letter, x: Math.round(sh.x), y: Math.round(sh.y) });
          busItems.push({ id: 'arrow' + letter, type: 'arrow', x: Math.round(ar.x), y: Math.round(ar.y), rot: Math.round(Math.atan2(dir.y, dir.x) * 180 / Math.PI) });
          doorPts.push(q); labels.push(SB);
          done = true; break;
        }
      }
    }
  }

  // ---- 5. title -------------------------------------------------------------------
  const items = [];
  if (opt.title) {
    const m = opt.measure ? opt.measure(opt.title, true) : { w: 300, h: 60 };
    const spots = [V(W - m.w / 2 - 20, m.h / 2 + 16), V(m.w / 2 + 20, m.h / 2 + 16), V(W - m.w / 2 - 20, H - m.h / 2 - 16), V(m.w / 2 + 20, H - m.h / 2 - 16)];
    for (const c of spots) {
      const L = rectBox(c.x - m.w / 2, c.y - m.h / 2, m.w, m.h);
      let rd = 1e9; for (const r of roads) rd = Math.min(rd, boxSegDist(L, r.a, r.b) - r.hw);
      if (placed.some(o => obbOverlap(o.box, L, 6)) || labels.some(o => obbOverlap(o, L, 6)) || rd < 4) continue;
      items.push({ id: 'title', type: 'label', kind: 'title', text: opt.title, x: Math.round(c.x), y: Math.round(c.y) });
      break;
    }
  }

  // ---- 6. Composer data ----------------------------------------------------------
  const paths = [];
  placed.forEach((o, i) => {
    const sz = o.sz, r = o.rot * Math.PI / 180;
    const off = V(sz.ox * Math.cos(r) - sz.oy * Math.sin(r), sz.ox * Math.sin(r) + sz.oy * Math.cos(r));
    const c = sub(o.box.c, off);
    items.push({ id: 'b' + i, type: 'image', lib: o.pl.lib, x: Math.round(c.x), y: Math.round(c.y), s: +sz.s.toFixed(4), rot: Math.round(o.rot), flip: false, under: false });
    paths.push({ id: 'w' + i, w: opt.pathW || 16, pts: [{ x: Math.round(o.q.x), y: Math.round(o.q.y) }, { x: Math.round(o.door.x), y: Math.round(o.door.y) }] });
    items.push({ id: 'p' + i, type: 'place', text: o.pl.name, px: Math.round(o.door.x), py: Math.round(o.door.y), lx: Math.round(o.lab.c.x), ly: Math.round(o.lab.c.y) });
  });
  items.push(...busItems);
  const outEdges = edges.map((e, i) => ({ id: 'e' + (i + 1), a: idOf.get(e.a), b: idOf.get(e.b), w: e.kind === 'main' ? 'main' : 'street' }));
  return {
    nodes: nodes.map(({ id, x, y }) => ({ id, x, y })), edges: outEdges, paths, items, missing,
    stats: { junctions: junc.length, edges: edges.length, rows, diags, outside: outsideCount },
  };
}
