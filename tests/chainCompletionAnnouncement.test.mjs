// Once-only chain-completion announcement tests.
//
// When a chain transitions to `completed: true`, the player must hear about
// it exactly once. The announcement lives on chainState.announced (a set of
// chainIds), so that:
//   - a chain completing for the first time fires the announcement;
//   - re-renders, re-loads, and re-fires of the terminal step DO NOT re-fire;
//   - legacy chainState hydrates safely (missing announced is treated as {}).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAINS,
  createChainState,
  markChainStepFired,
  findChainByPendingEventId,
  getChainStep,
} from '../src/data/eventChains.js';
import { detectChainCompletions, markChainsAnnounced } from '../src/engines/chainCompletionAnnouncer.js';
import { serializeState, deserializeState } from '../src/engines/stateSerializer.js';

function walkToCompleted(chainState, chain) {
  markChainStepFired(chainState, chain.id, chain.steps[0].id);
  markChainStepFired(chainState, chain.id, chain.steps[1].id);
  markChainStepFired(chainState, chain.id, chain.steps[2].id);
}

test('detectChainCompletions returns the chainId that just transitioned to completed', () => {
  const chainState = createChainState();
  const chain = CHAINS[0];

  // Snapshot the chain BEFORE walking — pre-walk state must not register.
  const before = {};
  for (const [k, v] of Object.entries(chainState.chains)) before[k] = { ...v };

  walkToCompleted(chainState, chain);

  const completed = detectChainCompletions(chainState, before);
  assert.deepEqual(completed, [chain.id]);
});

test('detectChainCompletions returns an empty list when no chain transitioned', () => {
  const chainState = createChainState();
  const before = {};
  for (const [k, v] of Object.entries(chainState.chains)) before[k] = { ...v };

  // Walking step 1 only does NOT complete a chain.
  markChainStepFired(chainState, CHAINS[1].id, CHAINS[1].steps[0].id);

  const completed = detectChainCompletions(chainState, before);
  assert.deepEqual(completed, []);
});

test('detectChainCompletions returns every chain that newly completed in one pass', () => {
  // Edge case: a freshly-loaded legacy save where TWO chains happen to seal
  // in the same turn (e.g. an autosave restarted mid-game). Both must be
  // detected so the announcer fires for each exactly once. Detection is a
  // diff: we snapshot the chains BEFORE walking, then walk, then compare.
  const chainState = createChainState();
  const a = CHAINS[0];
  const b = CHAINS[2];

  // Pre-walk snapshot — both chains still at step-1, not completed.
  const before = {};
  for (const [k, v] of Object.entries(chainState.chains)) before[k] = { ...v };

  walkToCompleted(chainState, a);
  walkToCompleted(chainState, b);
  assert.equal(chainState.chains[a.id].completed, true);
  assert.equal(chainState.chains[b.id].completed, true);

  const completed = detectChainCompletions(chainState, before);
  assert.deepEqual(completed.sort(), [a.id, b.id].sort());
});

test('markChainsAnnounced records the chainIds and ignores unknown ids', () => {
  const chainState = createChainState();
  const before = structuredClone(chainState);
  const updated = markChainsAnnounced(chainState, [CHAINS[0].id, 'totally_made_up_id']);
  // known id was recorded
  assert.equal(updated.announced[CHAINS[0].id], true);
  // unknown id is silently dropped
  assert.equal(updated.announced['totally_made_up_id'], undefined);
  // structure is otherwise unchanged
  assert.deepEqual(updated.chains, before.chains);
});

test('detectChainCompletions ignores chains already announced even if the snapshot is stale', () => {
  // The shipped announce() helper must combine detectChainCompletions with
  // markChainsAnnounced so a chain that has already been toasted is NEVER
  // toasted again, regardless of how many times `applyEvent` was called
  // since the announcement.
  const chainState = createChainState();
  const chain = CHAINS[1];
  walkToCompleted(chainState, chain);

  // Pre-mark the chain as announced.
  chainState.announced = { [chain.id]: true };

  const before = {};
  for (const [k, v] of Object.entries(chainState.chains)) before[k] = { ...v };

  // A second walk that lands the same completion must NOT yield the chain.
  markChainStepFired(chainState, chain.id, chain.steps[2].id);
  assert.equal(chainState.chains[chain.id].completed, true);
  const completed = detectChainCompletions(chainState, before, { announced: chainState.announced });
  assert.deepEqual(completed, []);
});

test('chainState rides through serialize/deserialize with the announced map intact', () => {
  const chainState = createChainState();
  chainState.announced = { chain_first_club_trial: true };
  const wrapped = {
    player: { name: 'R' },
    world: { year: 2026 },
    relationships: {},
    settings: { theme: 'dark' },
    quarterCounter: 1,
    seed: 'chain-announced-serde',
    eventHistory: { firedIds: [], lastFiredAt: [], log: [] },
    chainState,
  };
  const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(wrapped))));
  assert.equal(restored.chainState.announced.chain_first_club_trial, true);
});

test('legacy save without announced field defaults to empty when chainState is hydrated', () => {
  // Legacy v1/v2 chainState shape predates the announced map. Hydrating via
  // the main.js boundary (`chainState ?? createChainState()`) MUST keep the
  // announcer quiet — the empty default treats every chain as eligible, but
  // detectChainCompletions() with an untouched `before` snapshot still
  // yields nothing because no chain flipped to completed during hydration.
  const legacyChainState = { chains: {} };
  for (const chain of CHAINS) {
    legacyChainState.chains[chain.id] = { currentStepId: chain.steps[0].id, completed: false };
  }
  // No `announced` key — must NOT throw on read.
  const before = structuredClone(legacyChainState.chains);
  const completed = detectChainCompletions(legacyChainState, before);
  assert.deepEqual(completed, []);
});

test('findChainByPendingEventId continues to work for a chainState that carries announced (paranoia check)', () => {
  // Belt-and-braces: the announcer hook must not change the behavior of
  // pre-existing chain helpers.
  const chainState = createChainState();
  chainState.announced = { chain_first_club_trial: true };
  const stepEventId = getChainStep('chain_first_club_trial', 'step-1').eventId;
  assert.equal(findChainByPendingEventId(chainState, stepEventId), 'chain_first_club_trial');
});
