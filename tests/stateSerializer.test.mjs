import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventHistory } from '../src/engines/eventEngine.js';
import { createRng } from '../src/engines/rng.js';
import { serializeState, deserializeState } from '../src/engines/stateSerializer.js';

function makeGameState() {
  const history = createEventHistory();
  history.firedIds.add('evt_a');
  history.firedIds.add('evt_b');
  history.lastFiredAt.set('evt_a', 3);
  history.log.push({ id: 'evt_a', category: 'life', text: 'Something happened.', quarter: 3, choiceId: null, effects: {} });

  return {
    player: { name: 'Test Player', age: 7 },
    world: { year: 2027, npcs: [{ id: 'npc-0', name: 'Alex' }] },
    relationships: { coach: { id: 'coach', trust: 55 } },
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    quarterCounter: 5,
    seed: 'abc123',
    eventHistory: history,
  };
}

test('serializeState produces a JSON-stringify-safe plain object', () => {
  const state = makeGameState();
  const serialized = serializeState(state);
  assert.doesNotThrow(() => JSON.stringify(serialized));
});

test('serializeState carries through player, world, relationships, settings, quarterCounter, seed unchanged', () => {
  const state = makeGameState();
  const serialized = serializeState(state);
  assert.deepEqual(serialized.player, state.player);
  assert.deepEqual(serialized.world, state.world);
  assert.deepEqual(serialized.relationships, state.relationships);
  assert.deepEqual(serialized.settings, state.settings);
  assert.equal(serialized.quarterCounter, 5);
  assert.equal(serialized.seed, 'abc123');
});

test('serializeState flattens eventHistory Set/Map into plain arrays', () => {
  const state = makeGameState();
  const serialized = serializeState(state);
  assert.ok(Array.isArray(serialized.eventHistory.firedIds));
  assert.ok(Array.isArray(serialized.eventHistory.lastFiredAt));
  assert.ok(Array.isArray(serialized.eventHistory.log));
});

test('deserializeState reconstructs a Set for firedIds and a Map for lastFiredAt', () => {
  const state = makeGameState();
  const roundTripped = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));
  assert.ok(roundTripped.eventHistory.firedIds instanceof Set);
  assert.ok(roundTripped.eventHistory.lastFiredAt instanceof Map);
  assert.ok(roundTripped.eventHistory.firedIds.has('evt_a'));
  assert.ok(roundTripped.eventHistory.firedIds.has('evt_b'));
  assert.equal(roundTripped.eventHistory.lastFiredAt.get('evt_a'), 3);
});

test('round trip through serialize -> JSON -> deserialize preserves the full game state', () => {
  const state = makeGameState();
  const json = JSON.stringify(serializeState(state));
  const restored = deserializeState(JSON.parse(json));
  assert.deepEqual(restored.player, state.player);
  assert.deepEqual(restored.world, state.world);
  assert.deepEqual(restored.eventHistory.log, state.eventHistory.log);
  assert.equal(restored.quarterCounter, state.quarterCounter);
});

test('serializeState captures the rng internal state', () => {
  const rng = createRng('seed-x');
  rng.next();
  rng.next();
  const state = { ...makeGameState(), rng };
  const serialized = serializeState(state);
  assert.equal(serialized.rngState, rng.getState());
});

test('save/load round trip preserves rng call continuity instead of restarting the sequence', () => {
  const rng = createRng('seed-continuity');
  rng.next();
  rng.next();
  const state = { ...makeGameState(), seed: 'seed-continuity', rng };

  const json = JSON.stringify(serializeState(state));
  const restored = deserializeState(JSON.parse(json));

  const expectedNext = rng.next(); // what the original rng would produce next
  const resumedRng = createRng(restored.seed, restored.rngState);
  assert.equal(resumedRng.next(), expectedNext);

  const freshRng = createRng('seed-continuity');
  assert.notEqual(resumedRng.next(), freshRng.next());
});
