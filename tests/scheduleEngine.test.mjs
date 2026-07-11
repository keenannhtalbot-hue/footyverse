import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoundRobin } from '../src/engines/scheduleEngine.js';

test('generateRoundRobin produces the same schedule regardless of input team order', () => {
  const a = generateRoundRobin(['Wolves', 'Lions', 'Bears', 'Tigers']);
  const b = generateRoundRobin(['Tigers', 'Bears', 'Wolves', 'Lions']);
  assert.deepEqual(a, b);
});

test('generateRoundRobin never pairs a team against itself', () => {
  const rounds = generateRoundRobin(['A', 'B', 'C', 'D']);
  for (const round of rounds) {
    for (const fixture of round) {
      assert.notEqual(fixture.home, fixture.away);
    }
  }
});

test('generateRoundRobin has every distinct pair meet exactly twice, with reversed home/away', () => {
  const teams = ['A', 'B', 'C', 'D'];
  const fixtures = generateRoundRobin(teams).flat();

  const pairCounts = new Map();
  for (const { home, away } of fixtures) {
    const key = [home, away].sort().join('-');
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const key = [teams[i], teams[j]].sort().join('-');
      assert.equal(pairCounts.get(key), 2, `expected ${key} to meet exactly twice`);
    }
  }

  for (const { home, away } of fixtures) {
    const reverseCount = fixtures.filter((f) => f.home === away && f.away === home).length;
    assert.equal(reverseCount, 1, `expected exactly one reverse fixture for ${home} vs ${away}`);
  }
});

test('generateRoundRobin handles an odd team count with byes and no invalid fixtures', () => {
  const teams = ['A', 'B', 'C', 'D', 'E'];
  const rounds = generateRoundRobin(teams);

  for (const round of rounds) {
    assert.equal(round.length, Math.floor(teams.length / 2));
    for (const { home, away } of round) {
      assert.ok(teams.includes(home), `unexpected home value: ${home}`);
      assert.ok(teams.includes(away), `unexpected away value: ${away}`);
    }
  }
});
