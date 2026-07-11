import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptContractOffer, expireContracts } from '../src/engines/contractEngine.js';

function makeState(overrides = {}) {
  return {
    schemaVersion: 2,
    clock: { tick: 500, year: 2028, quarterIndex: 0, week: 1 },
    peopleById: {
      'person-player': { id: 'person-player', kind: 'player' },
    },
    contractsById: {},
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
