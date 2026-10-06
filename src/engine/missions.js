// Builds a map's mission list automatically from its roads.
import { MapGraph } from './engine.js';
import { solve } from './solver.js';

export const TIERS = [
  { id: 1, name: 'Warm-up', ja: 'ウォームアップ', hint: 'marker', desc: 'Short walks. The place glows on the map.', jaDesc: '近い場所へ行こう。行き先が地図で光るよ。' },
  { id: 2, name: 'Town Walk', ja: 'まちあるき', hint: 'text', desc: 'More turns and "a little bit".', jaDesc: '曲がり角や「a little bit」がふえるよ。' },
  { id: 3, name: 'Listening', ja: 'リスニング', hint: 'none', desc: 'Listen carefully. No name on screen!', jaDesc: 'よく聞いてね！場所の名前は出ないよ。' },
  { id: 4, name: 'Challenge', ja: 'チャレンジ', hint: 'none', desc: 'Long walks and a tight block budget.', jaDesc: '遠い場所へ。ブロックの数に気をつけて！' },
];

// Every start x destination pair that can be solved, with difficulty info.
export function analysePairs(map) {
  const g = new MapGraph(map);
  const out = [];
  for (const s of g.starts()) {
    for (const d of g.destinations()) {
      if (g.neighbors(s.id).includes(d.id)) continue;
      const best = solve(g, s.id, d.id);
      if (!best) continue;
      const turns = best.filter(b => b.type !== 'straight' && b.type !== 'littlebit').length;
      const littlebit = best.some(b => b.type === 'littlebit');
      const steps = best.reduce((t, b) => t + (b.type === 'straight' ? b.n : 1), 0);
      out.push({ start: s.id, destination: d.id, best, bestCount: best.length, turns, littlebit, score: best.length * 10 + turns * 3 + steps + (littlebit ? 4 : 0) });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}

// Picks `perTier` missions for each tier, spreading destinations and starts.
export function generateMissions(map, perTier = 6) {
  const pairs = analysePairs(map);
  if (!pairs.length) return [];
  const used = new Set();
  const n = pairs.length;
  // Split sorted pairs into 4 difficulty bands.
  const bands = [
    pairs.slice(0, Math.ceil(n * 0.3)),
    pairs.slice(Math.floor(n * 0.25), Math.ceil(n * 0.6)),
    pairs.slice(Math.floor(n * 0.3), Math.ceil(n * 0.75)),
    pairs.slice(Math.floor(n * 0.6)),
  ];
  // Tier 2 prefers "little bit" routes.
  bands[1].sort((a, b) => (b.littlebit - a.littlebit) || (a.score - b.score));
  const missions = [];
  bands.forEach((band, ti) => {
    const tierDest = new Set(), tierStart = new Map();
    const picked = [];
    const pass = strict => {
      for (const p of band) {
        if (picked.length >= perTier) break;
        const k = p.start + '>' + p.destination;
        if (used.has(k)) continue;
        if (strict && (tierDest.has(p.destination) || (tierStart.get(p.start) || 0) >= Math.ceil(perTier / 2))) continue;
        picked.push(p); used.add(k); tierDest.add(p.destination);
        tierStart.set(p.start, (tierStart.get(p.start) || 0) + 1);
      }
    };
    pass(true); pass(false);
    picked.sort((a, b) => a.score - b.score);
    picked.forEach((p, i) => missions.push({
      id: `t${ti + 1}-${i + 1}`, tier: ti + 1, start: p.start, destination: p.destination, best: p.bestCount,
    }));
  });
  return missions;
}
