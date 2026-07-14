// End-to-end smoke: completing a chain in applyEvent must surface a
// top-level feedback effect exactly once via the chainCompletionAnnouncer
// hook. This test wires announceNewChainCompletions(state) into the same
// pipeline main.js drives, and locks in the once-only contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engines/rng.js';
import { createPlayer } from '../src/engines/playerEngine.js';
import { createEventHistory, applyEvent } from '../src/engines/eventEngine.js';
import { CHAINS, createChainState } from '../src/data/eventChains.js';
import { announceNewChainCompletions } from '../src/engines/chainCompletionAnnouncer.js';

function makePlayer() {
  return Object.assign(
    createPlayer({ name: 'Robin Test', gender: 'nonbinary', country: 'Canada', startYear: 2026 }),
    { age: 9 }
  );
}

test('applyEvent → announcer returns the chainId exactly once when the terminal step fires', () => {
  const chainState = createChainState();
  const p = makePlayer();
  const history = createEventHistory();
  const chain = CHAINS[3]; // chain_independent_travel

  // Walk the chain via the engine up to (but not including) the terminal fire.
  applyEvent(p, { id: chain.steps[0].eventId, category: 'life', text: 'a', effects: {} }, null, history, 0, chainState);
  applyEvent(p, { id: chain.steps[1].eventId, category: 'life', text: 'b', effects: {} }, null, history, 1, chainState);

  // Capture the pre-terminal snapshot BEFORE the final fire.
  const beforeChains = structuredClone(chainState.chains);

  // Fire the terminal step through applyEvent — the chain flips to completed.
  applyEvent(p, { id: chain.steps[2].eventId, category: 'life', text: 'c', effects: {} }, null, history, 2, chainState);
  assert.equal(chainState.chains[chain.id].completed, true);

  // The announcer sees the just-flipped chain and returns its id.
  const announced = announceNewChainCompletions(
    { chainState, player: p, world: { year: 2026 }, quarterCounter: 2, rng: createRng('s'), settings: {}, relationships: {}, eventHistory: history },
    { beforeChains }
  );
  assert.deepEqual(announced, [chain.id]);

  // Mark the chain as announced — the contract main.js enforces.
  chainState.announced = { ...(chainState.announced ?? {}), [chain.id]: true };

  // Re-fire the terminal step. The announcer must remain silent: detecting
  // again returns an empty list because the chain was already announced
  // before this fire and the chain was already completed before this fire
  // (idempotent terminal lock in markChainStepFired).
  applyEvent(p, { id: chain.steps[2].eventId, category: 'life', text: 'c', effects: {} }, null, history, 3, chainState);
  const announcedAgain = announceNewChainCompletions(
    { chainState, player: p, world: { year: 2026 }, quarterCounter: 3, rng: createRng('s'), settings: {}, relationships: {}, eventHistory: history },
    { beforeChains: structuredClone(chainState.chains) }
  );
  assert.deepEqual(announcedAgain, []);
});

test('Rng/state side is not mutated by the announcer hook (pure)', () => {
  const chainState = createChainState();
  const p = makePlayer();
  const history = createEventHistory();
  const chain = CHAINS[4]; // chain_rising_talent

  applyEvent(p, { id: chain.steps[0].eventId, category: 'football', text: 'a', effects: {} }, null, history, 0, chainState);
  applyEvent(p, { id: chain.steps[1].eventId, category: 'football', text: 'b', effects: {} }, null, history, 1, chainState);

  const seed = 'pure-test';
  const rng = createRng(seed);
  const state = {
    chainState,
    player: p,
    world: { year: 2026 },
    quarterCounter: 2,
    rng,
    settings: {},
    relationships: {},
    eventHistory: history,
  };
  const beforeRng = rng.getState();
  const beforeChains = structuredClone(chainState.chains);

  announceNewChainCompletions(state, { beforeChains });

  assert.deepEqual(rng.getState(), beforeRng, 'announcer must not consume the rng');
  // chains snapshot is unchanged (no fire happened in this call)
  assert.deepEqual(chainState.chains, beforeChains);
});
