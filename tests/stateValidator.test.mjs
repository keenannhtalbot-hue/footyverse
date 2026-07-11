import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateState } from '../src/engines/stateValidator.js';

function makeValidState() {
  return {
    schemaVersion: 2,
    seed: 'career-seed',
    clock: { tick: 10, year: 2028, quarterIndex: 2, week: 3 },
    rng: { legacyState: 123456, algorithm: 'mulberry32-v1' },
    playerId: 'person-player',
    peopleById: {
      'person-player': { id: 'person-player', kind: 'player' },
    },
    clubsById: {},
    teamsById: {},
    competitionsById: {},
    seasonsById: {},
    fixturesById: {},
    contractsById: {},
    negotiationsById: {},
    registrationsById: {},
    nationalTeamsById: {},
    callUpsById: {},
    awardsById: {},
    activeSeasonIds: [],
    pendingDecisionIds: [],
    ledger: [],
    newsLog: [],
    idCounters: {},
    settings: {},
  };
}

test('validateState accepts a well-formed schema v2 state', () => {
  const result = validateState(makeValidState());
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('validateState rejects a clock with quarterIndex out of range', () => {
  const state = makeValidState();
  state.clock.quarterIndex = 4;
  const result = validateState(state);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('quarterIndex')),
    'expected an error mentioning quarterIndex',
  );
});
