import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuidedSeason,
  ensureGuidedSeason,
  resolveActiveStep,
  resolveActiveStepForApp,
  markStepDismissed,
  markStepCompleted,
  resetGuidedHints,
  recordApSpend,
  recordApRefill,
  recordQuarterAdvance,
  recordChoiceTaken,
  recordHomeOpened,
} from '../src/engines/guidedSeason.js';

const FRESH = createGuidedSeason();

function makeState(overrides = {}) {
  const top = overrides.topLevel ?? {};
  return {
    guidedSeason: overrides.guidedSeason !== undefined
      ? overrides.guidedSeason
      : createGuidedSeason(),
    player: {
      age: 7,
      ap: 10,
      apSpentCount: 0,
      quarterCounter: 2,
      choicesTaken: 0,
      hidden: { fatigue: 0 },
      ...overrides.player,
    },
    careerState: {
      clock: { tick: 3 },
      negotiationsById: {},
      ...(overrides.careerState ?? {}),
    },
    quarterRecap: 'quarterRecap' in overrides ? overrides.quarterRecap : null,
    activeApp: 'home',
    ...top,
  };
}

test('createGuidedSeason returns a JSON-safe empty seeded shape with resetCount 0', () => {
  const g = createGuidedSeason();
  assert.equal(g.schemaVersion, 1);
  assert.deepEqual(g.seen, {});
  assert.equal(g.resetCount, 0);
  assert.ok(Number.isFinite(g.lastUpdatedAt));
  assert.doesNotThrow(() => JSON.stringify(g));
});

test('ensureGuidedSeason fills defaults for legacy saves that predate guided hints', () => {
  const out = ensureGuidedSeason(undefined);
  assert.equal(out.schemaVersion, 1);
  assert.deepEqual(out.seen, {});
  assert.equal(out.resetCount, 0);

  const out2 = ensureGuidedSeason({});
  assert.equal(out2.schemaVersion, 1);

  const existing = {
    schemaVersion: 1,
    seen: { 'home.objective': { dismissed: true, completed: true } },
    resetCount: 2,
    lastUpdatedAt: 1,
  };
  assert.deepEqual(ensureGuidedSeason(existing), existing);
});

test('resolveActiveStep returns the first home.objective moment for a brand-new player', () => {
  const step = resolveActiveStep(makeState());
  assert.ok(step, 'expected a step for a brand-new player');
  assert.equal(step.id, 'home.objective');
  assert.equal(step.app, 'home');
  assert.match(step.title, /plan/i);
  assert.match(step.body, /home/i);
});

test('resolveActiveStep returns null after every step has been completed or dismissed', () => {
  const seen = {};
  for (const id of ['home.objective', 'ap.spend', 'fatigue', 'choice.moment', 'quarter.advance', 'recap.read']) {
    seen[id] = { dismissed: true, completed: true, at: 1 };
  }
  const state = makeState({ guidedSeason: { ...FRESH, seen } });
  assert.equal(resolveActiveStep(state), null);
});

test('resolveActiveStep advances to ap.spend after home.objective has been seen', () => {
  const seen = { 'home.objective': { dismissed: true, completed: true, at: 0 } };
  const state = makeState({ guidedSeason: { ...FRESH, seen } });
  const step = resolveActiveStep(state);
  assert.ok(step);
  assert.equal(step.id, 'ap.spend');
  assert.equal(step.app, 'football');
});

test('recordApSpend flags ap.spend complete and resets the next sequential step to fatigue', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: false, completed: false, at: 0 },
  };
  const state = makeState({ guidedSeason: { ...FRESH, seen }, player: { apSpentCount: 1 } });
  const out = recordApSpend(state);
  assert.equal(out.guidedSeason.seen['ap.spend'].completed, true);
  assert.equal(out.player.apSpentCount, 2);

  const step = resolveActiveStep(out);
  assert.ok(step);
  assert.equal(step.id, 'fatigue');
});

test('resolveActiveStep does not re-show a dismissed step after a save/load round trip', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 4 },
    'ap.spend': { dismissed: true, completed: false, at: 4 },
    'fatigue': { dismissed: false, completed: false, at: 0 },
  };
  const state = makeState({ guidedSeason: { ...FRESH, seen }, player: { quarterCounter: 5 } });
  const step = resolveActiveStep(state);
  assert.ok(step);
  assert.equal(step.id, 'fatigue', 'dismissed previous step but did not nag again');
});

test('resolveActiveStep does not render the choice.moment hint after the player took a non-training choice', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: true, completed: true, at: 0 },
    'fatigue': { dismissed: true, completed: true, at: 0 },
    'choice.moment': { dismissed: false, completed: false, at: 0 },
  };
  const state = makeState({ guidedSeason: { ...FRESH, seen }, player: { choicesTaken: 1 } });
  const afterAction = recordChoiceTaken(state);
  const step = resolveActiveStep(afterAction);
  assert.ok(step);
  assert.equal(step.id, 'quarter.advance', 'next step is quarter advance after the choice was taken');
  assert.equal(afterAction.guidedSeason.seen['choice.moment'].completed, true);
});

test('resolveActiveStepForApp hides a step that belongs to a different app', () => {
  const state = makeState({ activeApp: 'profile' });
  const step = resolveActiveStep(state);
  assert.ok(step, 'resolver still knows the active step regardless of app');
  assert.equal(step.app, 'home');
  assert.equal(resolveActiveStepForApp(state, 'profile'), null);
  assert.notEqual(resolveActiveStepForApp(state, 'home'), null);
});

test('resolveActiveStep suppresses the recap.read hint once the player has dismissed the recap', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: true, completed: true, at: 0 },
    'fatigue': { dismissed: true, completed: true, at: 0 },
    'choice.moment': { dismissed: true, completed: true, at: 0 },
    'quarter.advance': { dismissed: true, completed: true, at: 0 },
    'recap.read': { dismissed: false, completed: false, at: 0 },
  };
  const state = makeState({
    guidedSeason: { ...FRESH, seen },
    quarterRecap: { dismissed: true, highlights: [] },
  });
  const step = resolveActiveStep(state);
  assert.equal(step, null, 'no hint remains when the recap was dismissed');
});

test('markStepDismissed flips the dismissed flag and bumps lastUpdatedAt', () => {
  const g = createGuidedSeason();
  const before = g.lastUpdatedAt;
  const out = markStepDismissed(g, 'home.objective');
  assert.equal(out.seen['home.objective'].dismissed, true);
  assert.equal(out.seen['home.objective'].completed, true);
  assert.ok(out.lastUpdatedAt >= before);
});

test('markStepCompleted leaves dismissed flag alone but flags completed', () => {
  const g = markStepDismissed(createGuidedSeason(), 'home.objective');
  const out = markStepCompleted(g, 'home.objective');
  assert.equal(out.seen['home.objective'].dismissed, true);
  assert.equal(out.seen['home.objective'].completed, true);
  // markStepCompleted on an already-completed entry leaves state byte-identical.
  const again = markStepCompleted(g, 'home.objective');
  assert.equal(again, g, 'no-op leaves the state untouched');
});

test('markStepDismissed is idempotent for an already dismissed step', () => {
  const once = markStepDismissed(createGuidedSeason(), 'home.objective');
  const twice = markStepDismissed(once, 'home.objective');
  assert.deepEqual(twice, once, 'repeat dismiss yields identical state');
});

test('resetGuidedHints clears the seen map but preserves the resetCount history', () => {
  const g = markStepDismissed(createGuidedSeason(), 'home.objective');
  const cleared = resetGuidedHints(g);
  assert.deepEqual(cleared.seen, {});
  assert.equal(cleared.resetCount, 1);
  const clearedTwice = resetGuidedHints(cleared);
  assert.equal(clearedTwice.resetCount, 2);
});

test('recordHomeOpened completes home.objective and bumps apSpentCount affordance for the next step', () => {
  const state = makeState();
  const out = recordHomeOpened(state);
  assert.equal(out.guidedSeason.seen['home.objective'].completed, true);
  // After opening Home once, the resolver should advance.
  const next = resolveActiveStep(out);
  assert.ok(next);
  assert.equal(next.id, 'ap.spend');
});

test('recordApRefill flags fatigue as complete when AP has been topped up beyond the prior count', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: true, completed: true, at: 0 },
  };
  const state = makeState({
    guidedSeason: { ...FRESH, seen },
    player: { ap: 12, apRefilledFromZero: true, apSpentCount: 1 },
  });
  const out = recordApRefill(state);
  assert.equal(out.guidedSeason.seen['fatigue'].completed, true);
});

test('recordQuarterAdvance flags quarter.advance as complete after the first quarter rolls over', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: true, completed: true, at: 0 },
    'fatigue': { dismissed: true, completed: true, at: 0 },
    'choice.moment': { dismissed: true, completed: true, at: 0 },
  };
  const state = makeState({
    guidedSeason: { ...FRESH, seen },
    player: { quarterCounter: 4 },
  });
  const out = recordQuarterAdvance(state, { previousQuarterCounter: 3 });
  assert.equal(out.guidedSeason.seen['quarter.advance'].completed, true);
});

test('recordChoiceTaken marks choice.moment complete without racing with completed flags', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: true, completed: true, at: 0 },
    'fatigue': { dismissed: true, completed: true, at: 0 },
  };
  const state = makeState({
    guidedSeason: { ...FRESH, seen },
    player: { choicesTaken: 1 },
  });
  const out = recordChoiceTaken(state);
  assert.equal(out.guidedSeason.seen['choice.moment'].completed, true);
});

test('round trip createGuidedSeason -> JSON -> ensureGuidedSeason preserves seen history', () => {
  const g = markStepDismissed(createGuidedSeason(), 'home.objective');
  const json = JSON.parse(JSON.stringify(g));
  const restored = ensureGuidedSeason(json);
  assert.equal(restored.seen['home.objective'].dismissed, true);
  assert.equal(restored.resetCount, 0);
});

test('resolveActiveStep is deterministic for the same input state', () => {
  const state = makeState();
  const a = resolveActiveStep(state);
  const b = resolveActiveStep(state);
  assert.deepEqual(a, b);
});

test('resolveActiveStep does not mutate the input state', () => {
  const state = makeState();
  const snapshot = JSON.stringify(state);
  resolveActiveStep(state);
  assert.equal(JSON.stringify(state), snapshot);
});

test('resolveActiveStep returns null for a senior player with substantial progress', () => {
  const seen = {
    'home.objective': { dismissed: true, completed: true, at: 0 },
    'ap.spend': { dismissed: true, completed: true, at: 0 },
    'fatigue': { dismissed: true, completed: true, at: 0 },
    'choice.moment': { dismissed: true, completed: true, at: 0 },
    'quarter.advance': { dismissed: true, completed: true, at: 0 },
    'recap.read': { dismissed: true, completed: true, at: 0 },
  };
  const state = makeState({
    guidedSeason: { ...FRESH, seen },
    player: { age: 16, apSpentCount: 12, choicesTaken: 6, quarterCounter: 18 },
  });
  assert.equal(resolveActiveStep(state), null);
});
