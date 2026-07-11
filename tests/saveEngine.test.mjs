import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveGame,
  loadGame,
  deleteSave,
  exportSave,
  importSave,
  SAVE_KEY,
  CURRENT_VERSION,
} from '../src/engines/saveEngine.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('saveGame writes a versioned record and loadGame reads it back', () => {
  const storage = makeMemoryStorage();
  const state = { player: { name: 'Test Player' }, world: { year: 2026 } };
  saveGame(storage, state);
  const loaded = loadGame(storage);
  assert.equal(loaded.version, CURRENT_VERSION);
  assert.deepEqual(loaded.state, state);
  assert.ok(loaded.savedAt);
});

test('saveGame stores under the expected storage key', () => {
  const storage = makeMemoryStorage();
  saveGame(storage, { a: 1 });
  assert.ok(storage.getItem(SAVE_KEY));
});

test('loadGame returns null when nothing has been saved', () => {
  const storage = makeMemoryStorage();
  assert.equal(loadGame(storage), null);
});

test('deleteSave clears the save so loadGame returns null again', () => {
  const storage = makeMemoryStorage();
  saveGame(storage, { a: 1 });
  deleteSave(storage);
  assert.equal(loadGame(storage), null);
});

test('exportSave/importSave round-trips state exactly', () => {
  const state = { player: { name: 'Round Trip', stats: { passing: 40 } }, world: { npcs: [1, 2, 3] } };
  const json = exportSave(state);
  assert.equal(typeof json, 'string');
  const imported = importSave(json);
  assert.deepEqual(imported, state);
});

test('importSave throws on malformed JSON', () => {
  assert.throws(() => importSave('{not valid json'));
});

test('importSave throws when the version field is missing', () => {
  assert.throws(() => importSave(JSON.stringify({ state: { a: 1 } })));
});

test('importSave throws when the state field is missing', () => {
  assert.throws(() => importSave(JSON.stringify({ version: CURRENT_VERSION })));
});
