import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptTransferOffer,
  acceptTransferOfferWithResult,
} from '../src/engines/transferEngine.js';

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
    teamsById: {
      'team-redbrook-senior': { id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior', squadPersonIds: ['person-player'] },
      'team-rheintal-senior': { id: 'team-rheintal-senior', clubId: 'club-rheintal', level: 'senior', squadPersonIds: [] },
    },
    clubsById: {
      'club-redbrook': {
        id: 'club-redbrook', name: 'Redbrook Town FC', countryId: 'england',
        reputation: 340, finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 10000000 },
      },
      'club-rheintal': {
        id: 'club-rheintal', name: 'Rheintal FC', countryId: 'switzerland',
        reputation: 300, finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 8000000 },
      },
    },
    contractsById: {
      'contract-1': {
        id: 'contract-1', personId: 'person-player', clubId: 'club-redbrook',
        status: 'active', kind: 'professional', startTick: 400, endTick: 900,
        wagePerWeekMinor: 100000, signingBonusMinor: 0, squadRole: 'starter',
        releaseFeeMinor: null, parentContractId: null,
      },
    },
    registrationsById: {
      'registration-1': {
        id: 'registration-1', personId: 'person-player', teamId: 'team-redbrook-senior',
        kind: 'permanent', startTick: 400, endTick: null, parentClubId: null, active: true,
      },
    },
    negotiationsById: {
      'negotiation-t1': {
        id: 'negotiation-t1', kind: 'transfer', personId: 'person-player',
        fromClubId: 'club-redbrook', toClubId: 'club-rheintal', toTeamId: 'team-rheintal-senior',
        createdTick: 490, expiresTick: 510, status: 'open',
        terms: {
          transferFeeMinor: 3000000, durationTicks: 128,
          wagePerWeekMinor: 150000, signingBonusMinor: 50000, squadRole: 'starter',
        },
      },
    },
    idCounters: {},
    ...overrides,
  };
}

test('acceptTransferOffer atomically moves contract ownership and registration to the buying club while conserving the transfer fee, without mutating the input', () => {
  const state = makeState();
  const clubsBefore = state.clubsById;
  const contractsBefore = state.contractsById;
  const registrationsBefore = state.registrationsById;
  const totalFundsBefore =
    state.clubsById['club-redbrook'].finances.transferBudgetMinor +
    state.clubsById['club-rheintal'].finances.transferBudgetMinor;

  const next = acceptTransferOffer(state, 'negotiation-t1');

  assert.notEqual(next, state);
  assert.equal(state.clubsById, clubsBefore);
  assert.equal(state.contractsById, contractsBefore);
  assert.equal(state.registrationsById, registrationsBefore);

  assert.equal(next.contractsById['contract-1'].status, 'terminated');

  const newContracts = Object.values(next.contractsById).filter(
    (c) => c.personId === 'person-player' && c.status === 'active',
  );
  assert.equal(newContracts.length, 1);
  const [newContract] = newContracts;
  assert.equal(newContract.clubId, 'club-rheintal');
  assert.equal(newContract.wagePerWeekMinor, 150000);
  assert.equal(newContract.signingBonusMinor, 50000);
  assert.equal(newContract.squadRole, 'starter');
  assert.equal(newContract.startTick, 500);
  assert.equal(newContract.endTick, 628);

  assert.equal(next.registrationsById['registration-1'].active, false);
  const newRegistrations = Object.values(next.registrationsById).filter(
    (r) => r.personId === 'person-player' && r.active,
  );
  assert.equal(newRegistrations.length, 1);
  const [newRegistration] = newRegistrations;
  assert.equal(newRegistration.teamId, 'team-rheintal-senior');
  assert.equal(newRegistration.parentClubId, null);

  assert.equal(next.clubsById['club-redbrook'].finances.transferBudgetMinor, 13000000);
  assert.equal(next.clubsById['club-rheintal'].finances.transferBudgetMinor, 5000000);
  const totalFundsAfter =
    next.clubsById['club-redbrook'].finances.transferBudgetMinor +
    next.clubsById['club-rheintal'].finances.transferBudgetMinor;
  assert.equal(totalFundsAfter, totalFundsBefore);

  assert.equal(next.negotiationsById['negotiation-t1'].status, 'accepted');
});

test('acceptTransferOfferWithResult exposes the exact contract and registration created by the transition', () => {
  const state = makeState();
  state.contractsById['contract-9'] = {
    id: 'contract-9', personId: 'person-other', clubId: 'club-rheintal', status: 'active',
  };
  state.registrationsById['registration-7'] = {
    id: 'registration-7', personId: 'person-other', teamId: 'team-rheintal-senior', active: true,
  };

  const result = acceptTransferOfferWithResult(state, 'negotiation-t1');

  assert.equal(result.contractId, 'contract-10');
  assert.equal(result.registrationId, 'registration-8');
  assert.equal(result.state.contractsById[result.contractId].personId, 'person-player');
  assert.equal(result.state.registrationsById[result.registrationId].personId, 'person-player');
});

test('acceptTransferOffer rejects an insufficient buying-club transfer budget without mutating any state', () => {
  const state = makeState();
  state.negotiationsById['negotiation-t1'].terms.transferFeeMinor = 999000000;
  const clubsBefore = state.clubsById;
  const contractsBefore = state.contractsById;
  const registrationsBefore = state.registrationsById;
  const negotiationsBefore = state.negotiationsById;

  assert.throws(
    () => acceptTransferOffer(state, 'negotiation-t1'),
    /transfer budget/i,
  );

  assert.equal(state.clubsById, clubsBefore);
  assert.equal(state.contractsById, contractsBefore);
  assert.equal(state.registrationsById, registrationsBefore);
  assert.equal(state.negotiationsById, negotiationsBefore);
});

// Mobility slice — person.career pointer update on transfer acceptance.
// ContractEngine already does this; transferEngine did not. After this
// slice the accepting player's canonical career pointer must flip to
// the buying club so Home/Football and downstream epilogue cards read
// consistent "current" data. Stage stays 'senior' (the player has not
// retired — they have just moved clubs).
test('acceptTransferOffer updates person.career pointers to the buying club while keeping stage=senior', () => {
  const state = makeState();
  const before = structuredClone(state.peopleById['person-player'].career);

  const next = acceptTransferOffer(state, 'negotiation-t1');

  const after = next.peopleById['person-player'].career;
  assert.notDeepEqual(after, before, 'career block must change on transfer acceptance');
  assert.equal(after.stage, 'senior', 'career stage must remain senior — transfer is not a promotion/demotion event');
  assert.equal(after.currentTeamId, 'team-rheintal-senior');
  // The contractId is a fresh allocation; recompute from the next state's
  // contractsById and confirm the pointer matches the player's new active contract.
  const newActiveContractId = Object.values(next.contractsById).find(
    (c) => c.personId === 'person-player' && c.status === 'active',
  ).id;
  assert.equal(after.currentContractId, newActiveContractId);
  assert.equal(after.parentClubTeamId, null, 'transfer is permanent — parent club pointer must be null');
  assert.equal(after.loanTeamId, null, 'transfer is permanent — loan pointer must be null');
});

// Atomic-failure regression: a failed acceptance must NOT touch the
// person's career pointer at all, so a stale "current club" never
// appears in the UI as a side-effect of the rejection. Mirrors the
// contractEngine "active owning contract" guard.
test('acceptTransferOffer failure leaves person.career pointers untouched', () => {
  const state = makeState();
  state.negotiationsById['negotiation-t1'].terms.transferFeeMinor = 999000000;
  const before = structuredClone(state.peopleById['person-player'].career);

  assert.throws(() => acceptTransferOffer(state, 'negotiation-t1'), /transfer budget/i);

  const after = state.peopleById['person-player'].career;
  assert.deepEqual(after, before, 'career block must remain byte-identical on failed acceptance');
});

// Defensive guard (raised by Claude review on 2026-07-15): a transfer
// whose origin and destination are the same club is a no-op for
// budget accounting — the post-buying-club write would overwrite
// the post-selling-club write using un-debited original finances,
// netting to a zero budget change while the engine still flips
// ownership. The happy path does not generate such offers, but the
// engine MUST throw cleanly so the bug is caught at the boundary
// rather than silently corrupting club finances.
test('acceptTransferOffer rejects same-club (origin === destination) transfers atomically', () => {
  const state = makeState();
  state.negotiationsById['negotiation-t1'].fromClubId = 'club-redbrook';
  state.negotiationsById['negotiation-t1'].toClubId = 'club-redbrook';
  state.negotiationsById['negotiation-t1'].toTeamId = 'team-redbrook-senior';
  const snapshot = structuredClone(state);

  assert.throws(
    () => acceptTransferOffer(state, 'negotiation-t1'),
    /origin and destination are the same club/i,
  );
  assert.deepEqual(state, snapshot, 'state must remain byte-identical on rejection');
});
