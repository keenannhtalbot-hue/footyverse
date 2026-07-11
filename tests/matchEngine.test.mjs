import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatchPlan } from '../src/engines/matchEngine.js';

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
