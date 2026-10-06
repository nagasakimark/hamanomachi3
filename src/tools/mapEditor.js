// Hamanomachi Map Editor
// Trace roads on a map picture, name the places, check everything works,
// auto-build missions, test-play, and export a map pack (.zip) to drop into
// the game's maps/ folder.
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './mapEditor.css';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { MapGraph, blockLabel, simulate } from '../engine/engine.js';
import { solve } from '../engine/solver.js';
import { generateMissions, TIERS } from '../engine/missions.js';
import { idbGet, idbSet } from './idb.js';
import { h } from '../ui/dom.js';
import { MAPS } from '../data/maps.js';

// ---------------- state ----------------
const S = {
  map: blankMap(),
  image: null,        // HTMLImageElement
  imageData: null,    // data URL
  imageName: 'map.png',
  audio: {},          // filename -> data URL
  tool: 'select',
  selected: null,     // { kind: 'point'|'road', id|index }
  hover: null,
  roadFrom: null,
  view: { x: 20, y: 20, z: 0.6 },
  undo: [], redo: [],
  solution: null,     // { path: [ids], blocks }
  issues: [],
  dirty: false,
};

function blankMap() {
  return { format: 1, id: 'newtown', name: 'New Town', subtitle: '', order: 2, unlockStars: 20, image: 'map.png', width: 0, height: 0, points: [], roads: [], missions: [] };
}

const TYPE_COLORS = { normal: '#2f7de1', littlebit: '#ff9800', start: '#1faa55', destination: '#e8337a' };
const TOOLS = [
  { id: 'select', label: 'Select / move', key: 'V', icon: '👆' },
  { id: 'road', label: 'Draw roads', key: 'R', icon: '🛣️' },
  { id: 'normal', label: 'Corner point', key: 'N', icon: '🔵' },
  { id: 'littlebit', label: 'Little-bit point', key: 'L', icon: '🟠' },
  { id: 'start', label: 'Start (bus stop)', key: 'S', icon: '🟢' },
  { id: 'destination', label: 'Place', key: 'D', icon: '📍' },
  { id: 'delete', label: 'Delete', key: 'X', icon: '🗑️' },
];

// ---------------- layout ----------------
const root = document.getElementById('editor');
const canvas = h('canvas.ed-canvas');
const ctx = canvas.getContext('2d');
const toolbar = h('div.ed-tools');
const side = h('div.ed-side');
const status = h('div.ed-status');
const fileInput = h('input', { type: 'file', accept: 'image/*,.zip,.json', style: { display: 'none' } });
const audioInput = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' } });

const menu = h('div.ed-menu', {},
  h('div.ed-brand', {}, '🗺️ Map Editor'),
  mbtn('📂 Open…', () => fileInput.click(), 'Open a map picture, a map pack (.zip), or an old map_data.json'),
  builtInSelect(),
  mbtn('↶ Undo', undo), mbtn('↷ Redo', redo),
  h('div.ed-grow'),
  mbtn('▶ Test play', testPlay, 'Opens the game with this map'),
  mbtn('💾 Download map pack', exportPack, 'A .zip to unzip into the game\'s maps/ folder', 'primary'),
  h('a.ed-help', { href: '#', onclick: e => { e.preventDefault(); showHelp(); } }, '❓ Help'),
);
root.append(menu, h('div.ed-main', {}, toolbar, h('div.ed-canvas-wrap', {}, canvas, status), side), fileInput, audioInput);

function mbtn(text, fn, title = '', cls = '') { return h('button.ed-btn' + (cls ? '.' + cls : ''), { onclick: fn, title }, text); }

function builtInSelect() {
  const sel = h('select.ed-select', { title: 'Open a map that is already in the game' },
    h('option', { value: '' }, 'Open a game map…'),
    ...MAPS.map(m => h('option', { value: m.id }, m.name)));
  sel.addEventListener('change', async () => {
    const m = MAPS.find(x => x.id === sel.value);
    sel.value = '';
    if (!m || !confirmLose()) return;
    const { graph, imageUrl, thumbUrl, audioUrl, ...plain } = m;
    const img = await fetchDataUrl(imageUrl);
    const audio = {};
    for (const p of m.points) if (p.audio && audioUrl(p.audio)) audio[p.audio] = await fetchDataUrl(audioUrl(p.audio));
    loadState(JSON.parse(JSON.stringify(plain)), img, m.image, audio);
  });
  return sel;
}

async function fetchDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}

function renderToolbar() {
  toolbar.replaceChildren(...TOOLS.map(t => h('button.ed-tool' + (S.tool === t.id ? '.on' : ''), {
    title: `${t.label} (${t.key})`, onclick: () => setTool(t.id),
  }, h('span.ti', {}, t.icon), h('span.tl', {}, t.label), h('kbd', {}, t.key))));
}
function setTool(id) { S.tool = id; S.roadFrom = null; renderToolbar(); draw(); }

// ---------------- helpers ----------------
const P = id => S.map.points.find(p => p.id === id);
function nextId() {
  let n = 0;
  for (const p of S.map.points) { const m = /^p(\d+)$/.exec(p.id); if (m) n = Math.max(n, +m[1]); }
  return 'p' + (n + 1);
}
function snapshot() {
  S.undo.push(JSON.stringify(S.map));
  if (S.undo.length > 150) S.undo.shift();
  S.redo = [];
}
function changed() { S.dirty = true; S.solution = null; scheduleCheck(); autosave(); renderSide(); draw(); }
function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(S.map)); S.map = JSON.parse(S.undo.pop()); S.selected = null; changed(); }
function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(S.map)); S.map = JSON.parse(S.redo.pop()); S.selected = null; changed(); }
function confirmLose() { return !S.dirty || confirm('Open another map? Your current map is autosaved in this browser, but will be replaced.'); }

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - S.view.x) / S.view.z, y: (e.clientY - r.top - S.view.y) / S.view.z };
}
function pointAt(w, rad = 12) {
  let best = null, bd = rad / S.view.z;
  for (const p of S.map.points) { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function roadAt(w, rad = 8) {
  let best = -1, bd = rad / S.view.z;
  S.map.roads.forEach(([a, b], i) => {
    const A = P(a), B = P(b); if (!A || !B) return;
    const dx = B.x - A.x, dy = B.y - A.y, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((w.x - A.x) * dx + (w.y - A.y) * dy) / L));
    const d = Math.hypot(A.x + t * dx - w.x, A.y + t * dy - w.y);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function snapAngle(from, w) {
  const dx = w.x - from.x, dy = w.y - from.y, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
  const s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  return { x: Math.round(from.x + Math.cos(s) * d), y: Math.round(from.y + Math.sin(s) * d) };
}
function addPoint(w, type) {
  const p = { id: nextId(), x: Math.round(w.x), y: Math.round(w.y), type };
  if (type === 'destination') p.name = 'new place';
  if (type === 'start') p.name = 'new start';
  S.map.points.push(p);
  return p;
}
function connect(a, b) {
  if (a === b) return;
  if (S.map.roads.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return;
  S.map.roads.push([a, b]);
}
function deletePoint(id) {
  S.map.points = S.map.points.filter(p => p.id !== id);
  S.map.roads = S.map.roads.filter(r => !r.includes(id));
  S.map.missions = S.map.missions.filter(m => m.start !== id && m.destination !== id);
  for (const p of S.map.points) if (p.facing === id) delete p.facing;
}

// ---------------- mouse ----------------
let drag = null, spaceDown = false, mouseW = { x: 0, y: 0 }, shift = false;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  const w = toWorld(e);
  if (e.button === 1 || e.button === 2 || spaceDown) { drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; return; }
  if (!S.image) return;
  const hitP = pointAt(w);
  const tool = S.tool;
  if (tool === 'select') {
    if (hitP) { S.selected = { kind: 'point', id: hitP.id }; snapshot(); drag = { kind: 'move', id: hitP.id, moved: false }; }
    else { const r = roadAt(w); S.selected = r >= 0 ? { kind: 'road', index: r } : null; if (r < 0) drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; }
    renderSide(); draw();
  } else if (tool === 'road') {
    snapshot();
    let target = hitP;
    if (!target) {
      const pos = S.roadFrom && shift ? snapAngle(P(S.roadFrom), w) : w;
      const onRoad = roadAt(pos);
      target = addPoint(pos, 'normal');
      if (onRoad >= 0) { // split the road we clicked on
        const [a, b] = S.map.roads[onRoad];
        S.map.roads.splice(onRoad, 1, [a, target.id], [target.id, b]);
      }
    }
    if (S.roadFrom) connect(S.roadFrom, target.id);
    S.roadFrom = target.id;
    S.selected = { kind: 'point', id: target.id };
    changed();
  } else if (tool === 'delete') {
    if (hitP) { snapshot(); deletePoint(hitP.id); S.selected = null; changed(); }
    else { const r = roadAt(w); if (r >= 0) { snapshot(); S.map.roads.splice(r, 1); changed(); } }
  } else {
    // place a point of this type (or change an existing point's type)
    snapshot();
    if (hitP) { hitP.type = tool; if (tool === 'destination' && !hitP.name) hitP.name = 'new place'; if (tool === 'start' && !hitP.name) hitP.name = 'new start'; S.selected = { kind: 'point', id: hitP.id }; }
    else {
      const onRoad = roadAt(w);
      const p = addPoint(w, tool);
      if (onRoad >= 0 && tool !== 'destination') { const [a, b] = S.map.roads[onRoad]; S.map.roads.splice(onRoad, 1, [a, p.id], [p.id, b]); }
      S.selected = { kind: 'point', id: p.id };
      if (tool === 'destination' || tool === 'start') { setTool('road'); S.roadFrom = p.id; status.textContent = 'Now click the road point this place connects to.'; }
    }
    changed();
  }
});
canvas.addEventListener('pointermove', e => {
  const w = toWorld(e); mouseW = w; shift = e.shiftKey;
  if (drag?.kind === 'pan') { S.view.x = drag.vx + e.clientX - drag.sx; S.view.y = drag.vy + e.clientY - drag.sy; draw(); return; }
  if (drag?.kind === 'move') {
    const p = P(drag.id); p.x = Math.round(w.x); p.y = Math.round(w.y); drag.moved = true; draw(); return;
  }
  const hp = pointAt(w);
  S.hover = hp ? hp.id : null;
  status.textContent = `x ${Math.round(w.x)}, y ${Math.round(w.y)}` + (hp ? ` · ${hp.type}${hp.name ? ': ' + hp.name : ''}` : '') + (S.tool === 'road' ? ' · click to add road points, Esc to stop, hold Shift for straight lines' : '');
  draw();
});
canvas.addEventListener('pointerup', () => {
  if (drag?.kind === 'move') { if (drag.moved) changed(); else S.undo.pop(); }
  drag = null;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const k = Math.exp(-e.deltaY * 0.0015);
  const z = Math.max(0.1, Math.min(6, S.view.z * k));
  S.view.x = mx - (mx - S.view.x) * (z / S.view.z);
  S.view.y = my - (my - S.view.y) * (z / S.view.z);
  S.view.z = z; draw();
}, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  if (e.code === 'Space') { spaceDown = true; e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape') { S.roadFrom = null; S.solution = null; draw(); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.selected?.kind === 'point') { snapshot(); deletePoint(S.selected.id); S.selected = null; changed(); }
    else if (S.selected?.kind === 'road') { snapshot(); S.map.roads.splice(S.selected.index, 1); S.selected = null; changed(); }
  }
  const t = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
  if (t && !e.ctrlKey && !e.metaKey) setTool(t.id);
});
window.addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
window.addEventListener('resize', () => { resize(); draw(); });
window.addEventListener('beforeunload', e => { if (S.dirty) { /* autosaved; no prompt needed */ } });

// ---------------- drawing ----------------
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function fitView() {
  if (!S.image) return;
  const r = canvas.parentElement.getBoundingClientRect();
  const z = Math.min((r.width - 40) / S.image.width, (r.height - 40) / S.image.height);
  S.view = { z, x: (r.width - S.image.width * z) / 2, y: (r.height - S.image.height * z) / 2 };
}
function draw() {
  const r = canvas.parentElement.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
  if (!S.image) {
    ctx.fillStyle = '#5c6178'; ctx.font = '600 22px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Open a map picture (PNG/JPG), a map pack (.zip) or a game map to start.', r.width / 2, r.height / 2);
    return;
  }
  const { x, y, z } = S.view;
  ctx.save();
  ctx.translate(x, y); ctx.scale(z, z);
  ctx.drawImage(S.image, 0, 0);
  const lw = 1 / z;
  // roads
  S.map.roads.forEach(([a, b], i) => {
    const A = P(a), B = P(b); if (!A || !B) return;
    const sel = S.selected?.kind === 'road' && S.selected.index === i;
    const toDest = A.type === 'destination' || B.type === 'destination';
    ctx.strokeStyle = sel ? '#ff3d00' : toDest ? 'rgba(232,51,122,.8)' : 'rgba(47,125,225,.75)';
    ctx.lineWidth = (sel ? 7 : 5) * lw;
    ctx.setLineDash(toDest ? [8 * lw, 6 * lw] : []);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  });
  ctx.setLineDash([]);
  // solution path
  if (S.solution) {
    ctx.strokeStyle = 'rgba(255,193,7,.95)'; ctx.lineWidth = 9 * lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    S.solution.path.forEach((id, i) => { const p = P(id); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
  }
  // road being drawn
  if (S.tool === 'road' && S.roadFrom && P(S.roadFrom)) {
    const A = P(S.roadFrom), B = shift ? snapAngle(A, mouseW) : mouseW;
    ctx.strokeStyle = 'rgba(47,125,225,.5)'; ctx.lineWidth = 4 * lw; ctx.setLineDash([6 * lw, 5 * lw]);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
  }
  // issues
  const bad = new Set(S.issues.flatMap(i => i.ids || []));
  // points
  for (const p of S.map.points) {
    const sel = S.selected?.kind === 'point' && S.selected.id === p.id;
    const rad = (p.type === 'normal' ? 6 : 8) * lw * (sel ? 1.4 : 1) * (S.hover === p.id ? 1.3 : 1);
    if (bad.has(p.id)) { ctx.fillStyle = 'rgba(255,0,0,.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 2.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = TYPE_COLORS[p.type] || '#666';
    ctx.strokeStyle = sel ? '#ff3d00' : '#fff'; ctx.lineWidth = (sel ? 3 : 2) * lw;
    ctx.beginPath();
    if (p.type === 'littlebit') { ctx.rect(p.x - rad, p.y - rad, rad * 2, rad * 2); }
    else ctx.arc(p.x, p.y, rad, 0, 7);
    ctx.fill(); ctx.stroke();
    if (p.littlebit && p.type !== 'littlebit') { ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 3 * lw; ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4 * lw, 0, 7); ctx.stroke(); }
    if (p.name && (p.type === 'destination' || p.type === 'start')) {
      ctx.font = `600 ${13 * lw}px Fredoka, sans-serif`; ctx.textAlign = 'center';
      const w = ctx.measureText(p.name).width + 10 * lw;
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(p.x - w / 2, p.y - 30 * lw, w, 18 * lw);
      ctx.fillStyle = TYPE_COLORS[p.type]; ctx.fillText(p.name, p.x, p.y - 16 * lw);
    }
    if (p.type === 'start' && p.facing && P(p.facing)) {
      const F = P(p.facing), a = Math.atan2(F.y - p.y, F.x - p.x);
      ctx.strokeStyle = '#1faa55'; ctx.lineWidth = 3 * lw;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * 26 * lw, p.y + Math.sin(a) * 26 * lw); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------- side panel ----------------
let tab = 'point';
function renderSide() {
  const tabs = h('div.ed-tabs', {}, ...[['point', 'Selected'], ['map', 'Map info'], ['check', `Checker ${S.issues.length ? '(' + S.issues.length + ')' : '✔'}`], ['missions', `Missions (${S.map.missions.length})`]]
    .map(([id, label]) => h('button.ed-tab' + (tab === id ? '.on' : '') + (id === 'check' && S.issues.some(i => i.level === 'error') ? '.bad' : ''), { onclick: () => { tab = id; renderSide(); } }, label)));
  const body = h('div.ed-panel');
  if (tab === 'point') body.append(...pointPanel());
  if (tab === 'map') body.append(...mapPanel());
  if (tab === 'check') body.append(...checkPanel());
  if (tab === 'missions') body.append(...missionsPanel());
  side.replaceChildren(tabs, body);
}

function field(label, input) { return h('label.ed-field', {}, h('span', {}, label), input); }
function textInput(value, onChange, attrs = {}) {
  const i = h('input', { value: value ?? '', ...attrs });
  i.addEventListener('change', () => { snapshot(); onChange(i.value); changed(); });
  return i;
}

function pointPanel() {
  const sel = S.selected;
  if (!sel) return [h('p.ed-hint', {}, 'Click a point or road with the Select tool to edit it.'), legend()];
  if (sel.kind === 'road') {
    const [a, b] = S.map.roads[sel.index] || [];
    return [h('h3', {}, 'Road'), h('p', {}, `${a} ↔ ${b}`), mbtn('🗑️ Delete road', () => { snapshot(); S.map.roads.splice(sel.index, 1); S.selected = null; changed(); })];
  }
  const p = P(sel.id);
  if (!p) return [];
  const g = new MapGraph(S.map);
  const typeSel = h('select', {}, ...['normal', 'littlebit', 'start', 'destination'].map(t => h('option', { value: t, selected: p.type === t }, t)));
  typeSel.addEventListener('change', () => { snapshot(); p.type = typeSel.value; if ((p.type === 'destination' || p.type === 'start') && !p.name) p.name = 'new ' + (p.type === 'start' ? 'start' : 'place'); changed(); });
  const out = [h('h3', {}, `Point ${p.id}`), field('Type', typeSel)];
  if (p.type === 'destination' || p.type === 'start') {
    out.push(field('Name (shown to students)', textInput(p.name, v => {
      p.name = v.trim();
      if (p.type === 'destination' && !p.audio) { /* keep */ }
    })));
  }
  if (p.type === 'destination') {
    const suggested = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.mp3';
    const has = p.audio && S.audio[p.audio];
    out.push(h('div.ed-audio', {},
      h('div', {}, has ? `🔊 ${p.audio}` : '🔇 No voice clip yet'),
      has ? mbtn('▶ Play', () => new Audio(S.audio[p.audio]).play()) : null,
      mbtn(has ? 'Replace clip' : 'Add voice clip', () => {
        audioInput.onchange = async () => {
          const f = audioInput.files[0]; if (!f) return;
          const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
          const name = suggested.replace(/\.mp3$/, '.' + ext);
          S.audio[name] = await readAs(f, 'dataURL');
          snapshot(); p.audio = name; audioInput.value = ''; changed();
        };
        audioInput.click();
      }),
      has ? mbtn('Remove', () => { snapshot(); delete p.audio; changed(); }) : null,
    ));
    const nb = g.neighbors(p.id);
    if (nb.length !== 1) out.push(h('p.ed-warn', {}, nb.length ? 'A place should connect to exactly one road point.' : 'Connect this place to a road point (Road tool).'));
  }
  if (p.type === 'start') {
    const nb = g.neighbors(p.id);
    const f = h('select', {}, ...nb.map(n => h('option', { value: n, selected: p.facing === n }, `towards ${n}` + (P(n).name ? ` (${P(n).name})` : ''))));
    f.addEventListener('change', () => { snapshot(); p.facing = f.value; changed(); });
    out.push(field('Character faces', f));
  }
  if (p.type !== 'littlebit') {
    const cb = h('input', { type: 'checkbox', checked: !!p.littlebit });
    cb.addEventListener('change', () => { snapshot(); if (cb.checked) p.littlebit = true; else delete p.littlebit; changed(); });
    out.push(h('label.ed-check', {}, cb, ' Count as a little-bit point when walking (does not count as a block)'));
  }
  out.push(h('p.ed-small', {}, `x ${p.x}, y ${p.y} · roads: ${g.neighbors(p.id).join(', ') || 'none'}`));
  out.push(mbtn('🗑️ Delete point', () => { snapshot(); deletePoint(p.id); S.selected = null; changed(); }));
  return out;
}

function legend() {
  return h('div.ed-legend', {},
    h('h3', {}, 'How points work'),
    h('p', {}, h('b', { style: { color: TYPE_COLORS.normal } }, '● Corner point'), ' — a crossing or bend. Counts as 1 block for "go straight for 1 block".'),
    h('p', {}, h('b', { style: { color: TYPE_COLORS.littlebit } }, '■ Little-bit point'), ' — where "go straight for a little bit" stops, usually beside a place. Doesn\'t count as a block.'),
    h('p', {}, h('b', { style: { color: TYPE_COLORS.start } }, '● Start'), ' — where the character begins (bus stops). Set which way it faces.'),
    h('p', {}, h('b', { style: { color: TYPE_COLORS.destination } }, '● Place'), ' — a destination. Connect it to one road point with a short road. "You can see it on your left/right" walks onto it.'),
  );
}

function mapPanel() {
  const m = S.map;
  const num = (v, fn) => textInput(v, x => fn(Number(x) || 0), { type: 'number' });
  return [
    h('h3', {}, 'Map info'),
    field('Map id (folder name, no spaces)', textInput(m.id, v => { m.id = v.toLowerCase().replace(/[^a-z0-9-]/g, '-'); })),
    field('Town name', textInput(m.name, v => { m.name = v; })),
    field('Subtitle', textInput(m.subtitle, v => { m.subtitle = v; })),
    field('Order on the town screen', num(m.order, v => { m.order = v; })),
    field('Stars needed to unlock', num(m.unlockStars, v => { m.unlockStars = v; })),
    h('p.ed-small', {}, `Picture: ${S.imageName} (${m.width} × ${m.height})`),
    mbtn('🖼️ Replace map picture', () => { replacingImage = true; fileInput.click(); }),
    legend(),
  ];
}

// ---------------- checker ----------------
let checkTimer = 0;
function scheduleCheck() { clearTimeout(checkTimer); checkTimer = setTimeout(() => { S.issues = runChecks(); renderSide(); draw(); }, 250); }
function runChecks() {
  const m = S.map, g = new MapGraph(m), out = [];
  const starts = g.starts(), dests = g.destinations();
  if (!S.image) return out;
  if (!starts.length) out.push({ level: 'error', text: 'Add at least one start point.' });
  if (!dests.length) out.push({ level: 'error', text: 'Add at least one place.' });
  for (const p of m.points) {
    const nb = g.neighbors(p.id);
    if (!nb.length) out.push({ level: 'error', text: `${p.name || p.id} is not connected to any road.`, ids: [p.id] });
    if (p.type === 'destination' && nb.length > 1) out.push({ level: 'warn', text: `${p.name} connects to ${nb.length} roads (usually 1).`, ids: [p.id] });
    if (p.type === 'destination' && !p.audio) out.push({ level: 'warn', text: `${p.name} has no voice clip (Listening missions will be silent).`, ids: [p.id] });
    if (p.type === 'destination' && (!p.name || p.name === 'new place')) out.push({ level: 'error', text: `Place ${p.id} needs a name.`, ids: [p.id] });
    for (const q of m.points) if (q.id < p.id && Math.hypot(p.x - q.x, p.y - q.y) < 6) out.push({ level: 'warn', text: `${p.id} and ${q.id} are on top of each other.`, ids: [p.id, q.id] });
  }
  // Two roads leaving a point in almost the same direction make "go straight" ambiguous.
  for (const p of m.points) {
    const nb = g.neighbors(p.id).map(n => g.angle(p.id, n));
    for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) {
      let d = Math.abs(nb[i] - nb[j]); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < Math.PI / 8) out.push({ level: 'warn', text: `Two roads leave ${p.name || p.id} in almost the same direction.`, ids: [p.id] });
    }
  }
  for (const d of dests) {
    const ok = starts.some(s => solve(g, s.id, d.id));
    if (!ok && g.neighbors(d.id).length) out.push({ level: 'error', text: `Nobody can reach ${d.name} with the blocks.`, ids: [d.id] });
  }
  for (const ms of m.missions) {
    if (!P(ms.start) || !P(ms.destination)) { out.push({ level: 'error', text: `Mission ${ms.id} uses a deleted point.` }); continue; }
    const best = solve(g, ms.start, ms.destination);
    if (!best) out.push({ level: 'error', text: `Mission ${ms.id} (${P(ms.destination).name}) can't be solved any more.`, ids: [ms.destination] });
    else if (best.length !== ms.best) out.push({ level: 'fix', text: `Mission ${ms.id}: best is now ${best.length} blocks (was ${ms.best}).`, fix: () => { ms.best = best.length; } });
  }
  return out;
}
function checkPanel() {
  if (!S.image) return [h('p.ed-hint', {}, 'Open a map first.')];
  if (!S.issues.length) return [h('div.ed-ok', {}, '✔ Everything looks good!')];
  const fixes = S.issues.filter(i => i.fix);
  return [
    fixes.length ? mbtn(`🔧 Fix ${fixes.length} star targets`, () => { snapshot(); fixes.forEach(f => f.fix()); changed(); }) : null,
    ...S.issues.map(i => h('div.ed-issue.' + i.level, {
      onclick: () => { if (i.ids?.[0]) { S.selected = { kind: 'point', id: i.ids[0] }; focusPoint(P(i.ids[0])); tab = 'point'; renderSide(); } },
    }, { error: '⛔ ', warn: '⚠️ ', fix: '🔧 ' }[i.level], i.text)),
  ].filter(Boolean);
}
function focusPoint(p) {
  if (!p) return;
  const r = canvas.parentElement.getBoundingClientRect();
  S.view.z = Math.max(S.view.z, 1.2);
  S.view.x = r.width / 2 - p.x * S.view.z; S.view.y = r.height / 2 - p.y * S.view.z;
  draw();
}

// ---------------- missions ----------------
function missionsPanel() {
  const m = S.map, g = new MapGraph(m);
  const out = [
    h('p.ed-small', {}, 'Missions are made automatically from your roads: 4 tiers (Warm-up, Town Walk, Listening, Challenge). Star targets use the shortest possible program.'),
    h('div.ed-row', {},
      mbtn('✨ Auto-generate missions', () => {
        if (m.missions.length && !confirm('Replace all missions with new auto-generated ones?')) return;
        snapshot(); m.missions = generateMissions(m); changed();
      }, '', 'primary'),
    ),
  ];
  // add mission
  const starts = g.starts(), dests = g.destinations();
  const sSel = h('select', {}, ...starts.map(s => h('option', { value: s.id }, s.name)));
  const dSel = h('select', {}, ...dests.map(d => h('option', { value: d.id }, d.name)));
  const tSel = h('select', {}, ...TIERS.map(t => h('option', { value: t.id }, t.name)));
  out.push(h('div.ed-add', {}, h('b', {}, 'Add a mission: '), sSel, ' → ', dSel, tSel, mbtn('Add', () => {
    const best = solve(g, sSel.value, dSel.value);
    if (!best) { alert('That route cannot be solved with the blocks.'); return; }
    snapshot();
    const tier = Number(tSel.value);
    const n = m.missions.filter(x => x.tier === tier).length + 1;
    let id = `t${tier}-${n}`; while (m.missions.some(x => x.id === id)) id += 'b';
    m.missions.push({ id, tier, start: sSel.value, destination: dSel.value, best: best.length });
    m.missions.sort((a, b) => a.tier - b.tier);
    changed();
  })));
  for (const t of TIERS) {
    const list = m.missions.filter(x => x.tier === t.id);
    out.push(h('h3', {}, `${t.id}. ${t.name} (${list.length})`));
    for (const ms of list) {
      const st = P(ms.start), de = P(ms.destination);
      out.push(h('div.ed-mission', {},
        h('span.ed-m-name', {}, `${st?.name || '?'} → ${de?.name || '?'}`),
        h('span.ed-m-best', { title: 'fewest blocks' }, `${ms.best} blocks`),
        mbtn('👁️', () => showSolution(ms), 'Show the shortest solution'),
        mbtn('✖', () => { snapshot(); m.missions = m.missions.filter(x => x !== ms); changed(); }, 'Remove'),
      ));
    }
  }
  if (S.solution) {
    out.push(h('div.ed-solution', {}, h('b', {}, 'Shortest solution:'), h('ol', {}, ...S.solution.blocks.map(b => h('li', {}, blockLabel(b))))));
  }
  return out;
}
function showSolution(ms) {
  const g = new MapGraph(S.map);
  const best = solve(g, ms.start, ms.destination);
  if (!best) return;
  const r = simulate(g, best, ms.start, ms.destination);
  const path = [ms.start];
  for (const s of r.steps) for (const sub of s.sub) if (sub.kind === 'move') path.push(...sub.path.slice(1));
  S.solution = { path, blocks: best };
  renderSide(); draw();
}

// ---------------- open / import ----------------
let replacingImage = false;
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0]; fileInput.value = '';
  if (!f) return;
  const name = f.name.toLowerCase();
  if (name.endsWith('.zip')) return openZip(f);
  if (name.endsWith('.json')) return openJson(f);
  if (f.type.startsWith('image/')) {
    const data = await readAs(f, 'dataURL');
    if (replacingImage) { replacingImage = false; S.imageData = data; S.imageName = 'map.' + (name.split('.').pop() || 'png'); S.map.image = S.imageName; await setImage(data); changed(); return; }
    if (!confirmLose()) return;
    const m = blankMap();
    m.image = 'map.' + (name.split('.').pop() === 'jpg' ? 'jpg' : name.split('.').pop() || 'png');
    loadState(m, data, m.image, {});
  }
});

async function openZip(f) {
  if (!confirmLose()) return;
  const files = unzipSync(new Uint8Array(await f.arrayBuffer()));
  const key = Object.keys(files).find(k => k.endsWith('map.json'));
  if (!key) return alert('No map.json in that zip.');
  const base = key.slice(0, -'map.json'.length);
  const map = JSON.parse(strFromU8(files[key]));
  const imgBytes = files[base + map.image];
  if (!imgBytes) return alert(`The picture ${map.image} is missing from the zip.`);
  const img = await bytesToDataUrl(imgBytes, mimeFor(map.image));
  const audio = {};
  for (const [k, v] of Object.entries(files)) if (k.startsWith(base + 'audio/') && v.length) audio[k.slice((base + 'audio/').length)] = await bytesToDataUrl(v, mimeFor(k));
  loadState(map, img, map.image, audio);
}

async function openJson(f) {
  const data = JSON.parse(await readAs(f, 'text'));
  if (data.format === 1) {
    if (!S.image) return alert('Open the map picture first, then the map.json.');
    snapshot(); S.map = { ...blankMap(), ...data, image: S.imageName }; changed(); return;
  }
  // Old format (map_data.json from the first version of the game)
  if (!S.image) return alert('Open the map picture first, then the old map_data.json.');
  snapshot();
  S.map = { ...S.map, ...convertOld(data) };
  changed();
}

// Same conversion as scripts/convert-old-map.mjs
function convertOld(old) {
  const points = []; let n = 0;
  for (const p of old.points) {
    const id = p.type === 'start' && p.id ? p.id : `p${++n}`;
    const np = { id, x: p.x, y: p.y, type: p.type };
    if (p.name) np.name = p.name;
    if (p.type === 'destination') np.audio = p.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.mp3';
    if (p.type === 'start') np.name = p.id;
    if (p.id === 'start3') np.littlebit = true; // quirk kept from the first game
    points.push(np);
  }
  const find = c => points.find(p => Math.abs(p.x - c.x) <= 1 && Math.abs(p.y - c.y) <= 1);
  const roads = [];
  for (const c of old.connections) { const a = find(c.p1), b = find(c.p2); if (a && b) roads.push([a.id, b.id]); }
  for (const p of points.filter(p => p.type === 'start')) { const r = roads.find(r => r.includes(p.id)); if (r) p.facing = r[0] === p.id ? r[1] : r[0]; }
  return { points, roads, missions: [] };
}

function mimeFor(n) { const e = n.split('.').pop().toLowerCase(); return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav' }[e] || 'application/octet-stream'; }
function readAs(f, how) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); if (how === 'text') fr.readAsText(f); else fr.readAsDataURL(f); }); }
function bytesToDataUrl(bytes, mime) { return readAs(new Blob([bytes], { type: mime }), 'dataURL'); }
function dataUrlToBytes(d) { const b = atob(d.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

function setImage(data) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { S.image = img; S.map.width = img.width; S.map.height = img.height; res(); };
    img.src = data;
  });
}
async function loadState(map, imageData, imageName, audio) {
  S.map = { ...blankMap(), ...map };
  S.imageData = imageData; S.imageName = imageName || map.image; S.map.image = S.imageName;
  S.audio = audio || {};
  S.undo = []; S.redo = []; S.selected = null; S.solution = null; S.dirty = false;
  await setImage(imageData);
  fitView(); scheduleCheck(); renderSide(); draw(); autosave();
}

// ---------------- save / export / test ----------------
let saveTimer = 0;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!S.imageData) return;
    idbSet('autosave', { map: S.map, image: S.imageData, imageName: S.imageName, audio: S.audio }).catch(() => {});
  }, 500);
}

async function thumbBytes() {
  const w = 480, k = w / S.image.width;
  const c = document.createElement('canvas'); c.width = w; c.height = Math.round(S.image.height * k);
  c.getContext('2d').drawImage(S.image, 0, 0, c.width, c.height);
  return dataUrlToBytes(c.toDataURL('image/png'));
}

async function exportPack() {
  if (!S.image) return alert('Open a map first.');
  const errors = runChecks().filter(i => i.level === 'error');
  if (errors.length && !confirm(`The checker found ${errors.length} problem(s). Download anyway?`)) return;
  if (!S.map.missions.length && confirm('This map has no missions yet. Auto-generate them now?')) { snapshot(); S.map.missions = generateMissions(S.map); changed(); }
  const id = S.map.id || 'newtown';
  const files = {
    [`${id}/map.json`]: strToU8(JSON.stringify(S.map, null, 1)),
    [`${id}/${S.imageName}`]: dataUrlToBytes(S.imageData),
    [`${id}/thumb.png`]: await thumbBytes(),
  };
  const used = new Set(S.map.points.map(p => p.audio).filter(Boolean));
  for (const [n, d] of Object.entries(S.audio)) if (used.has(n)) files[`${id}/audio/${n}`] = dataUrlToBytes(d);
  const zip = zipSync(files, { level: 0 });
  const a = h('a', { href: URL.createObjectURL(new Blob([zip], { type: 'application/zip' })), download: `${id}.zip` });
  document.body.append(a); a.click(); a.remove();
  S.dirty = false;
  showToast(`Downloaded ${id}.zip — unzip it into the game's maps/ folder.`);
}

async function testPlay() {
  if (!S.image) return alert('Open a map first.');
  if (!S.map.missions.length) { snapshot(); S.map.missions = generateMissions(S.map); changed(); }
  await idbSet('testpack', { map: S.map, image: S.imageData, audio: S.audio });
  window.open('./index.html?test=1', '_blank');
}

function showToast(t) {
  const el = h('div.ed-toast', {}, t); document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

function showHelp() {
  const back = h('div.ed-modal-back', { onclick: e => { if (e.target === back) back.remove(); } }, h('div.ed-modal', {},
    h('h2', {}, 'Making a new town'),
    h('ol', {},
      h('li', {}, 'Click ', h('b', {}, 'Open…'), ' and choose your map picture (PNG or JPG).'),
      h('li', {}, 'Use ', h('b', {}, 'Draw roads (R)'), ': click along the middle of each road. Click at every crossing and bend. Press Esc to stop a line. Click an existing point to join roads. Hold Shift for straight lines.'),
      h('li', {}, 'Use ', h('b', {}, 'Little-bit point (L)'), ' on a road where "go straight for a little bit" should stop, usually beside a place.'),
      h('li', {}, 'Use ', h('b', {}, 'Place (D)'), ' on each building, name it, then click the road point it joins. Add its voice clip in the Selected tab.'),
      h('li', {}, 'Use ', h('b', {}, 'Start (S)'), ' for each bus stop, join it to a road, and choose which way the character faces.'),
      h('li', {}, 'Open the ', h('b', {}, 'Checker'), ' tab and fix anything red.'),
      h('li', {}, 'In ', h('b', {}, 'Missions'), ', press Auto-generate. Use 👁️ to see the shortest answer.'),
      h('li', {}, 'Press ', h('b', {}, 'Test play'), ' to try it in the real game.'),
      h('li', {}, 'Press ', h('b', {}, 'Download map pack'), '. Unzip it into ', h('code', {}, 'game/maps/'), ', commit and push. The new town appears automatically.'),
    ),
    h('p', {}, 'Mouse: scroll to zoom, right-drag or Space+drag to move around. Ctrl+Z to undo. Your work autosaves in this browser.'),
    h('button.ed-btn.primary', { onclick: () => back.remove() }, 'Got it'),
  ));
  document.body.append(back);
}

// ---------------- boot ----------------
renderToolbar();
resize();
renderSide();
draw();
(async () => {
  try {
    const saved = await idbGet('autosave');
    if (saved?.image) { await loadState(saved.map, saved.image, saved.imageName, saved.audio); showToast('Restored your last map.'); }
    else showHelp();
  } catch (e) { showHelp(); }
})();
