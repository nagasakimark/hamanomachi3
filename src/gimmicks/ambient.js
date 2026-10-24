// Screen effects that give a town its mood. Right now: underwater bubbles (Bikini Bottom).
// A map turns it on with  "ambient": "bubbles"  (the map editor has a dropdown). Undersea
// "treasure" towns and maps with "bikini" in their id get it automatically; "ambient": "" forces it off.
//
// 1) Screen bubbles: a see-through canvas on top of the game. Bubbles of many sizes rise from the
//    bottom, wobble side to side, grow a little as they rise, and some pop on the way up.
// 2) Character bubbles: the hero, the asker and the pet let out little bubbles now and then
//    (more when they walk), like the treasure chests do.
import { sfx } from '../audio/sfx.js';

export const ambientOf = map => {
  if (!map) return '';
  if (map.ambient !== undefined) return map.ambient || '';
  return map.gimmick === 'treasure' || /bikini/i.test(map.id || '') ? 'bubbles' : '';
};

export function startAmbient(mv, map) {
  return ambientOf(map) === 'bubbles' ? startBubbles(mv) : null;
}

const rnd = (a, b) => a + Math.random() * (b - a);

function startBubbles(mv) {
  const scene = mv.scene, host = mv.game.canvas.parentElement;
  if (!host) return null;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const cv = document.createElement('canvas');
  cv.className = 'amb-bubbles';
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:5';
  host.append(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const fit = () => {
    const r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  };
  fit();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(host);

  const bubbles = [], pops = [];
  let spawnIn = 0.3, last = performance.now(), raf = 0, dead = false, popSound = 0;
  const MAX = 14;

  // a size → speed rule like the real thing: big bubbles rise faster
  function spawn(x, r) {
    r = r ?? (Math.random() < 0.6 ? rnd(4, 9) : Math.random() < 0.75 ? rnd(9, 18) : rnd(18, 34));
    const h = H / 600; // sizes are chosen for a 600px-tall screen
    bubbles.push({
      x: x ?? rnd(0.03, 0.97) * W, y: H + r * h + 4, r: r * h,
      vy: (28 + r * 3.2) * h * rnd(0.85, 1.15),         // px per second
      ph: rnd(0, 6.28), wf: rnd(1.2, 2.6) / Math.max(0.6, r / 12), wa: rnd(6, 16) * h * (1 - Math.min(0.6, r / 60)),
      grow: rnd(0.05, 0.12),                             // gets bigger as the water pressure drops
      // chance to pop: small chance each second once it is above the lower third; bigger ones pop easier
      popRate: (0.05 + r / 90) * (Math.random() < 0.45 ? 1 : 0.15),
      born: 0, a: rnd(0.65, 0.95),
    });
  }
  function popAt(b) {
    pops.push({ x: b.x, y: b.y, r: b.r, t: 0, drops: Array.from({ length: 5 + Math.floor(b.r / 6) }, () => ({ a: rnd(0, 6.28), v: rnd(30, 70) * (H / 600) })) });
    if (b.r > 10 * (H / 600) && performance.now() - popSound > 400) { popSound = performance.now(); sfx.play('bubble'); }
  }

  function draw(b) {
    const { x, y, r } = b;
    ctx.globalAlpha = b.a * Math.min(1, b.born / 0.4);
    // soft fill, brighter toward the lower right like a real soap-film bubble
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.7, 'rgba(120,210,255,0.22)'); g.addColorStop(1, 'rgba(70,170,235,0.5)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    // blue outer edge so it shows on pale maps, white inner rim so it shows on dark ones
    ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.strokeStyle = 'rgba(40,130,210,0.75)'; ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, 6.2832); ctx.stroke();
    // rainbow-ish edge tint
    ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = 'rgba(255,150,225,0.6)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0.3, 1.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,255,220,0.6)'; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 3.4, 4.6); ctx.stroke();
    // shiny spot
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.2, r * 0.12, -0.7, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.hidden) return;
    spawnIn -= dt;
    if (spawnIn <= 0 && bubbles.length < MAX) {
      spawnIn = rnd(1.0, 2.8);
      if (Math.random() < 0.1) { // a little string of bubbles from one spot
        const x = rnd(0.05, 0.95) * W, n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) setTimeout(() => !dead && bubbles.length < MAX && spawn(x + rnd(-6, 6), rnd(3, 8)), i * 160);
      } else spawn();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.born += dt; b.y -= b.vy * dt; b.r *= 1 + b.grow * dt; b.ph += b.wf * dt * 2;
      b.x += Math.cos(b.ph) * b.wa * dt * 1.6;
      const high = 1 - b.y / H; // 0 at the bottom, 1 at the top
      if ((high > 0.25 && Math.random() < b.popRate * dt) || b.y < -b.r) {
        if (b.y > -b.r) popAt(b);
        bubbles.splice(i, 1); continue;
      }
      draw(b);
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt;
      const k = p.t / 0.28;
      if (k >= 1) { pops.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = 'rgba(40,130,210,0.85)'; ctx.lineWidth = Math.max(1, p.r * 0.1 * (1 - k));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + 0.5 * k), 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(70,170,235,0.9)';
      for (const d of p.drops) { ctx.beginPath(); ctx.arc(p.x + Math.cos(d.a) * (p.r + d.v * p.t), p.y + Math.sin(d.a) * (p.r + d.v * p.t), Math.max(0.8, p.r * 0.1 * (1 - k)), 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < 4; i++) { spawn(); const b = bubbles[bubbles.length - 1]; b.y = rnd(0.2, 1) * H; b.born = 1; } // not empty at the start
  raf = requestAnimationFrame(frame);

  // ---- bubbles from the characters (they live on the map, so they travel with it) ----
  const seen = new Map();
  const timer = scene.time.addEvent({
    delay: 900, loop: true, callback: () => {
      for (const s of [scene.player, scene.asker, scene.pet]) {
        if (!s || !s.visible || s.x < -500) continue;
        const prev = seen.get(s), moving = !!prev && Math.hypot(prev.x - s.x, prev.y - s.y) > 4;
        seen.set(s, { x: s.x, y: s.y });
        if (Math.random() < (moving ? 0.3 : 0.08)) {
          const n = Math.random() < 0.12 ? 2 : 1;
          for (let i = 0; i < n; i++) setTimeout(() => !dead && scene.sys?.isActive() && worldBubble(scene, s.x + rnd(-8, 8), s.y - (s === scene.pet ? 22 : 56) * (s.scale || 1)), i * 140);
        }
      }
    },
  });

  return {
    destroy() { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); cv.remove(); timer.remove(); },
  };
}

// A small bubble on the map: rises, sways, and sometimes pops before it fades.
export function worldBubble(scene, x, y, r = rnd(3, 7)) {
  const g = scene.add.graphics().setDepth(11);
  g.fillStyle(0x9fdcff, 0.3).fillCircle(0, 0, r).lineStyle(2, 0x2882d2, 0.8).strokeCircle(0, 0, r).lineStyle(1, 0xffffff, 0.95).strokeCircle(0, 0, r * 0.82).fillStyle(0xffffff, 0.95).fillCircle(-r * 0.35, -r * 0.35, Math.max(1, r * 0.25));
  g.setPosition(x, y);
  const rise = rnd(55, 110), dur = rnd(1300, 2200), sway = rnd(6, 14), ph = rnd(0, 6.28), pops = Math.random() < 0.4;
  const st = { t: 0 };
  scene.tweens.add({
    targets: st, t: 1, duration: pops ? dur * rnd(0.5, 0.85) : dur, ease: 'Sine.out',
    onUpdate: () => { g.y = y - rise * st.t; g.x = x + Math.sin(ph + st.t * 7) * sway * st.t; g.setScale(1 + 0.25 * st.t); if (!pops) g.setAlpha(1 - Math.max(0, (st.t - 0.6) / 0.4)); },
    onComplete: () => {
      if (!pops) return g.destroy();
      scene.tweens.add({ targets: g, scale: 1.9, alpha: 0, duration: 140, ease: 'Quad.out', onComplete: () => g.destroy() });
    },
  });
  return g;
}
