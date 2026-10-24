// Wild monsters (the monster town): tall grass grows on some roads. Walking through it may
// stir up a monster ("!"); if the mission is then won for the first time, the monster jumps out. It plays like a classic handheld monster RPG battle: answer three
// place names (English -> Japanese) to wear it down, then a capsule catches it.
// The places come from every town the student has already visited.
// All monster art is original pixel art (scripts/pixel-art/mon.py).
import { h, btn, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { MAPS } from '../data/maps.js';
import { jaName, PLACE_JA } from '../data/placeNames.js';
import { sfx } from '../audio/sfx.js';
import { composeLook, FRAME } from '../avatar/compositor.js';
import { loadTex } from './pickups.js';
import { simulate } from '../engine/engine.js';
import { solve } from '../engine/solver.js';

const px = import.meta.glob('../assets/gimmick/px/*.png', { eager: true, query: '?url', import: 'default' });
export const pxUrl = n => px[`../assets/gimmick/px/${n}.png`];

export const MONSTERS = [
  { id: 'mofun', w: 20, n: 1, name: 'モフン', kind: 'くも', text: 'くものように ふわふわ。はれの ひは そらを ただよう。' },
  { id: 'umikii', w: 15, n: 2, name: 'ウミキー', kind: 'うみ', text: 'あたまの ほしが ひかると なかまが あつまってくる。' },
  { id: 'bobo', w: 20, n: 3, name: 'ボボ', kind: 'ほのお', text: 'ちょうちんの おばけ。よるの まつりが だいすき。' },
  { id: 'leafy', w: 20, n: 4, name: 'リーフィ', kind: 'くさ', text: 'あたまの はっぱで おひさまの ひかりを あつめる。' },
  { id: 'pinkuru', w: 15, n: 5, name: 'ピンクル', kind: 'ようせい', text: 'ちいさな はねで ぴょんぴょん とぶ。おもちが すき。' },
  { id: 'yurari', w: 10, n: 6, name: 'ユラリ', kind: 'ゴースト', text: 'ゆらゆら ゆれる。ちいさな おうかんが じまん。' },
  { id: 'kachiri', w: 15, n: 7, name: 'カチリ', kind: 'でんき', text: 'せなかの トゲに でんきを ためる。さわると パチッ！' },
  { id: 'pochan', w: 20, n: 8, name: 'ポチャン', kind: 'みず', text: 'みずたまりから うまれた。あめの ひは げんき いっぱい。' },
];

export const intro = {
  theme: 'monsters',
  icon: h => h('img.gi-px', { src: pxUrl('mon1') }),
  title: 'やせいの モンスター',
  lines: [
    [h => h('img.gi-li', { src: pxUrl('grass0'), style: 'image-rendering:pixelated' }), 'みちに くさむらが あるよ。とおると モンスターが でてくるかも！'],
    ['!', '「！」が でたら チャンス。ミッションを クリアすると モンスターが とびだすよ。'],
    ['A', 'えいごの ばしょの なまえを にほんごで えらんで たたかおう！'],
    ['●', '3もん せいかいで カプセルを なげて つかまえよう。ずかんに のるよ！'],
  ],
};
export const introVersion = 'v2';

// Chance that one patch of tall grass stirs up a monster. Simulated pacing (most trips cross 0-2 patches,
// only first clears count, new monsters are twice as likely): about 15 battles / 60 cleared missions
// to fill the dex, while the first monster usually turns up within the first few clears.
export const GRASS_CHANCE = 0.25;
export const ENCOUNTER_CHANCE = GRASS_CHANCE;
const NEED = 3;

// Every place the student has already reached, on any town. One entry per Japanese name.
export function encounteredPlaces() {
  const s = save.get(), out = new Map();
  for (const m of MAPS) {
    for (const id of s.visited[m.id] || []) {
      const p = m.graph.point(id);
      const ja = p && jaName(p.name);
      if (ja && !out.has(ja)) out.set(ja, { en: p.name, ja, map: m, audio: p.audio });
    }
  }
  return [...out.values()];
}

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const anim = (el, kf, opt) => el.animate(kf, typeof opt === 'number' ? { duration: opt, fill: 'forwards' } : { fill: 'forwards', ...opt }).finished.catch(() => {});

// Returns true if a battle was shown. `cue` runs first (e.g. a "!" over the hero).
export async function maybeEncounter({ force = false, cue } = {}) {
  const pool = encounteredPlaces();
  if (pool.length < NEED) return false;
  if (!force && Math.random() > (window.__encounterChance ?? ENCOUNTER_CHANCE)) return false; // override is for testing
  if (cue) { await cue(); }
  await transition();
  await battle(pool);
  return true;
}

// The classic flash-and-shutter wipe into a battle.
function transition() {
  sfx.play('encounter');
  const ov = h('div.pk-wipe', {}, ...Array.from({ length: 8 }, (_, i) => h('div.pk-bar', { style: { top: `${i * 12.5}%`, animationDelay: `${0.45 + (i % 2) * 0.06 + i * 0.03}s` } })));
  document.getElementById('overlay').append(ov);
  return wait(1150).then(() => { setTimeout(() => ov.remove(), 600); ov.classList.add('out'); });
}

// The player's own character, seen from behind (avatar sheet row 0 = walking up).
async function backSprite() {
  const c = document.createElement('canvas'); c.width = FRAME; c.height = FRAME; c.className = 'pk-back';
  try { const sheet = await composeLook(save.get().look); c.getContext('2d').drawImage(sheet, 0, 0, FRAME, FRAME, 0, 0, FRAME, FRAME); } catch (e) { /* ignore */ }
  return c;
}

// Rarer monsters have a smaller weight; ones not caught yet are twice as likely, so the dex fills steadily.
export function pickMonster(dex = save.get().dex, rnd = Math.random) {
  const ws = MONSTERS.map(m => (m.w || 15) * (dex[m.id] ? 1 : 2));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < MONSTERS.length; i++) if ((r -= ws[i]) < 0) return MONSTERS[i];
  return MONSTERS[MONSTERS.length - 1];
}

export async function battle(pool) {
  const mon = pickMonster();
  const lv = 3 + Math.floor(Math.random() * 6);
  const known = save.get().dex[mon.id] > 0;
  const questions = shuffle(pool).slice(0, NEED);
  const allJa = [...new Set(Object.values(PLACE_JA))];
  const back = await backSprite();

  return new Promise(res => {
    let done = false, q = 0;
    // --- scene ---
    const enemy = h('img.pk-enemy', { src: pxUrl('mon' + mon.n), alt: '' });
    const hpFill = h('div.pk-hpfill');
    const eHud = h('div.pk-hud.pk-ehud', {},
      h('div.pk-hudrow', {}, h('span.pk-name', {}, mon.name), known ? h('img.pk-owned', { src: pxUrl('capsule'), title: 'つかまえたことがある' }) : null, h('span.pk-lv', {}, `Lv${lv}`)),
      h('div.pk-hprow', {}, h('span.pk-hplab', {}, 'HP'), h('div.pk-hpbar', {}, hpFill)));
    const caps = Array.from({ length: NEED }, () => h('img.pk-cap', { src: pxUrl('capsule') }));
    const pHud = h('div.pk-hud.pk-phud', {},
      h('div.pk-hudrow', {}, h('span.pk-name', {}, 'あなた')),
      h('div.pk-caprow', {}, h('span.pk-small', {}, 'せいかい'), ...caps),
      h('div.pk-hudtail'));
    const msg = h('div.pk-msg');
    const arrow = h('div.pk-arrow', {}, '▼');
    const msgBox = h('div.pk-box.pk-msgbox', {}, msg, arrow);
    const menu = h('div.pk-box.pk-menu');
    const scene = h('div.pk-scene', {}, h('img.pk-bg', { src: pxUrl('battle-bg') }), enemy, back, eHud, pHud, msgBox, menu);
    const m = modal(h('div.pk-wrap', {}, scene), { cls: 'pk-modal' });
    m.back.classList.add('pk-back-dim');
    m.back.onpointerdown = null;

    // --- text box with typewriter ---
    let skip = null;
    msgBox.addEventListener('pointerdown', () => skip?.());
    async function say(text, { hold = 700, click = false } = {}) {
      msg.textContent = ''; arrow.classList.remove('on');
      let fast = false; skip = () => { fast = true; };
      for (let i = 0; i < text.length; i++) {
        msg.textContent += text[i];
        if (i % 2 === 0 && text[i] !== ' ') sfx.play('blip');
        if (!fast) await wait(28);
      }
      if (click) {
        arrow.classList.add('on');
        await new Promise(r => { skip = r; scene.addEventListener('keydown', r, { once: true }); });
        arrow.classList.remove('on');
      } else {
        await new Promise(r => { skip = r; setTimeout(r, hold); });
      }
      skip = null;
    }
    const finish = caught => { if (done) return; done = true; m.close(); res(caught); };

    // --- intro: both sides slide in, enemy starts as a silhouette ---
    (async () => {
      anim(enemy, [{ transform: 'translateX(-190px)', filter: 'brightness(0.15)' }, { transform: 'none', filter: 'brightness(0.15)', offset: 0.75 }, { transform: 'none', filter: 'none' }], 1100);
      await anim(back, [{ transform: 'translateX(220px)' }, { transform: 'none' }], 900);
      enemy.classList.add('idle');
      anim(eHud, [{ transform: 'translateX(-120%)' }, { transform: 'none' }], 300);
      anim(pHud, [{ transform: 'translateX(120%)' }, { transform: 'none' }], 300);
      await say(`あっ！ やせいの ${mon.name}が とびだしてきた！`, { hold: 900 });
      ask();
    })();

    function setHp(frac) {
      hpFill.style.width = Math.max(0.04, frac) * 100 + '%';
      hpFill.className = 'pk-hpfill' + (frac <= 0.25 ? ' red' : frac <= 0.5 ? ' yellow' : '');
    }

    async function ask() {
      if (done) return;
      const cur = questions[q];
      const en = cur.en.replace(/ 7\/11| lawson/, '').replace(/\b\w/g, c => c.toUpperCase());
      scene.classList.add('asking');
      msg.innerHTML = '';
      msg.append(h('span.pk-en', {}, en), h('br'), 'は にほんごで なんて いう？');
      const url = cur.map.audioUrl?.(cur.audio);
      if (url) sfx.voice(url);
      const wrong = shuffle(allJa.filter(x => x !== cur.ja)).slice(0, 2);
      const opts = shuffle([cur.ja, ...wrong]);
      menu.replaceChildren(...opts.map(opt => h('button.pk-opt', { onclick: e => pick(e.currentTarget, opt) }, opt)),
        h('button.pk-opt.pk-runopt', { onclick: run }, 'にげる'));
      menu.classList.add('on');
      async function pick(b, opt) {
        if (b.disabled) return;
        if (opt !== cur.ja) {
          b.disabled = true; b.classList.add('no');
          sfx.play('error');
          menu.classList.add('busy');
          await enemyAttack();
          menu.classList.remove('busy');
          msg.innerHTML = ''; msg.append(h('span.pk-en', {}, en), h('br'), 'おしい！ もういちど えらんでね。');
          return;
        }
        menu.classList.remove('on'); scene.classList.remove('asking');
        caps[q].classList.add('on');
        sfx.play('star' + Math.min(3, q + 1));
        q++;
        if (q < NEED) {
          await say(`せいかい！ 「${en}」は「${cur.ja}」！`, { hold: 500 });
          await hitEnemy();
          setHp(1 - q / NEED);
          await say(q === 1 ? 'きいてる きいてる！' : 'あと すこし！', { hold: 600 });
          ask();
        } else {
          await say(`せいかい！ 「${en}」は「${cur.ja}」！`, { hold: 500 });
          await hitEnemy();
          setHp(0.06);
          await say('いまだ！ カプセルを なげた！', { hold: 200 });
          await catchIt();
        }
      }
    }

    async function hitEnemy() {
      sfx.play('hit');
      const star = h('div.pk-impact');
      scene.append(star);
      setTimeout(() => star.remove(), 450);
      for (let i = 0; i < 3; i++) { enemy.style.visibility = 'hidden'; await wait(70); enemy.style.visibility = ''; await wait(70); }
    }

    async function enemyAttack() {
      await say(`${mon.name}の たいあたり！`, { hold: 150 });
      enemy.classList.remove('idle');
      await anim(enemy, [{ transform: 'none' }, { transform: 'translate(-60px, 40px) scale(1.08)' }, { transform: 'none' }], { duration: 320, fill: 'none' });
      sfx.play('tackle');
      enemy.classList.add('idle');
      anim(scene, [{ transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'none' }], { duration: 260, fill: 'none' });
      for (let i = 0; i < 3; i++) { back.style.visibility = 'hidden'; await wait(60); back.style.visibility = ''; await wait(60); }
    }

    async function catchIt() {
      const cap = h('img.pk-throw', { src: pxUrl('capsule') });
      scene.append(cap);
      sfx.play('throw');
      enemy.classList.remove('idle');
      // throw in an arc from the player to the monster
      await anim(cap, [
        { left: '22%', top: '62%', transform: 'rotate(0deg) scale(1.2)' },
        { left: '48%', top: '0%', transform: 'rotate(540deg) scale(1)', offset: 0.5 },
        { left: '70.5%', top: '14%', transform: 'rotate(1080deg) scale(.9)' }], { duration: 750, easing: 'linear' });
      sfx.play('absorb');
      cap.classList.add('open');
      await anim(enemy, [{ filter: 'brightness(1)', transform: 'none', opacity: 1 }, { filter: 'brightness(4) saturate(0)', transform: 'scale(.9)', opacity: 1, offset: 0.3 }, { filter: 'brightness(4) saturate(0)', transform: 'translateY(-20px) scale(0.05)', opacity: 0 }], 600);
      cap.classList.remove('open');
      sfx.play('bonk');
      await anim(cap, [{ top: '14%' }, { top: '30%' }, { top: '24%' }, { top: '30%' }], { duration: 450, easing: 'ease-in' });
      for (let i = 0; i < 3; i++) {
        await wait(450);
        sfx.play('wobble');
        await anim(cap, [{ transform: 'rotate(0)' }, { transform: 'rotate(-28deg)' }, { transform: 'rotate(22deg)' }, { transform: 'rotate(0)' }], { duration: 420, fill: 'none' });
      }
      await wait(350);
      sfx.play('caught');
      cap.classList.add('locked');
      for (let i = 0; i < 6; i++) scene.append(h('div.pk-spark', { style: { '--a': `${i * 60}deg` } }));
      const dex = save.get().dex;
      const first = !dex[mon.id];
      dex[mon.id] = (dex[mon.id] || 0) + 1;
      save.addCoins(10);
      save.write();
      await say(`やったー！ ${mon.name}を つかまえた！`, { click: true });
      if (first) {
        await say(`${mon.name}の データが ずかんに とうろく された！`, { hold: 300 });
        const card = dexCard(mon, dex[mon.id]);
        scene.append(card);
        anim(card, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%)', opacity: 1 }], 300);
        await say('コイン +10 を ゲット！', { click: true });
      } else {
        await say('コイン +10 を ゲット！', { click: true });
      }
      finish(true);
    }

    async function run() {
      menu.classList.remove('on'); scene.classList.remove('asking');
      sfx.play('whoosh');
      await say('うまく にげきれた！', { hold: 800 });
      finish(false);
    }
  });
}

function dexCard(mon, count) {
  return h('div.pk-dexcard', {},
    h('div.pk-dc-img', {}, h('img', { src: pxUrl('mon' + mon.n) })),
    h('div.pk-dc-info', {},
      h('div.pk-dc-no', {}, 'No.' + String(mon.n).padStart(3, '0')),
      h('div.pk-dc-name', {}, mon.name),
      h('div.pk-dc-kind', {}, `${mon.kind} タイプ`),
      h('div.pk-dc-text', {}, mon.text)));
}

// The monster dex: a little handheld device.
export function showDex() {
  const dex = save.get().dex;
  const got = MONSTERS.filter(x => dex[x.id]).length;
  let sel = MONSTERS.find(x => dex[x.id]) || MONSTERS[0];
  const screen = h('div.dx-screen');
  const list = h('div.dx-list');
  const render = () => {
    const have = !!dex[sel.id];
    screen.replaceChildren(
      h('div.dx-lcd', {}, h('img.dx-mon' + (have ? '' : '.unknown'), { src: pxUrl('mon' + sel.n) })),
      h('div.dx-info', {},
        h('div.dx-no', {}, 'No.' + String(sel.n).padStart(3, '0')),
        h('div.dx-name', {}, have ? sel.name : '？？？？'),
        h('div.dx-kind', {}, have ? `${sel.kind} タイプ　つかまえた かず ×${dex[sel.id]}` : 'まだ みつけていない'),
        h('div.dx-text', {}, have ? sel.text : 'モンスターの まちで さがしてみよう！')));
    list.replaceChildren(...MONSTERS.map(x => h('button.dx-row' + (x === sel ? '.on' : ''), { onclick: () => { sel = x; sfx.play('blip'); render(); } },
      h('span.dx-cur', {}, x === sel ? '▶' : ''),
      dex[x.id] ? h('img.dx-ball', { src: pxUrl('capsule') }) : h('span.dx-ball'),
      h('span', {}, 'No.' + String(x.n).padStart(3, '0')),
      h('span.dx-rname', {}, dex[x.id] ? x.name : '－－－－'))));
  };
  render();
  sfx.play('pick');
  const m = modal(h('div.dx', {},
    h('div.dx-top', {}, h('div.dx-lens'), h('div.dx-led.r'), h('div.dx-led.y'), h('div.dx-led.g'), h('div.dx-title', {}, 'モンスターずかん'), h('div.dx-count', {}, `つかまえた ${got} / ${MONSTERS.length}`)),
    h('div.dx-body', {}, screen, list),
    h('div.dx-bottom', {}, h('button.dx-close', { onclick: () => m.close() }, 'とじる')),
  ), { cls: 'dx-modal' });
}

// ---- tall grass on the roads ------------------------------------------------------------
// map.json: "gimmickData": { "grass": 4, "grassChance": 0.25 }
const keyOf = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

// The roads walked by the best block program for this mission, so one patch is where the student will go.
function routeEdges(g, from, to) {
  try {
    const prog = solve(g, from, to);
    if (!prog) return [];
    const out = [];
    for (const st of simulate(g, prog, from, to).steps) for (const sub of st.sub) if (sub.kind === 'move') for (let i = 1; i < sub.path.length; i++) out.push([sub.path[i - 1], sub.path[i]]);
    return out;
  } catch (e) { return []; }
}

export function chooseGrass(map, mission, n = 4, rnd = Math.random) {
  const g = map.graph, ends = new Set([mission.start, mission.destination]);
  const ok = ([a, b]) => !ends.has(a) && !ends.has(b);
  const all = [], seen = new Set();
  for (const r of map.roads) {
    const e = [r[0], r[1]], k = keyOf(...e);
    if (seen.has(k) || !g.point(e[0]) || !g.point(e[1]) || !ok(e)) continue;
    seen.add(k); all.push(e);
  }
  const pick = [];
  const onRoute = routeEdges(g, mission.start, mission.destination).filter(ok);
  if (onRoute.length) pick.push(onRoute[Math.floor(rnd() * onRoute.length)]);
  const rest = all.filter(e => !pick.some(p => keyOf(...p) === keyOf(...e)));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return pick.concat(rest).slice(0, Math.max(0, n));
}

export function session(map, mission) {
  const d = map.gimmickData || {};
  const edges = chooseGrass(map, mission, d.grass ?? 4);
  const chance = window.__encounterChance ?? d.grassChance ?? GRASS_CHANCE;   // override is for testing
  const patches = new Map();
  let pending = false;
  const tuftUrls = [pxUrl('grass0'), pxUrl('grass1')];
  return {
    mount(mv) {
      const sc = mv.scene, g = map.graph;
      Promise.all(tuftUrls.map(u => loadTex(sc, u, true))).then(keys => {
        if (!keys[0]) return;
        for (const [a, b] of edges) {
          if (patches.has(keyOf(a, b))) continue;
          const pa = g.point(a), pb = g.point(b);
          const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2;
          const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
          // a little clump of tufts across and along the road
          const tufts = [[-0.9, -0.7], [0.9, -0.5], [0, 0.1], [-0.8, 0.8], [0.9, 0.9]].map(([along, across], i) => {
            const ox = Math.cos(ang) * along * 20 - Math.sin(ang) * across * 20, oy = Math.sin(ang) * along * 20 + Math.cos(ang) * across * 20;
            const s = sc.add.image(x + ox, y + oy, keys[i % 2]).setScale(1.7).setOrigin(0.5, 0.9).setDepth(4.5);
            s.baseX = s.x;
            return s;
          });
          const sway = sc.tweens.add({ targets: tufts, angle: { from: -3, to: 3 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: sc.tweens.stagger(120) });
          patches.set(keyOf(a, b), { x, y, tufts, sway });
        }
      });
    },
    // Walking through a patch: it rustles, and may stir up a monster (at most one per run).
    blockerAt(a, b, mv) {
      const p = patches.get(keyOf(a, b));
      if (!p) return null;
      return {
        x: p.x, y: p.y, pass: true,
        stop: () => {
          const sc = mv.scene;
          sfx.play('step');
          p.tufts.forEach((t, i) => sc.tweens.add({ targets: t, x: t.baseX + (i % 2 ? 4 : -4), duration: 60, yoyo: true, repeat: 3 }));
          sc.dust?.emitParticleAt(p.x, p.y, 6);
          if (pending || encounteredPlaces().length < NEED || Math.random() >= chance) return;
          pending = true;
          sfx.play('pop');
          mv.bubble(sc.player, '！', 1600, '#e8514a');
        },
      };
    },
    // Did the grass stir up a monster this run? (play.js asks after a first-time win)
    encounterPending: () => pending,
    reset() { pending = false; },
    destroy() { for (const p of patches.values()) { p.sway?.stop?.(); p.tufts.forEach(t => t.destroy()); } patches.clear(); },
  };
}
