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
