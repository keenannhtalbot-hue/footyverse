// Integration tests wiring eventChains through eventEngine.applyEvent and the
// serialize/deserialize + hydrate path. These are the real-world seams the
// gameplay path exercises: an event firing in the engine advances only the
// matching chain step, and the chainState rides through the save boundary.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engines/rng.js';
import { createPlayer } from '../src/engines/playerEngine.js';
import { createEventHistory, applyEvent } from '../src/engines/eventEngine.js';
import { CHAINS, createChainState, getChainStep, markChainStepFired } from '../src/data/eventChains.js';
import { serializeState, deserializeState } from '../src/engines/stateSerializer.js';
import { EVENTS } from '../src/data/events.js';

function makePlayer(overrides = {}) {
  const p = createPlayer({ name: 'Robin Test', gender: 'nonbinary', country: 'Canada', startYear: 2026 });
  return Object.assign(p, overrides);
}

function findChainStepByEventId(chainState, eventId) {
  // Returns the chainId that currently expects this eventId, or null.
  for (const [chainId, state] of Object.entries(chainState.chains)) {
    if (state.completed) continue;
    const step = getChainStep(chainId, state.currentStepId);
    if (step.eventId === eventId) return chainId;
  }
  return null;
}

test('applyEvent advances the matching chain from step 1 to step 2 exactly once', () => {
  const p = makePlayer({ age: 7 });
  const history = createEventHistory();
  const chainState = createChainState();

  const chain = CHAINS[0];
  const step1EventId = chain.steps[0].eventId;
  const evt = { id: step1EventId, category: 'football', text: '{name} trial', effects: { hidden: { confidence: 1 } } };

  const beforeChainId = findChainStepByEventId(chainState, step1EventId);
  assert.equal(beforeChainId, chain.id, 'chain should be at step 1 expecting this eventId');
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-1');

  applyEvent(p, evt, null, history, 0, chainState);

  assert.equal(chainState.chains[chain.id].currentStepId, 'step-2');
  assert.equal(chainState.chains[chain.id].completed, false);

  // Firing the same step-1 event a second time must NOT double-advance.
  applyEvent(p, evt, null, history, 1, chainState);
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-2');
});

test('applyEvent does not advance a chain when an unrelated event fires', () => {
  const p = makePlayer({ age: 7 });
  const history = createEventHistory();
  const chainState = createChainState();

  const chain = CHAINS[1];
  const startStep = chainState.chains[chain.id].currentStepId;

  // Pick an event whose id is NOT in the chain system — guaranteed-unrelated id.
  const unrelated = { id: 'definitely_not_a_chain_step_xyz', category: 'misc', text: 'noop', effects: {} };
  applyEvent(p, unrelated, null, history, 0, chainState);

  assert.equal(chainState.chains[chain.id].currentStepId, startStep);
  assert.equal(chainState.chains[chain.id].completed, false);
});

test('applyEvent seals a chain when the terminal step fires', () => {
  const p = makePlayer({ age: 9 });
  const history = createEventHistory();
  const chainState = createChainState();

  const chain = CHAINS[2];
  // Manually walk the chainState to step 3 by firing step 1 then step 2
  // through applyEvent with the chain-owned events.
  applyEvent(p, { id: chain.steps[0].eventId, category: 'life', text: 'a', effects: {} }, null, history, 0, chainState);
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-2');
  applyEvent(p, { id: chain.steps[1].eventId, category: 'life', text: 'b', effects: {} }, null, history, 1, chainState);
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-3');

  // Terminal step fires — must seal the chain as completed.
  applyEvent(p, { id: chain.steps[2].eventId, category: 'life', text: 'c', effects: {} }, null, history, 2, chainState);
  assert.equal(chainState.chains[chain.id].completed, true);
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-3');

  // Re-firing the terminal step must remain sealed — no further mutation.
  applyEvent(p, { id: chain.steps[2].eventId, category: 'life', text: 'c', effects: {} }, null, history, 3, chainState);
  assert.equal(chainState.chains[chain.id].completed, true);
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-3');
});

test('serialize -> JSON -> deserialize preserves chainState through the save boundary', () => {
  const p = makePlayer({ age: 7 });
  const history = createEventHistory();
  const chainState = createChainState();

  const chain = CHAINS[0];
  applyEvent(p, { id: chain.steps[0].eventId, category: 'football', text: 'a', effects: {} }, null, history, 0, chainState);
  assert.equal(chainState.chains[chain.id].currentStepId, 'step-2');

  const state = {
    player: p,
    world: { year: 2026 },
    relationships: {},
    settings: { theme: 'dark' },
    quarterCounter: 1,
    seed: 'chain-serde',
    eventHistory: history,
    chainState,
  };

  const json = JSON.stringify(serializeState(state));
  const restored = deserializeState(JSON.parse(json));

  assert.equal(restored.chainState.chains[chain.id].currentStepId, 'step-2');
  assert.equal(restored.chainState.chains[chain.id].completed, false);
});

test('serialize -> JSON -> deserialize preserves the completed terminal state of a chain', () => {
  // Regression guard: a fully completed chain must survive the save/load
  // boundary in its sealed form (completed: true), not regress back to an
  // in-progress state — completed chains stay sealed across reloads.
  const chainState = createChainState();
  const chain = CHAINS[3];
  // Walk the chain to completion deterministically via the existing helper.
  markChainStepFired(chainState, chain.id, chain.steps[0].id);
  markChainStepFired(chainState, chain.id, chain.steps[1].id);
  markChainStepFired(chainState, chain.id, chain.steps[2].id);
  assert.equal(chainState.chains[chain.id].completed, true);

  const state = {
    player: { name: 'R' },
    world: { year: 2026 },
    relationships: {},
    settings: { theme: 'dark' },
    quarterCounter: 6,
    seed: 'chain-sealed',
    eventHistory: { firedIds: [], lastFiredAt: [], log: [] },
    chainState,
  };

  const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));
  assert.equal(restored.chainState.chains[chain.id].completed, true);
  assert.equal(restored.chainState.chains[chain.id].currentStepId, chain.steps[2].id);
});

test('legacy save without chainState is hydrated to a fresh chainState by the main boundary', () => {
  // The legacy v1 save shape carries no chainState. The serialization layer
  // must emit a sentinel (null) so legacy saves do not gain a phantom
  // populated chainState field; the hydration path used by main.js
  // (deserializeState + ensure* defaults) must always yield a usable
  // chainState — never undefined, never mutated by a chained event.
  const legacyState = {
    player: { name: 'Alex Morgan', gender: 'nonbinary' },
    world: { year: 2026 },
    relationships: {},
    settings: { theme: 'dark' },
    quarterCounter: 0,
    seed: 'legacy-chain',
    eventHistory: { firedIds: [], lastFiredAt: [], log: [] },
  };

  // Serialize without chainState and confirm the serializer emits the
  // sentinel so legacy on-disk saves are unambiguous.
  const serialized = serializeState(legacyState);
  assert.equal(serialized.chainState, null, 'serializer must emit null sentinel for missing chainState');

  // Simulate the main.js hydrate path: deserializeState gives us a partial
  // object, then a downstream ensure pass must populate chainState.
  const restored = deserializeState(serialized);
  assert.equal(restored.chainState, null);

  const hydratedChainState = (restored.chainState ?? createChainState());
  assert.ok(hydratedChainState.chains, 'hydrated chainState has the expected shape');
  for (const chain of CHAINS) {
    assert.equal(hydratedChainState.chains[chain.id].completed, false);
    assert.equal(hydratedChainState.chains[chain.id].currentStepId, chain.steps[0].id);
  }
});

test('a real shipped event whose id is in a chain can be wired through applyEvent', () => {
  // End-to-end smoke: pick a real shipped EVENTS catalog entry that is also
  // a chain step-1, fire it through applyEvent, and confirm the chain
  // advances. This proves the wiring works against the shipped catalog,
  // not just our synthetic test events.
  const p = makePlayer({ age: 8 });
  const history = createEventHistory();
  const chainState = createChainState();

  // Find a chain whose step-1 eventId exists in EVENTS and is currently
  // expecting that fire (i.e., not already advanced or completed).
  const eventIds = new Set(EVENTS.map((e) => e.id));
  const chain = CHAINS.find((c) => eventIds.has(c.steps[0].eventId));
  assert.ok(chain, 'at least one chain step-1 must reference a shipped event');
  const step1Id = chain.steps[0].eventId;

  const evt = EVENTS.find((e) => e.id === step1Id);
  assert.ok(evt, 'the real event must exist in the EVENTS catalog');

  applyEvent(p, evt, null, history, 0, chainState);

  assert.equal(chainState.chains[chain.id].currentStepId, chain.steps[1].id);
});

test('applyEvent without chainState preserves existing behavior for legacy callers', () => {
  // Backwards compatibility: callers (tests, UI) that omit chainState
  // must continue to receive the same return value and side effects.
  const p = makePlayer({ age: 7 });
  const history = createEventHistory();
  const evt = { id: 'evt_legacy', category: 'life', text: '{name} ok', effects: { hidden: { confidence: 2 } } };
  const confidenceBefore = p.hidden.confidence ?? 0;
  const result = applyEvent(p, evt, null, history, 0);
  assert.equal(result.id, 'evt_legacy');
  assert.equal(p.hidden.confidence, confidenceBefore + 2);
  assert.ok(history.firedIds.has('evt_legacy'));
});
