// Tiny DOM helpers.
export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- Stage: a 900px-tall game area, as wide as the screen allows ----
// Width follows the screen shape (1440-2100px), so there are no side bars on
// wide screens and the extra space goes to the map.
export const STAGE_H = 900, STAGE_MIN_W = 1440, STAGE_MAX_W = 2100;
export let STAGE_W = 1600;
let stageScale = 1;
export function getStageScale() { return stageScale; }
export function getStageW() { return STAGE_W; }
export function fitStage() {
  const stage = document.getElementById('stage');
  const vw = window.innerWidth, vh = window.innerHeight;
  STAGE_W = Math.round(Math.max(STAGE_MIN_W, Math.min(STAGE_MAX_W, STAGE_H * vw / vh)));
  const s = Math.min(vw / STAGE_W, vh / STAGE_H);
  stageScale = s;
  stage.style.width = STAGE_W + 'px';
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
// Convert a pointer event's client coordinates to stage coordinates.
export function toStage(clientX, clientY) {
  const r = document.getElementById('stage').getBoundingClientRect();
  return { x: (clientX - r.left) / stageScale, y: (clientY - r.top) / stageScale };
}
export function rectInStage(el) {
  const r = el.getBoundingClientRect();
  const s = document.getElementById('stage').getBoundingClientRect();
  return { x: (r.left - s.left) / stageScale, y: (r.top - s.top) / stageScale, w: r.width / stageScale, h: r.height / stageScale };
}

// A juicy button: plays a sound and squishes on press.
import { sfx } from '../audio/sfx.js';
export function btn(cls, content, onClick, attrs = {}) {
  const b = h('button.btn.' + cls, attrs, content);
  b.addEventListener('pointerdown', () => { sfx.play('press'); });
  b.addEventListener('click', e => { if (!b.disabled) onClick?.(e); });
  return b;
}

// Modal popups on the overlay layer.
export function modal(content, { onClose, cls = '' } = {}) {
  const overlay = document.getElementById('overlay');
  const back = h('div.modal-back');
  const box = h('div.modal.' + (cls || 'plain'), {}, content);
  back.append(box);
  const close = () => {
    back.classList.add('closing');
    setTimeout(() => back.remove(), 220);
    onClose?.();
  };
  back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  overlay.append(back);
  return { close, box, back };
}

export function toast(text, cls = '') {
  const t = h('div.toast.' + (cls || 'info'), {}, text);
  document.getElementById('overlay').append(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2300);
}

// Count a number up with a little bounce on the element.
export function countTo(el, from, to, ms = 700) {
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
