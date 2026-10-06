// Stickers for the sticker book. check() runs after every win (and after
// shopping) and returns newly earned stickers.
import { save } from './save.js';
import { MAPS } from '../data/maps.js';

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
  shopper: s => s.owned.length >= 1,
  stylist: s => s.owned.length >= 8,
  expert: s => MAPS.some(m => !m.isTest && m.missions.length && m.missions.every(ms => (s.stars[m.id]?.[ms.id] || 0) >= 3)),
  dizzy: s => s.stats.dizzy >= 1,
};

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
