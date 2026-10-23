// Stamp rally (kawaii town): the first time you reach a place you get its stamp,
// pressed into a stamp card like a real Japanese stamp rally. Collect them all
// for a ribbon.
import { h, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { sfx } from '../audio/sfx.js';
import { svgUrl, addArt } from './pickups.js';

const inks = import.meta.glob('../assets/gimmick/ink/*.png', { eager: true, query: '?url', import: 'default' });
const INK = ['#e8457a', '#e0464a', '#9a5ad0', '#3f86d9', '#ff6f9f', '#e2574a', '#8a5ad0', '#2f9ad9'];
const stampNo = (map, destId) => Math.max(0, map.graph.destinations().findIndex(d => d.id === destId)) % 8 + 1;
const tilt = id => ((String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 17) - 8);

// One inked stamp (mask picture coloured with its ink) with the place name.
function inked(map, destId, cls = '') {
  const n = stampNo(map, destId), name = map.graph.point(destId)?.name || '';
  return h('div.st-ink' + cls, { style: { '--ink': INK[n - 1], '--tilt': tilt(destId) + 'deg' } },
    h('div.st-inkimg', { style: { WebkitMaskImage: `url(${inks[`../assets/gimmick/ink/ink${n}.png`]})`, maskImage: `url(${inks[`../assets/gimmick/ink/ink${n}.png`]})` } }),
    h('div.st-inkname', {}, name));
}

export const intro = {
  theme: 'stamps',
  icon: () => h('img.gi-svg', { src: svgUrl('stamp-stand') }),
  title: 'スタンプラリー',
  lines: [
    [() => h('img.gi-li', { src: svgUrl('stamp-stand') }), 'はじめて いく ばしょで スタンプが もらえるよ！'],
    ['♡', 'スタンプは スタンプカードに たまっていくよ。'],
    ['🎀', 'ぜんぶ あつめると とくべつな リボンが もらえる！'],
  ],
};

export const REWARD_ITEM = 'hat-rally';
export const REWARD_COINS = 100;

const stampsOf = map => (save.get().stamps[map.id] ||= []);
export const countStamps = map => stampsOf(map).length;
export const totalStamps = map => map.graph.destinations().length;

export function session(map, mission) {
  let stands = [];
  return {
    // a little stamp stand beside every place that still has a stamp to give
    mount(mv) {
      const have = new Set(stampsOf(map));
      stands = map.graph.destinations().filter(d => !have.has(d.id)).map(d => {
        const a = addArt(mv.scene, svgUrl('stamp-stand'), d.x + 26, d.y - 18, 34, 4.5);
        a.onReady = o => mv.scene.tweens.add({ targets: o, y: o.y - 4, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        return a;
      });
    },
    async afterWin({ first, coins }) {
      if (!first) return;
      const list = stampsOf(map);
      if (list.includes(mission.destination)) return;
      list.push(mission.destination);
      save.write();
      await stampPopup(map, mission.destination, list.length, totalStamps(map));
      if (list.length >= totalStamps(map) && !save.owns(REWARD_ITEM)) {
        save.get().owned.push(REWARD_ITEM);
        save.addCoins(REWARD_COINS);
        save.write();
        coins?.bump(save.get().coins - REWARD_COINS, save.get().coins);
        await rewardPopup();
      }
    },
    destroy() { stands.forEach(s => s.destroy()); stands = []; },
  };
}

// The stamping moment: the rubber stamp comes down - pon! - and leaves the ink.
function stampPopup(map, destId, n, total) {
  return new Promise(res => {
    const ink = inked(map, destId, '.big');
    const handle = h('div.st-handle', {}, h('div.st-knob'), h('div.st-neck'), h('div.st-base'));
    const pad = h('div.st-paper', {}, ink, handle);
    const okBtn = h('button.st-btn', { onclick: () => m.close() }, 'やったね！');
    okBtn.style.visibility = 'hidden';
    const m = modal(h('div.st-pop', {},
      h('div.st-ribbon', {}, 'スタンプ ゲット！'),
      pad,
      h('div.st-place', {}, map.graph.point(destId)?.name || ''),
      h('div.st-count', {}, h('b', {}, String(n)), ` / ${total} こ あつめたよ`),
      okBtn,
    ), { cls: 'st-modal', onClose: () => res() });
    ink.style.opacity = 0;
    handle.animate([{ transform: 'translate(-50%, -260px) rotate(-8deg)' }, { transform: 'translate(-50%, -20px) rotate(0)', offset: 0.55 }, { transform: 'translate(-50%, 10px) scale(1.04, .94)', offset: 0.7 }, { transform: 'translate(-50%, -300px)', opacity: 0, offset: 1 }], { duration: 1300, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(() => {
      sfx.play('stamp');
      ink.style.opacity = '';
      ink.animate([{ transform: `rotate(var(--tilt)) scale(1.15)`, filter: 'blur(1px)' }, { transform: `rotate(var(--tilt)) scale(1)`, filter: 'none' }], { duration: 250, easing: 'ease-out' });
      for (let i = 0; i < 8; i++) pad.append(h('i.st-heart', { style: { '--a': `${i * 45}deg` } }, i % 2 ? '♡' : '✦'));
    }, 880);
    setTimeout(() => { okBtn.style.visibility = ''; }, 1400);
  });
}

function rewardPopup() {
  return new Promise(res => {
    sfx.play('win');
    const m = modal(h('div.st-pop.st-reward', {},
      h('div.st-ribbon', {}, 'コンプリート！'),
      h('div.st-bigbow', {}, '🎀'),
      h('div.st-place', {}, 'スタンプが ぜんぶ そろったよ！'),
      h('div.st-count', {}, 'とくべつな「ラリーリボン」と コイン +' + REWARD_COINS + ' を ゲット！ きせかえで つけてみよう。'),
      h('button.st-btn', { onclick: () => m.close() }, 'ありがとう！'),
    ), { cls: 'st-modal', onClose: () => res() });
  });
}

// The stamp card (button on the mission screen).
export function missionsExtra(map) {
  return h('button.st-open', { onclick: () => { sfx.play('press'); showCard(map); } }, h('img', { src: svgUrl('stamp-stand') }), h('span', {}, 'スタンプカード'), h('small', {}, `${countStamps(map)} / ${totalStamps(map)}`));
}

export function showCard(map) {
  const have = new Set(stampsOf(map));
  const dests = map.graph.destinations();
  const cells = dests.map((d, i) => h('div.st-cell' + (have.has(d.id) ? '.on' : ''), {},
    h('div.st-slot', {}, have.has(d.id) ? inked(map, d.id) : h('span.st-num', {}, String(i + 1))),
    h('div.st-label', {}, have.has(d.id) ? d.name : '？')));
  const m = modal(h('div.st-card', {},
    h('div.st-cardhead', {}, h('span.st-cardtitle', {}, `${map.name} スタンプラリー`), h('span.st-cardcount', {}, `${have.size} / ${dests.length}`)),
    h('div.st-grid', {}, ...cells),
    h('div.st-cardfoot', {}, h('span', {}, 'ぜんぶ あつめると 🎀 リボン！'), h('button.st-btn', { onclick: () => m.close() }, 'とじる')),
  ), { cls: 'st-modal' });
}
