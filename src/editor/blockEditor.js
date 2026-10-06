// Custom drag-and-drop block editor: one stack under "start ▶".
// Blocks snap into place with a gap preview, a clack and a bounce.
import { h, toStage, rectInStage, toast } from '../ui/dom.js';
import { sfx } from '../audio/sfx.js';
import { BLOCK_DEFS, PALETTE } from './blocks.js';
import { blockLabel, TERMINAL } from '../engine/engine.js';

let uid = 0;
const newId = () => 'b' + (++uid);

function blockContent(b, { withNum = true } = {}) {
  const def = BLOCK_DEFS[b.type];
  const icon = h('span.bicon', { html: def.icon });
  if (b.type === 'straight') {
    const n = b.n || 1;
    return [icon, h('span.btext', {}, 'go straight for ', withNum ? h('span.num', { 'data-num': '1' }, String(n)) : h('span.num.static', {}, String(n)), ` ${n === 1 ? 'block' : 'blocks'}`)];
  }
  if (b.type === 'start') return [h('span.btext', {}, 'start ▶')];
  return [icon, h('span.btext', {}, blockLabel(b))];
}

export function blockEl(b, cls = '') {
  const def = BLOCK_DEFS[b.type];
  const el = h('div.block.' + b.type + (cls ? '.' + cls : ''), { style: { '--c': def.color, '--d': def.dark } }, ...blockContent(b));
  if (TERMINAL.has(b.type)) el.classList.add('terminal');
  return el;
}

export class BlockEditor {
  constructor({ palette, program, bin, onChange, maxBlocks = 12 }) {
    this.paletteEl = palette;
    this.programEl = program;
    this.binEl = bin;
    this.onChange = onChange || (() => {});
    this.max = maxBlocks;
    this.model = [];
    this.els = new Map();
    this.locked = false;
    this.gapIndex = -1;
    this.stack = h('div.stack');
    this.startEl = blockEl({ type: 'start' }, 'start-block');
    this.gapEl = h('div.gap');
    this.programEl.append(this.stack);
    this.buildPalette();
    this.render(false);
  }

  buildPalette() {
    this.paletteEl.innerHTML = '';
    PALETTE.forEach(p => {
      const key = blockEl(p, 'pkey');
      key.querySelector('.num')?.classList.add('static');
      key.addEventListener('pointerdown', e => this.pointerDown(e, { from: 'palette', proto: p, el: key }));
      this.paletteEl.append(key);
    });
  }

  setProgram(list) {
    this.model = list.map(b => ({ ...b, id: newId() }));
    this.render(false);
    this.onChange(this.program());
  }
  program() { return this.model.map(({ type, n }) => (type === 'straight' ? { type, n: n || 1 } : { type })); }

  // ---- rendering with FLIP animation ----
  elFor(b) {
    let el = this.els.get(b.id);
    if (!el) {
      el = blockEl(b);
      el.dataset.id = b.id;
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('.num')) return;
        this.pointerDown(e, { from: 'program', id: b.id, el });
      });
      el.addEventListener('click', e => {
        const num = e.target.closest('.num');
        if (num && !this.locked) this.pickNumber(b.id, num);
      });
      this.els.set(b.id, el);
    }
    return el;
  }
  refreshEl(b) {
    const el = this.els.get(b.id);
    if (!el) return;
    el.replaceChildren(...blockContent(b));
  }
  render(animate = true) {
    const before = new Map();
    if (animate) for (const [id, el] of this.els) if (el.isConnected) before.set(id, el.getBoundingClientRect());
    const children = [this.startEl];
    this.model.forEach((b, i) => {
      if (i === this.gapIndex) children.push(this.gapEl);
      children.push(this.elFor(b));
    });
    if (this.gapIndex >= this.model.length) children.push(this.gapEl);
    if (this.gapIndex < 0) this.gapEl.remove();
    this.stack.replaceChildren(...children);
    for (const [id, el] of this.els) if (!this.model.find(b => b.id === id)) this.els.delete(id);
    if (animate) {
      for (const [id, r0] of before) {
        const el = this.els.get(id);
        if (!el || !el.isConnected) continue;
        const r1 = el.getBoundingClientRect();
        const dy = r0.top - r1.top, dx = r0.left - r1.left;
        if (Math.abs(dy) < 1 && Math.abs(dx) < 1) continue;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      }
    }
    this.programEl.classList.toggle('empty', this.model.length === 0);
  }

  // ---- rules: "you can see it..." blocks must be last ----
  validIndices(type) {
    const t = this.model.findIndex(b => TERMINAL.has(b.type));
    if (TERMINAL.has(type)) return [t < 0 ? this.model.length : t];
    const max = t < 0 ? this.model.length : t;
    return Array.from({ length: max + 1 }, (_, i) => i);
  }
  insertAt(block, index) {
    const t = this.model.findIndex(b => TERMINAL.has(b.type));
    if (TERMINAL.has(block.type) && t >= 0) { this.model.splice(t, 1); index = Math.min(index, this.model.length); }
    this.model.splice(index, 0, block);
  }

  append(proto, fromEl) {
    if (this.locked) return;
    if (this.model.length >= this.max && !(TERMINAL.has(proto.type) && this.model.some(b => TERMINAL.has(b.type)))) return this.tooMany();
    const block = { ...proto, id: newId() };
    const idx = this.validIndices(block.type).pop();
    this.insertAt(block, idx);
    this.render();
    const el = this.els.get(block.id);
    if (fromEl && el) {
      const a = fromEl.getBoundingClientRect(), b = el.getBoundingClientRect();
      el.animate([
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(.9)`, opacity: 0.6 },
        { transform: 'translate(0,0) scale(1.06)', opacity: 1, offset: 0.8 },
        { transform: 'none' },
      ], { duration: 360, easing: 'cubic-bezier(.3,.8,.3,1)' });
    }
    this.landed(block.id, 300);
    this.scrollTo(el);
    this.onChange(this.program());
  }
  tooMany() {
    sfx.play('error');
    this.programEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 280 });
    toast('ブロックが多すぎるよ！へらしてみよう。', 'warn');
  }
  landed(id, delay = 0) {
    setTimeout(() => {
      const el = this.els.get(id);
      if (!el) return;
      sfx.play('snap');
      el.animate([{ transform: 'scale(1.08, .88)' }, { transform: 'scale(.97, 1.04)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }, delay);
  }
  scrollTo(el) {
    if (!el) return;
    const p = this.programEl;
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (bottom > p.scrollTop + p.clientHeight - 20) p.scrollTo({ top: bottom - p.clientHeight + 40, behavior: 'smooth' });
  }

  // ---- number picker for "go straight for [n] block(s)" ----
  pickNumber(id, anchor) {
    const b = this.model.find(x => x.id === id);
    if (!b) return;
    sfx.play('pick');
    const overlay = document.getElementById('overlay');
    const r = rectInStage(anchor);
    const pop = h('div.numpop', { style: { left: r.x - 10 + 'px', top: r.y + r.h + 8 + 'px' } });
    for (let n = 1; n <= 10; n++) {
      pop.append(h('button.numbtn' + (n === (b.n || 1) ? '.on' : ''), {
        onclick: () => {
          b.n = n; this.refreshEl(b); sfx.play('snap'); close(); this.onChange(this.program());
          const el = this.els.get(id);
          el?.querySelector('.num')?.animate([{ transform: 'scale(1.5)' }, { transform: 'none' }], { duration: 250 });
        },
      }, String(n)));
    }
    const back = h('div.numpop-back', { onpointerdown: e => { if (e.target === back) close(); } }, pop);
    const close = () => back.remove();
    overlay.append(back);
  }

  // ---- drag and drop ----
  pointerDown(e, src) {
    if (this.locked || e.button > 0) return;
    e.preventDefault();
    const start = toStage(e.clientX, e.clientY);
    const origin = rectInStage(src.el);
    let drag = null;
    const move = ev => {
      const p = toStage(ev.clientX, ev.clientY);
      if (!drag) {
        if (Math.hypot(p.x - start.x, p.y - start.y) < 7) return;
        drag = this.beginDrag(src, origin, start);
      }
      this.dragMove(drag, p);
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (drag) this.dragEnd(drag, toStage(ev.clientX, ev.clientY));
      else if (src.from === 'palette') { sfx.play('pick'); this.append(src.proto, src.el); src.el.animate([{ transform: 'scale(.92)' }, { transform: 'none' }], { duration: 160 }); }
      else if (src.from === 'program') {
        src.el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 180 });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  beginDrag(src, origin, start) {
    sfx.play('pick');
    let block, fromIndex = -1;
    if (src.from === 'palette') block = { ...src.proto, id: newId() };
    else {
      fromIndex = this.model.findIndex(b => b.id === src.id);
      block = this.model[fromIndex];
      this.model.splice(fromIndex, 1);
      this.gapIndex = fromIndex;
      this.render(false);
    }
    const ghost = blockEl(block, 'dragging');
    ghost.querySelector('.num')?.classList.add('static');
    ghost.style.left = origin.x + 'px';
    ghost.style.top = origin.y + 'px';
    document.getElementById('drag-layer').append(ghost);
    document.body.classList.add('is-dragging');
    this.binEl?.classList.add('show');
    return { src, block, fromIndex, ghost, off: { x: start.x - origin.x, y: start.y - origin.y }, overProgram: false };
  }

  overProgram(p) {
    const r = rectInStage(this.programEl);
    return p.x > r.x - 30 && p.x < r.x + r.w + 30 && p.y > r.y - 20 && p.y < r.y + r.h + 20;
  }
  overBin(p) {
    if (!this.binEl) return false;
    const r = rectInStage(this.binEl);
    return p.x > r.x - 20 && p.x < r.x + r.w + 20 && p.y > r.y - 20 && p.y < r.y + r.h + 20;
  }

  dragMove(drag, p) {
    const { ghost } = drag;
    const x = p.x - drag.off.x, y = p.y - drag.off.y;
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    const over = this.overProgram(p) && !this.overBin(p);
    this.binEl?.classList.toggle('hot', this.overBin(p));
    ghost.classList.toggle('will-delete', drag.src.from === 'program' && !over);
    let gi = -1;
    if (over) {
      const valid = this.validIndices(drag.block.type);
      // raw index from the ghost's centre vs the blocks' middles
      const cy = y + 30;
      let raw = 0;
      this.model.forEach(b => {
        const el = this.els.get(b.id);
        if (!el) return;
        const r = rectInStage(el);
        if (r.y + r.h / 2 < cy) raw++;
      });
      gi = valid.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best), valid[0]);
    }
    if (gi !== this.gapIndex) {
      this.gapIndex = gi;
      this.render(true);
      if (gi >= 0) sfx.play('press');
    }
    // autoscroll
    const r = rectInStage(this.programEl);
    if (over && p.y > r.y + r.h - 50) this.programEl.scrollTop += 8;
    if (over && p.y < r.y + 50) this.programEl.scrollTop -= 8;
  }

  dragEnd(drag, p) {
    const { ghost, block, src } = drag;
    document.body.classList.remove('is-dragging');
    this.binEl?.classList.remove('show', 'hot');
    const over = this.overProgram(p) && !this.overBin(p) && this.gapIndex >= 0;
    const isNew = src.from === 'palette';
    if (over && isNew && this.model.length >= this.max && !(TERMINAL.has(block.type) && this.model.some(b => TERMINAL.has(b.type)))) {
      this.gapIndex = -1; this.render(); this.tooMany();
      this.flyBack(ghost, src.el);
      return;
    }
    if (over) {
      const idx = this.gapIndex;
      const target = rectInStage(this.gapEl);
      ghost.animate([{ left: ghost.style.left, top: ghost.style.top }, { left: target.x + 'px', top: target.y + 'px' }], { duration: 120, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => {
          ghost.remove();
          this.gapIndex = -1;
          this.insertAt(block, idx);
          this.render(false);
          this.landed(block.id);
          this.onChange(this.program());
        });
    } else if (src.from === 'program') {
      // dropped outside: delete with a poof
      this.gapIndex = -1;
      this.render();
      sfx.play('poof');
      ghost.classList.add('poof');
      setTimeout(() => ghost.remove(), 350);
      this.poofAt(p);
      this.binEl?.animate([{ transform: 'rotate(-12deg) scale(1.15)' }, { transform: 'rotate(10deg)' }, { transform: 'none' }], { duration: 400 });
      this.onChange(this.program());
    } else {
      this.gapIndex = -1;
      this.render();
      this.flyBack(ghost, src.el);
    }
  }
  flyBack(ghost, el) {
    sfx.play('back');
    const r = rectInStage(el);
    ghost.animate([{ left: ghost.style.left, top: ghost.style.top, opacity: 1 }, { left: r.x + 'px', top: r.y + 'px', opacity: 0.2 }], { duration: 250, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => ghost.remove());
  }
  poofAt(p) {
    const layer = document.getElementById('drag-layer');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dot = h('div.puff', { style: { left: p.x + 'px', top: p.y + 'px' } });
      layer.append(dot);
      dot.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9 }, { transform: `translate(${Math.cos(a) * 50 - 12}px, ${Math.sin(a) * 50 - 12}px) scale(.3)`, opacity: 0 }], { duration: 420, easing: 'ease-out' }).finished.then(() => dot.remove());
    }
  }

  clear() {
    if (this.locked || !this.model.length) return;
    sfx.play('poof');
    const els = [...this.els.values()];
    els.forEach((el, i) => el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-60px) rotate(-8deg)', opacity: 0 }], { duration: 250, delay: i * 30, fill: 'forwards' }));
    setTimeout(() => { this.model = []; this.render(false); this.onChange(this.program()); }, 250 + els.length * 30);
  }

  // ---- run feedback ----
  setLocked(v) { this.locked = v; this.programEl.classList.toggle('running', v); this.paletteEl.classList.toggle('locked', v); }
  clearMarks() { for (const el of this.els.values()) el.classList.remove('active', 'done', 'fail'); this.startEl.classList.remove('active'); }
  mark(i, state) {
    const b = this.model[i];
    const el = b && this.els.get(b.id);
    if (!el) return;
    if (state === 'active') { for (const e of this.els.values()) e.classList.remove('active'); this.scrollTo(el); }
    el.classList.remove('active', 'done', 'fail');
    el.classList.add(state);
    if (state === 'fail') el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px) rotate(-2deg)' }, { transform: 'translateX(10px) rotate(2deg)' }, { transform: 'translateX(-6px)' }, { transform: 'none' }], { duration: 450 });
  }
  pulseStart() {
    this.startEl.classList.add('active');
    this.startEl.animate([{ transform: 'scale(1.1)' }, { transform: 'none' }], { duration: 300 });
  }
}
