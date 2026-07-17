// Tests for the post-expiry offer generator and the acceptTransferInAppState
// adapter — the two new seams added to careerStateAdapter.js to close the
// professional-mobility dead end. No mocks: the tests exercise the same
// engine factories the app uses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptTransferInAppState,
  createCareerStateForPlayer,
  generatePostExpiryOffers,
  recordPressConference,
} from '../src/engines/careerStateAdapter.js';
import { reduceCareerCommand } from '../src/engines/careerOrchestrator.js';
import { expireContracts } from '../src/engines/contractEngine.js';

function makePlayer(overrides = {}) {
  return {
    name: 'Alex Morgan', gender: 'nonbinary', country: 'England',
    age: 16, year: 2037, quarterIndex: 0,
    stats: { passing: 54, shooting: 61 }, hidden: { potential: 82 },
    ...overrides,
  };
}

// RED 1 — expire a professional contract and assert the generator
// produces at least one offer from another eligible senior club, never
// from the player's last club. Stable IDs and deterministic results on
// re-runs.
test('generatePostExpiryOffers returns up to two deterministic offers from other senior clubs after the player expires', () => {
  const player = makePlayer();
  const careerState = createCareerStateForPlayer(player, 44);
  // Accept the seeded Redbrook Town FC contract to put the player in the senior stage.
  const accepted = reduceCareerCommand(careerState, {
    type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1',
  }).state;
  // Force the contract to be eligible for expiry (endTick <= clock.tick).
  const playerContractId = Object.values(accepted.contractsById)
    .find((c) => c.personId === 'person-player' && c.status === 'active').id;
  accepted.contractsById[playerContractId].endTick = 45;
  accepted.clock.tick = 45;

  const first = generatePostExpiryOffers(accepted);
  const retry = generatePostExpiryOffers(first);
  const idsFirst = first.negotiationsById
    ? Object.keys(first.negotiationsById).filter((id) => id.startsWith('negotiation-offer-')).sort()
    : [];
  const idsRetry = retry.negotiationsById
    ? Object.keys(retry.negotiationsById).filter((id) => id.startsWith('negotiation-offer-')).sort()
    : [];

  assert.deepEqual(idsRetry, idsFirst, 'rerun must be byte-identical for reproducibility');
  assert.ok(idsFirst.length >= 1, 'expected at least one other-club offer after expiry');
  assert.ok(idsFirst.length <= 2, 'generator must cap at two offers per expiry event');

  const offers = Object.values(retry.negotiationsById)
    .filter((n) => idsFirst.includes(n.id) && n.personId === 'person-player' && n.status === 'open');
  const playerClubs = new Set(
    ['club-redbrook'].filter((id) => retry.clubsById?.[id]),
  );
  for (const offer of offers) {
    assert.equal(offer.kind, 'professional-offer');
    assert.notEqual(
      offer.toClubId, 'club-redbrook',
      'post-expiry offers must come from clubs other than the player\'s last club (redbrook)',
    );
    assert.ok(retry.clubsById?.[offer.toClubId], 'offer toClubId must reference an existing club');
    assert.equal(playerClubs.has(offer.toClubId), false, 'from-club must not match last club');
    assert.equal(typeof offer.terms.transferFeeMinor, 'number');
  }
});

// RED 2 — dedupe: if the player already has open offers, calling the
// generator again must NOT add duplicate offers for the same
// (toClubId, kind).
test('generatePostExpiryOffers is idempotent: rerunning after offers already exist does not duplicate', () => {
  const player = makePlayer();
  const careerState = createCareerStateForPlayer(player, 44);
  const accepted = reduceCareerCommand(careerState, {
    type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1',
  }).state;
  accepted.contractsById[Object.values(accepted.contractsById)
    .find((c) => c.personId === 'person-player' && c.status === 'active').id].endTick = 45;
  accepted.clock.tick = 45;

  const first = generatePostExpiryOffers(accepted);
  const firstOfferNegotiations = Object.values(first.negotiationsById)
    .filter((n) => n.id.startsWith('negotiation-offer-') && n.personId === 'person-player');
  assert.ok(firstOfferNegotiations.length >= 1, 'first run must produce an offer');

  const second = generatePostExpiryOffers(first);
  const secondOfferNegotiations = Object.values(second.negotiationsById)
    .filter((n) => n.id.startsWith('negotiation-offer-') && n.personId === 'person-player');
  assert.equal(
    secondOfferNegotiations.length, firstOfferNegotiations.length,
    'rerun must NOT add more offers for the same player',
  );
});

// Empty fallback: when no other senior clubs exist, the helper runs
// expireContracts (defensive) and then exits the offer-pool with no
// candidates. The returned state reflects the expiry side-effect (no
// offers inserted) but is otherwise a no-op on the offer pool.
test('generatePostExpiryOffers returns no offers when no alternative senior clubs exist', () => {
  const player = makePlayer();
  const careerState = createCareerStateForPlayer(player, 44);
  const accepted = reduceCareerCommand(careerState, {
    type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1',
  }).state;
  // Strip alternative clubs so the offer pool is empty (truthful "no offers" path).
  accepted.clubsById = {
    'club-redbrook': accepted.clubsById['club-redbrook'],
  };
  accepted.teamsById = {
    'team-redbrook-senior': accepted.teamsById['team-redbrook-senior'],
  };
  accepted.contractsById[Object.values(accepted.contractsById)
    .find((c) => c.personId === 'person-player' && c.status === 'active').id].endTick = 45;
  accepted.clock.tick = 45;
  // Build the expected post-helper state by mirroring the only side-effect
  // we expect: the defensive expireContracts pass. After that, no offer
  // pool changes.
  const expectedAfter = expireContracts(accepted);

  const result = generatePostExpiryOffers(accepted);

  const newOffers = Object.values(result.negotiationsById)
    .filter((n) => n.id.startsWith('negotiation-offer-') && n.personId === 'person-player');
  assert.equal(newOffers.length, 0, 'no other-club offers when no other senior clubs exist');
  assert.deepEqual(result, expectedAfter, 'state must equal post-expireContracts state with no offer-insert side effect');
});

// RED 4 — pure: input is never mutated.
test('generatePostExpiryOffers never mutates input state', () => {
  const player = makePlayer();
  const careerState = createCareerStateForPlayer(player, 44);
  const accepted = reduceCareerCommand(careerState, {
    type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1',
  }).state;
  accepted.contractsById[Object.values(accepted.contractsById)
    .find((c) => c.personId === 'person-player' && c.status === 'active').id].endTick = 45;
  accepted.clock.tick = 45;
  const snapshot = structuredClone(accepted);

  generatePostExpiryOffers(accepted);

  assert.deepEqual(accepted, snapshot, 'input state must remain byte-identical');
});

// RED 5 — gated: the generator must NOT fire when no active contract
// expired this tick (i.e. no expiry-just-happened signal). It is
// expected to be called once after expireContracts; reruns without a
// fresh expiry must not produce offers out of nothing.
test('generatePostExpiryOffers does not invent offers when no contract has just expired', () => {
  const player = makePlayer();
  const careerState = createCareerStateForPlayer(player, 44);
  // No contract at all — never signed anyone.
  const snapshot = structuredClone(careerState);
  const result = generatePostExpiryOffers(careerState);

  const newOffers = Object.values(result.negotiationsById)
    .filter((n) => n.id.startsWith('negotiation-offer-') && n.personId === 'person-player');
  assert.equal(newOffers.length, 0, 'generator must be quiescent when no expiry triggered the call');
  assert.deepEqual(result, snapshot, 'state must be byte-identical when generator is quiescent');
});

// RED 6 — acceptTransferInAppState: mirrors the contract pattern,
// updates careerPointer implicitly via the orchestrator + transferEngine
// cascade, and writes a truthful careerHistory/quarterEvidence.
test('acceptTransferInAppState mirrors the transfer orchestrator result to appState.player (club, pathway, history, evidence)', () => {
  const player = makePlayer({ club: 'Redbrook Town FC', pathway: 'Senior team' });
  const careerState = createCareerStateForPlayer(player, 44);
  const accepted = reduceCareerCommand(careerState, {
    type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1',
  }).state;
  // Plant a second senior club so a transfer target exists.
  accepted.clubsById['club-hartshill'] = {
    id: 'club-hartshill',
    name: 'Hartshill United',
    countryId: 'england',
    teamIds: ['team-hartshill-senior'],
    finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 10000000 },
  };
  accepted.teamsById['team-hartshill-senior'] = {
    id: 'team-hartshill-senior', clubId: 'club-hartshill', level: 'senior', squadPersonIds: [],
  };
  // Plant a transfer negotiation (state already keeps the active contract).
  accepted.contractsById[Object.values(accepted.contractsById)
    .find((c) => c.personId === 'person-player' && c.status === 'active').id].endTick = 900;
  accepted.negotiationsById['negotiation-transfer-1'] = {
    id: 'negotiation-transfer-1',
    kind: 'transfer',
    personId: 'person-player',
    fromClubId: 'club-redbrook',
    toClubId: 'club-hartshill',
    toTeamId: 'team-hartshill-senior',
    createdTick: 44,
    expiresTick: 60,
    status: 'open',
    terms: {
      transferFeeMinor: 1500000, durationTicks: 96,
      wagePerWeekMinor: 130000, signingBonusMinor: 30000, squadRole: 'starter',
    },
  };

  const appState = {
    player: structuredClone(player),
    careerState: accepted,
    quarterEvidence: [],
    quarterCounter: 44,
  };
  const persisted = [];
  const next = acceptTransferInAppState(
    appState,
    'negotiation-transfer-1',
    (n) => persisted.push(n),
  );

  // player.club updated
  assert.equal(next.player.club, 'Hartshill United');
  assert.equal(next.player.pathway, 'Senior team');
  // careerHistory recorded
  const transferred = next.player.careerHistory.find((h) => h.type === 'transferred');
  assert.ok(transferred, 'careerHistory should record a transferred entry');
  assert.equal(transferred.from, 'Redbrook Town FC');
  assert.equal(transferred.to, 'Hartshill United');
  assert.equal(transferred.fee, 1500000);
  assert.equal(transferred.age, 16);
  assert.equal(transferred.year, 2037);
  // quarterEvidence recorded
  const moveEvidence = next.quarterEvidence.find((e) => e.kind === 'career');
  assert.ok(moveEvidence, 'quarterEvidence should record the career move');
  assert.match(moveEvidence.outcome, /Hartshill United/);
  // canonical career pointer flipped
  const careerAfter = next.careerState.peopleById['person-player'].career;
  assert.equal(careerAfter.currentTeamId, 'team-hartshill-senior');
  // TRANSFER_ACCEPTED ledger event present
  const transferEvent = next.careerState.ledger.find((e) => e.type === 'TRANSFER_ACCEPTED');
  assert.ok(transferEvent, 'TRANSFER_ACCEPTED event must be emitted by the orchestrator path');
  // TransferFeedback contract mirrors ContractFeedback shape
  assert.equal(next.transferFeedback.type, 'success');
  assert.match(next.transferFeedback.message, /Hartshill United/);
  // Persist called once on success.
  assert.equal(persisted.length, 1);
});

// RED 7 — acceptTransferInAppState failure path: atomic, no mutation of
// state, no spurious feedback, returns a transferFeedback with type 'error'.
test('acceptTransferInAppState failure leaves the appState canonical and player fields untouched', () => {
  const player = makePlayer({ club: 'Redbrook Town FC', pathway: 'Senior team' });
  const careerState = createCareerStateForPlayer(player, 44);
  const accepted = reduceCareerCommand(careerState, {
    type: 'ACCEPT_CONTRACT', negotiationId: 'negotiation-contract-1',
  }).state;
  accepted.clubsById['club-hartshill'] = {
    id: 'club-hartshill', name: 'Hartshill United', countryId: 'england',
    teamIds: ['team-hartshill-senior'],
    finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 10000000 },
  };
  accepted.teamsById['team-hartshill-senior'] = {
    id: 'team-hartshill-senior', clubId: 'club-hartshill', level: 'senior', squadPersonIds: [],
  };
  accepted.contractsById[Object.values(accepted.contractsById)
    .find((c) => c.personId === 'person-player' && c.status === 'active').id].endTick = 900;
  accepted.negotiationsById['negotiation-transfer-1'] = {
    id: 'negotiation-transfer-1',
    kind: 'transfer', personId: 'person-player',
    fromClubId: 'club-redbrook', toClubId: 'club-hartshill',
    toTeamId: 'team-hartshill-senior',
    createdTick: 44, expiresTick: 60, status: 'open',
    terms: {
      transferFeeMinor: 999000000, // impossible — triggers engine error.
      durationTicks: 96, wagePerWeekMinor: 130000,
      signingBonusMinor: 30000, squadRole: 'starter',
    },
  };

  const appState = {
    player: structuredClone(player),
    careerState: accepted,
    quarterEvidence: [{ kind: 'training', label: 'Pre-season', id: '43-0' }],
    quarterCounter: 44,
  };
  const snapshot = structuredClone(appState);
  let saves = 0;
  const result = acceptTransferInAppState(
    appState,
    'negotiation-transfer-1',
    () => { saves += 1; },
  );

  assert.equal(result.careerState, appState.careerState, 'careerState reference must not change on failure');
  assert.equal(result.player, appState.player, 'player reference must not change on failure');
  assert.equal(result.player.club, 'Redbrook Town FC');
  assert.equal(result.player.pathway, 'Senior team');
  assert.equal(result.quarterEvidence, appState.quarterEvidence, 'quarterEvidence must be untouched');
  assert.deepEqual(appState, snapshot, 'input appState must be byte-identical on failure');
  assert.equal(saves, 0, 'persist must not be invoked on failure');
  assert.equal(result.transferFeedback.type, 'error');
  assert.match(result.transferFeedback.message, /transfer budget|insufficient|fee/i);
});

// RED 8 — recordPressConference: once-only per (milestone, ledgerEventId)
// pair. Subsequent calls with the same tuple are no-ops.
test('recordPressConference is once-only per (milestone, ledgerEventId) pair', () => {
  const careerState = {
    schemaVersion: 2,
    pressConferences: [],
  };
  const first = recordPressConference(careerState, {
    milestone: 'transfer-accepted',
    ledgerEventId: 'event-42',
    question: 'How does it feel to join a new club?',
    choiceId: 'professional',
    choiceLabel: 'I am here to work hard.',
    effects: { confidenceDelta: 1, relationshipTargetId: 'coach', relationshipDelta: 0.05 },
  });
  const second = recordPressConference(first, {
    milestone: 'transfer-accepted',
    ledgerEventId: 'event-42',
    question: 'How does it feel to join a new club?',
    choiceId: 'gracious',
    choiceLabel: 'I am grateful for the opportunity.',
    effects: { confidenceDelta: 0, relationshipTargetId: 'coach', relationshipDelta: 0.10 },
  });

  assert.equal(first.pressConferences.length, 1);
  assert.equal(second.pressConferences.length, 1, 'duplicate fires must be ignored');
  assert.equal(second.pressConferences[0].choiceId, 'professional', 'first record wins');
});

// RED 9 — recordPressConference accepts a fresh ledgerEventId and
// appends it. The list is append-only.
test('recordPressConference appends a new record when ledgerEventId is fresh', () => {
  const careerState = {
    schemaVersion: 2,
    pressConferences: [],
  };
  const first = recordPressConference(careerState, {
    milestone: 'transfer-accepted',
    ledgerEventId: 'event-42',
    question: 'Q1', choiceId: 'a', choiceLabel: 'A',
    effects: {},
  });
  const second = recordPressConference(first, {
    milestone: 'contract-accepted',
    ledgerEventId: 'event-99',
    question: 'Q2', choiceId: 'b', choiceLabel: 'B',
    effects: { confidenceDelta: 1 },
  });

  assert.equal(second.pressConferences.length, 2);
  assert.equal(second.pressConferences[0].ledgerEventId, 'event-42');
  assert.equal(second.pressConferences[1].ledgerEventId, 'event-99');
});
