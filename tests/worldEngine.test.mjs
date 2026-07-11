import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engines/rng.js';
import {
  createWorld,
  advanceWorldQuarter,
  getRecentNews,
} from '../src/engines/worldEngine.js';

test('createWorld generates at least 18 NPC youth peers', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-1' });
  assert.ok(world.npcs.length >= 18, `expected >= 18 npcs, got ${world.npcs.length}`);
});

test('createWorld NPCs span multiple countries and clubs', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-2' });
  const countries = new Set(world.npcs.map((n) => n.country));
  const clubs = new Set(world.npcs.map((n) => n.club));
  assert.ok(countries.size >= 4, `expected npcs across >=4 countries, got ${countries.size}`);
  assert.ok(clubs.size >= 4, `expected npcs across >=4 clubs, got ${clubs.size}`);
});

test('every NPC has visible stats and a plausible age for a youth peer', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-3' });
  for (const npc of world.npcs) {
    assert.ok(npc.age >= 5 && npc.age <= 16);
    assert.ok('passing' in npc.stats);
    assert.ok(typeof npc.name === 'string' && npc.name.length > 0);
  }
});

test('advanceWorldQuarter cycles season and ages NPCs on year wrap', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-4' });
  const rng = createRng('advance-4');
  assert.equal(world.season, 'Spring');
  advanceWorldQuarter(world, rng);
  advanceWorldQuarter(world, rng);
  advanceWorldQuarter(world, rng);
  const someNpcAgeBefore = world.npcs[0].age;
  advanceWorldQuarter(world, rng); // wraps to Spring, year+1
  assert.equal(world.season, 'Spring');
  assert.equal(world.year, 2027);
  assert.equal(world.npcs[0].age, someNpcAgeBefore + 1);
});

test('advanceWorldQuarter produces news entries over several quarters', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-5' });
  const rng = createRng('advance-5');
  for (let i = 0; i < 8; i++) advanceWorldQuarter(world, rng);
  assert.ok(world.newsLog.length > 0, 'expected some news to be generated');
});

test('getRecentNews returns at most `limit` items, most recent first', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-6' });
  const rng = createRng('advance-6');
  for (let i = 0; i < 10; i++) advanceWorldQuarter(world, rng);
  const recent = getRecentNews(world, 3);
  assert.ok(recent.length <= 3);
  if (world.newsLog.length > 1) {
    assert.equal(recent[0], world.newsLog[world.newsLog.length - 1]);
  }
});

test('NPC stats and injuries evolve over many quarters (world is not static)', () => {
  const world = createWorld({ startYear: 2026, seed: 'world-7' });
  const rng = createRng('advance-7');
  const snapshot = world.npcs.map((n) => JSON.stringify(n.stats));
  for (let i = 0; i < 12; i++) advanceWorldQuarter(world, rng);
  const changed = world.npcs.some((n, i) => JSON.stringify(n.stats) !== snapshot[i]);
  assert.ok(changed, 'expected at least one NPC to change stats over 12 quarters');
});
