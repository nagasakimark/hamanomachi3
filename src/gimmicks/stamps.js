// Stamp rally (Sanrio-style): the first time you reach a place you get its stamp.
// Collect them all for a special hat.
import { h, btn, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { sfx } from '../audio/sfx.js';
import { artUrl, stampArt } from './pickups.js';

export const intro = {
  icon: '📮',
  title: 'スタンプラリー',
  lines: [
    ['📍', 'はじめて行く ばしょで スタンプが もらえるよ！'],
    ['📒', 'スタンプカードに あつまるよ。'],
    ['🎁', 'ぜんぶ あつめると とくべつな ごほうび！'],
  ],
};

export const REWARD_ITEM = 'hat-rally';
export const REWARD_COINS = 100;

const stampsOf = map => (save.get().stamps[map.id] ||= []);
export const countStamps = map => stampsOf(map).length;
export const totalStamps = map => map.graph.destinations().length;

export function session(map, mission) {
  return {
    // Called after the win, with `first` = first time at this place.
    async afterWin({ first, mapPanel, coins }) {
      if (!first) return;
      const list = stampsOf(map);
      if (list.includes(mission.destination)) return;
      list.push(mission.destination);
      save.write();
      const name = map.graph.point(mission.destination).name;
      await stampPopup(mapPanel, name, list.length, totalStamps(map), stampArt(map, mission.destination));
      if (list.length >= totalStamps(map) && !save.owns(REWARD_ITEM)) {
        save.get().owned.push(REWARD_ITEM);
        save.addCoins(REWARD_COINS);
        save.write();
        coins?.bump(save.get().coins - REWARD_COINS, save.get().coins);
        await rewardPopup();
      }
    },
  };
}

function stampPopup(parent, name, n, total, art) {
  return new Promise(res => {
    sfx.play('buy');
    const m = modal(h('div.stamp-pop', {},
      h('div.stamp-title', {}, 'スタンプ ゲット！'),
      h('div.stamp-ink', {}, h('div.stamp-ring', {}, h('img.stamp-img', { src: artUrl(art), alt: '' }), h('div.stamp-name', {}, name))),
      h('div.stamp-count', {}, `${n} / ${total}`),
      btn('primary', 'OK', () => m.close()),
    ), { cls: 'gimmick-intro stamp-modal', onClose: () => res() });
  });
}

function rewardPopup() {
  return new Promise(res => {
    sfx.play('win');
    const m = modal(h('div.gi', {},
      h('div.gi-icon', {}, '🎀'),
      h('h2', {}, 'スタンプ ぜんぶ そろった！'),
      h('ul.gi-lines', {}, h('li', {}, h('span.gi-i', {}, '🎁'), h('span', {}, 'とくべつな ぼうしを ゲット！ きせかえで つけてみよう。')),
        h('li', {}, h('span.gi-i', {}, '🪙'), h('span', {}, `コイン +${REWARD_COINS}`))),
      btn('primary', 'やったー！', () => m.close()),
    ), { cls: 'gimmick-intro', onClose: () => res() });
  });
}

// The stamp card (button on the mission screen).
export function missionsExtra(map) {
  return btn('secondary free-btn extra-btn', ['📒 スタンプカード', h('small', {}, `${countStamps(map)} / ${totalStamps(map)}`)], () => showCard(map));
}

export function showCard(map) {
  const have = new Set(stampsOf(map));
  const dests = map.graph.destinations();
  const cells = dests.map(d => have.has(d.id)
    ? h('div.card-cell.on', {}, h('div.stamp-ring.small', {}, h('img.stamp-img', { src: artUrl(stampArt(map, d.id)), alt: '' }), h('div.stamp-name', {}, d.name)))
    : h('div.card-cell', {}, '?'));
  const m = modal(h('div.stamp-card', {},
    h('h2', {}, `${map.name} スタンプカード`),
    h('div.card-grid', {}, ...cells),
    h('div.stamp-count', {}, `${have.size} / ${dests.length}`),
    btn('primary', 'とじる', () => m.close()),
  ), { cls: 'gimmick-intro' });
}
