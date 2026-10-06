// All sound effects are synthesised with WebAudio, so there are no sound
// files to license or load. Music is a gentle generated loop (off by default).
let ctx = null, master = null, musicGain = null;
const settings = { sfx: true, music: false, voice: true };

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005, dest } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, { vol = 0.2, at = 0, freq = 1200, q = 1, sweep = 0, type = 'bandpass' } = {}) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const SOUNDS = {
  press: () => tone(520, 0.07, { type: 'triangle', vol: 0.18, slide: 180 }),
  pick: () => { tone(700, 0.06, { type: 'triangle', vol: 0.2, slide: 300 }); },
  snap: () => { noise(0.05, { vol: 0.35, freq: 2500, q: 2 }); tone(190, 0.09, { type: 'square', vol: 0.12 }); tone(380, 0.06, { type: 'triangle', vol: 0.15, at: 0.02 }); },
  poof: () => { noise(0.25, { vol: 0.3, freq: 3000, sweep: -2600 }); tone(300, 0.2, { vol: 0.12, slide: -200 }); },
  back: () => tone(420, 0.12, { type: 'triangle', vol: 0.15, slide: -200 }),
  step: () => noise(0.05, { vol: 0.09, freq: 900 + Math.random() * 300, q: 3 }),
  turn: () => { noise(0.22, { vol: 0.12, freq: 600, sweep: 1400, q: 2 }); },
  bump: () => { tone(110, 0.22, { type: 'sine', vol: 0.45, slide: -50 }); noise(0.1, { vol: 0.2, freq: 300 }); },
  fail: () => { tone(392, 0.18, { type: 'triangle', vol: 0.22 }); tone(311, 0.32, { type: 'triangle', vol: 0.22, at: 0.18 }); },
  run: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.16, at: i * 0.06 })); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? 0.6 : 0.16, { type: 'triangle', vol: 0.24, at: i * 0.1 })); [262, 392].forEach(f => tone(f, 0.8, { type: 'sine', vol: 0.12, at: 0.4 })); },
  star1: () => { tone(880, 0.35, { type: 'sine', vol: 0.25 }); tone(1320, 0.3, { type: 'sine', vol: 0.1, at: 0.03 }); },
  star2: () => { tone(988, 0.35, { type: 'sine', vol: 0.25 }); tone(1480, 0.3, { type: 'sine', vol: 0.1, at: 0.03 }); },
  star3: () => { tone(1175, 0.5, { type: 'sine', vol: 0.28 }); tone(1760, 0.45, { type: 'sine', vol: 0.12, at: 0.03 }); },
  coin: () => { tone(988, 0.06, { type: 'square', vol: 0.1 }); tone(1319, 0.2, { type: 'square', vol: 0.1, at: 0.06 }); },
  badge: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.2, { type: 'sine', vol: 0.18, at: i * 0.07 })); },
  buy: () => { [659, 880, 1319].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.2, at: i * 0.08 })); },
  dizzy: () => { for (let i = 0; i < 6; i++) tone(600 + (i % 2) * 200, 0.12, { type: 'triangle', vol: 0.15, at: i * 0.1, slide: -100 }); },
  whoosh: () => noise(0.3, { vol: 0.15, freq: 400, sweep: 2500, q: 1 }),
  error: () => { tone(200, 0.12, { type: 'square', vol: 0.1 }); tone(160, 0.15, { type: 'square', vol: 0.1, at: 0.1 }); },
};

// ---- Music: a soft pentatonic loop ----
let musicTimer = null;
function startMusic() {
  const c = ac(); if (!c || musicTimer) return;
  musicGain.gain.setTargetAtTime(0.35, c.currentTime, 0.5);
  const scale = [392, 440, 523, 587, 659, 784, 880];
  const bass = [131, 147, 110, 98];
  let beat = 0;
  const tick = () => {
    const bar = Math.floor(beat / 8) % 4;
    if (beat % 8 === 0) tone(bass[bar], 1.6, { type: 'sine', vol: 0.18, dest: musicGain });
    if (beat % 2 === 0 || Math.random() < 0.3) {
      const f = scale[(beat * 3 + bar * 2 + (Math.random() < 0.3 ? 1 : 0)) % scale.length];
      tone(f, 0.35, { type: 'triangle', vol: 0.07, dest: musicGain });
    }
    beat++;
  };
  musicTimer = setInterval(tick, 300);
}
function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
}

// ---- Voice clips (the recorded directions questions) ----
let voiceEl = null;
function playVoice(url) {
  if (!url) return null; // the voice can't be turned off: it's the lesson
  if (voiceEl) { voiceEl.pause(); }
  voiceEl = new Audio(url);
  voiceEl.play().catch(() => {});
  return voiceEl;
}

export const sfx = {
  play(name) { if (settings.sfx && SOUNDS[name]) { try { SOUNDS[name](); } catch (e) { /* ignore */ } } },
  voice: playVoice,
  stopVoice() { if (voiceEl) voiceEl.pause(); },
  apply(s) {
    Object.assign(settings, s);
    if (settings.music) startMusic(); else stopMusic();
  },
  unlock() { ac(); if (settings.music) startMusic(); },
};
