import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptLoanOffer, returnExpiredLoans } from '../src/engines/loanEngine.js';

function makeState(overrides = {}) {
  return {
    schemaVersion: 2,
    clock: { tick: 500, year: 2028, quarterIndex: 0, week: 1 },
    peopleById: {
      'person-player': {
        id: 'person-player',
        career: {
          currentTeamId: 'team-redbrook-senior',
          currentContractId: 'contract-1',
          parentClubTeamId: null,
          loanTeamId: null,
        },
      },
    },
    clubsById: {
      'club-redbrook': { id: 'club-redbrook', teamIds: ['team-redbrook-senior'] },
      'club-rheintal': { id: 'club-rheintal', teamIds: ['team-rheintal-senior'] },
    },
    teamsById: {
      'team-redbrook-senior': {
        id: 'team-redbrook-senior', clubId: 'club-redbrook', squadPersonIds: ['person-player'],
      },
      'team-rheintal-senior': {
        id: 'team-rheintal-senior', clubId: 'club-rheintal', squadPersonIds: [],
      },
    },
    contractsById: {
      'contract-1': {
        id: 'contract-1', personId: 'person-player', clubId: 'club-redbrook',
        status: 'active', kind: 'professional', startTick: 400, endTick: 900,
      },
    },
    registrationsById: {
      'registration-1': {
        id: 'registration-1', personId: 'person-player', teamId: 'team-redbrook-senior',
        kind: 'permanent', startTick: 400, endTick: null, parentClubId: null, active: true,
      },
    },
    negotiationsById: {
      'negotiation-loan-1': {
        id: 'negotiation-loan-1', kind: 'loan', personId: 'person-player',
        fromClubId: 'club-redbrook', toClubId: 'club-rheintal',
        toTeamId: 'team-rheintal-senior', createdTick: 490, expiresTick: 510,
        status: 'open', terms: { durationTicks: 32 },
      },
    },
    ledger: [],
    idCounters: {},
    ...overrides,
  };
}

test('acceptLoanOffer preserves contract ownership and atomically activates one fixed-term destination registration', () => {
  const state = makeState();
  const snapshot = structuredClone(state);

  const next = acceptLoanOffer(state, 'negotiation-loan-1');

  assert.deepEqual(state, snapshot);
  assert.notEqual(next, state);
  assert.deepEqual(next.contractsById['contract-1'], state.contractsById['contract-1']);
  assert.equal(next.registrationsById['registration-1'].active, false);
  assert.equal(next.registrationsById['registration-1'].endTick, 500);

  const active = Object.values(next.registrationsById).filter(
    (registration) => registration.personId === 'person-player' && registration.active,
  );
  assert.equal(active.length, 1);
  assert.deepEqual(active[0], {
    id: 'registration-2',
    personId: 'person-player',
    teamId: 'team-rheintal-senior',
    kind: 'loan',
    startTick: 500,
    endTick: 532,
    parentClubId: 'club-redbrook',
    active: true,
  });
  assert.deepEqual(next.teamsById['team-redbrook-senior'].squadPersonIds, []);
  assert.deepEqual(next.teamsById['team-rheintal-senior'].squadPersonIds, ['person-player']);
  assert.deepEqual(next.peopleById['person-player'].career, {
    currentTeamId: 'team-rheintal-senior',
    currentContractId: 'contract-1',
    parentClubTeamId: 'team-redbrook-senior',
    loanTeamId: 'team-rheintal-senior',
  });
  assert.equal(next.negotiationsById['negotiation-loan-1'].status, 'accepted');
  assert.equal(next.idCounters.registration, 2);
});

test('returnExpiredLoans returns a due loan to its preserved parent registration exactly once', () => {
  const loanState = acceptLoanOffer(makeState(), 'negotiation-loan-1');
  loanState.clock.tick = 532;
  const snapshot = structuredClone(loanState);

  const returned = returnExpiredLoans(loanState);

  assert.deepEqual(loanState, snapshot);
  assert.equal(returned.registrationsById['registration-2'].active, false);
  assert.equal(returned.registrationsById['registration-2'].endTick, 532);
  assert.equal(returned.registrationsById['registration-1'].active, true);
  assert.equal(returned.registrationsById['registration-1'].endTick, null);
  assert.deepEqual(returned.teamsById['team-rheintal-senior'].squadPersonIds, []);
  assert.deepEqual(returned.teamsById['team-redbrook-senior'].squadPersonIds, ['person-player']);
  assert.deepEqual(returned.peopleById['person-player'].career, {
    currentTeamId: 'team-redbrook-senior',
    currentContractId: 'contract-1',
    parentClubTeamId: null,
    loanTeamId: null,
  });

  assert.deepEqual(returnExpiredLoans(returned), returned);
});

test('acceptLoanOffer rejects malformed, stale, conflicting, or dangling offers without partial mutation', () => {
  const cases = [
    ['malformed people container', (state) => { state.peopleById = null; }, /peopleById must be an object/i],
    ['non-open offer', (state) => { state.negotiationsById['negotiation-loan-1'].status = 'accepted'; }, /not open/i],
    ['expired offer', (state) => { state.clock.tick = 511; }, /expired/i],
    ['unknown person', (state) => { delete state.peopleById['person-player']; }, /unknown person/i],
    ['unknown parent club', (state) => { delete state.clubsById['club-redbrook']; }, /unknown parent club/i],
    ['unknown destination club', (state) => { delete state.clubsById['club-rheintal']; }, /unknown destination club/i],
    ['unknown destination team', (state) => { delete state.teamsById['team-rheintal-senior']; }, /unknown destination team/i],
    ['destination team belongs to another club', (state) => {
      state.teamsById['team-rheintal-senior'].clubId = 'club-redbrook';
    }, /does not belong/i],
    ['conflicting active registration', (state) => {
      state.registrationsById['registration-conflict'] = {
        id: 'registration-conflict', personId: 'person-player', teamId: 'team-rheintal-senior',
        kind: 'permanent', startTick: 450, endTick: null, parentClubId: null, active: true,
      };
    }, /exactly one active registration/i],
    ['missing owning contract', (state) => { state.contractsById['contract-1'].status = 'expired'; }, /active owning contract/i],
  ];

  for (const [name, alter, expected] of cases) {
    const state = makeState();
    alter(state);
    const snapshot = structuredClone(state);
    assert.throws(() => acceptLoanOffer(state, 'negotiation-loan-1'), expected, name);
    assert.deepEqual(state, snapshot, `${name} mutated input`);
  }
});

test('returnExpiredLoans validates every due loan before applying any return', () => {
  const state = acceptLoanOffer(makeState(), 'negotiation-loan-1');
  state.clock.tick = 532;
  state.peopleById['person-player'].career.parentClubTeamId = 'team-missing';
  const snapshot = structuredClone(state);

  assert.throws(() => returnExpiredLoans(state), /parent team/i);
  assert.deepEqual(state, snapshot);
});

test('returnExpiredLoans preserves the fixed loan end tick when processing an overdue return', () => {
  const state = acceptLoanOffer(makeState(), 'negotiation-loan-1');
  state.clock.tick = 540;

  const returned = returnExpiredLoans(state);

  assert.equal(returned.registrationsById['registration-2'].endTick, 532);
});
