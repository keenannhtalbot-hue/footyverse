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

test('serialize and deserialize preserve canonical career state and contract feedback', () => {
  const careerState = { schemaVersion: 2, clock: { tick: 44 }, negotiationsById: {} };
  const contractFeedback = { type: 'success', message: 'Contract accepted.' };
  const state = { ...makeGameState(), careerState, contractFeedback };

  const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))));

  assert.deepEqual(restored.careerState, careerState);
  assert.deepEqual(restored.contractFeedback, contractFeedback);
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

test('serialize and deserialize persist quarter recap state with migration-safe defaults', () => {
  const quarterRecap = { quarter: 5, dismissed: true, sparse: false, highlights: ['Training → Passing +2.'] };
  const quarterEvidence = [{ kind: 'training', label: 'Training', stat: 'passing', gain: 2 }];
  const restored = deserializeState(JSON.parse(JSON.stringify(serializeState({
    ...makeGameState(),
    quarterRecap,
    quarterEvidence,
  }))));

  assert.deepEqual(restored.quarterRecap, quarterRecap);
  assert.deepEqual(restored.quarterEvidence, quarterEvidence);

  const legacy = deserializeState(JSON.parse(JSON.stringify(serializeState(makeGameState()))));
  assert.equal(legacy.quarterRecap, null);
  assert.deepEqual(legacy.quarterEvidence, []);
});

test('serialize and deserialize round-trip the guidedSeason object alongside legacy fields', () => {
  const guidedSeason = {
    schemaVersion: 1,
    seen: {
      'home.objective': { dismissed: true, completed: true, at: 5 },
    },
    resetCount: 0,
    lastUpdatedAt: 5,
  };
  const restored = deserializeState(JSON.parse(JSON.stringify(serializeState({
    ...makeGameState(),
    guidedSeason,
  }))));

  assert.deepEqual(restored.guidedSeason, guidedSeason);
  assert.equal(restored.player.name, 'Test Player');
  assert.equal(restored.quarterCounter, 5);
});

test('serializeState emits a null guidedSeason for legacy saves so hydration can default it safely', () => {
  const serialized = serializeState(makeGameState());
  assert.equal(serialized.guidedSeason, null);
});

test('deserializeState hydrates a missing guidedSeason into a safe empty shape via ensureGuidedSeason', () => {
  const legacyJson = JSON.stringify({
    version: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    state: {
      player: { name: 'Legacy' },
      world: { year: 2026 },
      relationships: {},
      settings: { theme: 'dark' },
      quarterCounter: 0,
      seed: 'legacy-seed',
      eventHistory: { firedIds: [], lastFiredAt: [], log: [] },
      // intentionally no guidedSeason key
    },
  });
  const record = JSON.parse(legacyJson);
  const restored = deserializeState(record.state);
  // The deserialization boundary must always hand back a usable guidedSeason
  // object so callers can call record*/ensureGuidedSeason without a separate
  // hydration step.
  assert.equal(restored.guidedSeason.schemaVersion, 1);
  assert.deepEqual(restored.guidedSeason.seen, {});
  assert.equal(restored.guidedSeason.resetCount, 0);
});
