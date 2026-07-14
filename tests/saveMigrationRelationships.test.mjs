// Regression tests for the v1→v2 relationship migration concern.
//
// The original audit hypothesised that legacy saves would lose
// `state.relationships` because stateMigrations stores legacy relationships
// under `migrated.legacy.relationships`. The live application does not call
// that dormant migration module: its save boundary is
// serializeState → saveGame/loadGame → deserializeState.
//
// These tests exercise that real boundary with a genuine runtime-shaped state,
// including the Set/Map event history and RNG object that serializeState must
// convert before saveGame receives the payload. They intentionally do not
// claim that missing/null relationships are safe for downstream gameplay; that
// is a separate compatibility decision, not evidence that the migration
// hypothesis is active on the current runtime path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventHistory } from '../src/engines/eventEngine.js';
import { createRng } from '../src/engines/rng.js';
import {
  saveGame,
  loadGame,
  exportSave,
  importSave,
  CURRENT_VERSION,
} from '../src/engines/saveEngine.js';
import { serializeState, deserializeState } from '../src/engines/stateSerializer.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

const SAMPLE_RELATIONSHIPS = {
  coach: { id: 'coach', name: 'Coach Carter', trust: 61, loyalty: 70 },
  teacher: { id: 'teacher', name: 'Ms. Lin', trust: 55 },
  parentA: { id: 'parent-a', name: 'Alex Sr.', trust: 80 },
  parentB: { id: 'parent-b', name: 'Jordan Sr.', trust: 75 },
  friends: [
    { id: 'friend-1', name: 'Sam', trust: 60 },
    { id: 'friend-2', name: 'Riley', trust: 50 },
  ],
};

function makeRuntimeState() {
  const eventHistory = createEventHistory();
  eventHistory.firedIds.add('first-day');
  eventHistory.lastFiredAt.set('first-day', 1);
  eventHistory.log.push({
    id: 'first-day',
    category: 'life',
    text: 'A first day.',
    quarter: 1,
    choiceId: null,
    effects: {},
  });

  const rng = createRng('career-seed');
  rng.next();

  return {
    player: {
      name: 'Alex Morgan', gender: 'nonbinary', country: 'England',
      year: 2028, age: 7, quarter: 'Fall', quarterIndex: 2,
      stats: { passing: 31, shooting: 27 },
      hidden: { potential: 81, workEthic: 66 },
      club: 'Redbrook Juniors',
    },
    world: { year: 2028, season: 'Fall', quarterIndex: 2, newsLog: [] },
    relationships: structuredClone(SAMPLE_RELATIONSHIPS),
    settings: { theme: 'dark' },
    quarterCounter: 10,
    seed: 'career-seed',
    rng,
    eventHistory,
  };
}

function saveRuntimeState(storage, state) {
  saveGame(storage, serializeState(state));
  return deserializeState(loadGame(storage).state);
}

test('real runtime save/load boundary preserves top-level relationships exactly', () => {
  const storage = makeMemoryStorage();
  const original = makeRuntimeState();
  const restored = saveRuntimeState(storage, original);

  assert.deepEqual(restored.relationships, SAMPLE_RELATIONSHIPS);
  assert.equal(restored.relationships.coach.name, 'Coach Carter');
  assert.equal(restored.relationships.teacher.trust, 55);
  assert.equal(restored.relationships.parentA.trust, 80);
  assert.equal(restored.relationships.parentB.trust, 75);
  assert.equal(restored.relationships.friends.length, 2);
  assert.equal(restored.relationships.friends[0].id, 'friend-1');
  assert.ok(restored.eventHistory.firedIds.has('first-day'));
  assert.equal(restored.eventHistory.lastFiredAt.get('first-day'), 1);
  assert.equal(restored.rngState, original.rng.getState());
});

test('real runtime export/import boundary preserves top-level relationships exactly', () => {
  const original = makeRuntimeState();
  const restored = deserializeState(importSave(exportSave(serializeState(original))));

  assert.deepEqual(restored.relationships, SAMPLE_RELATIONSHIPS);
  assert.ok(restored.eventHistory.firedIds instanceof Set);
  assert.ok(restored.eventHistory.lastFiredAt instanceof Map);
});

test('runtime save record is version-stamped while preserving top-level relationships', () => {
  const storage = makeMemoryStorage();
  const original = makeRuntimeState();
  saveGame(storage, serializeState(original));

  const record = loadGame(storage);
  assert.equal(record.version, CURRENT_VERSION);
  assert.deepEqual(record.state.relationships, SAMPLE_RELATIONSHIPS);
});

test('loading the same runtime save twice yields identical relationships', () => {
  const storage = makeMemoryStorage();
  saveGame(storage, serializeState(makeRuntimeState()));

  const first = deserializeState(loadGame(storage).state);
  const second = deserializeState(loadGame(storage).state);

  assert.deepEqual(first.relationships, SAMPLE_RELATIONSHIPS);
  assert.deepEqual(second.relationships, SAMPLE_RELATIONSHIPS);
  assert.deepEqual(first.relationships, second.relationships);
});

test('an explicitly empty relationship container round-trips without relocation or coercion', () => {
  const storage = makeMemoryStorage();
  const state = makeRuntimeState();
  state.relationships = {};

  const restored = saveRuntimeState(storage, state);
  assert.deepEqual(restored.relationships, {});
});

test('an absent relationship key remains absent rather than being relocated or synthesized', () => {
  const storage = makeMemoryStorage();
  const state = makeRuntimeState();
  delete state.relationships;

  const restored = saveRuntimeState(storage, state);
  assert.equal(restored.relationships, undefined);
});

test('null relationship payload remains explicit rather than being silently relocated', () => {
  const storage = makeMemoryStorage();
  const state = makeRuntimeState();
  state.relationships = null;

  const restored = saveRuntimeState(storage, state);
  assert.equal(restored.relationships, null);
});
