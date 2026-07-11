import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptContractInAppState,
  createCareerStateForPlayer,
  ensureCareerState,
  syncCareerState,
} from '../src/engines/careerStateAdapter.js';
import {
  getContractOffers,
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
