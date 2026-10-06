import { h, btn, toast, wait, getStageScale, getStageW, rectInStage } from '../ui/dom.js';
import { app } from '../app.js';
import { save } from '../progress/save.js';
import { mapById } from '../data/maps.js';
import { TIERS } from '../engine/missions.js';
import { tierOpen } from './missions.js';
import { simulate } from '../engine/engine.js';
import { solve } from '../engine/solver.js';
import { BlockEditor } from '../editor/blockEditor.js';
import { MapView } from '../play/mapView.js';
import { composeLook, previewCanvas, portraitCanvas, randomLook } from '../avatar/compositor.js';
import { coinPill, iconBtn, ICONS, showQR, showSettings, showBadges } from '../ui/hud.js';
import { checkBadges } from '../progress/badges.js';
import { sfx } from '../audio/sfx.js';

const TOP_H = 68, PANEL_W = 460;

function hashSeed(str) { let x = 0; for (const c of str) x = (x * 31 + c.charCodeAt(0)) % 100000; return x / 100000; }

export async function playScreen({ mapId, missionId, free }) {
  const map = mapById(mapId);
  const g = map.graph;
  const s = save.get();
  let mission, tier;
  const pickFree = () => {
    const starts = g.starts(), dests = g.destinations();
    for (let tries = 0; tries < 50; tries++) {
      const st = starts[Math.floor(Math.random() * starts.length)];
      const de = dests[Math.floor(Math.random() * dests.length)];
      if (g.neighbors(st.id).includes(de.id)) continue;
      const best = solve(g, st.id, de.id);
      if (best) return { id: 'free', tier: 0, start: st.id, destination: de.id, best: best.length };
    }
    return null;
  };
  if (free) mission = pickFree();
  else mission = map.missions.find(m => m.id === missionId);
  // Free play is the hardest mode: voice only, no hints, tightest block budget.
  tier = free ? { id: 0, ja: 'フリープレイ', hint: 'none', exact: true } : TIERS.find(t => t.id === mission.tier);
  if (tier.id === 4) tier = { ...tier, exact: true };
  const tierMissions = free ? [] : map.missions.filter(m => m.tier === mission.tier);
  let attempts = 0;
  let running = false;

  // ---- layout: the map gets as much room as possible ----
  const W = getStageW();
  const avail = W - PANEL_W, mapH = 900 - TOP_H;
  const fullMapW = Math.round(mapH * (map.width / map.height));
  const sideW = avail - fullMapW >= 220 ? Math.min(340, avail - fullMapW) : 0;
  const mapW = avail - sideW;

  // ---- characters ----
  const heroSheet = await composeLook(s.look);
  let askerSheet = await composeLook(randomLook(hashSeed(map.id + mission.id + mission.destination), { female: true }));

  // ---- the person asking the way (top bar, or a side column on wide screens) ----
  const askerFace = portraitCanvas(56);
  askerFace.setSheet(askerSheet);
  const askerBig = previewCanvas(200, { dir: 2 });
  askerBig.setSheet(askerSheet);
  const heroBig = previewCanvas(170, { dir: 2 });
  heroBig.setSheet(heroSheet);
  const hintText = h('div.hint-text');
  const speakBtn = btn('speak', h('span', { html: ICONS.speaker }), () => playClip(), { title: 'もういちど聞く' });
  const coins = coinPill();
  const targetEl = h('div.target');
  const counterEl = h('div.counter');
  const tierChip = h('div.tier-chip.t' + tier.id);
  // Speech bubble that pops up over the asker's picture while the clip plays.
  const talkBubble = h('div.talk-bubble', {}, h('span', {}, '💬'));
  const askerCard = h('div.asker-card' + (sideW ? '.big' : ''), {},
    sideW ? h('div.asker-stage', {}, h('div.w-spot'), askerBig, talkBubble) : h('div.asker-face-wrap', {}, h('div.asker-face', {}, askerFace), talkBubble),
    h('div.asker-talk', {}, speakBtn, hintText));
  const top = h('div.topbar.play-top', {},
    iconBtn(ICONS.back, 'もどる', () => leave(), 'back'),
    sideW ? null : askerCard,
    tierChip,
    h('div.spacer'),
    h('div.budget', {}, counterEl, targetEl),
    coins,
    iconBtn(ICONS.qr, 'QRコード', showQR),
    iconBtn(ICONS.gear, 'せってい', () => showSettings(() => { mv.speed = s.settings.speed; })),
  );

  // ---- block panel ----
  const palette = h('div.palette');
  const program = h('div.program');
  const bin = h('div.bin', { html: ICONS.bin });
  const runBtn = btn('run', [h('span.run-icon', { html: ICONS.play }), h('span', {}, 'すすむ！')], () => run());
  const speedLabel = () => (s.settings.speed > 1 ? '🐇 はやい' : '🐢 ふつう');
  const speedBtn = btn('small speed', speedLabel(), () => {
    s.settings.speed = s.settings.speed > 1 ? 1 : 2; save.write();
    speedBtn.textContent = speedLabel();
    mv.speed = s.settings.speed;
  });
  const clearBtn = btn('small clear', [h('span.dock-icon', { html: ICONS.broom }), 'けす'], () => editor.clear());
  const panel = h('div.block-panel', { style: { width: PANEL_W + 'px', top: TOP_H + 'px' } },
    h('div.panel-label', {}, 'ブロック'),
    palette,
    h('div.panel-label', {}, 'みちあんない'),
    h('div.program-wrap', {}, program, bin),
    h('div.runbar', {}, clearBtn, speedBtn, runBtn),
  );

  // ---- map ----
  const mapBox = h('div.map-box');
  const mapPanel = h('div.map-panel', { style: { left: PANEL_W + 'px', top: TOP_H + 'px', width: mapW + 'px' } }, mapBox);
  const side = sideW ? h('div.side-panel', { style: { width: sideW + 'px', top: TOP_H + 'px' } },
    h('div.side-label', {}, 'みちをきいている人'),
    askerCard,
    h('div.side-label', {}, 'あなた'),
    h('div.hero-card', {}, h('div.asker-stage', {}, h('div.w-spot'), heroBig)),
  ) : null;
  const el = h('div.play-screen', {}, top, panel, mapPanel, side);

  const editor = new BlockEditor({
    palette, program, bin, maxBlocks: 12,
    onChange: prog => updateCounter(prog),
  });

  const limitFor = () => mission.best + (tier.exact ? 0 : 1);
  function updateCounter(prog = editor.program()) {
    const n = prog.length;
    counterEl.replaceChildren(h('span.cnum', {}, String(n)), h('span', {}, ' ブロック'));
    counterEl.animate([{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 200 });
    const limit = limitFor();
    targetEl.replaceChildren(h('span.t-stars', {}, '★★★'), ` ${limit}こ いか`);
    targetEl.classList.toggle('over', n > limit);
  }

  function setMissionUI() {
    const dest = g.point(mission.destination);
    tierChip.textContent = free ? 'フリープレイ' : `${tier.ja} ${tierMissions.indexOf(mission) + 1}`;
    hintText.replaceChildren(tier.hint === 'none' ? h('span.listen', {}, 'よく聞いてね！') : h('span.place', {}, '📍 ', dest.name));
    speakBtn.style.display = map.audioUrl(dest.audio) ? '' : 'none';
    updateCounter();
  }

  function playClip() {
    const dest = g.point(mission.destination);
    const url = map.audioUrl(dest.audio);
    if (!url) return;
    speakBtn.classList.add('talking');
    talkBubble.classList.remove('show'); void talkBubble.offsetWidth; talkBubble.classList.add('show');
    const a = sfx.voice(url);
    const stop = () => { speakBtn.classList.remove('talking'); talkBubble.classList.remove('show'); };
    if (a) { a.onended = stop; a.onerror = stop; } else stop();
    if (mv?.scene?.ready) mv.bubble(mv.scene.asker, '💬', 1500, '#2a9d8f');
  }

  // ---- Phaser ----
  const R = Math.max(1, Math.min(2, getStageScale() * (window.devicePixelRatio || 1)));
  let mv = null;

  async function startMission(intro = true) {
    attempts = 0;
    setMissionUI();
    const st = g.initialState(mission.start);
    mv.reset(mission.start, mission.destination, { marker: tier.hint === 'marker', angle: st.angle });
    editor.setLocked(false);
    editor.clearMarks();
    if (intro) {
      const sp = g.point(mission.start);
      mv.focusOn(sp.x, sp.y, 1.9, 0);
      await wait(350);
      playClip();
      await wait(1100);
      mv.overview(900);
    }
  }

  async function run() {
    if (running) return;
    const prog = editor.program();
    if (!prog.length) {
      sfx.play('error');
      toast('まずブロックをおいてね！', 'warn');
      palette.animate([{ transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 250, iterations: 2 });
      return;
    }
    running = true;
    attempts++;
    sfx.play('run');
    editor.setLocked(true);
    editor.clearMarks();
    runBtn.classList.add('going');
    const st = g.initialState(mission.start);
    mv.reset(mission.start, mission.destination, { marker: tier.hint === 'marker', angle: st.angle });
    await wait(250);
    editor.pulseStart();
    mv.followPlayer();
    await wait(600);
    const result = simulate(g, prog, mission.start, mission.destination);
    for (const step of result.steps) {
      if (!alive) return;
      editor.mark(step.block, 'active');
      sfx.play('pick');
      await mv.delay(220);
      for (const sub of step.sub) {
        if (sub.kind === 'move') await mv.walk(sub.path);
        else if (sub.kind === 'turn') await mv.turn(sub.from, sub.by);
      }
      if (!step.ok) {
        editor.mark(step.block, 'fail');
        await mv.bump();
        break;
      }
      editor.mark(step.block, 'done');
    }
    if (!alive) return;
    runBtn.classList.remove('going');
    if (result.won) return win(prog);
    if (result.dizzy) {
      await mv.dizzy();
      s.stats.dizzy++; save.write();
      const b = checkBadges();
      if (b.length) { coins.bump(s.coins - b.length * 20, s.coins); await showBadges(b); }
    } else if (result.failIndex < 0) {
      // walked everything but not at the place
      await mv.bump();
    }
    sfx.play('fail');
    showTryAgain(result.dizzy ? '目がまわった〜！もういちど。' : (result.failIndex >= 0 ? 'あれ？そのブロックはできなかったよ。' : 'うーん、ここじゃないみたい。'));
  }

  function showTryAgain(text) {
    const card = h('div.tryagain', {},
      h('div.ta-emoji', {}, '🤔'),
      h('div.ta-text', {}, text),
      btn('primary', 'もういちど', () => {
        card.classList.add('out');
        setTimeout(() => card.remove(), 250);
        const st = g.initialState(mission.start);
        mv.reset(mission.start, mission.destination, { marker: tier.hint === 'marker', angle: st.angle });
        editor.setLocked(false);
        editor.clearMarks();
        running = false;
      }),
    );
    mapPanel.append(card);
  }

  async function win(prog) {
    sfx.play('win');
    await mv.celebrate(mission.destination);
    const limit = limitFor();
    const checks = [true, attempts <= 2, attempts <= 2 && prog.length <= limit];
    const stars = checks.filter(Boolean).length;
    const coinsBefore = s.coins;
    let earned;
    save.visit(map.id, mission.destination);
    s.stats.wins++;
    if (tier.id >= 3) s.stats.listenWins++;
    if (prog.some(b => b.type === 'littlebit')) s.stats.littlebitWins++;
    s.stats.bestComeback = Math.max(s.stats.bestComeback || 0, attempts - 1);
    if (free) { s.stats.freeWins++; earned = 5; }
    else if (map.isTest) earned = 0;
    else {
      const newStars = save.setStars(map.id, mission.id, stars);
      earned = newStars ? newStars * 10 : 3;
    }
    save.addCoins(earned);
    save.write();
    await showResults({ stars: free ? 0 : stars, checks, limit, earned, coinsBefore });
    const badges = map.isTest ? [] : checkBadges();
    if (badges.length) {
      coins.bump(s.coins - badges.length * 20, s.coins);
      await showBadges(badges);
    }
  }

  function showResults({ stars, checks, limit, earned, coinsBefore }) {
    return new Promise(res => {
      const dest = g.point(mission.destination);
      const starEls = [1, 2, 3].map(() => h('div.rstar', {}, '★'));
      const lines = free ? [] : [
        ['とうちゃく！', checks[0]],
        ['1〜2回目でクリア', checks[1]],
        [`ブロック ${limit}こ いか`, checks[2]],
      ].map(([t, ok]) => h('div.rline' + (ok ? '.ok' : ''), {}, h('span.tick', {}, ok ? '✔' : '✖'), t));
      const coinRow = h('div.rcoins', {}, '+', h('span.rc-num', {}, String(earned)), h('span.coin-icon'));
      const idx = tierMissions.indexOf(mission);
      let nextMission = free ? null : tierMissions[idx + 1] || map.missions[map.missions.indexOf(mission) + 1];
      if (nextMission && !tierOpen(map, nextMission.tier)) nextMission = null;
      const card = h('div.results', {},
        h('div.r-title', {}, ['やったね！', 'すごい！', 'よくできました！', 'かんぺき！'][Math.floor(Math.random() * 4)]),
        h('div.r-place', {}, h('b', {}, dest.name), ' に着いたよ！'),
        free ? null : h('div.rstars', {}, ...starEls),
        h('div.rlines', {}, ...lines),
        coinRow,
        h('div.r-buttons', {},
          btn('secondary', '↺ もういちど', () => { close(); startMission(false); }),
          free
            ? btn('primary', 'つぎへ ▶', () => { close(); mission = pickFree(); newAsker().then(() => startMission(true)); })
            : nextMission
              ? btn('primary', 'つぎへ ▶', () => { close(); app.go('play', { mapId: map.id, missionId: nextMission.id }); })
              : btn('primary', 'ミッションへ', () => { close(); app.go('missions', { mapId: map.id }); }),
        ),
      );
      const back = h('div.results-back', {}, card);
      mapPanel.append(back);
      const close = () => { back.classList.add('out'); setTimeout(() => back.remove(), 250); running = false; editor.setLocked(false); editor.clearMarks(); };
      // animate stars one by one, then coins fly to the counter
      (async () => {
        await wait(450);
        for (let i = 0; i < stars; i++) {
          starEls[i].classList.add('on');
          sfx.play('star' + (i + 1));
          await wait(380);
        }
        await wait(200);
        flyCoins(coinRow, Math.min(8, Math.max(3, earned / 3)));
        await wait(700);
        coins.bump(coinsBefore, save.get().coins);
        sfx.play('coin');
        await wait(500);
        res();
      })();
    });
  }

  function flyCoins(fromEl, n) {
    const layer = document.getElementById('drag-layer');
    const a = rectInStage(fromEl), b = rectInStage(coins);
    for (let i = 0; i < n; i++) {
      const c = h('div.coin-icon.flying', { style: { left: a.x + a.w / 2 + 'px', top: a.y + 'px' } });
      layer.append(c);
      const dx = b.x + 20 - (a.x + a.w / 2), dy = b.y + 10 - a.y;
      c.animate([
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${dx * 0.4 + (Math.random() - 0.5) * 120}px, ${dy * 0.4 - 80}px) scale(1.3)`, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(.6)` },
      ], { duration: 650, delay: i * 60, easing: 'ease-in', fill: 'forwards' }).finished.then(() => { c.remove(); sfx.play('coin'); });
    }
  }

  async function newAsker() {
    askerSheet = await composeLook(randomLook(Math.random(), { female: true }));
    askerFace.setSheet(askerSheet);
    askerBig.setSheet(askerSheet);
    mv.setAsker(askerSheet);
  }

  let alive = true;
  function leave() { sfx.stopVoice(); app.go('missions', { mapId: map.id }); }

  const onKey = e => {
    if (e.key === 'Enter' && !e.target.closest('textarea,input')) { e.preventDefault(); run(); }
  };

  return {
    el,
    async mounted() {
      mv = new MapView(mapBox, map, { width: mapW, height: mapH, renderScale: R, hero: heroSheet, asker: askerSheet });
      mv.speed = s.settings.speed || 1;
      await mv.ready();
      window.addEventListener('keydown', onKey);
      // First time: a starter hint in the program area.
      await startMission(true);
    },
    destroy() {
      alive = false;
      window.removeEventListener('keydown', onKey);
      sfx.stopVoice();
      mv?.destroy();
    },
  };
}
