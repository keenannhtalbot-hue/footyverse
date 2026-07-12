import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProgressMarkers } from '../src/engines/guidedSeasonIntegration.js';
import {
  createGuidedSeason,
  ensureGuidedSeason,
  recordApSpend,
  recordChoiceTaken,
  recordHomeOpened,
  resolveActiveStep,
} from '../src/engines/guidedSeason.js';

function makeState(overrides = {}) {
  return {
    guidedSeason: createGuidedSeason(),
    player: {
      age: 7,
      ap: 10,
      apMax: 12,
      apSpentCount: 0,
      quarterCounter: 0,
      choicesTaken: 0,
      hidden: { fatigue: 0 },
      ...overrides.player,
    },
    careerState: { clock: { tick: 0 }, negotiationsById: {} },
    quarterRecap: null,
    activeApp: 'home',
  };
}

test('applyProgressMarkers ap.spend marks the ap.spend step complete and increments apSpentCount', () => {
  const state = makeState();
  const out = applyProgressMarkers(state, 'ap.spend', { previousAp: state.player.ap });
  assert.equal(out.player.apSpentCount, 1);
  assert.equal(out.guidedSeason.seen['ap.spend'].completed, true);
});

test('applyProgressMarkers ap.refill flags fatigue when the player\'s AP refilled and they had previously spent', () => {
  const state = makeState({ player: { ap: 12, apSpentCount: 1, previousAp: 0 } });
  const out = applyProgressMarkers(state, 'ap.refill', { previousAp: 0 });
  assert.equal(out.guidedSeason.seen['fatigue'].completed, true);
});

test('applyProgressMarkers ap.refill does NOT flag fatigue when there was no prior spend (first run)', () => {
  const state = makeState({ player: { ap: 12, apSpentCount: 0 } });
  const out = applyProgressMarkers(state, 'ap.refill', { previousAp: 0 });
  assert.equal(out.guidedSeason.seen['fatigue'], undefined);
});

test('applyProgressMarkers quarter.advance marks quarter.advance complete when counter incremented', () => {
  const state = makeState({ player: { quarterCounter: 1 } });
  const out = applyProgressMarkers(state, 'quarter.advance', { previousQuarterCounter: 0 });
  assert.equal(out.guidedSeason.seen['quarter.advance'].completed, true);
});

test('applyProgressMarkers choice.taken marks choice.moment complete and increments choicesTaken', () => {
  const state = makeState();
  const out = applyProgressMarkers(state, 'choice.taken');
  assert.equal(out.guidedSeason.seen['choice.moment'].completed, true);
  assert.equal(out.player.choicesTaken, 1);
});

test('applyProgressMarkers home.opened marks home.objective complete on first opening', () => {
  const state = makeState();
  const out = applyProgressMarkers(state, 'home.opened');
  assert.equal(out.guidedSeason.seen['home.objective'].completed, true);
  assert.equal(out.player.openedHomeOnce, true);
});

test('applyProgressMarkers returns the state byte-identically for an unknown event kind', () => {
  const state = makeState();
  const out = applyProgressMarkers(state, 'no-such-event');
  assert.equal(out, state);
});

test('applyProgressMarkers is idempotent for repeat events of the same kind', () => {
  const state = makeState();
  const once = applyProgressMarkers(state, 'ap.spend');
  const twice = applyProgressMarkers(once, 'ap.spend');
  // apSpentCount should still be exactly 1 (recordApSpend uses tallySpent).
  const step = resolveActiveStep(twice);
  // ap.spend should be cleared, next step is fatigue or ap.spend is no longer pending.
  assert.ok(step);
  assert.equal(step.id, 'fatigue');
  assert.equal(twice.player.apSpentCount, 1);
});

test('record* helpers do not throw when guidedSeason is null (defense in depth)', () => {
  // Simulate the post-deserialization boundary where ensureGuidedSeason has
  // not yet been called: a null guidedSeason sits in state. record* should
  // either no-op safely or hydrate internally — never throw a TypeError.
  const state = {
    guidedSeason: null,
    player: { age: 7, ap: 10, apMax: 12, apSpentCount: 0, quarterCounter: 1, choicesTaken: 0, hidden: { fatigue: 0 } },
    careerState: { clock: { tick: 0 }, negotiationsById: {} },
    quarterRecap: null,
    activeApp: 'home',
  };

  assert.doesNotThrow(() => recordHomeOpened(state));
  assert.doesNotThrow(() => recordApSpend(state));
  assert.doesNotThrow(() => recordChoiceTaken(state));

  // After any of these, ensureGuidedSeason should still produce a clean shape.
  const after = recordHomeOpened(state);
  const safe = ensureGuidedSeason(after.guidedSeason);
  assert.equal(safe.schemaVersion, 1);
  assert.equal(safe.seen['home.objective']?.completed, true);
});
