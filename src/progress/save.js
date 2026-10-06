// Progress is saved in this browser (localStorage). Each student plays on
// their own Chromebook, so there is one save per browser. A backup code lets
// a student move their progress to another device.
import { STARTER } from '../avatar/items.js';

const KEY = 'hamanomachi.save.v2';

function fresh() {
  return {
    v: 2,
    created: Date.now(),
    madeCharacter: false,
    look: { ...STARTER },
    owned: [],
    coins: 0,
    stars: {},        // mapId -> missionId -> 0..3
    visited: {},      // mapId -> [destination ids]
    badges: {},       // badgeId -> timestamp
    stats: { wins: 0, listenWins: 0, littlebitWins: 0, freeWins: 0, threeStars: 0, dizzy: 0, bestComeback: 0 },
    settings: { sfx: true, music: false, speed: 1 },
    seen: {},
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(fresh(), JSON.parse(raw));
  } catch (e) { /* private window or blocked storage */ }
  return fresh();
}
function merge(base, saved) {
  for (const k of Object.keys(saved)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object') base[k] = { ...base[k], ...saved[k] };
    else base[k] = saved[k];
  }
  return base;
}

export const save = {
  get: () => data,
  write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } },
  reset() { data = fresh(); this.write(); },

  starsFor(mapId, missionId) { return data.stars[mapId]?.[missionId] || 0; },
  mapStars(mapId) { return Object.values(data.stars[mapId] || {}).reduce((a, b) => a + b, 0); },
  totalStars() { return Object.keys(data.stars).reduce((t, m) => t + this.mapStars(m), 0); },
  setStars(mapId, missionId, n) {
    data.stars[mapId] = data.stars[mapId] || {};
    const old = data.stars[mapId][missionId] || 0;
    if (n > old) data.stars[mapId][missionId] = n;
    return Math.max(0, n - old);
  },
  visit(mapId, destId) {
    const v = data.visited[mapId] = data.visited[mapId] || [];
    if (!v.includes(destId)) v.push(destId);
  },
  addCoins(n) { data.coins = Math.max(0, data.coins + n); },
  owns(itemId) { return data.owned.includes(itemId); },

};
