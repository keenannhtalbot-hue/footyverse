import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engines/rng.js';
import { createPlayer } from '../src/engines/playerEngine.js';
import {
  createEventHistory,
  getEligibleEvents,
  selectEvent,
  applyEvent,
  resolveEventText,
} from '../src/engines/eventEngine.js';

const sampleEvents = [
  {
    id: 'young_only',
    category: 'school',
    weight: 5,
    minAge: 5,
    maxAge: 6,
    cooldownQuarters: 2,
    text: '{name} had a young-only event.',
    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'needs_club',
    category: 'football',
    weight: 5,
    minAge: 5,
    maxAge: 16,
    cooldownQuarters: 2,
    requiresClub: true,
    text: '{name} had a club event.',
    effects: { stats: { passing: 2 } },
  },
  {
    id: 'once_only',
    category: 'rare',
    weight: 5,
    minAge: 5,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: '{name} had a once-only event.',
    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'with_choice',
    category: 'life',
    weight: 5,
    minAge: 5,
    maxAge: 16,
    cooldownQuarters: 1,
    text: '{name} faced a choice.',
    choices: [
      { id: 'a', label: 'Option A', effects: { hidden: { confidence: 5 } } },
      { id: 'b', label: 'Option B', effects: { hidden: { workEthic: 5 } } },
    ],
  },
];

function makePlayer(overrides = {}) {
  const p = createPlayer({ name: 'Robin Test', gender: 'nonbinary', country: 'Canada', startYear: 2026 });
  return Object.assign(p, overrides);
}

test('getEligibleEvents excludes events outside the player age range', () => {
  const p = makePlayer({ age: 10 });
  const history = createEventHistory();
  const eligible = getEligibleEvents(sampleEvents, p, history, 0);
  assert.ok(!eligible.find((e) => e.id === 'young_only'));
});

test('getEligibleEvents excludes club-required events when player has no club', () => {
  const p = makePlayer({ age: 8, club: null });
  const history = createEventHistory();
  const eligible = getEligibleEvents(sampleEvents, p, history, 0);
  assert.ok(!eligible.find((e) => e.id === 'needs_club'));
});

test('getEligibleEvents includes club-required events once player has a club', () => {
  const p = makePlayer({ age: 8, club: 'Maple Ridge FC' });
  const history = createEventHistory();
  const eligible = getEligibleEvents(sampleEvents, p, history, 0);
  assert.ok(eligible.find((e) => e.id === 'needs_club'));
});

test('once events fire only a single time', () => {
  const p = makePlayer({ age: 8 });
  const history = createEventHistory();
  let eligible = getEligibleEvents(sampleEvents, p, history, 0);
  assert.ok(eligible.find((e) => e.id === 'once_only'));
  applyEvent(p, sampleEvents.find((e) => e.id === 'once_only'), null, history, 0);
  eligible = getEligibleEvents(sampleEvents, p, history, 1);
  assert.ok(!eligible.find((e) => e.id === 'once_only'));
});

test('cooldown prevents an event from firing again until quarters pass', () => {
  const p = makePlayer({ age: 8, club: 'Maple Ridge FC' });
  const history = createEventHistory();
  const evt = sampleEvents.find((e) => e.id === 'needs_club');
  applyEvent(p, evt, null, history, 0);
  let eligible = getEligibleEvents(sampleEvents, p, history, 1);
  assert.ok(!eligible.find((e) => e.id === 'needs_club'), 'should be on cooldown at quarter 1');
  eligible = getEligibleEvents(sampleEvents, p, history, 2);
  assert.ok(eligible.find((e) => e.id === 'needs_club'), 'should be eligible again at quarter 2');
});

test('selectEvent is deterministic for a given seed and returns null when no events eligible', () => {
  const p = makePlayer({ age: 8, club: 'Maple Ridge FC' });
  const history1 = createEventHistory();
  const history2 = createEventHistory();
  const rngA = createRng('select-seed');
  const rngB = createRng('select-seed');
  const a = selectEvent(sampleEvents, p, history1, 0, rngA);
  const b = selectEvent(sampleEvents, p, history2, 0, rngB);
  assert.equal(a.id, b.id);

  const none = selectEvent([], p, history1, 0, rngA);
  assert.equal(none, null);
});

test('applyEvent applies default effects and substitutes {name} in text', () => {
  const p = makePlayer({ age: 8 });
  const history = createEventHistory();
  const evt = sampleEvents.find((e) => e.id === 'young_only');
  const before = p.hidden.confidence;
  const result = applyEvent(p, evt, null, history, 0);
  assert.equal(p.hidden.confidence, before + 2);
  assert.equal(result.text, 'Robin Test had a young-only event.');
});

test('applyEvent with a choice applies only that branch effects', () => {
  const p = makePlayer({ age: 8 });
  const history = createEventHistory();
  const evt = sampleEvents.find((e) => e.id === 'with_choice');
  const beforeConfidence = p.hidden.confidence;
  const beforeWorkEthic = p.hidden.workEthic;
  applyEvent(p, evt, 'b', history, 0);
  assert.equal(p.hidden.confidence, beforeConfidence);
  assert.equal(p.hidden.workEthic, beforeWorkEthic + 5);
});

test('resolveEventText substitutes the player name', () => {
  const p = makePlayer({ name: 'Zara Lane' });
  const evt = sampleEvents.find((e) => e.id === 'young_only');
  assert.equal(resolveEventText(evt, p), 'Zara Lane had a young-only event.');
});

test('applyEvent returns the resolved branch effects so callers can wire relationship deltas', () => {
  const p = makePlayer({ age: 8 });
  const history = createEventHistory();
  const evt = sampleEvents.find((e) => e.id === 'young_only');
  const result = applyEvent(p, evt, null, history, 0);
  assert.deepEqual(result.effects, evt.effects);
});

test('applyEvent returns the chosen branch effects, not the default, for choice events', () => {
  const p = makePlayer({ age: 8 });
  const history = createEventHistory();
  const evt = sampleEvents.find((e) => e.id === 'with_choice');
  const result = applyEvent(p, evt, 'b', history, 0);
  assert.deepEqual(result.effects, evt.choices.find((c) => c.id === 'b').effects);
});
