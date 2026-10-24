import { itemById } from '../avatar/items.js';
// Stickers for the sticker book. check() runs after every win (and after
// shopping) and returns newly earned stickers.
import { save } from './save.js';
import { MAPS } from '../data/maps.js';
import { MONSTERS } from '../gimmicks/monsters.js';

export const BADGE_COINS = 20;

export const BADGES = [
  { id: 'first', name: 'はじめの一歩', icon: '👣', color: '#6cc36a', desc: 'はじめてミッションをクリアする。' },
  { id: 'explorer', name: 'まちたんけん', icon: '🗺️', color: '#3fb5c9', desc: '町のぜんぶの場所に行く。' },
  { id: 'listener', name: '聞き上手', icon: '👂', color: '#9b6ad6', desc: 'リスニングかチャレンジで10回クリアする。', reward: 'まほうつかい' },
  { id: 'nevergiveup', name: 'あきらめない', icon: '💪', color: '#e8514a', desc: '3回以上しっぱいしてからクリアする。' },
  { id: 'efficient', name: 'むだなし', icon: '⚡', color: '#f6c84d', desc: '10このミッションで★3をとる。', reward: 'シルクハット' },
  { id: 'littlebit', name: 'a little bit 名人', icon: '🐾', color: '#f39a3c', desc: '「go straight for a little bit」をつかって5回クリアする。' },
  { id: 'free', name: 'フリーウォーカー', icon: '🚶', color: '#4a78d6', desc: 'フリープレイで10回クリアする。' },
  { id: 'stars50', name: 'スターコレクター', icon: '🌟', color: '#f2b53a', desc: '★を50こ あつめる。' },
  { id: 'shopper', name: 'おかいもの', icon: '🛍️', color: '#f08fb6', desc: 'ショップで何か買う。' },
  { id: 'stylist', name: 'おしゃれさん', icon: '🎨', color: '#1f9a7a', desc: 'ショップのアイテムを8こ もつ。' },
  { id: 'expert', name: 'まちの名人', icon: '👑', color: '#d9a441', desc: '町のぜんぶのミッションで★3をとる。', reward: 'おうかん' },
  // --- more stickers: wins, towns and every town's special game ---
  { id: 'wins25', name: 'ベテランたんけん家', icon: '🧭', color: '#2f8f83', desc: 'ミッションを25回 クリアする。' },
  { id: 'wins100', name: 'みちマスター', icon: '🏅', color: '#d9822b', desc: 'ミッションを100回 クリアする。' },
  { id: 'stars100', name: 'ミラクルスター', icon: '✨', color: '#f0b429', desc: '★を100こ あつめる。' },
  { id: 'rich', name: 'おかねもち', icon: '💰', color: '#c9a227', desc: 'コインを500まい もつ。' },
  { id: 'closet', name: 'ファッションリーダー', icon: '👗', color: '#e0559c', desc: 'アイテムを20こ もつ。' },
  { id: 'traveler', name: 'せかいりょこう', icon: '✈️', color: '#4a90d9', desc: '3つの町で ★をとる。' },
  { id: 'globetrot', name: 'ぜんぶの町へ！', icon: '🌍', color: '#2e7d5b', desc: 'ぜんぶの町で ★をとる。' },
  { id: 'stamper', name: 'スタンプマスター', icon: '🎀', color: '#ff6fa5', desc: 'サンリオタウンの スタンプを ぜんぶ あつめる。' },
  { id: 'diver', name: 'トレジャーハンター', icon: '🏴‍☠️', color: '#1e88a8', desc: 'たからばこを 10こ ひらく。' },
  { id: 'miner', name: 'はじめての クラフト', icon: '⛏️', color: '#7a6a4f', desc: 'ぼうしを ひとつ つくる。' },
  { id: 'smith', name: 'クラフトマスター', icon: '💎', color: '#2bbfb0', desc: 'クラフトの ぼうしを ぜんぶ つくる。' },
  { id: 'powerup', name: 'パワーアップ！', icon: '🍄', color: '#e8514a', desc: 'パワーアップを 20こ あつめる。' },
  { id: 'buster', name: 'モンスターバスター', icon: '⭐', color: '#f5c518', desc: 'ブロックの モンスターを 10たい たおす。' },
  { id: 'catcher', name: 'ゲットだぜ！', icon: '🔴', color: '#d93a3a', desc: 'はじめて モンスターを つかまえる。' },
  { id: 'dexhalf', name: 'モンスターはかせ', icon: '📖', color: '#5b6fd6', desc: 'モンスターを 4しゅるい つかまえる。' },
  { id: 'dexfull', name: 'ずかん コンプリート', icon: '🏆', color: '#d4a017', desc: 'モンスターずかんを ぜんぶ うめる。' },
  { id: 'dizzy', name: '目がまわる〜', icon: '😵‍💫', color: '#b07ad6', desc: 'ひみつのシール…', secret: true },
];

const rules = {
  first: s => s.stats.wins >= 1,
  explorer: s => MAPS.some(m => !m.isTest && m.graph.destinations().every(d => (s.visited[m.id] || []).includes(d.id))),
  listener: s => s.stats.listenWins >= 10,
  nevergiveup: s => s.stats.bestComeback >= 3,
  efficient: s => countThree(s) >= 10,
  littlebit: s => s.stats.littlebitWins >= 5,
  free: s => s.stats.freeWins >= 10,
  stars50: () => save.totalStars() >= 50,
  shopper: s => s.owned.some(id => { const it = itemById(id); return !it || it.price > 0; }),   // bought something (town rewards don't count)
  stylist: s => s.owned.length >= 8,
  expert: s => MAPS.some(m => !m.isTest && m.missions.length && m.missions.every(ms => (s.stars[m.id]?.[ms.id] || 0) >= 3)),
  wins25: s => s.stats.wins >= 25,
  wins100: s => s.stats.wins >= 100,
  stars100: () => save.totalStars() >= 100,
  rich: s => s.coins >= 500,
  closet: s => s.owned.length >= 20,
  traveler: () => realMaps().filter(m => save.mapStars(m.id) > 0).length >= 3,
  globetrot: () => realMaps().length > 0 && realMaps().every(m => save.mapStars(m.id) > 0),
  stamper: s => MAPS.some(m => !m.isTest && m.gimmick === 'stamps' && (s.stamps[m.id] || []).length >= m.graph.destinations().length),
  diver: s => Object.values(s.chests || {}).reduce((a, b) => a + b, 0) >= 10,
  miner: s => s.owned.some(id => id.startsWith('hat-craft-')),
  smith: s => ['leather', 'iron', 'gold', 'diamond'].every(k => s.owned.includes('hat-craft-' + k)),
  powerup: s => Object.values(s.powerCollected || {}).reduce((a, b) => a + b, 0) >= 20,
  buster: s => (s.foesDefeated || 0) >= 10,
  catcher: s => Object.keys(s.dex || {}).length >= 1,
  dexhalf: s => Object.keys(s.dex || {}).length >= 4,
  dexfull: s => MONSTERS.every(m => (s.dex || {})[m.id] > 0),
  dizzy: s => s.stats.dizzy >= 1,
};

const realMaps = () => MAPS.filter(m => !m.isTest);

function countThree(s) {
  return Object.values(s.stars).reduce((t, m) => t + Object.values(m).filter(v => v >= 3).length, 0);
}

export function checkBadges() {
  const s = save.get();
  const earned = [];
  for (const b of BADGES) {
    if (s.badges[b.id]) continue;
    if (rules[b.id]?.(s)) {
      s.badges[b.id] = Date.now();
      save.addCoins(BADGE_COINS);
      earned.push(b);
    }
  }
  if (earned.length) save.write();
  return earned;
}
