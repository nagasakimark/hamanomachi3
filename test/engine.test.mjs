// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapGraph, simulate, goStraight, turn } from '../src/engine/engine.js';
import { solve } from '../src/engine/solver.js';
import { generateMissions } from '../src/engine/missions.js';

// A tiny "plus" shaped town:      N
//                                 |
//                           W --- C --- E ---(lb)--- F
//                                 |                  |
//                                 S                 shop
const mini = {
  points: [
    { id: 'S', x: 0, y: 100, type: 'start', facing: 'C' },
    { id: 'C', x: 0, y: 0, type: 'normal' },
    { id: 'N', x: 0, y: -100, type: 'normal' },
    { id: 'W', x: -100, y: 0, type: 'normal' },
    { id: 'E', x: 100, y: 0, type: 'normal' },
    { id: 'L', x: 150, y: 0, type: 'littlebit' },
    { id: 'F', x: 200, y: 0, type: 'normal' },
    { id: 'shop', x: 150, y: 30, type: 'destination', name: 'shop' },
  ],
  roads: [['S', 'C'], ['C', 'N'], ['C', 'W'], ['C', 'E'], ['E', 'L'], ['L', 'F'], ['L', 'shop']],
};

test('straight counts blocks and skips little-bit points', () => {
  const g = new MapGraph(mini);
  const s = g.initialState('S');
  const r = goStraight(g, s, 1, 'shop');
  assert.equal(r.state.node, 'C');
  const t = turn(g, r.state, 'right');
  assert.ok(t.ok);
  const r2 = goStraight(g, t.state, 2, 'shop');
  assert.deepEqual(r2.path, ['C', 'E', 'L', 'F']);
});

test('turn left / right pick the 90 degree road', () => {
  const g = new MapGraph(mini);
  const at = { node: 'C', angle: -Math.PI / 2 }; // facing north
  assert.equal(turn(g, at, 'left').state.angle, Math.PI);
  assert.equal(turn(g, at, 'right').state.angle, 0);
});

test('a classic program wins', () => {
  const g = new MapGraph(mini);
  const prog = [{ type: 'straight', n: 1 }, { type: 'right' }, { type: 'straight', n: 1 }, { type: 'littlebit' }, { type: 'lookRight' }];
  const r = simulate(g, prog, 'S', 'shop');
  assert.equal(r.won, true);
});

test('a wrong turn fails on the right block', () => {
  const g = new MapGraph(mini);
  const prog = [{ type: 'straight', n: 1 }, { type: 'right' }, { type: 'straight', n: 5 }];
  const r = simulate(g, prog, 'S', 'shop');
  assert.equal(r.won, false);
  assert.equal(r.failIndex, 2);
});

test('four turns the same way makes you dizzy', () => {
  const g = new MapGraph(mini);
  const prog = [{ type: 'straight', n: 1 }, { type: 'left' }, { type: 'left' }, { type: 'left' }, { type: 'left' }];
  assert.equal(simulate(g, prog, 'S', 'shop').dizzy, true);
});

test('solver finds a winning program', () => {
  const g = new MapGraph(mini);
  const best = solve(g, 'S', 'shop');
  assert.ok(best);
  assert.equal(simulate(g, best, 'S', 'shop').won, true);
});

for (const dir of fs.readdirSync(new URL('../maps', import.meta.url))) {
  test(`map pack "${dir}": every mission is solvable in its best count`, () => {
    const map = JSON.parse(fs.readFileSync(new URL(`../maps/${dir}/map.json`, import.meta.url)));
    const g = new MapGraph(map);
    assert.ok(map.missions.length > 0);
    for (const m of map.missions) {
      const best = solve(g, m.start, m.destination);
      assert.ok(best, `${m.id} unsolvable`);
      assert.equal(best.length, m.best, `${m.id} best changed`);
    }
  });
}

test('mission generation gives 4 tiers', () => {
  const map = JSON.parse(fs.readFileSync(new URL('../maps/hamanomachi/map.json', import.meta.url)));
  const ms = generateMissions(map);
  assert.deepEqual([...new Set(ms.map(m => m.tier))], [1, 2, 3, 4]);
});

// A cut corner:  S ---- A ---(lb P)--- B           (B and C are 45-degree bends)
//                                        \
//                                         C
//                                         |
//                                         D (junction) --- E
// with "book" next to P, and little-bit points sitting right on the bends too.
const corner = {
  points: [
    { id: 'S', x: 0, y: 0, type: 'start', facing: 'A' },
    { id: 'A', x: 100, y: 0, type: 'normal' }, { id: 'A2', x: 100, y: -100, type: 'normal' },
    { id: 'P', x: 200, y: 0, type: 'littlebit' },
    { id: 'B', x: 300, y: 0, type: 'littlebit' },
    { id: 'C', x: 380, y: 80, type: 'normal' },
    { id: 'D', x: 380, y: 200, type: 'normal' }, { id: 'E', x: 480, y: 200, type: 'normal' }, { id: 'F', x: 380, y: 300, type: 'normal' },
    { id: 'book', x: 200, y: -30, type: 'destination', name: 'book' },
  ],
  roads: [['S', 'A'], ['A', 'A2'], ['A', 'P'], ['P', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['D', 'F'], ['P', 'book']],
};

test('roads are followed round cut corners, which are not blocks', () => {
  const g = new MapGraph(corner);
  const r = goStraight(g, g.initialState('S'), 2, null);
  assert.deepEqual(r.path, ['S', 'A', 'P', 'B', 'C', 'D']);
});

test('a place next to a cut corner can be reached from both sides', () => {
  const g = new MapGraph(corner);
  assert.ok(solve(g, 'S', 'book'));
  const back = { ...corner, points: corner.points.map(p => (p.id === 'S' ? { ...p, x: 380, y: 400, facing: 'F' } : p)), roads: [...corner.roads.filter(r => r[0] !== 'S'), ['S', 'F']] };
  const g2 = new MapGraph(back);
  const best = solve(g2, 'S', 'book');
  assert.ok(best, 'reachable coming round the corner');
  assert.equal(simulate(g2, best, 'S', 'book').won, true);
});
