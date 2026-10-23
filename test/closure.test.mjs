import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapGraph } from '../src/engine/engine.js';
import { solve } from '../src/engine/solver.js';
import { chooseClosed, graphWithout } from '../src/gimmicks/closure.js';

const map = JSON.parse(fs.readFileSync(new URL('../maps/hamanomachi/map.json', import.meta.url)));
const g = new MapGraph(map);

test('closed roads never make a mission impossible', () => {
  const all = map.roads;
  for (const m of map.missions.slice(0, 20)) {
    const closed = chooseClosed(map, m, all, 3);
    assert.ok(closed.length <= 3);
    assert.ok(solve(graphWithout(map, closed), m.start, m.destination), 'still solvable');
  }
});

test('closing a road on the shortest route can change the answer', () => {
  let changed = 0;
  for (const m of map.missions.slice(0, 12)) {
    const base = solve(g, m.start, m.destination);
    for (const road of map.roads) {
      const alt = solve(graphWithout(map, [road]), m.start, m.destination);
      if (alt && JSON.stringify(alt) !== JSON.stringify(base)) changed++;
    }
  }
  assert.ok(changed > 0, 'at least one closure forces a different program');
});
