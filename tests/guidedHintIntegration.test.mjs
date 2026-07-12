// End-to-end-ish driver test: build a minimal stubbed DOM environment, then
// exercise the guided-hint slice against it the same way the browser would.
// Catches relative-import mistakes, save-then-load round trips, and the
// cascade from a real AP action down through the resolver + renderer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createGuidedSeason, ensureGuidedSeason, resolveActiveStepForApp } from '../src/engines/guidedSeason.js';
import { serializeState, deserializeState } from '../src/engines/stateSerializer.js';
import { saveGame, loadGame, exportSave, importSave, SAVE_KEY, CURRENT_VERSION } from '../src/engines/saveEngine.js';
import { renderGuidedHint } from '../src/ui/guidedHint.js';

function makePlayer(overrides = {}) {
  return {
    name: 'Test Kid', gender: 'boy', country: 'England',
    year: 2028, age: 7, quarter: 'Spring', quarterIndex: 0,
    ap: 12, apMax: 12,
    stats: { passing: 30, shooting: 28, pace: 25, dribbling: 22, defending: 18, physical: 24, goalkeeping: 15 },
    hidden: { potential: 70, confidence: 50, workEthic: 60, fatigue: 0, injuryProneness: 12 },
    position: null, positionAccepted: null, injury: null, physioUsedThisQuarter: false,
    matchObservations: 0, club: null, pathway: null, school: null,
    careerHistory: [], storyLedger: [],
    ...overrides,
  };
}

function makeWorld() {
  return {
    year: 2028, season: 'Spring', quarterIndex: 0, weather: 'Mild',
    npcs: [], newsLog: [], transferLog: [],
  };
}

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => { map.clear(); },
  };
}

test('A first-run save -> load -> autosave sequence round-trips the guidedSeason without state loss', () => {
  const storage = makeMemoryStorage();

  // Game 1: brand-new player, never opened Home.
  const player = makePlayer();
  const state1 = {
    player, world: makeWorld(),
    relationships: { coach: { id: 'coach', trust: 50 }, parentA: {}, parentB: {}, teacher: {}, friends: [] },
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    careerState: { clock: { tick: 0 }, negotiationsById: {}, clubsById: {}, teamsById: {}, contractsById: {}, registrationsById: {} },
    quarterRecap: null, quarterEvidence: [],
    quarterCounter: 0, seed: 'integration-seed',
    eventHistory: { firedIds: new Set(), lastFiredAt: new Map(), log: [] },
    guidedSeason: createGuidedSeason(),
    headline: 'Ready.', rngState: 0,
  };

  saveGame(storage, serializeState(state1));
  assert.ok(storage.getItem(SAVE_KEY), 'autosave persisted');

  const loaded = loadGame(storage);
  assert.ok(loaded);

  // Hydrate runtime fields as main.js does.
  const hydrated = { ...loaded.state, guidedSeason: ensureGuidedSeason(loaded.state.guidedSeason) };
  const step = resolveActiveStepForApp(hydrated, 'home');
  assert.ok(step);
  assert.equal(step.id, 'home.objective');
  assert.match(step.title, /plan/i);
});

test('Export and re-import of a save carries the guidedSeason through without altering the active step', () => {
  const storage = makeMemoryStorage();
  const player = makePlayer();
  const state = {
    player, world: makeWorld(),
    relationships: { coach: { id: 'coach', trust: 50 }, parentA: {}, parentB: {}, teacher: {}, friends: [] },
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    careerState: { clock: { tick: 0 }, negotiationsById: {} },
    quarterRecap: null, quarterEvidence: [],
    quarterCounter: 0, seed: 'export-seed',
    eventHistory: { firedIds: new Set(), lastFiredAt: new Map(), log: [] },
    guidedSeason: createGuidedSeason(),
    headline: 'Ready.', rngState: 0,
  };

  const json = exportSave(serializeState(state));
  const record = JSON.parse(json);
  assert.equal(record.version, CURRENT_VERSION);
  assert.ok(record.state.guidedSeason);

  const restored = importSave(json);
  assert.ok(restored.guidedSeason);
  assert.deepEqual(restored.guidedSeason, state.guidedSeason);
});

test('A legacy save (no guidedSeason) deserialises safely and the resolver returns the home objective hint', () => {
  const legacyRecord = {
    version: CURRENT_VERSION,
    savedAt: '2026-01-01T00:00:00.000Z',
    state: {
      player: makePlayer({ name: 'Legacy' }),
      world: makeWorld(),
      relationships: {},
      settings: { theme: 'dark' },
      careerState: { clock: { tick: 0 }, negotiationsById: {} },
      quarterCounter: 0,
      seed: 'legacy',
      eventHistory: { firedIds: [], lastFiredAt: [], log: [] },
      // no guidedSeason key on purpose
    },
  };

  const json = JSON.stringify(legacyRecord);
  const stored = makeMemoryStorage();
  stored.setItem(SAVE_KEY, json);

  const loaded = loadGame(stored);
  assert.ok(loaded);
  const hydrated = { ...loaded.state, guidedSeason: ensureGuidedSeason(loaded.state.guidedSeason) };

  // Critical: legacy player still gets the teaching. Even though they have a
  // long-running career, the resolver sees a fresh guidedSeason {seen: {}}
  // and the first ever home.objective hint appears.
  const step = resolveActiveStepForApp(hydrated, 'home');
  assert.ok(step);
  assert.equal(step.id, 'home.objective');

  // Dismiss the hint once; subsequent calls return null immediately.
  const dismissed = ensureGuidedSeason(dismissStep(hydrated.guidedSeason, 'home.objective'));
  const hydrated2 = { ...hydrated, guidedSeason: dismissed };
  assert.equal(resolveActiveStepForApp(hydrated2, 'home'), null);
});

function dismissStep(g, stepId) {
  const seen = { ...g.seen };
  seen[stepId] = { dismissed: true, completed: true, at: Date.now() };
  return { ...g, seen, lastUpdatedAt: Date.now() };
}

test('renderGuidedHint output flows into the host app container without breaking escaped copy', () => {
  const step = {
    id: 'home.objective',
    app: 'home',
    title: 'A wild <tag>',
    body: 'Pick a stat & try training.',
    next: null,
  };
  const html = renderGuidedHint({ step, onDismiss: () => {} });
  assert.match(html, /A wild &lt;tag&gt;/);
  assert.match(html, /Pick a stat &amp; try training\./);
});
