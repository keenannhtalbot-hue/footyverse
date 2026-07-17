import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptContractInAppState,
  counterContractInAppState,
  createCareerStateForPlayer,
  ensureCareerState,
  rejectContractInAppState,
  syncCareerState,
} from '../src/engines/careerStateAdapter.js';
import {
  getContractOffers,
  parseCounterTerms,
  renderContractInbox,
} from '../src/ui/contracts.js';
import { createEventHistory } from '../src/engines/eventEngine.js';
import { deserializeState, serializeState } from '../src/engines/stateSerializer.js';
import { deriveHomeObjectives, renderHomeDashboard } from '../src/ui/home.js';
import { render as renderFootball } from '../src/ui/football.js';
import { buildQuarterRecap } from '../src/engines/quarterRecap.js';

function makePlayer(overrides = {}) {
  return {
    name: 'Alex Morgan', gender: 'nonbinary', country: 'England',
    age: 16, year: 2037, quarterIndex: 0,
    stats: { passing: 54, shooting: 61 }, hidden: { potential: 82 },
    ...overrides,
  };
}

test('eligible players receive one deterministic professional offer with readable details', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const offers = getContractOffers(careerState);

  assert.equal(offers.length, 1);
  assert.equal(offers[0].clubName, 'Redbrook Town FC');
  assert.equal(offers[0].status, 'open');

  const html = renderContractInbox(careerState);
  assert.match(html, /Contract offers/);
  assert.match(html, /Redbrook Town FC/);
  assert.match(html, /Expires in 8 ticks/);
  assert.match(html, /2 years/);
  assert.match(html, /£1,200\/week/);
  assert.match(html, /£5,000/);
  assert.match(html, /Rotation/);
  assert.match(html, /£50,000/);
  assert.match(html, /2 counter rounds remaining/);
  assert.match(html, /aria-label="Accept contract offer from Redbrook Town FC"/);
});

test('career defaults are migration-safe and do not offer professional terms to children', () => {
  const legacy = { player: makePlayer({ age: 12 }), quarterCounter: 28 };
  const next = ensureCareerState(legacy);

  assert.equal(next.schemaVersion, 2);
  assert.deepEqual(next.negotiationsById, {});
  assert.match(renderContractInbox(next), /No contract offers right now/);
});

test('career clock sync creates the deterministic offer when the player becomes eligible', () => {
  const child = makePlayer({ age: 15, year: 2036 });
  const appState = { player: child, quarterCounter: 40 };
  appState.careerState = ensureCareerState(appState);
  appState.player = makePlayer({ age: 16, year: 2037 });
  appState.quarterCounter = 44;

  const synced = syncCareerState(appState);

  assert.equal(synced.clock.tick, 44);
  assert.equal(synced.negotiationsById['negotiation-contract-1'].status, 'open');
});

test('accept applies the orchestrator result once and only persists successful canonical state', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const appState = { player: makePlayer(), careerState };
  const persisted = [];

  const accepted = acceptContractInAppState(
    appState,
    'negotiation-contract-1',
    (next) => persisted.push(next),
  );

  assert.equal(appState.careerState.negotiationsById['negotiation-contract-1'].status, 'open');
  assert.equal(accepted.careerState.negotiationsById['negotiation-contract-1'].status, 'accepted');
  assert.equal(accepted.careerState.contractsById['contract-1'].status, 'active');
  assert.equal(accepted.careerState.ledger.at(-1).type, 'CONTRACT_ACCEPTED');
  assert.deepEqual(accepted.contractFeedback, {
    type: 'success', message: 'Contract accepted — welcome to Redbrook Town FC!',
  });
  assert.doesNotMatch(
    renderContractInbox(accepted.careerState, accepted.contractFeedback),
    /tabindex="-1"/,
    'persisted feedback must not steal focus on later renders',
  );
  assert.doesNotMatch(
    renderContractInbox(accepted.careerState, accepted.contractFeedback),
    /offer-feedback--success" role="status"/,
    'persisted feedback must not be re-announced on every render',
  );
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0], accepted);

  const retried = acceptContractInAppState(accepted, 'negotiation-contract-1', (next) => persisted.push(next));
  assert.equal(retried.careerState, accepted.careerState);
  assert.match(retried.contractFeedback.message, /not open/i);
  assert.equal(persisted.length, 1);
});

test('accepting the first professional contract completes and persists the senior club transition', () => {
  const player = makePlayer({
    club: 'Riverside Juniors',
    pathway: 'England youth pathway',
    quarter: 'Spring',
    ap: 12,
    apMax: 12,
    position: 'midfielder',
    injury: null,
    matchObservations: 8,
    careerHistory: [],
    storyLedger: [],
  });
  const appState = {
    player,
    careerState: createCareerStateForPlayer(player, 44),
    world: {},
    relationships: { coach: { name: 'Coach Rowan', personality: 'supportive' } },
    settings: {},
    quarterCounter: 44,
    seed: 'contract-transition',
    eventHistory: createEventHistory(),
  };
  assert.equal(appState.careerState.peopleById['person-player'].career.stage, 'grassroots');

  const accepted = acceptContractInAppState(appState, 'negotiation-contract-1', () => {});
  const career = accepted.careerState.peopleById['person-player'].career;
  const activeRegistrations = Object.values(accepted.careerState.registrationsById)
    .filter((registration) => registration.personId === 'person-player' && registration.active);

  assert.equal(Object.values(accepted.careerState.contractsById)
    .filter((contract) => contract.personId === 'person-player' && contract.status === 'active').length, 1);
  assert.equal(activeRegistrations.length, 1);
  assert.equal(activeRegistrations[0].kind, 'permanent');
  assert.equal(activeRegistrations[0].teamId, 'team-redbrook-senior');
  assert.deepEqual(
    accepted.careerState.teamsById['team-redbrook-senior'].squadPersonIds,
    ['person-player'],
  );
  assert.equal(career.currentContractId, 'contract-1');
  assert.equal(career.currentTeamId, 'team-redbrook-senior');
  assert.equal(career.stage, 'senior');
  assert.equal(accepted.careerState.negotiationsById['negotiation-contract-1'].status, 'accepted');
  assert.equal(accepted.player.club, 'Redbrook Town FC');
  assert.equal(accepted.player.pathway, 'Senior team');
  assert.doesNotMatch(renderHomeDashboard(accepted), /finish your youth journey|first senior step/i);
  assert.match(deriveHomeObjectives(accepted).longTerm, /senior|professional/i);

  const footballContainer = { innerHTML: '' };
  renderFootball(footballContainer, { state: accepted });
  assert.match(footballContainer.innerHTML, /Redbrook Town FC/);
  assert.match(footballContainer.innerHTML, /Senior team/);

  const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(accepted))));
  restored.quarterCounter = 45;
  restored.player.quarterIndex = 1;
  restored.player.quarter = 'Summer';
  restored.careerState = syncCareerState(restored);
  assert.equal(restored.careerState.clock.tick, 45);
  assert.equal(restored.careerState.peopleById['person-player'].career.stage, 'senior');
  assert.equal(restored.careerState.peopleById['person-player'].career.currentTeamId, 'team-redbrook-senior');
  assert.equal(restored.player.club, 'Redbrook Town FC');
  assert.equal(getContractOffers(restored.careerState)[0].expired, false);
  assert.doesNotMatch(renderContractInbox(restored.careerState), /data-accept-contract|This offer has expired/);
});

test('accepted contract closes the inbox and records a causal senior-debut recap fact', () => {
  const player = makePlayer({ club: 'Riverside Juniors', pathway: 'England youth pathway' });
  const appState = {
    player,
    careerState: createCareerStateForPlayer(player, 44),
    quarterCounter: 44,
    quarterEvidence: [],
  };

  const accepted = acceptContractInAppState(appState, 'negotiation-contract-1', () => {});
  const inbox = renderContractInbox(accepted.careerState);

  assert.match(inbox, /Senior contract in place\. The youth chapter is closed; see your club panel for next steps\./);
  assert.doesNotMatch(inbox, /data-accept-contract|data-counter-contract|data-reject-contract/);
  assert.equal(accepted.quarterEvidence.length, 1);
  assert.deepEqual(accepted.quarterEvidence[0], {
    kind: 'career',
    label: 'Senior debut',
    outcome: 'Signed a professional contract with Redbrook Town FC.',
    id: '44-0',
  });

  const recap = buildQuarterRecap({
    quarter: 45,
    from: { quarter: 'Spring', year: 2037, age: 16, fatigue: 0 },
    to: { quarter: 'Summer', year: 2037, age: 16, fatigue: 0 },
    evidence: accepted.quarterEvidence,
  });
  assert.deepEqual(recap.highlights[0], 'Senior debut → Signed a professional contract with Redbrook Town FC.');
});

test('career clock sync expires due professional contracts without reverting the senior club', () => {
  const player = makePlayer({ club: 'Riverside Juniors', pathway: 'England youth pathway' });
  const appState = {
    player,
    careerState: createCareerStateForPlayer(player, 44),
    quarterCounter: 44,
    quarterEvidence: [],
  };
  const accepted = acceptContractInAppState(appState, 'negotiation-contract-1', () => {});
  accepted.careerState.contractsById['contract-1'].endTick = 45;
  accepted.quarterCounter = 45;

  const synced = syncCareerState(accepted);

  assert.equal(synced.contractsById['contract-1'].status, 'expired');
  assert.equal(synced.peopleById['person-player'].career.stage, 'senior');
  assert.equal(synced.peopleById['person-player'].career.currentContractId, null);
  assert.equal(synced.peopleById['person-player'].career.currentTeamId, null);
  assert.equal(synced.registrationsById['registration-1'].active, false);
  assert.deepEqual(synced.teamsById['team-redbrook-senior'].squadPersonIds, []);
  assert.equal(accepted.player.club, 'Redbrook Town FC');
  assert.equal(synced.negotiationsById['negotiation-contract-1'].status, 'accepted');
  assert.match(renderContractInbox(synced), /contract term has ended|post-contract career decision is not implemented/i);
  const expiredAppState = { ...accepted, careerState: synced };
  assert.match(renderHomeDashboard(expiredAppState), /contract with Redbrook Town FC has ended/i);
  assert.doesNotMatch(renderHomeDashboard(expiredAppState), /Keep growing as .* with Redbrook Town FC/i);
});

test('expired acceptance reports the engine error without mutating or persisting state', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  careerState.clock.tick = 53;
  const appState = { player: makePlayer(), careerState };
  const snapshot = structuredClone(careerState);
  let saves = 0;

  const result = acceptContractInAppState(appState, 'negotiation-contract-1', () => { saves += 1; });

  assert.deepEqual(result.careerState, snapshot);
  assert.match(result.contractFeedback.message, /expired/i);
  assert.equal(saves, 0);
  assert.match(renderContractInbox(result.careerState, result.contractFeedback), /This offer has expired/);
  assert.doesNotMatch(renderContractInbox(result.careerState), /data-accept-contract/);
});

test('reject applies the orchestrator result once and persists only canonical success', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const appState = { player: makePlayer(), careerState };
  const persisted = [];

  const rejected = rejectContractInAppState(
    appState,
    'negotiation-contract-1',
    (next) => persisted.push(next),
  );

  assert.equal(appState.careerState.negotiationsById['negotiation-contract-1'].status, 'open');
  assert.equal(rejected.careerState.negotiationsById['negotiation-contract-1'].status, 'rejected');
  assert.equal(rejected.careerState.ledger.at(-1).type, 'CONTRACT_REJECTED');
  assert.deepEqual(rejected.contractFeedback, {
    type: 'success', message: 'Offer rejected — no hard feelings, Redbrook Town FC.',
  });
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0], rejected);

  const retried = rejectContractInAppState(rejected, 'negotiation-contract-1', () => {
    throw new Error('must not save');
  });
  assert.equal(retried.careerState, rejected.careerState);
  assert.match(retried.contractFeedback.message, /not open/i);
});

test('reject save failure preserves prior canonical state and reports the failure', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const appState = { player: makePlayer(), careerState };

  const result = rejectContractInAppState(appState, 'negotiation-contract-1', () => {
    throw new Error('storage full');
  });

  assert.equal(result.careerState, careerState);
  assert.equal(result.careerState.negotiationsById['negotiation-contract-1'].status, 'open');
  assert.match(result.contractFeedback.message, /storage full/i);
});

test('accept save failure preserves prior canonical career/player state and reports the failure', () => {
  const player = makePlayer({ club: 'Riverside Juniors', pathway: 'England youth pathway' });
  const careerState = createCareerStateForPlayer(player, 44);
  const priorEvidence = [
    { kind: 'training', label: 'Pre-season camp', outcome: 'Stamina +2', id: '43-0' },
  ];
  const appState = {
    player,
    careerState,
    quarterEvidence: priorEvidence,
    quarterCounter: 44,
  };
  const snapshot = structuredClone(careerState);
  const snapshotPlayer = structuredClone(player);
  const snapshotEvidence = structuredClone(priorEvidence);
  let saves = 0;

  const result = acceptContractInAppState(appState, 'negotiation-contract-1', () => {
    saves += 1;
    throw new Error('quota exceeded');
  });

  // Atomicity: every field the success path mutates must roll back to the pre-accept reference.
  assert.equal(result.careerState, careerState, 'careerState reference must not change on persist failure');
  assert.equal(result.player, player, 'player reference must not change on persist failure');
  assert.equal(result.quarterEvidence, priorEvidence, 'quarterEvidence reference must not change on persist failure');
  assert.equal(priorEvidence.length, 1, 'input evidence must be untouched (no in-place mutation by adapter)');
  assert.equal(result.player.club, 'Riverside Juniors', 'player club must remain pre-accept');
  assert.equal(result.player.pathway, 'England youth pathway', 'player pathway must remain pre-accept');
  assert.deepEqual(result.careerState, snapshot, 'canonical career state must be byte-identical to pre-accept snapshot');
  assert.deepEqual(result.player, snapshotPlayer, 'player must remain pre-accept');
  assert.deepEqual(result.quarterEvidence, snapshotEvidence, 'quarter evidence must remain pre-accept');
  assert.equal(result.careerState.negotiationsById['negotiation-contract-1'].status, 'open');
  assert.equal(Object.keys(result.careerState.contractsById).length, 0, 'no contract must be created on persist failure');
  assert.equal(Object.keys(result.careerState.registrationsById).length, 0, 'no registration must be created on persist failure');
  assert.equal(result.careerState.peopleById['person-player'].career.stage, 'grassroots', 'career stage must remain pre-accept');
  assert.equal(result.careerState.peopleById['person-player'].career.currentContractId, null);
  assert.equal(result.careerState.peopleById['person-player'].career.currentTeamId, null);
  assert.equal(saves, 1, 'persist must still be invoked exactly once before the failure is surfaced');
  assert.equal(result.contractFeedback.type, 'error');
  assert.match(result.contractFeedback.message, /quota exceeded/i);
  assert.match(
    renderContractInbox(result.careerState, result.contractFeedback),
    /data-accept-contract="negotiation-contract-1"/,
    'open offer must remain actionable so the caller can retry',
  );
});

test('open offers expose separate accept, counter, and reject choices while stale offers expose none', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const openHtml = renderContractInbox(careerState);

  assert.match(openHtml, /data-accept-contract="negotiation-contract-1"/);
  assert.match(openHtml, /data-counter-contract="negotiation-contract-1"/);
  assert.match(openHtml, /data-reject-contract="negotiation-contract-1"/);

  careerState.negotiationsById['negotiation-contract-1'].status = 'rejected';
  const staleHtml = renderContractInbox(careerState);
  assert.doesNotMatch(staleHtml, /data-(?:accept|counter|reject)-contract/);
});

// ---------------------------------------------------------------------------
// Mobility slice — transfer negotiation UI
// ---------------------------------------------------------------------------
// The inbox now renders kind='transfer' negotiations alongside
// professional-offer ones. They surface a distinct title + accept/reject
// controls (no counter — the buying club decides terms). The transfer
// card must escape the buying club name and never leak the seeded
// redbrook contract into the transfer card body.

function makeTransferOffer() {
  return {
    id: 'negotiation-transfer-1',
    kind: 'transfer',
    personId: 'person-player',
    fromClubId: 'club-redbrook',
    toClubId: 'club-rheintal',
    toTeamId: 'team-rheintal-senior',
    createdTick: 50,
    expiresTick: 60,
    status: 'open',
    terms: {
      transferFeeMinor: 3000000,
      durationTicks: 128,
      wagePerWeekMinor: 150000,
      signingBonusMinor: 50000,
      squadRole: 'starter',
    },
  };
}

test('transfer inbox renders transfer negotiations with accept/reject controls and an escaped club name', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  // Plant a transfer target + offer against the player.
  careerState.clubsById['club-rheintal'] = {
    id: 'club-rheintal', name: '<b>Rheintal</b> FC', countryId: 'switzerland',
    teamIds: ['team-rheintal-senior'],
    finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 8000000 },
  };
  careerState.teamsById['team-rheintal-senior'] = {
    id: 'team-rheintal-senior', clubId: 'club-rheintal', level: 'senior', squadPersonIds: [],
  };
  careerState.negotiationsById['negotiation-transfer-1'] = makeTransferOffer();

  const html = renderContractInbox(careerState);

  // Both kinds render in one inbox.
  assert.match(html, /data-accept-contract="negotiation-contract-1"/);
  assert.match(html, /data-accept-transfer="negotiation-transfer-1"/);
  assert.match(html, /data-reject-transfer="negotiation-transfer-1"/);
  // Hostile club name is escaped, NOT injected raw.
  assert.match(html, /&lt;b&gt;Rheintal&lt;\/b&gt; FC/);
  assert.doesNotMatch(html, /<b>Rheintal<\/b> FC/);
  // Honest fee disclosure — formatted in pounds minor→major.
  assert.match(html, /£30,000/);
  assert.match(html, /Starter/);
});

test('transfer inbox filters out stale (non-open) transfer negotiations', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  careerState.clubsById['club-rheintal'] = {
    id: 'club-rheintal', name: 'Rheintal FC', countryId: 'switzerland',
    teamIds: ['team-rheintal-senior'],
    finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 8000000 },
  };
  careerState.teamsById['team-rheintal-senior'] = {
    id: 'team-rheintal-senior', clubId: 'club-rheintal', level: 'senior', squadPersonIds: [],
  };
  careerState.negotiationsById['negotiation-transfer-1'] = makeTransferOffer();
  careerState.negotiationsById['negotiation-transfer-1'].status = 'rejected';

  const html = renderContractInbox(careerState);
  assert.doesNotMatch(html, /data-accept-transfer/);
  assert.match(html, /Rheintal FC/);
});

test('counter form values become canonical integer terms while retaining the signing bonus', () => {
  const existing = createCareerStateForPlayer(makePlayer(), 44)
    .negotiationsById['negotiation-contract-1'].terms;

  assert.deepEqual(parseCounterTerms(existing, {
    wage: '1500', duration: '3', role: 'starter', releaseFee: '',
  }), {
    durationTicks: 96,
    wagePerWeekMinor: 150000,
    signingBonusMinor: 500000,
    squadRole: 'starter',
    releaseFeeMinor: null,
    transferFeeMinor: 0,
  });
  assert.throws(
    () => parseCounterTerms(existing, {
      wage: '12.50', duration: '0', role: 'captain', releaseFee: '-1',
    }),
    /whole number|whole positive|squad role|release fee/i,
  );
});

test('counter routes canonical terms once, persists once, and shows authoritative returned terms', () => {
  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const appState = { player: makePlayer(), careerState };
  const persisted = [];
  const terms = parseCounterTerms(
    careerState.negotiationsById['negotiation-contract-1'].terms,
    { wage: '1500', duration: '3', role: 'starter', releaseFee: '75000' },
  );

  const countered = counterContractInAppState(
    appState, 'negotiation-contract-1', terms, (next) => persisted.push(next),
  );

  const offer = countered.careerState.negotiationsById['negotiation-contract-1'];
  assert.equal(offer.roundsUsed, 1);
  assert.deepEqual(offer.terms, terms);
  assert.equal(countered.careerState.ledger.at(-1).type, 'CONTRACT_COUNTERED');
  assert.equal(persisted.length, 1);
  assert.match(countered.contractFeedback.message, /1 round remaining/i);
  const html = renderContractInbox(countered.careerState, countered.contractFeedback);
  assert.match(html, /£1,500\/week/);
  assert.match(html, /3 years/);
  assert.match(html, /Starter/);
  assert.match(html, /£75,000/);
});

test('counter failures do not consume a round, mutate canonical state, or persist', () => {
  for (const arrange of [
    (state) => { state.clock.tick = 53; },
    (state) => { state.negotiationsById['negotiation-contract-1'].roundsUsed = 2; },
  ]) {
    const careerState = createCareerStateForPlayer(makePlayer(), 44);
    arrange(careerState);
    const snapshot = structuredClone(careerState);
    let saves = 0;
    const result = counterContractInAppState(
      { player: makePlayer(), careerState },
      'negotiation-contract-1',
      careerState.negotiationsById['negotiation-contract-1'].terms,
      () => { saves += 1; },
    );
    assert.deepEqual(result.careerState, snapshot);
    assert.equal(saves, 0);
    assert.equal(result.contractFeedback.type, 'error');
  }

  const careerState = createCareerStateForPlayer(makePlayer(), 44);
  const result = counterContractInAppState(
    { player: makePlayer(), careerState },
    'negotiation-contract-1',
    careerState.negotiationsById['negotiation-contract-1'].terms,
    () => { throw new Error('quota exceeded'); },
  );
  assert.equal(result.careerState, careerState);
  assert.equal(result.careerState.negotiationsById['negotiation-contract-1'].roundsUsed, 0);
  assert.match(result.contractFeedback.message, /quota exceeded/i);
});
