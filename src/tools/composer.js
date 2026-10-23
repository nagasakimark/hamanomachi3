// Map Composer
// Build the map PICTURE itself: draw roads (junctions, corners and road
// markings are automatic), drop in building images, add walkways, labels and
// pins, bus stops, pick a background colour, then save a PNG. "Use in editor"
// hands the picture (and, optionally, the traced roads and places) straight
// to the Hamanomachi map editor.
import './composer.css';
import { h } from '../ui/dom.js';
import { idbGet, idbSet } from './idb.js';

import { PACKS } from './buildingPacks.js';
import { generateTown } from './townGen.js';

export const STANDARD_PLACES = ['tonkatsu restaurant','convenience store 7/11','soba restaurant','bookstore','sushi restaurant','police station','department store','chawanmushi restaurant','castella shop','flower shop','post office','ramen restaurant','temple','convenience store lawson','ice cream shop','supermarket','hospital','hotel'];

const FONT = '"Fredoka", "Segoe UI", system-ui, sans-serif';
const LABEL_STYLES = {
  place: { fill: '#c9f7b4', stroke: '#2f6f2f', text: '#1d3d1d' },
  bus: { fill: '#ffb69b', stroke: '#b9532f', text: '#4a1d0e' },
  title: { fill: '#c9f7b4', stroke: '#2f6f2f', text: '#1d3d1d' },
};
const BUS_LABEL_DY = 58;

// ---------------------------------------------------------------- state
function newDoc() {
  return { v: 1, name: 'My town', w: 1587, h: 1123, bg: '#fbf3df', roadColor: '#8d949c', rwStreet: 44, rwMain: 64, fs: 26, pathW: 18, nodes: [], edges: [], paths: [], items: [] };
}
const C = {
  doc: newDoc(), lib: {}, tool: 'select', sel: null, hover: null,
  view: { x: 30, y: 30, z: 0.6 }, undo: [], redo: [], arm: null,
  roadKind: 'street', axis: true, snap: true, grid: false,
  from: null, pathPts: null, mouse: { x: 0, y: 0 }, guides: [], tab: 'sel', keepArmed: false,
};
let el = null, canvas = null, ctx = null, panelEl = null, toolbarEl = null, statusEl = null, onUse = null;
let imgInput = null, projInput = null, saveTimer = 0, drag = null, spaceDown = false, snapped = false;
const mctx = document.createElement('canvas').getContext('2d');

const rid = p => p + Math.random().toString(36).slice(2, 8);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nodeOf = id => C.doc.nodes.find(n => n.id === id);
const itemOf = id => C.doc.items.find(i => i.id === id);
const roadW = (doc, e) => (e.w === 'main' ? doc.rwMain : doc.rwStreet);

// ---------------------------------------------------------------- geometry
function projSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx, y = a.y + t * dy;
  return { t, x, y, d: Math.hypot(x - p.x, y - p.y) };
}
function segInter(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return { t, u, x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

// ---------------------------------------------------------------- road model
function addNode(x, y) {
  const n = { id: rid('n'), x: Math.round(x), y: Math.round(y) };
  C.doc.nodes.push(n);
  return n;
}
function degree(id) { return C.doc.edges.filter(e => e.a === id || e.b === id).length; }
function hasEdge(a, b) { return C.doc.edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)); }
function splitEdgeAt(e, node) {
  C.doc.edges = C.doc.edges.filter(x => x !== e);
  C.doc.edges.push({ id: rid('e'), a: e.a, b: node.id, w: e.w }, { id: rid('e'), a: node.id, b: e.b, w: e.w });
}
// Add a road between two nodes. Crossings with other roads, and nodes that sit
// on the new road, become junctions automatically.
function addRoad(aId, bId, kind) {
  if (aId === bId) return;
  const A = nodeOf(aId), B = nodeOf(bId);
  if (!A || !B || dist(A, B) < 2) return;
  const cuts = [];
  for (const n of C.doc.nodes) {
    if (n.id === aId || n.id === bId) continue;
    const ps = projSeg(n, A, B);
    if (ps.d < 1.5 && ps.t > 0.001 && ps.t < 0.999) cuts.push({ t: ps.t, id: n.id });
  }
  for (const e of C.doc.edges.slice()) {
    if ([e.a, e.b].includes(aId) || [e.a, e.b].includes(bId)) continue;
    const E1 = nodeOf(e.a), E2 = nodeOf(e.b);
    const I = segInter(A, B, E1, E2);
    if (!I || I.t <= 0.001 || I.t >= 0.999 || I.u <= 0.001 || I.u >= 0.999) continue;
    const nn = addNode(I.x, I.y);
    splitEdgeAt(e, nn);
    cuts.push({ t: I.t, id: nn.id });
  }
  for (const X of [A, B]) {
    for (const e of C.doc.edges.slice()) {
      if (e.a === X.id || e.b === X.id) continue;
      const ps = projSeg(X, nodeOf(e.a), nodeOf(e.b));
      if (ps.d < 1.5 && ps.t > 0.001 && ps.t < 0.999) splitEdgeAt(e, X);
    }
  }
  cuts.sort((p, q) => p.t - q.t);
  const chain = [aId, ...cuts.map(c => c.id), bId];
  for (let i = 0; i + 1 < chain.length; i++) {
    if (chain[i] !== chain[i + 1] && !hasEdge(chain[i], chain[i + 1])) C.doc.edges.push({ id: rid('e'), a: chain[i], b: chain[i + 1], w: kind });
  }
}
function cleanNodes() {
  const used = new Set(C.doc.edges.flatMap(e => [e.a, e.b]));
  C.doc.nodes = C.doc.nodes.filter(n => used.has(n.id) || n.id === C.from);
}
function deleteNode(id) {
  C.doc.edges = C.doc.edges.filter(e => e.a !== id && e.b !== id);
  C.doc.nodes = C.doc.nodes.filter(n => n.id !== id);
  cleanNodes();
}
function deleteEdge(id) {
  C.doc.edges = C.doc.edges.filter(e => e.id !== id);
  cleanNodes();
}
function nodeAt(p, r) {
  let best = null, bd = r;
  for (const n of C.doc.nodes) { const d = dist(n, p); if (d < bd) { bd = d; best = n; } }
  return best;
}
function edgeHit(p, extra = 0) {
  let best = null, bd = Infinity;
  for (const e of C.doc.edges) {
    const A = nodeOf(e.a), B = nodeOf(e.b);
    if (!A || !B) continue;
    const ps = projSeg(p, A, B);
    const lim = roadW(C.doc, e) / 2 + extra;
    if (ps.d <= lim && ps.d < bd) { bd = ps.d; best = { edge: e, proj: ps }; }
  }
  return best;
}

// Snap a cursor position: right angles from the previous point, alignment to
// other points, and a 10px grid.
function snapPos(w, from, e) {
  let x = w.x, y = w.y;
  C.guides = [];
  const free = e?.altKey;
  const locked = from && C.axis && !free;
  let lockX = false, lockY = false;
  if (locked) {
    if (Math.abs(x - from.x) > Math.abs(y - from.y)) { y = from.y; lockY = true; } else { x = from.x; lockX = true; }
  }
  if (C.snap && !free) {
    const tol = 9 / C.view.z;
    let sx = false, sy = false;
    for (const n of C.doc.nodes) {
      if (!lockX && !sx && Math.abs(n.x - x) < tol) { x = n.x; sx = true; C.guides.push({ x: n.x }); }
      if (!lockY && !sy && Math.abs(n.y - y) < tol) { y = n.y; sy = true; C.guides.push({ y: n.y }); }
    }
    if (!lockX && !sx) x = Math.round(x / 10) * 10;
    if (!lockY && !sy) y = Math.round(y / 10) * 10;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

// ---------------------------------------------------------------- undo / save
function snapshot() {
  C.undo.push(JSON.stringify(C.doc));
  if (C.undo.length > 150) C.undo.shift();
  C.redo = [];
}
function undo() { if (!C.undo.length) return; C.redo.push(JSON.stringify(C.doc)); C.doc = JSON.parse(C.undo.pop()); C.sel = null; C.from = null; changed(); }
function redo() { if (!C.redo.length) return; C.undo.push(JSON.stringify(C.doc)); C.doc = JSON.parse(C.redo.pop()); C.sel = null; C.from = null; changed(); }
function changed(keepPanel = false) {
  autosave();
  if (!keepPanel) renderPanel();
  draw();
}
function libPlain() {
  const out = {};
  for (const [id, l] of Object.entries(C.lib)) out[id] = { name: l.name, url: l.url, under: !!l.under, size: l.size };
  return out;
}
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { idbSet('compose-v1', { doc: C.doc, lib: libPlain(), overlay: OV.src }).catch(() => {}); }, 500);
}

// ---------------------------------------------------------------- images
function addLib(id, name, url, extra = {}) {
  const l = { name, url, under: !!extra.under, size: extra.size, img: new Image(), alpha: null };
  l.img.onload = () => { draw(); renderPanel(); };
  l.img.src = url;
  C.lib[id] = l;
  return l;
}
function addPack(pack) {
  let n = 0;
  for (const it of pack.items) {
    const id = 'pk_' + pack.id + '_' + it.name.replace(/[^a-z0-9]+/gi, '');
    if (C.lib[id]) continue;
    addLib(id, it.name, it.url, { under: it.under ?? pack.under, size: it.size ?? pack.size }); n++;
  }
  C.tab = 'img'; autosave(); renderPanel();
  toast(n ? `Added ${pack.name} ${pack.label.toLowerCase()} (${n}) to the Images tab.` : `Already in the Images tab.`);
}
function readURL(f) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); }
async function importImages(files) {
  let last = null;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const id = rid('img');
    addLib(id, f.name.replace(/\.[^.]+$/, ''), await readURL(f));
    last = id;
  }
  if (last) { C.tab = 'img'; autosave(); renderPanel(); toast(`Added to the Images tab. Click one, then click the map to place it.`); }
}
function alphaAt(lib, ix, iy) {
  const img = lib.img;
  if (!img.naturalWidth) return true;
  if (!lib.alpha) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    lib.alpha = { g, w: c.width, h: c.height };
  }
  if (ix < 0 || iy < 0 || ix >= lib.alpha.w || iy >= lib.alpha.h) return false;
  try { return lib.alpha.g.getImageData(ix | 0, iy | 0, 1, 1).data[3] > 16; } catch { return true; }
}
function imgSize(it) {
  const img = C.lib[it.lib]?.img;
  return { w: (img?.naturalWidth || 100) * it.s, h: (img?.naturalHeight || 100) * it.s };
}
function toLocal(it, p) {
  const a = it.rot * Math.PI / 180, dx = p.x - it.x, dy = p.y - it.y;
  let lx = dx * Math.cos(a) + dy * Math.sin(a);
  const ly = -dx * Math.sin(a) + dy * Math.cos(a);
  if (it.flip) lx = -lx;
  return { lx, ly };
}
function hitImage(it, p) {
  const { w, h: hh } = imgSize(it), { lx, ly } = toLocal(it, p);
  if (Math.abs(lx) > w / 2 || Math.abs(ly) > hh / 2) return false;
  const lib = C.lib[it.lib];
  if (!lib) return true;
  return alphaAt(lib, (lx / it.s) + lib.img.naturalWidth / 2, (ly / it.s) + lib.img.naturalHeight / 2);
}

// ---------------------------------------------------------------- text boxes
function wrapText(text) {
  const t = String(text).trim();
  if (t.length <= 14 || !t.includes(' ')) return [t];
  let best = -1, bd = 1e9;
  for (let i = 0; i < t.length; i++) if (t[i] === ' ') { const d = Math.abs(i - t.length / 2); if (d < bd) { bd = d; best = i; } }
  return [t.slice(0, best), t.slice(best + 1)];
}
function labelMetrics(text, fs) {
  mctx.font = `600 ${fs}px ${FONT}`;
  const lines = wrapText(text);
  const w = Math.max(...lines.map(l => mctx.measureText(l).width));
  const lh = fs * 1.2;
  return { lines, lh, w: Math.max(w, fs) + fs * 0.9, h: lines.length * lh + fs * 0.6 };
}
function labelFs(it) { return it.kind === 'title' ? Math.round(C.doc.fs * 1.9) : (it.fs || C.doc.fs); }
function labelRect(it) {
  const cx = it.type === 'place' ? it.lx : it.type === 'bus' ? it.x : it.x;
  const cy = it.type === 'place' ? it.ly : it.type === 'bus' ? it.y + BUS_LABEL_DY : it.y;
  const m = labelMetrics(it.text, labelFs(it));
  return { x: cx - m.w / 2, y: cy - m.h / 2, w: m.w, h: m.h, cx, cy, m };
}
function rrect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + hh - r); g.arcTo(x + w, y + hh, x + w - r, y + hh, r);
  g.lineTo(x + r, y + hh); g.arcTo(x, y + hh, x, y + hh - r, r);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
}
function drawLabelBox(g, it, style) {
  const r = labelRect(it), s = LABEL_STYLES[style];
  rrect(g, r.x, r.y, r.w, r.h, Math.min(10, r.h / 3));
  g.fillStyle = s.fill; g.fill();
  g.lineWidth = 3; g.strokeStyle = s.stroke; g.stroke();
  g.fillStyle = s.text; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${labelFs(it)}px ${FONT}`;
  const top = r.cy - (r.m.lines.length - 1) * r.m.lh / 2;
  r.m.lines.forEach((l, i) => g.fillText(l, r.cx, top + i * r.m.lh + 1));
  return r;
}
const PIN_R = 13;
const pinR = it => PIN_R * (it.ps || 1);
function pinBody(it) {
  const r = labelRect(it);
  let dx = r.cx - it.px, dy = r.cy - it.py;
  const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  return { x: it.px + dx * pinR(it) * 2.2, y: it.py + dy * pinR(it) * 2.2, dx, dy };
}
function drawPin(g, it, selected) {
  const b = pinBody(it), tip = { x: it.px, y: it.py };
  const PR = pinR(it), th = Math.atan2(tip.y - b.y, tip.x - b.x), dd = PR * 2.2, al = Math.acos(PR / dd);
  g.beginPath();
  g.moveTo(tip.x, tip.y);
  g.lineTo(b.x + Math.cos(th - al) * PR, b.y + Math.sin(th - al) * PR);
  g.arc(b.x, b.y, PR, th - al, th + al, true);
  g.closePath();
  g.fillStyle = '#ffc42e'; g.fill();
  g.lineWidth = 2.5; g.strokeStyle = selected ? '#ff3d00' : '#4a3b12'; g.stroke();
  g.beginPath(); g.arc(b.x, b.y, PR * 0.38, 0, 7); g.fillStyle = '#7a5a10'; g.fill();
}
function drawPlace(g, it, selected) {
  const r = labelRect(it), b = pinBody(it);
  const sx = Math.max(r.x, Math.min(r.x + r.w, b.x)), sy = Math.max(r.y, Math.min(r.y + r.h, b.y));
  g.beginPath(); g.moveTo(sx, sy); g.lineTo(b.x, b.y);
  g.lineWidth = 2.5; g.strokeStyle = '#2b2b2b'; g.stroke();
  drawPin(g, it, selected);
  drawLabelBox(g, it, 'place');
}

// ---------------------------------------------------------------- drawing
function drawRoads(g, doc) {
  const nodes = new Map(doc.nodes.map(n => [n.id, n]));
  const deg = new Map(), mw = new Map();
  for (const e of doc.edges) {
    const w = roadW(doc, e);
    for (const id of [e.a, e.b]) { deg.set(id, (deg.get(id) || 0) + 1); mw.set(id, Math.max(mw.get(id) || 0, w)); }
  }
  const pass = (extra, color) => {
    g.strokeStyle = color; g.fillStyle = color; g.lineCap = 'butt';
    for (const e of doc.edges) {
      const A = nodes.get(e.a), B = nodes.get(e.b); if (!A || !B) continue;
      g.lineWidth = roadW(doc, e) + extra;
      g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    }
    for (const [id, d] of deg) {
      if (d < 2) continue;
      const n = nodes.get(id);
      g.beginPath(); g.arc(n.x, n.y, (mw.get(id) + extra) / 2, 0, 7); g.fill();
    }
  };
  pass(12, '#ffffff');
  pass(0, doc.roadColor);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([20, 16]); g.lineCap = 'butt';
  for (const e of doc.edges) {
    const A = nodes.get(e.a), B = nodes.get(e.b); if (!A || !B) continue;
    const L = dist(A, B); if (!L) continue;
    const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
    const trim = id => (deg.get(id) >= 3 ? mw.get(id) / 2 + 8 : deg.get(id) === 1 ? 10 : 0);
    const ta = trim(e.a), tb = trim(e.b);
    if (L - ta - tb < 24) continue;
    g.beginPath(); g.moveTo(A.x + ux * ta, A.y + uy * ta); g.lineTo(B.x - ux * tb, B.y - uy * tb); g.stroke();
  }
  g.setLineDash([]);
}
function drawPaths(g, doc) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [color, extra] of [['#b79b63', 6], ['#ecd6a3', 0]]) {
    g.strokeStyle = color;
    for (const p of doc.paths) {
      g.lineWidth = p.w + extra;
      g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
    }
  }
  g.lineCap = 'butt';
}
function drawImageItem(g, it) {
  const l = C.lib[it.lib]; if (!l || !l.img.complete || !l.img.naturalWidth) return;
  g.save(); g.translate(it.x, it.y); g.rotate(it.rot * Math.PI / 180); g.scale(it.flip ? -it.s : it.s, it.s);
  g.drawImage(l.img, -l.img.naturalWidth / 2, -l.img.naturalHeight / 2);
  g.restore();
}
function drawShelter(g, x, y) {
  g.save(); g.translate(x, y);
  g.lineWidth = 3; g.strokeStyle = '#3a2a1c';
  g.fillStyle = '#e9d9bf'; g.fillRect(-36, -20, 72, 38); g.strokeRect(-36, -20, 72, 38);
  g.fillStyle = '#9fd3e6'; g.fillRect(-30, -14, 60, 22); g.strokeRect(-30, -14, 60, 22);
  rrect(g, -44, -34, 88, 16, 5); g.fillStyle = '#7a5a43'; g.fill(); g.stroke();
  g.fillStyle = '#a66a3c'; g.fillRect(-26, 8, 52, 7); g.strokeRect(-26, 8, 52, 7);
  g.beginPath(); g.arc(-50, -8, 10, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke();
  g.beginPath(); g.arc(-50, -8, 5, 0, 7); g.fillStyle = '#d9382b'; g.fill();
  g.beginPath(); g.moveTo(-50, 2); g.lineTo(-50, 24); g.stroke();
  g.restore();
}
function drawArrow(g, it, selected) {
  g.save(); g.translate(it.x, it.y); g.rotate(it.rot * Math.PI / 180);
  g.beginPath();
  g.moveTo(-42, -11); g.lineTo(6, -11); g.lineTo(6, -24); g.lineTo(44, 0); g.lineTo(6, 24); g.lineTo(6, 11); g.lineTo(-42, 11); g.closePath();
  g.fillStyle = '#f48a4a'; g.fill(); g.lineWidth = 3; g.strokeStyle = selected ? '#ff3d00' : '#b3541b'; g.stroke();
  g.restore();
}
// The overlay is a picture (e.g. an AI-restyled version of this map) drawn over
// the background but under roads and labels. The picture itself lives here, not
// in the doc, so Undo history stays small; the doc only keeps its settings.
const OV = { src: null, img: null };
function setOverlay(src) {
  OV.src = src || null; OV.img = null;
  if (src) { const i = new Image(); i.onload = () => { OV.img = i; draw(); }; i.src = src; }
}
function overlayReady() { return OV.src && !OV.img ? new Promise(r => { const t = setInterval(() => { if (OV.img) { clearInterval(t); r(); } }, 30); setTimeout(() => { clearInterval(t); r(); }, 4000); }) : Promise.resolve(); }

export function renderDoc(g, doc, o = {}) {
  g.fillStyle = doc.bg; g.fillRect(0, 0, doc.w, doc.h);
  const ov = doc.overlay, showOv = !!(ov && ov.on !== false && OV.img);
  if (showOv) { g.save(); g.globalAlpha = ov.op ?? 1; g.drawImage(OV.img, 0, 0, doc.w, doc.h); g.restore(); }
  // Buildings always stay on top of the overlay (it is only the background).
  // Water/ground pieces ("under roads") belong to the background, so the overlay
  // replaces them. Buildings are hidden only if that box is ticked.
  const hideImgs = showOv && ov.hideImgs === true;
  for (const it of doc.items) if (it.type === 'image' && it.under && !showOv) drawImageItem(g, it);
  if (hideImgs) {
    // Buildings are baked into the overlay, so cut walkways out wherever one of
    // my own building/decoration pictures stands: paths always sit below buildings.
    const k = (g.getTransform ? g.getTransform().a : 1) || 1;
    const off = document.createElement('canvas'); off.width = Math.ceil(doc.w * k); off.height = Math.ceil(doc.h * k);
    const og = off.getContext('2d'); og.scale(k, k);
    drawPaths(og, doc);
    og.globalCompositeOperation = 'destination-out';
    for (const it of doc.items) if (it.type === 'image' && !it.under) drawImageItem(og, it);
    g.drawImage(off, 0, 0, doc.w, doc.h);
  } else drawPaths(g, doc);
  drawRoads(g, doc);
  for (const it of doc.items) {
    if (it.type === 'image' && !it.under) { if (!hideImgs) drawImageItem(g, it); }
    else if (it.type === 'bus') drawShelter(g, it.x, it.y);
    else if (it.type === 'arrow') drawArrow(g, it);
  }
  for (const it of doc.items) {
    if (it.type === 'place') drawPlace(g, it, o.sel && o.sel.id === it.id);
    else if (it.type === 'bus') drawLabelBox(g, it, 'bus');
    else if (it.type === 'label') drawLabelBox(g, it, it.kind === 'title' ? 'title' : it.kind);
  }
}

function resize() {
  if (!canvas || !canvas.parentElement) return;
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
  canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function fitView() {
  const r = canvas.parentElement.getBoundingClientRect();
  const z = Math.min((r.width - 40) / C.doc.w, (r.height - 40) / C.doc.h);
  C.view = { z, x: (r.width - C.doc.w * z) / 2, y: (r.height - C.doc.h * z) / 2 };
}
function draw() {
  if (!ctx || !el || el.hidden) return;
  const r = canvas.parentElement.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
  const { x, y, z } = C.view, doc = C.doc, lw = 1 / z;
  ctx.save();
  ctx.translate(x, y); ctx.scale(z, z);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 14 * lw; ctx.fillStyle = doc.bg; ctx.fillRect(0, 0, doc.w, doc.h);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, doc.w, doc.h); ctx.clip();
  renderDoc(ctx, doc, { sel: C.sel });
  if (C.grid) {
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let gx = 0; gx <= doc.w; gx += 50) { ctx.moveTo(gx, 0); ctx.lineTo(gx, doc.h); }
    for (let gy = 0; gy <= doc.h; gy += 50) { ctx.moveTo(0, gy); ctx.lineTo(doc.w, gy); }
    ctx.stroke();
  }
  ctx.restore();
  // roads that run past the picture are shown faded outside it
  ctx.save();
  ctx.beginPath(); ctx.rect(-4000, -4000, 8000 + doc.w, 8000 + doc.h); ctx.rect(doc.w, 0, -doc.w, doc.h); ctx.clip('evenodd');
  ctx.globalAlpha = 0.35; drawRoads(ctx, doc);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = lw; ctx.strokeRect(0, 0, doc.w, doc.h);
  drawOverlay(lw);
  ctx.restore();
}
function drawOverlay(lw) {
  const doc = C.doc, sel = C.sel;
  const showNodes = C.tool === 'road' || C.tool === 'select' || C.tool === 'delete';
  if (showNodes) {
    for (const n of doc.nodes) {
      const d = degree(n.id), hot = C.hover?.kind === 'node' && C.hover.id === n.id;
      ctx.beginPath(); ctx.arc(n.x, n.y, (d >= 3 ? 6 : 4.5) * lw * (hot ? 1.5 : 1), 0, 7);
      ctx.fillStyle = d >= 3 ? '#ff7a00' : '#2f7de1'; ctx.fill();
      ctx.lineWidth = 1.5 * lw; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }
  if (sel?.kind === 'edge') {
    const e = doc.edges.find(x => x.id === sel.id);
    if (e) { const A = nodeOf(e.a), B = nodeOf(e.b); ctx.strokeStyle = 'rgba(255,61,0,.85)'; ctx.lineWidth = 4 * lw; ctx.setLineDash([8 * lw, 6 * lw]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); }
  }
  if (sel?.kind === 'node') {
    const n = nodeOf(sel.id);
    if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, 10 * lw, 0, 7); ctx.strokeStyle = '#ff3d00'; ctx.lineWidth = 3 * lw; ctx.stroke(); }
  }
  if (sel?.kind === 'path') {
    const p = doc.paths.find(x => x.id === sel.id);
    if (p) { ctx.strokeStyle = 'rgba(255,61,0,.85)'; ctx.lineWidth = 3 * lw; ctx.setLineDash([6 * lw, 5 * lw]); ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.setLineDash([]); }
  }
  if (sel?.kind === 'item') {
    const it = itemOf(sel.id);
    if (it) outlineItem(it, lw);
  }
  // road being drawn
  if (C.tool === 'road' && C.from && nodeOf(C.from)) {
    const A = nodeOf(C.from), B = C.preview || C.mouse;
    ctx.strokeStyle = 'rgba(47,125,225,.8)'; ctx.lineWidth = 3 * lw; ctx.setLineDash([8 * lw, 6 * lw]);
    ctx.beginPath(); ctx.moveTo(A.x, A.y);
    if (C.elbow) ctx.lineTo(C.elbow.x, C.elbow.y);
    ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
  }
  if (C.tool === 'path' && C.pathPts?.length) {
    ctx.strokeStyle = 'rgba(160,110,30,.9)'; ctx.lineWidth = 4 * lw; ctx.setLineDash([8 * lw, 6 * lw]);
    ctx.beginPath(); C.pathPts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.lineTo((C.preview || C.mouse).x, (C.preview || C.mouse).y); ctx.stroke(); ctx.setLineDash([]);
  }
  if (C.guides.length) {
    ctx.strokeStyle = 'rgba(255,0,170,.6)'; ctx.lineWidth = lw; ctx.setLineDash([4 * lw, 4 * lw]);
    for (const gd of C.guides) { ctx.beginPath(); if (gd.x !== undefined) { ctx.moveTo(gd.x, -3000); ctx.lineTo(gd.x, 6000); } else { ctx.moveTo(-3000, gd.y); ctx.lineTo(6000, gd.y); } ctx.stroke(); }
    ctx.setLineDash([]);
  }
  if (C.tool === 'image' && C.arm && C.lib[C.arm]?.img.naturalWidth) {
    const l = C.lib[C.arm], s = defaultScale(l);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(C.mouse.x, C.mouse.y); ctx.scale(s, s);
    ctx.drawImage(l.img, -l.img.naturalWidth / 2, -l.img.naturalHeight / 2); ctx.restore();
  }
}
function outlineItem(it, lw) {
  ctx.strokeStyle = '#ff3d00'; ctx.lineWidth = 2.5 * lw; ctx.setLineDash([7 * lw, 5 * lw]);
  if (it.type === 'image') {
    const { w, h: hh } = imgSize(it);
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot * Math.PI / 180); ctx.strokeRect(-w / 2, -hh / 2, w, hh); ctx.restore();
  } else if (it.type === 'arrow') {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot * Math.PI / 180); ctx.strokeRect(-46, -26, 92, 52); ctx.restore();
  } else if (it.type === 'bus') {
    const r = labelRect(it); ctx.strokeRect(it.x - 56, it.y - 38, 112, 66); ctx.strokeRect(r.x, r.y, r.w, r.h);
  } else {
    const r = labelRect(it); ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    if (it.type === 'place') { ctx.beginPath(); ctx.arc(it.px, it.py, 7 * lw * 1.4, 0, 7); ctx.stroke(); }
  }
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------- hit testing
function hitTest(p) {
  const z = C.view.z, doc = C.doc;
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i];
    if (it.type === 'place') {
      if (dist({ x: it.px, y: it.py }, p) < 16 * (it.ps || 1) / z) return { kind: 'item', id: it.id, part: 'pin' };
      const r = labelRect(it);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { kind: 'item', id: it.id, part: 'label' };
    }
  }
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i];
    if (it.type === 'label') { const r = labelRect(it); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { kind: 'item', id: it.id }; }
    if (it.type === 'bus') {
      const r = labelRect(it);
      if ((p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) || (Math.abs(p.x - it.x) < 56 && p.y > it.y - 38 && p.y < it.y + 28)) return { kind: 'item', id: it.id };
    }
    if (it.type === 'arrow') {
      const a = -it.rot * Math.PI / 180, dx = p.x - it.x, dy = p.y - it.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) < 46 && Math.abs(ly) < 26) return { kind: 'item', id: it.id };
    }
  }
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i];
    if (it.type === 'image' && hitImage(it, p)) return { kind: 'item', id: it.id };
  }
  const n = nodeAt(p, 11 / z);
  if (n) return { kind: 'node', id: n.id };
  const eh = edgeHit(p);
  if (eh) return { kind: 'edge', id: eh.edge.id };
  for (let i = doc.paths.length - 1; i >= 0; i--) {
    const pa = doc.paths[i];
    for (let k = 0; k + 1 < pa.pts.length; k++) if (projSeg(p, pa.pts[k], pa.pts[k + 1]).d <= pa.w / 2 + 3) return { kind: 'path', id: pa.id };
  }
  return null;
}

// ---------------------------------------------------------------- items
function defaultScale(l) { const t = l.size || 150; return Math.min(1, t / Math.max(l.img.naturalWidth || t, l.img.naturalHeight || t)); }
function usedNames() { return new Set(C.doc.items.filter(i => i.type === 'place').map(i => i.text)); }
function nextPlaceName() {
  const used = usedNames();
  return STANDARD_PLACES.find(n => !used.has(n)) || 'new place';
}
function nextBusLetter() {
  const used = new Set(C.doc.items.filter(i => i.type === 'bus').map(i => i.text));
  for (const l of 'ABCDEFGH') if (!used.has(l + ' bus stop')) return l + ' bus stop';
  return 'bus stop';
}
function addItem(it) { C.doc.items.push(it); return it; }

// ---------------------------------------------------------------- pointer input
function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - C.view.x) / C.view.z, y: (e.clientY - r.top - C.view.y) / C.view.z };
}
function setTool(id) {
  finishPath();
  C.tool = id; C.from = null; C.preview = null; C.elbow = null; C.guides = [];
  renderToolbar(); renderPanel(); draw();
}
function finishPath() {
  if (C.pathPts && C.pathPts.length >= 2) {
    snapshot();
    const p = { id: rid('w'), w: C.doc.pathW, pts: C.pathPts.map(q => ({ x: q.x, y: q.y })) };
    C.doc.paths.push(p);
    C.sel = { kind: 'path', id: p.id };
    C.pathPts = null;
    changed();
    return;
  }
  C.pathPts = null;
}
function endRoadChain() {
  if (!C.from) return;
  C.from = null; C.elbow = null; C.preview = null;
  cleanNodes(); changed(true); draw();
}

function onDown(e) {
  canvas.setPointerCapture(e.pointerId);
  const w = toWorld(e);
  if (e.button === 1 || e.button === 2 || spaceDown) { drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: C.view.x, vy: C.view.y, btn: e.button, moved: 0 }; return; }
  const tool = C.tool;
  if (tool === 'select') {
    const hit = hitTest(w);
    if (hit) {
      C.sel = hit; snapshot();
      const it = hit.kind === 'item' ? itemOf(hit.id) : null;
      let ox = 0, oy = 0;
      if (it) {
        const ref = it.type === 'place' ? (hit.part === 'pin' ? { x: it.px, y: it.py } : { x: it.lx, y: it.ly }) : { x: it.x, y: it.y };
        ox = w.x - ref.x; oy = w.y - ref.y;
      }
      const pa = hit.kind === 'path' ? C.doc.paths.find(x => x.id === hit.id) : null;
      drag = { kind: 'move', hit, ox, oy, moved: false, start: w, orig: pa ? pa.pts.map(q => ({ ...q })) : null };
      C.tab = 'sel';
    } else { C.sel = null; drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: C.view.x, vy: C.view.y, moved: 0 }; }
    renderPanel(); draw();
  } else if (tool === 'road') {
    roadClick(w, e);
  } else if (tool === 'path') {
    pathClick(w, e);
  } else if (tool === 'image') {
    if (!C.arm || !C.lib[C.arm]) { toast('Pick a building in the Images tab first.'); C.tab = 'img'; renderPanel(); return; }
    snapshot();
    const l = C.lib[C.arm];
    const it = addItem({ id: rid('i'), type: 'image', lib: C.arm, x: Math.round(w.x), y: Math.round(w.y), s: +defaultScale(l).toFixed(3), rot: 0, flip: false, under: !!l.under });
    C.sel = { kind: 'item', id: it.id };
    if (!e.shiftKey) { C.tool = 'select'; renderToolbar(); }
    C.tab = 'sel'; changed();
  } else if (tool === 'place') {
    snapshot();
    const below = w.y < 120;
    const it = addItem({ id: rid('i'), type: 'place', text: nextPlaceName(), px: Math.round(w.x), py: Math.round(w.y), lx: Math.round(w.x), ly: Math.round(w.y + (below ? 80 : -80)) });
    C.sel = { kind: 'item', id: it.id }; C.tab = 'sel'; changed();
    setTimeout(() => panelEl.querySelector('#cp-text')?.select(), 30);
  } else if (tool === 'bus') {
    snapshot();
    const bus = addItem({ id: rid('i'), type: 'bus', text: nextBusLetter(), x: Math.round(w.x), y: Math.round(w.y) });
    addItem({ id: rid('i'), type: 'arrow', x: Math.round(w.x + 110), y: Math.round(w.y + 6), rot: 0 });
    C.sel = { kind: 'item', id: bus.id }; C.tool = 'select'; C.tab = 'sel'; renderToolbar(); changed();
  } else if (tool === 'text') {
    snapshot();
    const it = addItem({ id: rid('i'), type: 'label', kind: 'title', text: C.doc.name || 'Map title', x: Math.round(w.x), y: Math.round(w.y) });
    C.sel = { kind: 'item', id: it.id }; C.tool = 'select'; C.tab = 'sel'; renderToolbar(); changed();
    setTimeout(() => panelEl.querySelector('#cp-text')?.select(), 30);
  } else if (tool === 'delete') {
    const hit = hitTest(w);
    if (!hit) return;
    snapshot();
    deleteHit(hit);
    C.sel = null; changed();
  }
}
function deleteHit(hit) {
  if (hit.kind === 'item') C.doc.items = C.doc.items.filter(i => i.id !== hit.id);
  else if (hit.kind === 'node') deleteNode(hit.id);
  else if (hit.kind === 'edge') deleteEdge(hit.id);
  else if (hit.kind === 'path') C.doc.paths = C.doc.paths.filter(p => p.id !== hit.id);
}

function roadClick(w, e) {
  snapshot();
  const from = C.from ? nodeOf(C.from) : null;
  let target = nodeAt(w, 14 / C.view.z), elbow = null;
  if (!target) {
    const pos = snapPos(w, from, e);
    const eh = edgeHit(pos, 3);
    target = addNode(pos.x, pos.y);
    if (eh) {
      const A = nodeOf(eh.edge.a), B = nodeOf(eh.edge.b);
      const pr = projSeg(pos, A, B);
      target.x = Math.round(pr.x); target.y = Math.round(pr.y);
      splitEdgeAt(eh.edge, target);
    }
  } else if (from && C.axis && !e.altKey && Math.abs(target.x - from.x) > 1 && Math.abs(target.y - from.y) > 1) {
    elbow = addNode(target.x, from.y);
  }
  if (from) {
    if (elbow) { addRoad(from.id, elbow.id, C.roadKind); addRoad(elbow.id, target.id, C.roadKind); }
    else addRoad(from.id, target.id, C.roadKind);
  }
  C.from = target.id; C.sel = { kind: 'node', id: target.id };
  cleanNodes();
  changed(true); renderPanel();
}
function pathClick(w, e) {
  if (!C.pathPts) {
    const eh = edgeHit(w, 14);
    if (!eh) { toast('Start a walkway by clicking on a road.'); return; }
    C.pathPts = [{ x: Math.round(eh.proj.x), y: Math.round(eh.proj.y) }];
    draw(); return;
  }
  const last = C.pathPts[C.pathPts.length - 1];
  const p = snapPos(w, last, e);
  if (dist(p, last) < 6) { finishPath(); return; }
  C.pathPts.push(p);
  draw();
}

function onMove(e) {
  const w = toWorld(e); C.mouse = w;
  if (drag?.kind === 'pan') {
    drag.moved = Math.max(drag.moved || 0, Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy));
    C.view.x = drag.vx + e.clientX - drag.sx; C.view.y = drag.vy + e.clientY - drag.sy; draw(); return;
  }
  if (drag?.kind === 'move') {
    const { hit } = drag;
    drag.moved = true;
    if (hit.kind === 'item') {
      const it = itemOf(hit.id);
      let x = w.x - drag.ox, y = w.y - drag.oy;
      if (!e.altKey) { x = Math.round(x); y = Math.round(y); }
      if (it.type === 'place') { if (hit.part === 'pin') { it.px = x; it.py = y; } else { it.lx = x; it.ly = y; } }
      else { it.x = x; it.y = y; }
    } else if (hit.kind === 'node') {
      const n = nodeOf(hit.id); const p = snapPos(w, null, e); n.x = p.x; n.y = p.y;
    } else if (hit.kind === 'path') {
      const pa = C.doc.paths.find(x => x.id === hit.id);
      const dx = Math.round(w.x - drag.start.x), dy = Math.round(w.y - drag.start.y);
      pa.pts = drag.orig.map(q => ({ x: q.x + dx, y: q.y + dy }));
    }
    draw(); return;
  }
  let hover = null;
  if (C.tool === 'road' || C.tool === 'select' || C.tool === 'delete') { const n = nodeAt(w, 12 / C.view.z); if (n) hover = { kind: 'node', id: n.id }; }
  C.hover = hover;
  C.preview = null; C.elbow = null; C.guides = [];
  if (C.tool === 'road') {
    const from = C.from ? nodeOf(C.from) : null;
    const nh = nodeAt(w, 14 / C.view.z);
    if (nh) {
      C.preview = { x: nh.x, y: nh.y };
      if (from && C.axis && !e.altKey && Math.abs(nh.x - from.x) > 1 && Math.abs(nh.y - from.y) > 1) C.elbow = { x: nh.x, y: from.y };
    } else C.preview = snapPos(w, from, e);
  } else if (C.tool === 'path' && C.pathPts) {
    C.preview = snapPos(w, C.pathPts[C.pathPts.length - 1], e);
  }
  statusEl.textContent = `x ${Math.round(w.x)}, y ${Math.round(w.y)}` + hintFor(C.tool);
  draw();
}
function onUp(e) {
  if (drag?.kind === 'move') {
    if (drag.moved) { if (drag.hit.kind === 'node') cleanNodes(); changed(); } else C.undo.pop();
  }
  if (drag?.kind === 'pan' && drag.btn === 2 && (drag.moved || 0) < 5) {
    if (C.tool === 'road') endRoadChain();
    else if (C.tool === 'path') finishPath();
  }
  drag = null;
}
function hintFor(tool) {
  return {
    road: C.from ? ' · click to continue the road · right-click, double-click or Esc to stop · Alt = any angle' : ' · click to start a road · corners and junctions are automatic',
    path: C.pathPts ? ' · click to bend or end the walkway · Enter to finish' : ' · click on a road to start a walkway',
    image: ' · click to place the building (hold Shift to place more)',
    place: ' · click on the building\'s door to drop a pin',
    bus: ' · click to place a bus stop and its arrow',
    text: ' · click to add a text label',
    delete: ' · click anything to delete it',
    select: ' · drag to move · scroll to zoom · right-drag or Space+drag to pan',
  }[tool] || '';
}
function onWheel(e) {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const z = Math.max(0.1, Math.min(6, C.view.z * Math.exp(-e.deltaY * 0.0015)));
  C.view.x = mx - (mx - C.view.x) * (z / C.view.z);
  C.view.y = my - (my - C.view.y) * (z / C.view.z);
  C.view.z = z; draw();
}
function onKey(e) {
  if (!el || el.hidden) return;
  if (e.target.closest('input,textarea,select')) return;
  if (e.code === 'Space') { spaceDown = true; e.preventDefault(); return; }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape') { if (C.tool === 'road') endRoadChain(); else if (C.tool === 'path') finishPath(); else { C.sel = null; renderPanel(); draw(); } return; }
  if (e.key === 'Enter' && C.tool === 'path') { finishPath(); return; }
  const sel = C.sel;
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); snapshot(); deleteHit(sel); C.sel = null; changed(); return; }
  if (sel?.kind === 'item' && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const it = itemOf(sel.id), s = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
    snapshot();
    if (it.type === 'place') { it.lx += dx; it.ly += dy; it.px += dx; it.py += dy; } else { it.x += dx; it.y += dy; }
    changed(); return;
  }
  if (sel?.kind === 'item' && (e.key === '[' || e.key === ']')) {
    const it = itemOf(sel.id);
    if (it?.type === 'image') { snapshot(); it.s = Math.max(0.02, +(it.s * (e.key === ']' ? 1.05 : 0.95)).toFixed(3)); changed(); }
    return;
  }
  if (e.key.toLowerCase() === 'f' && !mod) { fitView(); draw(); return; }
  if (e.key.toLowerCase() === 'w' && !mod) { C.roadKind = C.roadKind === 'street' ? 'main' : 'street'; renderPanel(); toast(`New roads: ${C.roadKind === 'main' ? 'wide main road' : 'normal street'}`); return; }
  const t = TOOLS.find(x => x.key.toLowerCase() === e.key.toLowerCase());
  if (t && !mod) setTool(t.id);
}

// ---------------------------------------------------------------- toolbar + panel
const TOOLS = [
  { id: 'select', label: 'Select / move', key: 'V', icon: '👆' },
  { id: 'road', label: 'Draw roads', key: 'R', icon: '🛣️' },
  { id: 'path', label: 'Walkway from road', key: 'P', icon: '🟫' },
  { id: 'image', label: 'Place building', key: 'I', icon: '🏠' },
  { id: 'place', label: 'Label + pin', key: 'D', icon: '📍' },
  { id: 'bus', label: 'Bus stop', key: 'B', icon: '🚌' },
  { id: 'text', label: 'Text label', key: 'T', icon: '🔤' },
  { id: 'delete', label: 'Delete', key: 'X', icon: '🗑️' },
];
function btn(text, fn, title = '', cls = '') { return h('button.ed-btn' + (cls ? '.' + cls : ''), { onclick: fn, title, type: 'button' }, text); }
function renderToolbar() {
  toolbarEl.replaceChildren(
    ...TOOLS.map(t => h('button.ed-tool' + (C.tool === t.id ? '.on' : ''), { title: `${t.label} (${t.key})`, onclick: () => setTool(t.id) },
      h('span.ti', {}, t.icon), h('span.tl', {}, t.label), h('kbd', {}, t.key))),
    h('div.cp-sep'),
    h('div.cp-roadkind', {}, h('span', {}, 'New roads'),
      h('button.ed-tool' + (C.roadKind === 'street' ? '.on' : ''), { onclick: () => { C.roadKind = 'street'; renderToolbar(); renderPanel(); } }, h('span.tl', {}, 'Street')),
      h('button.ed-tool' + (C.roadKind === 'main' ? '.on' : ''), { onclick: () => { C.roadKind = 'main'; renderToolbar(); renderPanel(); } }, h('span.tl', {}, 'Wide road'), h('kbd', {}, 'W'))),
    h('label.ed-check', {}, cbox(C.axis, v => { C.axis = v; }), ' Right angles only'),
    h('label.ed-check', {}, cbox(C.snap, v => { C.snap = v; }), ' Snap and align'),
    h('label.ed-check', {}, cbox(C.grid, v => { C.grid = v; draw(); }), ' Show grid'),
    btn('⤢ Fit view (F)', () => { fitView(); draw(); }),
  );
}
function cbox(value, fn) {
  const c = h('input', { type: 'checkbox', checked: !!value });
  c.addEventListener('change', () => fn(c.checked));
  return c;
}
function renderPanel() {
  if (!panelEl) return;
  const tabs = h('div.ed-tabs', {}, ...[['sel', 'Selected'], ['img', `Images (${Object.keys(C.lib).length})`], ['map', 'Map'], ['town', '🏙️ Make a town']].map(([id, label]) =>
    h('button.ed-tab' + (C.tab === id ? '.on' : ''), { onclick: () => { C.tab = id; renderPanel(); } }, label)));
  const body = h('div.ed-panel');
  if (C.tab === 'sel') body.append(...selPanel());
  if (C.tab === 'img') body.append(...imgPanel());
  if (C.tab === 'map') body.append(...mapPanel());
  if (C.tab === 'town') body.append(...townPanel());
  const keepScroll = panelEl.querySelector('.ed-panel')?.scrollTop || 0;
  panelEl.replaceChildren(tabs, body);
  body.scrollTop = keepScroll;
}
function chk(v, fn) { const i = h('input', { type: 'checkbox' }); i.checked = v; i.addEventListener('change', fn); return i; }
function field(label, input) { return h('label.ed-field', {}, h('span', {}, label), input); }
// A text/number input that edits live and records one undo step per edit session.
function liveInput(value, set, attrs = {}) {
  const i = h('input', { value: value ?? '', ...attrs });
  let snapped = false;
  i.addEventListener('focus', () => { snapped = false; });
  i.addEventListener('input', () => { if (!snapped) { snapshot(); snapped = true; } set(i.value); draw(); autosave(); });
  i.addEventListener('change', () => { renderPanel(); });
  return i;
}
function liveRange(value, min, max, step, set, fmt = v => v) {
  const out = h('span.cp-rv', {}, fmt(value));
  const i = h('input', { type: 'range', min, max, step, value });
  let snapped = false;
  i.addEventListener('pointerdown', () => { snapped = false; });
  i.addEventListener('input', () => { if (!snapped) { snapshot(); snapped = true; } set(+i.value); out.textContent = fmt(+i.value); draw(); autosave(); });
  return h('div.cp-range', {}, i, out);
}
function act(fn) { return () => { snapshot(); fn(); changed(); }; }

function selPanel() {
  const s = C.sel;
  if (!s) return [h('p.ed-hint', {}, 'Click something on the map to edit it. Switch tools on the left to add roads, walkways, buildings, labels and bus stops.'), tipsBlock()];
  if (s.kind === 'node') {
    const n = nodeOf(s.id); if (!n) return [];
    return [h('h3', {}, 'Road point'), h('p.ed-small', {}, `x ${n.x}, y ${n.y} · ${degree(n.id)} road${degree(n.id) === 1 ? '' : 's'} meet here`),
      h('p.ed-small', {}, 'Drag it to move the corner or junction. Roads attached to it follow.'),
      btn('🗑️ Delete point and its roads', act(() => { deleteNode(n.id); C.sel = null; }))];
  }
  if (s.kind === 'edge') {
    const e = C.doc.edges.find(x => x.id === s.id); if (!e) return [];
    const sel = h('select', {}, h('option', { value: 'street', selected: e.w === 'street' }, 'Street'), h('option', { value: 'main', selected: e.w === 'main' }, 'Wide road'));
    sel.addEventListener('change', act(() => { e.w = sel.value; }));
    return [h('h3', {}, 'Road'), field('Type', sel), btn('🗑️ Delete this road', act(() => { deleteEdge(e.id); C.sel = null; }))];
  }
  if (s.kind === 'path') {
    const p = C.doc.paths.find(x => x.id === s.id); if (!p) return [];
    return [h('h3', {}, 'Walkway'), field('Width', liveRange(p.w, 6, 60, 1, v => { p.w = v; }, v => v + ' px')), btn('🗑️ Delete walkway', act(() => { C.doc.paths = C.doc.paths.filter(x => x !== p); C.sel = null; }))];
  }
  const it = itemOf(s.id); if (!it) return [];
  const del = btn('🗑️ Delete', act(() => { C.doc.items = C.doc.items.filter(x => x !== it); C.sel = null; }));
  const dup = btn('⧉ Duplicate', act(() => {
    const c = JSON.parse(JSON.stringify(it)); c.id = rid('i');
    if (c.type === 'place') { c.px += 40; c.py += 40; c.lx += 40; c.ly += 40; } else { c.x += 40; c.y += 40; }
    C.doc.items.push(c); C.sel = { kind: 'item', id: c.id };
  }));
  if (it.type === 'image') {
    const lib = C.lib[it.lib];
    return [h('h3', {}, lib?.name || 'Building'),
      field('Size', liveRange(Math.round(it.s * 100), 5, 400, 1, v => { it.s = v / 100; }, v => v + '%')),
      h('div.ed-row', {}, btn('⟲ 90°', act(() => { it.rot = (it.rot + 270) % 360; })), btn('⟳ 90°', act(() => { it.rot = (it.rot + 90) % 360; })), btn('⇋ Flip', act(() => { it.flip = !it.flip; }))),
      h('div.ed-row', {}, btn('⬆ Bring to front', act(() => { C.doc.items = C.doc.items.filter(x => x !== it); C.doc.items.push(it); })), btn('⬇ Send to back', act(() => { C.doc.items = C.doc.items.filter(x => x !== it); C.doc.items.unshift(it); }))),
      h('div.ed-row', {}, btn(it.under ? '✔ Under roads (water, ground)' : 'Draw under roads', act(() => { it.under = !it.under; }), 'Water and ground pieces go under the roads; buildings and trees stay on top')),
      h('p.ed-small', {}, 'Tip: [ and ] resize, arrow keys nudge (Shift for 10px).'),
      h('div.ed-row', {}, dup, del)];
  }
  if (it.type === 'place') {
    const dl = h('datalist', { id: 'cp-places' }, ...STANDARD_PLACES.map(n => h('option', { value: n })));
    const inp = liveInput(it.text, v => { it.text = v; }, { id: 'cp-text', list: 'cp-places' });
    return [h('h3', {}, 'Place label + pin'), field('Name shown to students', inp), dl,
      field('Pin size', liveRange(Math.round((it.ps || 1) * 100), 50, 250, 5, v => { it.ps = v / 100; }, v => v + '%')),
      field('Label text size', liveRange(it.fs || C.doc.fs, 12, 60, 1, v => { it.fs = v; }, v => v + ' px')),
      btn('Apply these sizes to every place', act(() => { for (const o of C.doc.items) if (o.type === 'place') { o.ps = it.ps; o.fs = it.fs; } }), 'Same pin and label size on all places'),
      h('p.ed-small', {}, 'Drag the yellow pin to the building\'s door. Drag the green label anywhere. In the game, the pin is where the character ends up.'),
      h('div.ed-row', {}, dup, del)];
  }
  if (it.type === 'bus') {
    return [h('h3', {}, 'Bus stop'), field('Name', liveInput(it.text, v => { it.text = v; }, { id: 'cp-text' })),
      h('p.ed-small', {}, 'Place the bus stop on the road where the character starts. Point its arrow along the road the way they face.'), del];
  }
  if (it.type === 'arrow') {
    return [h('h3', {}, 'Traffic arrow'),
      h('div.ed-row', {}, btn('⟲ 90°', act(() => { it.rot = (it.rot + 270) % 360; })), btn('⟳ 90°', act(() => { it.rot = (it.rot + 90) % 360; }))),
      h('div.ed-row', {}, btn('→', act(() => { it.rot = 0; })), btn('↓', act(() => { it.rot = 90; })), btn('←', act(() => { it.rot = 180; })), btn('↑', act(() => { it.rot = 270; }))), del];
  }
  const kind = h('select', {}, ...[['title', 'Title box'], ['place', 'Green label'], ['bus', 'Orange label']].map(([v, l]) => h('option', { value: v, selected: it.kind === v }, l)));
  kind.addEventListener('change', act(() => { it.kind = kind.value; }));
  return [h('h3', {}, 'Text label'), field('Text', liveInput(it.text, v => { it.text = v; }, { id: 'cp-text' })), field('Style', kind),
    field('Size', liveRange(it.fs || C.doc.fs, 12, 90, 1, v => { it.fs = v; }, v => v + ' px')), del];
}
function tipsBlock() {
  return h('div.ed-legend', {},
    h('h3', {}, 'How to build a map'),
    h('p', {}, '1. ', h('b', {}, 'Roads (R)'), ': click to start, click to turn. Every click makes a right-angle corner. Click on another road to make a junction. Roads that cross each other join automatically.'),
    h('p', {}, '2. ', h('b', {}, 'Images'), ': import your building pictures, click one, then click the map. Resize and rotate in the Selected tab so doors face the road you want.'),
    h('p', {}, '3. ', h('b', {}, 'Walkway (P)'), ': click a road, then click toward the door to draw a path.'),
    h('p', {}, '4. ', h('b', {}, 'Label + pin (D)'), ': click the door. The next place name from the game list is filled in for you.'),
    h('p', {}, '5. ', h('b', {}, 'Bus stop (B)'), ': click on a road, then turn its arrow.'),
    h('p', {}, '6. ', h('b', {}, 'Use in editor'), ' sends the picture, and the roads and places, to the map editor.'));
}
const packSel = h('select', { id: 'cp-packsel' }, ...PACKS.map(p => h('option', { value: p.id }, `${p.name} — ${p.label} (${p.items.length})`)));
function imgPanel() {
  const ids = Object.keys(C.lib);
  const used = new Set(C.doc.items.filter(i => i.type === 'image').map(i => i.lib));
  return [
    h('div.cp-sets', {}, packSel,
      btn('Add this set', () => addPack(PACKS.find(p => p.id === packSel.value)), 'Adds these pictures to the Images tab', 'primary')),
    btn('➕ Import building images…', () => imgInput.click(), 'PNG with a transparent background works best', 'primary'),
    h('p.ed-small', {}, 'Click an image, then click the map to place it. Drag images from here onto the map too.'),
    ids.length ? h('div.cp-lib', {}, ...ids.map(id => {
      const l = C.lib[id];
      const t = h('div.cp-thumb' + (C.arm === id && C.tool === 'image' ? '.on' : ''), { draggable: 'true', title: l.name, onclick: () => { C.arm = id; setTool('image'); } },
        h('img', { src: l.url, alt: l.name, draggable: 'false' }), h('span', {}, l.name),
        used.has(id) ? null : h('button.cp-x', { title: 'Remove from library', onclick: ev => { ev.stopPropagation(); delete C.lib[id]; if (C.arm === id) C.arm = null; autosave(); renderPanel(); } }, '✖'));
      t.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/x-lib', id); });
      return t;
    })) : h('p.ed-hint', {}, 'No images yet.'),
  ];
}
function mapPanel() {
  const d = C.doc;
  const num = (key, min) => liveInput(d[key], v => { d[key] = Math.max(min, Math.round(+v) || min); }, { type: 'number', min });
  const color = (key) => { const i = h('input', { type: 'color', value: d[key] }); let sn = false; i.addEventListener('pointerdown', () => { sn = false; }); i.addEventListener('input', () => { if (!sn) { snapshot(); sn = true; } d[key] = i.value; draw(); autosave(); }); return i; };
  const swatch = c => h('button.cp-swatch', { title: c, style: { background: c }, onclick: act(() => { d.bg = c; }) });
  return [
    h('h3', {}, 'Map'),
    field('Map name', liveInput(d.name, v => { d.name = v; })),
    h('div.ed-row', {}, field('Width (px)', num('w', 400)), field('Height (px)', num('h', 300))),
    h('p.ed-small', {}, 'Changing the size crops or extends the picture. 1587 × 1123 matches the Hamanomachi map.'),
    field('Background colour', color('bg')),
    h('div.cp-swatches', {}, ...['#fbf3df', '#ffffff', '#e8f1e4', '#dcefff', '#f6e7cf', '#f1e0ff', '#fff3a8'].map(swatch)),
    h('h3', {}, 'Overlay picture'),
    h('p.ed-small', {}, 'Save your map as a PNG, have an AI restyle the background, then load the result here. It replaces the background; your roads, walkways, buildings, pins and labels stay on top.'),
    btn(OV.src ? 'Replace overlay picture…' : 'Choose overlay picture…', () => {
      const i = h('input', { type: 'file', accept: 'image/*' });
      i.addEventListener('change', async () => { const f = i.files[0]; if (!f) return; snapshot(); setOverlay(await readURL(f)); d.overlay = { on: true, op: 1, hideImgs: false }; changed(); renderPanel(); });
      i.click();
    }, 'Pick the restyled picture (any size; it is stretched to the map size)'),
    ...(OV.src ? [
      h('label.ed-field', {}, h('span', {}, 'Show overlay'), chk(d.overlay?.on !== false, e => { snapshot(); d.overlay = { ...(d.overlay || {}), on: e.target.checked }; changed(); })),
      h('label.ed-field', {}, h('span', {}, 'Hide my building pictures (only if the overlay picture already has the buildings)'), chk(d.overlay?.hideImgs === true, e => { snapshot(); d.overlay = { ...(d.overlay || {}), hideImgs: e.target.checked }; changed(); })),
      field('Overlay opacity', liveRange(Math.round((d.overlay?.op ?? 1) * 100), 10, 100, 1, v => { d.overlay = { ...(d.overlay || {}), op: v / 100 }; }, v => v + '%')),
      btn('Remove overlay', () => { snapshot(); setOverlay(null); d.overlay = null; changed(); renderPanel(); }),
    ] : []),
    h('h3', {}, 'Roads'),
    field('Road colour', color('roadColor')),
    field('Street width', liveRange(d.rwStreet, 20, 90, 1, v => { d.rwStreet = v; }, v => v + ' px')),
    field('Wide road width', liveRange(d.rwMain, 24, 120, 1, v => { d.rwMain = v; }, v => v + ' px')),
    field('Label text size', liveRange(d.fs, 14, 48, 1, v => { d.fs = v; }, v => v + ' px')),
    field('Walkway width (new)', liveRange(d.pathW, 8, 40, 1, v => { d.pathW = v; }, v => v + ' px')),
  ];
}

// ---------------------------------------------------------------- town generator
// Builds a whole town (streets, buildings, labels, pins, walkways, bus stops)
// from a list of places. Same settings + same layout number = same town.
const THEMES = [['bikini', 'Bikini Bottom'], ['sanrio', 'Kawaii pastel'], ['minecraft', 'Blocky sandbox'], ['mario', 'Mushroom Kingdom'], ['pokemon', 'Monster world'], ['doraemon', 'Doraemon-style'], ['matsuri', 'Matsuri']];
// The 6-map plan (hamanomachi-map-plan-v2.xlsx): new buildings first, then returning ones.
export const MAP_PLAN = [
  { id: 'hamanomachi', title: 'Hamanomachi', theme: 'bikini', places: STANDARD_PLACES },
  { id: 'sanrio', title: 'Sanrio Town', theme: 'sanrio', places: ['house', 'park', 'station', 'zoo', 'castle', 'farm', 'ice cream shop', 'department store', 'post office', 'convenience store 7/11', 'hospital', 'ramen restaurant', 'soba restaurant', 'hotel', 'castella shop'] },
  { id: 'sandy', title: 'Bikini Bottom', theme: 'bikini', places: ['library', 'bank', 'museum', 'fire station', 'stadium', 'tower', 'supermarket', 'post office', 'temple', 'bookstore', 'police station', 'hospital', 'convenience store lawson', 'flower shop', 'ramen restaurant'] },
  { id: 'minecraft', title: 'Block Town', theme: 'minecraft', places: ['church', 'shrine', 'aquarium', 'theater', 'garden', 'dome', 'sushi restaurant', 'ice cream shop', 'department store', 'temple', 'police station', 'hospital', 'convenience store lawson', 'chawanmushi restaurant', 'tonkatsu restaurant'] },
  { id: 'mario', title: 'Mushroom Kingdom', theme: 'mario', places: ['elementary school', 'junior high school', 'kindergarten', 'city hall', 'amusement park', 'shopping mall', 'sushi restaurant', 'ice cream shop', 'supermarket', 'post office', 'bookstore', 'police station', 'convenience store 7/11', 'chawanmushi restaurant', 'hotel'] },
  { id: 'pokemon', title: 'Monster Town', theme: 'pokemon', places: ['factory', 'dam', 'airport', 'planetarium', 'gas station', 'sushi restaurant', 'supermarket', 'department store', 'temple', 'bookstore', 'convenience store 7/11', 'flower shop', 'soba restaurant', 'castella shop', 'tonkatsu restaurant'] },
];
const G = { theme: 'bikini', plan: 'sandy', places: MAP_PLAN[2].places.join('\n'), title: 'Bikini Bottom', seed: 1, outsideRow: true, slants: '', busStops: 4, size: 118, perBlock: 1.15, w: 1600, h: 1130 };
const packFor = (theme, name) => {
  for (const pid of [theme + '-b', theme + '-x']) {
    const pk = PACKS.find(p => p.id === pid), it = pk?.items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (it) return { id: 'pk_' + pid + '_' + it.name.replace(/[^a-z0-9]+/gi, ''), it, pk };
  }
  return null;
};
// The visible (non-transparent) part of a picture, so buildings pack tightly.
function opaqueBox(img) {
  const k = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return null;
  return { w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k, cx: (x0 + x1 + 1) / 2 / k, cy: (y0 + y1 + 1) / 2 / k };
}
const loaded = img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => { img.onload = () => { r(); draw(); }; img.onerror = r; }));
export async function generateIntoDoc(opts = G) {
  const names = String(opts.places).split('\n').map(s => s.trim()).filter(Boolean);
  const missing = names.filter(n => !packFor(opts.theme, n));
  if (missing.length) { toast(`No picture for: ${missing.join(', ')} (in this building set)`); }
  const places = [];
  for (const n of names) {
    const f = packFor(opts.theme, n); if (!f) continue;
    if (!C.lib[f.id]) addLib(f.id, f.it.name, f.it.url, { under: f.it.under ?? f.pk.under, size: f.it.size ?? f.pk.size });
    const l = C.lib[f.id];
    await loaded(l.img);
    l.box ||= opaqueBox(l.img);
    places.push({ name: n, lib: f.id, iw: l.img.naturalWidth, ih: l.img.naturalHeight, box: l.box });
  }
  const fs = 18;
  const res = generateTown({
    places, seed: +opts.seed || 1, w: opts.w, h: opts.h, title: opts.title, outsideRow: opts.outsideRow, slants: opts.slants === '' || opts.slants == null ? undefined : +opts.slants, busStops: +opts.busStops,
    size: +opts.size, rwStreet: 38, rwMain: 54, pathW: 16,
    measure: (t, title) => { const m = labelMetrics(t, title ? Math.round(fs * 1.9) : fs); return { w: m.w, h: m.h }; },
  });
  snapshot();
  Object.assign(C.doc, { name: opts.title || C.doc.name, w: opts.w, h: opts.h, fs, rwStreet: 38, rwMain: 54, pathW: 16, nodes: res.nodes, edges: res.edges, paths: res.paths, items: res.items, gen: { ...opts } });
  C.sel = null;
  fitView(); changed();
  if (res.missing.length) toast(`Could not fit: ${res.missing.join(', ')}. Try another layout or smaller buildings.`);
  return res;
}
function townPanel() {
  const planSel = h('select', {}, h('option', { value: '' }, '— choose —'), ...MAP_PLAN.map(p => h('option', { value: p.id, selected: G.plan === p.id }, `${p.title} (${p.places.length} places)`)));
  const themeSel = h('select', {}, ...THEMES.map(([id, n]) => h('option', { value: id, selected: G.theme === id }, n)));
  const ta = h('textarea.cp-places', { rows: 12 }); ta.value = G.places;
  const title = h('input', { value: G.title });
  const seed = h('input', { type: 'number', value: G.seed, min: 1, style: { width: '90px' } });
  const rng = (key, min, max, step, fmt) => liveRange(G[key], min, max, step, v => { G[key] = v; }, fmt);
  planSel.addEventListener('change', () => { const p = MAP_PLAN.find(x => x.id === planSel.value); if (!p) return; G.plan = p.id; G.theme = p.theme; G.places = p.places.join('\n'); G.title = p.title; renderPanel(); });
  themeSel.addEventListener('change', () => { G.theme = themeSel.value; });
  ta.addEventListener('input', () => { G.places = ta.value; });
  title.addEventListener('input', () => { G.title = title.value; });
  seed.addEventListener('input', () => { G.seed = +seed.value || 1; });
  const go = async (next) => {
    if (next) G.seed = (+G.seed || 1) + 1;
    if ((C.doc.nodes.length || C.doc.items.length) && !C.doc.gen && !confirm('Replace the current map with a new town? (Undo brings it back.)')) return;
    await generateIntoDoc(G);
  };
  const unknown = String(G.places).split('\n').map(x => x.trim()).filter(x => x && !packFor(G.theme, x));
  return [
    h('h3', {}, 'Make a town'),
    h('p.ed-small', {}, 'Pick a map from the plan (or type your own places), then press Make town. Not happy? Press Another layout until you like it, then fix small things by hand.'),
    field('Map plan', planSel),
    field('Building set', themeSel),
    field('Map title', title),
    field('Places (one per line)', ta),
    unknown.length ? h('p.ed-small', { style: { color: '#c0392b' } }, 'No picture in this set for: ' + unknown.join(', ')) : null,
    h('div.ed-row', {}, btn('🏙️ Make town', () => go(false), 'Build the town with these settings', 'primary'), btn('🎲 Another layout', () => go(true), 'Same places, new streets and positions')),
    field('Layout number', seed),
    h('h3', {}, 'Options'),
    h('label.ed-field', {}, h('span', {}, 'Row of buildings outside the ring road'), chk(G.outsideRow, e => { G.outsideRow = e.target.checked; })),
    field('Diagonal avenues (blank = random)', liveInput(G.slants, v => { G.slants = v === '' ? '' : Math.max(0, Math.min(3, +v || 0)); }, { type: 'number', min: 0, max: 3 })),
    field('Bus stops', rng('busStops', 2, 4, 1, v => v)),
    field('Building size', rng('size', 90, 170, 2, v => v + ' px')),
    h('div.ed-row', {}, field('Width', liveInput(G.w, v => { G.w = Math.max(800, +v || 1600); }, { type: 'number' })), field('Height', liveInput(G.h, v => { G.h = Math.max(600, +v || 1130); }, { type: 'number' }))),
  ].filter(Boolean);
}

// ---------------------------------------------------------------- export
async function ready() {
  await overlayReady();
  try { await Promise.all([document.fonts.load(`600 26px "Fredoka"`), document.fonts.load(`400 26px "Fredoka"`)]); } catch { /* fonts are optional */ }
}
export async function renderToCanvas(scale = 1) {
  await ready();
  const c = document.createElement('canvas');
  c.width = Math.round(C.doc.w * scale); c.height = Math.round(C.doc.h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  renderDoc(g, C.doc, {});
  return c;
}
function download(blob, filename) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const slug = s => (s || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';
async function downloadPng(scale) {
  const c = await renderToCanvas(scale);
  c.toBlob(b => { download(b, `${slug(C.doc.name)}${scale > 1 ? '@' + scale + 'x' : ''}.png`); toast(`Saved ${slug(C.doc.name)}.png`); }, 'image/png');
}
function saveProject() {
  const data = JSON.stringify({ format: 'hamanomachi-compose', doc: C.doc, lib: libPlain(), overlay: OV.src });
  download(new Blob([data], { type: 'application/json' }), `${slug(C.doc.name)}.compose.json`);
  toast('Project saved. Open it again with Open project.');
}
async function openProject(f) {
  try {
    const d = JSON.parse(await f.text());
    if (d.format !== 'hamanomachi-compose') throw new Error('not a project');
    snapshot();
    C.doc = { ...newDoc(), ...d.doc }; C.lib = {}; setOverlay(d.overlay);
    for (const [id, l] of Object.entries(d.lib || {})) addLib(id, l.name, l.url, l);
    C.sel = null; C.from = null; fitView(); changed();
  } catch { alert('That file is not a map project (.compose.json).'); }
}
function newProject() {
  if ((C.doc.nodes.length || C.doc.items.length) && !confirm('Start a new map? The current one is replaced (Undo brings it back).')) return;
  snapshot();
  const keep = C.doc;
  setOverlay(null); C.doc = newDoc(); C.doc.bg = keep.bg; C.doc.roadColor = keep.roadColor;
  C.sel = null; C.from = null; changed();
}

// ---------------------------------------------------------------- auto-trace for the game
// Turns the drawn roads and places into the map editor's points and roads.
export function traceDoc(doc) {
  const nodes = new Map(doc.nodes.map(n => [n.id, { x: n.x, y: n.y }]));
  let edges = doc.edges.map(e => [e.a, e.b]);
  // forget straight-through points: only corners, junctions and ends are blocks
  for (let again = true; again;) {
    again = false;
    const adj = new Map();
    for (const [a, b] of edges) { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
    for (const [id, nb] of adj) {
      if (nb.length !== 2 || nb[0] === nb[1]) continue;
      const P = nodes.get(id), A = nodes.get(nb[0]), B = nodes.get(nb[1]);
      const ax = A.x - P.x, ay = A.y - P.y, bx = B.x - P.x, by = B.y - P.y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la && lb && Math.abs(ax * by - ay * bx) / (la * lb) < 0.05 && ax * bx + ay * by < 0) {
        edges = edges.filter(([a, b]) => a !== id && b !== id);
        if (!edges.some(([a, b]) => (a === nb[0] && b === nb[1]) || (a === nb[1] && b === nb[0]))) edges.push([nb[0], nb[1]]);
        nodes.delete(id); again = true; break;
      }
    }
  }
  const used = new Set(edges.flat());
  const points = [], roads = [];
  const pid = new Map();
  let pn = 0;
  for (const [id, p] of nodes) if (used.has(id)) { const q = { id: 'p' + (++pn), x: p.x, y: p.y, type: 'normal' }; points.push(q); pid.set(id, q.id); }
  // where do places and bus stops sit on the roads?
  const attach = [];
  const nearest = (pt) => {
    let best = null;
    edges.forEach(([a, b], i) => {
      const ps = projSeg(pt, nodes.get(a), nodes.get(b));
      if (!best || ps.d < best.ps.d) best = { i, ps, a, b };
    });
    return best;
  };
  const arrows = doc.items.filter(i => i.type === 'arrow');
  const inserts = new Map(); // edge index -> [{t, point}]
  const addInsert = (i, t, point) => { (inserts.get(i) || inserts.set(i, []).get(i)).push({ t, point }); };
  const dests = [];
  let sn = 0;
  for (const it of doc.items) {
    if (it.type === 'place') {
      const nb = nearest({ x: it.px, y: it.py }); if (!nb) continue;
      const A = nodes.get(nb.a), B = nodes.get(nb.b), L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      const dA = nb.ps.t * L, dB = (1 - nb.ps.t) * L;
      const dest = { id: 'p' + (++pn + 1000), x: it.px, y: it.py, type: 'destination', name: it.text.trim() };
      dests.push(dest);
      if (dA < 14 || dB < 14) attach.push({ dest, node: pid.get(dA < dB ? nb.a : nb.b) });
      else { const lb = { id: 'p' + (++pn + 1000), x: Math.round(nb.ps.x), y: Math.round(nb.ps.y), type: 'littlebit' }; addInsert(nb.i, nb.ps.t, lb); attach.push({ dest, node: lb.id }); }
    } else if (it.type === 'bus') {
      const nb = nearest({ x: it.x, y: it.y }); if (!nb) continue;
      const A = nodes.get(nb.a), B = nodes.get(nb.b), L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      let d = nb.ps.t * L; d = Math.max(Math.min(24, L / 2), Math.min(L - Math.min(24, L / 2), d));
      const t = d / L, x = Math.round(A.x + (B.x - A.x) * t), y = Math.round(A.y + (B.y - A.y) * t);
      let ar = null, bd = 260;
      for (const a of arrows) { const dd = Math.hypot(a.x - it.x, a.y - it.y); if (dd < bd) { bd = dd; ar = a; } }
      const st = { id: 'start' + (++sn), x, y, type: 'start', name: it.text.trim(), littlebit: true, _ar: ar };
      addInsert(nb.i, t, st);
    }
  }
  const startPts = [];
  edges.forEach(([a, b], i) => {
    const list = (inserts.get(i) || []).sort((p, q) => p.t - q.t);
    const chain = [pid.get(a), ...list.map(l => l.point.id), pid.get(b)];
    for (const l of list) { points.push(l.point); if (l.point.type === 'start') startPts.push(l.point); }
    for (let k = 0; k + 1 < chain.length; k++) roads.push([chain[k], chain[k + 1]]);
  });
  const byId = new Map(points.map(p => [p.id, p]));
  for (const s of startPts) {
    const nb = roads.filter(r => r.includes(s.id)).map(r => (r[0] === s.id ? r[1] : r[0]));
    if (!nb.length) continue;
    let pick = nb[0];
    if (s._ar) {
      const ang = s._ar.rot * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang);
      let bs = -2;
      for (const n of nb) { const q = byId.get(n), dx = q.x - s.x, dy = q.y - s.y, l = Math.hypot(dx, dy) || 1, sc = (dx * ux + dy * uy) / l; if (sc > bs) { bs = sc; pick = n; } }
    }
    s.facing = pick; delete s._ar;
  }
  // tidy ids so places read p1, p2, ...
  const rename = new Map();
  let k = 0;
  for (const p of points) if (!p.id.startsWith('start')) rename.set(p.id, 'p' + (++k));
  for (const d of dests) { rename.set(d.id, 'p' + (++k)); points.push(d); }
  for (const a of attach) roads.push([a.node, a.dest.id]);
  const rn = id => rename.get(id) || id;
  for (const p of points) { p.id = rn(p.id); if (p.facing) p.facing = rn(p.facing); }
  const fixedRoads = roads.map(([a, b]) => [rn(a), rn(b)]);
  for (const p of points) if (p.type === 'destination') p.audio = p.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.mp3';
  return { points, roads: fixedRoads };
}

// ---------------------------------------------------------------- toast + build
function toast(t) {
  const x = h('div.ed-toast', {}, t); document.body.append(x);
  setTimeout(() => x.remove(), 3600);
}
async function useInEditor(trace) {
  if (!onUse) return;
  const issues = [];
  if (!C.doc.edges.length) issues.push('there are no roads yet');
  if (trace && !C.doc.items.some(i => i.type === 'place')) issues.push('there are no places yet');
  if (trace && !C.doc.items.some(i => i.type === 'bus')) issues.push('there are no bus stops yet');
  if (issues.length && !confirm(`Heads up: ${issues.join(' and ')}. Continue anyway?`)) return;
  const c = await renderToCanvas(1);
  const dataUrl = c.toDataURL('image/png');
  const ok = await onUse({ dataUrl, width: C.doc.w, height: C.doc.h, name: C.doc.name, trace: trace ? traceDoc(C.doc) : null });
  if (ok !== false) closeComposer();
}

function build() {
  canvas = h('canvas.ed-canvas');
  ctx = canvas.getContext('2d');
  toolbarEl = h('div.ed-tools.cp-tools');
  panelEl = h('div.ed-side');
  statusEl = h('div.ed-status');
  imgInput = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
  projInput = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
  imgInput.addEventListener('change', () => { importImages([...imgInput.files]); imgInput.value = ''; });
  projInput.addEventListener('change', () => { const f = projInput.files[0]; projInput.value = ''; if (f) openProject(f); });
  const menu = h('div.ed-menu', {},
    btn('← Back to editor', () => closeComposer(), 'Your work is saved automatically'),
    h('div.ed-brand', {}, '🎨 Map Composer'),
    btn('New', newProject), btn('Open project…', () => projInput.click()), btn('Save project', saveProject),
    btn('↶', undo, 'Undo (Ctrl+Z)'), btn('↷', redo, 'Redo (Ctrl+Y)'),
    h('div.ed-grow'),
    btn('🖼️ Save PNG', () => downloadPng(1), 'Download the map as a picture'),
    btn('🖼️ Save PNG (2×)', () => downloadPng(2), 'Twice the size, for printing'),
    btn('Use picture in editor', () => useInEditor(false), 'Send only the picture to the map editor'),
    btn('✨ Use picture + trace roads', () => useInEditor(true), 'Send the picture and turn the drawn roads, places and bus stops into game data', 'primary'),
  );
  const wrap = h('div.ed-canvas-wrap', {}, canvas, statusEl);
  el = h('div.cp', { id: 'composer', hidden: true }, menu, h('div.ed-main', {}, toolbarEl, wrap, panelEl), imgInput, projInput);
  document.body.append(el);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('dblclick', () => { if (C.tool === 'road') endRoadChain(); else if (C.tool === 'path') finishPath(); });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  wrap.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-lib') || e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('drop', e => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/x-lib');
    if (id && C.lib[id]) {
      const w = toWorld(e); snapshot();
      const it = addItem({ id: rid('i'), type: 'image', lib: id, x: Math.round(w.x), y: Math.round(w.y), s: +defaultScale(C.lib[id]).toFixed(3), rot: 0, flip: false, under: !!C.lib[id].under });
      C.sel = { kind: 'item', id: it.id }; C.tab = 'sel'; changed();
    } else if (e.dataTransfer.files.length) importImages([...e.dataTransfer.files]);
  });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
  window.addEventListener('resize', () => { if (!el.hidden) { resize(); draw(); } });
}

let restored = false;
export function composerOpen() { return !!el && !el.hidden; }
export function closeComposer() { if (el) el.hidden = true; }
export async function openComposer(opts = {}) {
  onUse = opts.onUse || null;
  if (!el) build();
  el.hidden = false;
  renderToolbar(); resize();
  if (!restored) {
    restored = true;
    try {
      const saved = await idbGet('compose-v1');
      if (saved?.doc) {
        C.doc = { ...newDoc(), ...saved.doc }; setOverlay(saved.overlay);
        for (const [id, l] of Object.entries(saved.lib || {})) addLib(id, l.name, l.url, l);
      }
    } catch { /* nothing saved yet */ }
  }
  await ready();
  fitView(); renderPanel(); draw();
}

// Test hook (used by the automated check, harmless otherwise).
export const _composer = { C, G, generateIntoDoc, projectData: () => { const used = new Set(C.doc.items.map(i => i.lib).filter(Boolean)); const lib = Object.fromEntries(Object.entries(libPlain()).filter(([id]) => used.has(id))); return { format: 'hamanomachi-compose', doc: C.doc, lib }; }, labelRect, traceDoc, addRoad, addNode, addItem, renderToCanvas, importImages, draw, nodeOf };
if (typeof window !== 'undefined') window.__composer = _composer;
