import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatchPlan, resolveMatchPlan } from '../src/engines/matchEngine.js';

function makeFixture(overrides = {}) {
  return {
    id: 'fixture-2039-0001',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    ...overrides,
  };
}

test('createMatchPlan produces the same deterministic incidents for the same seed, fixture, and lineups without mutating inputs', () => {
  const fixture = makeFixture();
  const homeLineup = [{ slot: 'ST', personId: 'p-home-1' }, { slot: 'GK', personId: 'p-home-2' }];
  const awayLineup = [{ slot: 'ST', personId: 'p-away-1' }, { slot: 'GK', personId: 'p-away-2' }];
  const homeLineupCopy = structuredClone(homeLineup);
  const awayLineupCopy = structuredClone(awayLineup);

  const planA = createMatchPlan(12345, fixture, homeLineup, awayLineup);
  const planB = createMatchPlan(12345, fixture, homeLineup, awayLineup);

  assert.deepEqual(planA, planB);
  assert.ok(planA.incidents.length > 0);
  assert.deepEqual(homeLineup, homeLineupCopy);
  assert.deepEqual(awayLineup, awayLineupCopy);
  assert.ok(Object.isFrozen(planA));
  assert.ok(Object.isFrozen(planA.incidents));
});

test('resolveMatchPlan resolves the same plan and decisions to a byte-equivalent immutable result bundle with a score and per-player performances, without mutating plan or decisions', () => {
  const fixture = makeFixture();
  const homeLineup = [{ slot: 'ST', personId: 'p-home-1' }, { slot: 'GK', personId: 'p-home-2' }];
  const awayLineup = [{ slot: 'ST', personId: 'p-away-1' }, { slot: 'GK', personId: 'p-away-2' }];
  const plan = createMatchPlan(12345, fixture, homeLineup, awayLineup);
  const planCopy = structuredClone(plan);
  const decisions = { 0: 'shoot', 2: 'pass' };
  const decisionsCopy = structuredClone(decisions);

  const resultA = resolveMatchPlan(12345, plan, homeLineup, awayLineup, decisions);
  const resultB = resolveMatchPlan(12345, plan, homeLineup, awayLineup, decisions);

  assert.deepEqual(resultA, resultB);
  assert.equal(JSON.stringify(resultA), JSON.stringify(resultB));
  assert.deepEqual(plan, planCopy);
  assert.deepEqual(decisions, decisionsCopy);

  assert.equal(typeof resultA.score.home, 'number');
  assert.equal(typeof resultA.score.away, 'number');
  assert.ok(resultA.playerPerformances.length > 0);
  for (const performance of resultA.playerPerformances) {
    assert.ok(Number.isInteger(performance.ratingX100));
    assert.ok(performance.ratingX100 >= 100 && performance.ratingX100 <= 1000);
  }
  assert.ok(Object.isFrozen(resultA));
  assert.ok(Object.isFrozen(resultA.score));
  assert.ok(Object.isFrozen(resultA.playerPerformances));
  assert.ok(Object.isFrozen(resultA.playerPerformances[0]));
});
