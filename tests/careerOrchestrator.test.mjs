import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduceCareerCommand } from '../src/engines/careerOrchestrator.js';

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
      'person-free-agent': {
        id: 'person-free-agent',
        career: {
          stage: 'grassroots',
          currentTeamId: null,
          currentContractId: null,
          parentClubTeamId: null,
          loanTeamId: null,
        },
      },
    },
    clubsById: {
      'club-redbrook': {
        id: 'club-redbrook', teamIds: ['team-redbrook-senior'],
        finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 10000000 },
      },
      'club-rheintal': {
        id: 'club-rheintal', teamIds: ['team-rheintal-senior'],
        finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 8000000 },
      },
    },
    teamsById: {
      'team-redbrook-senior': {
        id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior', squadPersonIds: ['person-player'],
      },
      'team-rheintal-senior': {
        id: 'team-rheintal-senior', clubId: 'club-rheintal', level: 'senior', squadPersonIds: [],
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
      'negotiation-transfer-1': {
        id: 'negotiation-transfer-1', kind: 'transfer', personId: 'person-player',
        fromClubId: 'club-redbrook', toClubId: 'club-rheintal',
        toTeamId: 'team-rheintal-senior', createdTick: 490, expiresTick: 510,
        status: 'open',
        terms: {
          transferFeeMinor: 3000000, durationTicks: 128,
          wagePerWeekMinor: 150000, signingBonusMinor: 50000, squadRole: 'starter',
        },
      },
      'negotiation-contract-1': {
        id: 'negotiation-contract-1', kind: 'professional-offer', personId: 'person-free-agent',
        fromClubId: 'club-rheintal', toClubId: 'club-rheintal',
        createdTick: 490, expiresTick: 510, status: 'open',
        terms: {
          durationTicks: 96, wagePerWeekMinor: 120000,
          signingBonusMinor: 40000, squadRole: 'rotation', releaseFeeMinor: 5000000,
        },
        roundsUsed: 0, maxRounds: 2,
      },
    },
    ledger: [],
    idCounters: {},
    ...overrides,
  };
}

test('ACCEPT_CONTRACT delegates acceptance and emits one deterministic event with the created contract ID', () => {
  const state = makeState();
  const snapshot = structuredClone(state);
  const command = { type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1' };

  const first = reduceCareerCommand(state, command);
  const retry = reduceCareerCommand(state, command);

  assert.deepEqual(state, snapshot);
  assert.deepEqual(first, retry);
  assert.equal(first.state.negotiationsById['negotiation-contract-1'].status, 'accepted');
  assert.deepEqual(first.events, [{
    id: 'event-1', tick: 500, type: 'CONTRACT_ACCEPTED',
    refs: {
      negotiationId: 'negotiation-contract-1', personId: 'person-free-agent',
      clubId: 'club-rheintal', contractId: 'contract-2', registrationId: 'registration-2',
    },
    payload: {
      durationTicks: 96, wagePerWeekMinor: 120000,
      signingBonusMinor: 40000, squadRole: 'rotation', releaseFeeMinor: 5000000,
    },
  }]);
  assert.deepEqual(first.state.ledger, first.events);
});

test('REJECT_CONTRACT delegates rejection and emits one deterministic event with round metadata', () => {
  const state = makeState();
  const snapshot = structuredClone(state);

  const result = reduceCareerCommand(state, {
    type: 'REJECT_CONTRACT', negotiationId: 'negotiation-contract-1',
  });

  assert.deepEqual(state, snapshot);
  assert.equal(result.state.negotiationsById['negotiation-contract-1'].status, 'rejected');
  assert.deepEqual(result.events, [{
    id: 'event-1', tick: 500, type: 'CONTRACT_REJECTED',
    refs: {
      negotiationId: 'negotiation-contract-1', personId: 'person-free-agent',
      clubId: 'club-rheintal',
    },
    payload: { roundsUsed: 0 },
  }]);
});

test('COUNTER_CONTRACT delegates terms and emits one deterministic event with the consumed round', () => {
  const state = makeState();
  const snapshot = structuredClone(state);
  const terms = {
    durationTicks: 128, wagePerWeekMinor: 140000,
    signingBonusMinor: 60000, squadRole: 'starter', releaseFeeMinor: null,
  };

  const result = reduceCareerCommand(state, {
    type: 'COUNTER_CONTRACT', negotiationId: 'negotiation-contract-1', terms,
  });

  assert.deepEqual(state, snapshot);
  assert.deepEqual(result.state.negotiationsById['negotiation-contract-1'].terms, terms);
  assert.deepEqual(result.events, [{
    id: 'event-1', tick: 500, type: 'CONTRACT_COUNTERED',
    refs: {
      negotiationId: 'negotiation-contract-1', personId: 'person-free-agent',
      clubId: 'club-rheintal',
    },
    payload: { terms, roundsUsed: 1, maxRounds: 2 },
  }]);
});

test('COUNTER_CONTRACT rejects malformed terms atomically', () => {
  const state = makeState();
  const snapshot = structuredClone(state);

  assert.throws(
    () => reduceCareerCommand(state, {
      type: 'COUNTER_CONTRACT', negotiationId: 'negotiation-contract-1', terms: null,
    }),
    /contract terms/i,
  );
  assert.deepEqual(state, snapshot);
});

test('contract response engine failures are atomic and emit no ledger event', () => {
  const terms = makeState().negotiationsById['negotiation-contract-1'].terms;
  const cases = [
    [{ type: 'ACCEPT_CONTRACT', negotiationId: 'missing-contract-offer' }, /unknown negotiation/i, null],
    [{ type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1' }, /expired/i,
      (state) => { state.clock.tick = 511; }],
    [{ type: 'REJECT_CONTRACT', negotiationId: 'negotiation-contract-1' }, /not open/i,
      (state) => { state.negotiationsById['negotiation-contract-1'].status = 'rejected'; }],
    [{ type: 'REJECT_CONTRACT', negotiationId: 'negotiation-contract-1' }, /expired/i,
      (state) => { state.clock.tick = 511; }],
    [{ type: 'REJECT_CONTRACT', negotiationId: 'negotiation-loan-1' }, /not a contract offer/i, null],
    [{ type: 'COUNTER_CONTRACT', negotiationId: 'negotiation-contract-1', terms }, /round limit/i,
      (state) => { state.negotiationsById['negotiation-contract-1'].roundsUsed = 2; }],
  ];

  for (const [command, expected, arrange] of cases) {
    const state = makeState();
    state.ledger.push({ id: 'event-4', tick: 490, type: 'CAREER_STARTED', refs: {}, payload: {} });
    state.idCounters.event = 4;
    arrange?.(state);
    const snapshot = structuredClone(state);

    assert.throws(() => reduceCareerCommand(state, command), expected);
    assert.deepEqual(state, snapshot);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.idCounters.event, 4);
  }
});

test('ACCEPT_TRANSFER delegates the atomic transition and appends one deterministic emitted ledger event', () => {
  const state = makeState();
  const priorEvent = {
    id: 'event-8', tick: 490, type: 'CAREER_STARTED', refs: {}, payload: {},
  };
  state.ledger.push(priorEvent);
  state.idCounters.event = 3;
  const snapshot = structuredClone(state);
  const command = { type: 'ACCEPT_TRANSFER', negotiationId: 'negotiation-transfer-1' };

  const first = reduceCareerCommand(state, command);
  const retry = reduceCareerCommand(state, command);

  assert.deepEqual(state, snapshot);
  assert.deepEqual(first, retry);
  assert.equal(first.state.negotiationsById['negotiation-transfer-1'].status, 'accepted');
  assert.equal(first.state.contractsById['contract-1'].status, 'terminated');
  assert.equal(first.state.contractsById['contract-2'].clubId, 'club-rheintal');
  assert.equal(first.state.registrationsById['registration-2'].teamId, 'team-rheintal-senior');
  assert.equal(first.state.clubsById['club-redbrook'].finances.transferBudgetMinor, 13000000);
  assert.equal(first.state.clubsById['club-rheintal'].finances.transferBudgetMinor, 5000000);
  assert.deepEqual(first.events, [{
    id: 'event-9',
    tick: 500,
    type: 'TRANSFER_ACCEPTED',
    refs: {
      negotiationId: 'negotiation-transfer-1',
      personId: 'person-player',
      fromClubId: 'club-redbrook',
      toClubId: 'club-rheintal',
      contractId: 'contract-2',
      registrationId: 'registration-2',
    },
    payload: {
      transferFeeMinor: 3000000,
      durationTicks: 128,
      wagePerWeekMinor: 150000,
      signingBonusMinor: 50000,
      squadRole: 'starter',
    },
  }]);
  assert.deepEqual(first.state.ledger, [priorEvent, ...first.events]);
  assert.equal(first.state.idCounters.event, 9);

  // Mobility slice: the orchestrator's ACCEPT_TRANSFER must cascade
  // through transferEngine and flip person.career to the buying club.
  // Stage, when defined, is preserved (a transfer is not a promotion
  // or demotion event).
  const careerAfter = first.state.peopleById['person-player'].career;
  const stageBefore = state.peopleById['person-player'].career.stage;
  assert.equal(careerAfter.currentTeamId, 'team-rheintal-senior');
  assert.equal(careerAfter.currentContractId, 'contract-2');
  assert.equal(careerAfter.parentClubTeamId, null);
  assert.equal(careerAfter.loanTeamId, null);
  assert.equal(careerAfter.stage, stageBefore, 'career stage must NOT be changed by a transfer');
});

test('invalid or stale ACCEPT_TRANSFER commands fail atomically without events', () => {
  const cases = [
    ['missing-transfer', /unknown negotiation/i],
    ['negotiation-transfer-1', /negotiation is not open/i],
  ];

  for (const [negotiationId, expected] of cases) {
    const state = makeState();
    if (negotiationId === 'negotiation-transfer-1') {
      state.negotiationsById[negotiationId].status = 'accepted';
    }
    const snapshot = structuredClone(state);

    assert.throws(
      () => reduceCareerCommand(state, { type: 'ACCEPT_TRANSFER', negotiationId }),
      expected,
    );
    assert.deepEqual(state, snapshot);
    assert.deepEqual(state.ledger, []);
  }
});

test('ACCEPT_TRANSFER with insufficient budget fails atomically without emitting an event', () => {
  const state = makeState();
  const priorEvent = {
    id: 'event-4', tick: 490, type: 'CAREER_STARTED', refs: {}, payload: {},
  };
  state.ledger.push(priorEvent);
  state.idCounters.event = 4;
  state.clubsById['club-rheintal'].finances.transferBudgetMinor = 2999999;
  const snapshot = structuredClone(state);

  assert.throws(
    () => reduceCareerCommand(state, {
      type: 'ACCEPT_TRANSFER', negotiationId: 'negotiation-transfer-1',
    }),
    /insufficient transfer budget/i,
  );
  assert.deepEqual(state, snapshot);
  assert.deepEqual(state.ledger, [priorEvent]);
  assert.equal(state.idCounters.event, 4);
});

test('ACCEPT_LOAN delegates the transition and appends one deterministic emitted ledger event', () => {
  const state = makeState();
  const snapshot = structuredClone(state);
  const command = { type: 'ACCEPT_LOAN', negotiationId: 'negotiation-loan-1' };

  const first = reduceCareerCommand(state, command);
  const retry = reduceCareerCommand(state, command);

  assert.deepEqual(state, snapshot);
  assert.deepEqual(first, retry);
  assert.equal(first.state.negotiationsById['negotiation-loan-1'].status, 'accepted');
  assert.equal(first.state.registrationsById['registration-2'].kind, 'loan');
  assert.deepEqual(first.events, [{
    id: 'event-1',
    tick: 500,
    type: 'LOAN_ACCEPTED',
    refs: {
      negotiationId: 'negotiation-loan-1',
      personId: 'person-player',
      registrationId: 'registration-2',
      fromClubId: 'club-redbrook',
      toClubId: 'club-rheintal',
    },
    payload: { endTick: 532 },
  }]);
  assert.deepEqual(first.state.ledger, first.events);
  assert.equal(first.state.idCounters.event, 1);
});

test('PROCESS_DUE_LOANS returns loans at the current tick and emits each return exactly once', () => {
  const accepted = reduceCareerCommand(makeState(), {
    type: 'ACCEPT_LOAN', negotiationId: 'negotiation-loan-1',
  }).state;
  accepted.clock.tick = 532;
  const snapshot = structuredClone(accepted);

  const returned = reduceCareerCommand(accepted, { type: 'PROCESS_DUE_LOANS' });

  assert.deepEqual(accepted, snapshot);
  assert.equal(returned.state.clock.tick, 532);
  assert.equal(returned.state.registrationsById['registration-2'].active, false);
  assert.deepEqual(returned.events, [{
    id: 'event-2',
    tick: 532,
    type: 'LOAN_RETURNED',
    refs: {
      personId: 'person-player',
      registrationId: 'registration-2',
      parentClubId: 'club-redbrook',
      fromTeamId: 'team-rheintal-senior',
      toTeamId: 'team-redbrook-senior',
    },
    payload: { scheduledEndTick: 532 },
  }]);
  assert.deepEqual(returned.state.ledger, [...accepted.ledger, ...returned.events]);

  const reprocessed = reduceCareerCommand(returned.state, { type: 'PROCESS_DUE_LOANS' });
  assert.deepEqual(reprocessed.state, returned.state);
  assert.deepEqual(reprocessed.events, []);
});

test('PROCESS_DUE_LOANS emits simultaneous returns in numeric registration order', () => {
  const accepted = reduceCareerCommand(makeState(), {
    type: 'ACCEPT_LOAN', negotiationId: 'negotiation-loan-1',
  }).state;
  accepted.clock.tick = 532;
  accepted.peopleById['person-second'] = {
    id: 'person-second',
    career: {
      currentTeamId: 'team-rheintal-senior', currentContractId: 'contract-2',
      parentClubTeamId: 'team-redbrook-senior', loanTeamId: 'team-rheintal-senior',
    },
  };
  accepted.contractsById['contract-2'] = {
    id: 'contract-2', personId: 'person-second', clubId: 'club-redbrook', status: 'active',
  };
  accepted.registrationsById['registration-9'] = {
    id: 'registration-9', personId: 'person-second', teamId: 'team-redbrook-senior',
    kind: 'permanent', startTick: 400, endTick: 500, parentClubId: null, active: false,
  };
  accepted.registrationsById['registration-10'] = {
    id: 'registration-10', personId: 'person-second', teamId: 'team-rheintal-senior',
    kind: 'loan', startTick: 500, endTick: 532, parentClubId: 'club-redbrook', active: true,
  };
  accepted.teamsById['team-rheintal-senior'].squadPersonIds.push('person-second');

  const result = reduceCareerCommand(accepted, { type: 'PROCESS_DUE_LOANS' });

  assert.deepEqual(result.events.map((event) => event.refs.registrationId), [
    'registration-2', 'registration-10',
  ]);
});

test('malformed and unknown commands fail clearly without mutating state', () => {
  const cases = [
    [null, /command must be an object/i],
    [{}, /command type must be a non-empty string/i],
    [{ type: 'ACCEPT_TRANSFER' }, /negotiationId must be a non-empty string/i],
    [{ type: 'ACCEPT_LOAN' }, /negotiationId must be a non-empty string/i],
    [{ type: 'ACCEPT_CONTRACT' }, /negotiationId must be a non-empty string/i],
    [{ type: 'REJECT_CONTRACT' }, /negotiationId must be a non-empty string/i],
    [{ type: 'COUNTER_CONTRACT' }, /negotiationId must be a non-empty string/i],
    [{ type: 'DO_MAGIC' }, /unknown career command: DO_MAGIC/i],
  ];

  for (const [command, expected] of cases) {
    const state = makeState();
    const snapshot = structuredClone(state);
    assert.throws(() => reduceCareerCommand(state, command), expected);
    assert.deepEqual(state, snapshot);
  }
});
