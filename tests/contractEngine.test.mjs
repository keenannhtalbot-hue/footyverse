import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptContractOffer,
  acceptContractOfferWithResult,
  counterContractOffer,
  expireContracts,
  rejectContractOffer,
} from '../src/engines/contractEngine.js';

function makeState(overrides = {}) {
  return {
    schemaVersion: 2,
    clock: { tick: 500, year: 2028, quarterIndex: 0, week: 1 },
    peopleById: {
      'person-player': {
        id: 'person-player',
        career: {
          stage: 'senior',
          currentTeamId: 'team-redbrook-senior',
          currentContractId: 'contract-1',
          parentClubTeamId: null,
          loanTeamId: null,
        },
      },
    },
    clubsById: {
      'club-redbrook': { id: 'club-redbrook', teamIds: ['team-redbrook-senior'] },
    },
    teamsById: {
      'team-redbrook-senior': {
        id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior', squadPersonIds: [],
      },
    },
    contractsById: {},
    registrationsById: {},
    negotiationsById: {
      'negotiation-1': {
        id: 'negotiation-1', kind: 'professional-offer', personId: 'person-player',
        fromClubId: 'club-redbrook', toClubId: 'club-redbrook',
        createdTick: 490, expiresTick: 510, status: 'open',
        terms: {
          durationTicks: 128, wagePerWeekMinor: 180000,
          signingBonusMinor: 200000, squadRole: 'prospect', transferFeeMinor: 0,
        },
        roundsUsed: 0, maxRounds: 2,
      },
    },
    idCounters: {},
    ...overrides,
  };
}

test('acceptContractOffer creates one active owning contract and marks the negotiation accepted, but rejects acceptance when the person already has an active owning contract', () => {
  const state = makeState();
  const negotiationBefore = state.negotiationsById['negotiation-1'];

  const next = acceptContractOffer(state, 'negotiation-1');

  assert.notEqual(next, state);
  assert.deepEqual(state.negotiationsById['negotiation-1'], negotiationBefore);
  assert.equal(Object.keys(state.contractsById).length, 0);

  const contracts = Object.values(next.contractsById);
  assert.equal(contracts.length, 1);
  const [contract] = contracts;
  assert.equal(contract.personId, 'person-player');
  assert.equal(contract.clubId, 'club-redbrook');
  assert.equal(contract.status, 'active');
  assert.equal(contract.kind, 'professional');
  assert.equal(contract.startTick, 500);
  assert.equal(contract.endTick, 628);
  assert.equal(contract.wagePerWeekMinor, 180000);
  assert.equal(contract.signingBonusMinor, 200000);
  assert.equal(contract.squadRole, 'prospect');

  assert.equal(next.negotiationsById['negotiation-1'].status, 'accepted');

  const stateWithSecondOffer = {
    ...next,
    negotiationsById: {
      ...next.negotiationsById,
      'negotiation-2': {
        id: 'negotiation-2', kind: 'professional-offer', personId: 'person-player',
        fromClubId: 'club-otherclub', toClubId: 'club-otherclub',
        createdTick: 500, expiresTick: 520, status: 'open',
        terms: {
          durationTicks: 64, wagePerWeekMinor: 90000,
          signingBonusMinor: 0, squadRole: 'rotation', transferFeeMinor: 0,
        },
        roundsUsed: 0, maxRounds: 2,
      },
    },
  };

  assert.throws(
    () => acceptContractOffer(stateWithSecondOffer, 'negotiation-2'),
    /active owning contract/,
  );
});

test('acceptContractOfferWithResult exposes the authoritative created contract ID without changing the legacy API', () => {
  const state = makeState();

  const result = acceptContractOfferWithResult(state, 'negotiation-1');

  assert.equal(result.contractId, 'contract-1');
  assert.equal(result.state.contractsById[result.contractId].personId, 'person-player');
  assert.equal(acceptContractOffer(state, 'negotiation-1').contractsById['contract-1'].id, 'contract-1');
});

test('rejectContractOffer marks an open negotiation rejected without creating a contract, and rejects negotiations that are not open', () => {
  const state = makeState();
  const negotiationBefore = state.negotiationsById['negotiation-1'];

  const next = rejectContractOffer(state, 'negotiation-1');

  assert.notEqual(next, state);
  assert.deepEqual(state.negotiationsById['negotiation-1'], negotiationBefore);
  assert.equal(next.negotiationsById['negotiation-1'].status, 'rejected');
  assert.equal(Object.keys(next.contractsById).length, 0);

  assert.throws(
    () => rejectContractOffer(next, 'negotiation-1'),
    /Negotiation is not open/,
  );
});

test('rejectContractOffer rejects an expired offer without mutating the input', () => {
  const state = makeState({
    clock: { tick: 511, year: 2028, quarterIndex: 0, week: 1 },
  });
  const snapshot = structuredClone(state);

  assert.throws(
    () => rejectContractOffer(state, 'negotiation-1'),
    /Negotiation has expired/,
  );
  assert.deepEqual(state, snapshot);
});

test('counterContractOffer replaces the proposed terms and consumes one negotiation round without mutating the input', () => {
  const state = makeState();
  const proposedTerms = {
    durationTicks: 96,
    wagePerWeekMinor: 210000,
    signingBonusMinor: 250000,
    squadRole: 'rotation',
    transferFeeMinor: 0,
  };

  const next = counterContractOffer(state, 'negotiation-1', proposedTerms);

  assert.equal(state.negotiationsById['negotiation-1'].roundsUsed, 0);
  assert.equal(next.negotiationsById['negotiation-1'].roundsUsed, 1);
  assert.deepEqual(next.negotiationsById['negotiation-1'].terms, proposedTerms);
});

test('counterContractOffer rejects a counter after the negotiation round limit is reached', () => {
  const state = makeState();
  state.negotiationsById['negotiation-1'].roundsUsed = 2;

  assert.throws(
    () => counterContractOffer(state, 'negotiation-1', state.negotiationsById['negotiation-1'].terms),
    /counter round limit reached/,
  );
});

test('counterContractOffer rejects a counter after the offer expires', () => {
  const state = makeState({
    clock: { tick: 511, year: 2028, quarterIndex: 0, week: 1 },
  });

  assert.throws(
    () => counterContractOffer(state, 'negotiation-1', state.negotiationsById['negotiation-1'].terms),
    /Negotiation has expired/,
  );
});

test('counterContractOffer rejects a negotiation that is no longer open', () => {
  const state = makeState();
  state.negotiationsById['negotiation-1'].status = 'rejected';

  assert.throws(
    () => counterContractOffer(state, 'negotiation-1', state.negotiationsById['negotiation-1'].terms),
    /Negotiation is not open/,
  );
});

test('contract responses reject non-contract negotiation kinds without mutating input', () => {
  const state = makeState();
  state.negotiationsById['negotiation-1'].kind = 'transfer';
  const snapshot = structuredClone(state);

  assert.throws(() => acceptContractOffer(state, 'negotiation-1'), /not a contract offer/i);
  assert.throws(() => rejectContractOffer(state, 'negotiation-1'), /not a contract offer/i);
  assert.throws(
    () => counterContractOffer(state, 'negotiation-1', state.negotiationsById['negotiation-1'].terms),
    /not a contract offer/i,
  );
  assert.deepEqual(state, snapshot);
});

test('counterContractOffer rejects terms that cannot create a valid JSON-safe contract', () => {
  const invalidTerms = [
    null,
    { durationTicks: 0, wagePerWeekMinor: 1, signingBonusMinor: 0, squadRole: 'rotation' },
    { durationTicks: 1, wagePerWeekMinor: -1, signingBonusMinor: 0, squadRole: 'rotation' },
    { durationTicks: 1, wagePerWeekMinor: 1, signingBonusMinor: -1, squadRole: 'rotation' },
    { durationTicks: 1, wagePerWeekMinor: 1, signingBonusMinor: 0, squadRole: '' },
    {
      durationTicks: 1, wagePerWeekMinor: 1, signingBonusMinor: 0,
      squadRole: 'rotation', releaseFeeMinor: Number.NaN,
    },
  ];

  for (const terms of invalidTerms) {
    const state = makeState();
    const snapshot = structuredClone(state);
    assert.throws(() => counterContractOffer(state, 'negotiation-1', terms), /contract terms/i);
    assert.deepEqual(state, snapshot);
  }
});

test('acceptContractOffer rejects stored malformed terms before creating a contract', () => {
  const state = makeState();
  delete state.negotiationsById['negotiation-1'].terms.durationTicks;
  const snapshot = structuredClone(state);

  assert.throws(() => acceptContractOffer(state, 'negotiation-1'), /contract terms/i);
  assert.deepEqual(state, snapshot);
});

test('acceptContractOffer rejects malformed destinations and active registrations atomically', () => {
  const cases = [
    (state) => { state.clubsById['club-redbrook'].teamIds = []; },
    (state) => { state.teamsById['team-redbrook-senior'].level = 'youth'; },
    (state) => {
      state.registrationsById['registration-existing'] = {
        id: 'registration-existing', personId: 'person-player', teamId: 'team-redbrook-senior',
        kind: 'permanent', active: true,
      };
    },
  ];

  for (const prepare of cases) {
    const state = makeState();
    prepare(state);
    const snapshot = structuredClone(state);
    assert.throws(() => acceptContractOffer(state, 'negotiation-1'));
    assert.deepEqual(state, snapshot);
  }
});

test('expireContracts marks active contracts whose endTick has passed as expired, leaving future and non-active contracts unchanged and the input untouched', () => {
  const state = makeState({
    clock: { tick: 700, year: 2028, quarterIndex: 0, week: 1 },
    contractsById: {
      'contract-past': {
        id: 'contract-past', personId: 'person-player', clubId: 'club-redbrook',
        status: 'active', kind: 'professional', startTick: 500, endTick: 628,
        wagePerWeekMinor: 180000, signingBonusMinor: 200000, squadRole: 'prospect',
        releaseFeeMinor: null, parentContractId: null,
      },
      'contract-exact': {
        id: 'contract-exact', personId: 'person-player', clubId: 'club-redbrook',
        status: 'active', kind: 'professional', startTick: 500, endTick: 700,
        wagePerWeekMinor: 180000, signingBonusMinor: 200000, squadRole: 'prospect',
        releaseFeeMinor: null, parentContractId: null,
      },
      'contract-future': {
        id: 'contract-future', personId: 'person-player', clubId: 'club-redbrook',
        status: 'active', kind: 'professional', startTick: 500, endTick: 900,
        wagePerWeekMinor: 180000, signingBonusMinor: 200000, squadRole: 'prospect',
        releaseFeeMinor: null, parentContractId: null,
      },
      'contract-already-expired': {
        id: 'contract-already-expired', personId: 'person-player', clubId: 'club-redbrook',
        status: 'expired', kind: 'professional', startTick: 100, endTick: 200,
        wagePerWeekMinor: 180000, signingBonusMinor: 200000, squadRole: 'prospect',
        releaseFeeMinor: null, parentContractId: null,
      },
    },
  });
  const contractsBefore = state.contractsById;

  const next = expireContracts(state);

  assert.notEqual(next, state);
  assert.equal(state.contractsById, contractsBefore);
  assert.equal(state.contractsById['contract-past'].status, 'active');

  assert.equal(next.contractsById['contract-past'].status, 'expired');
  assert.equal(next.contractsById['contract-exact'].status, 'expired');
  assert.equal(next.contractsById['contract-future'].status, 'active');
  assert.equal(next.contractsById['contract-already-expired'].status, 'expired');
});

test('contract operations fail clearly instead of throwing a TypeError when contractsById is missing', () => {
  const state = makeState();
  delete state.contractsById;

  assert.throws(
    () => acceptContractOffer(state, 'negotiation-1'),
    /contractsById must be an object/,
  );
  assert.throws(
    () => expireContracts(state),
    /contractsById must be an object/,
  );
});
