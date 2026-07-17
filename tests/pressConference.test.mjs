// Tests for the press-conference pure renderer + dialog payload. No DOM,
// no jsdom. The renderer is exercised against pre-built fixtures to
// guarantee escape, ordering, and the empty-state honesty contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPressConferenceDialog,
  buildPressConferenceRecord,
  getPressConferenceChoices,
  getPressConferenceQuestion,
  renderPressConferenceList,
} from '../src/ui/pressConference.js';

// Three deterministic choices are required by the spec (≥ 3 deterministic
// responses). Each milestone exposes exactly the same shape so the UI
// can paint the dialog without knowing the milestone up-front.
test('getPressConferenceChoices returns at least three deterministic choices per milestone', () => {
  for (const milestone of ['transfer-accepted', 'contract-accepted', 'post-expiry']) {
    const choices = getPressConferenceChoices(milestone);
    assert.ok(Array.isArray(choices));
    assert.ok(choices.length >= 3, `${milestone} should expose ≥ 3 choices, got ${choices.length}`);
    const ids = new Set(choices.map((choice) => choice.id));
    assert.equal(ids.size, choices.length, `${milestone} choice ids must be unique`);
  }
});

test('getPressConferenceQuestion returns a non-empty authored string per milestone', () => {
  for (const milestone of ['transfer-accepted', 'contract-accepted', 'post-expiry']) {
    const question = getPressConferenceQuestion(milestone);
    assert.equal(typeof question, 'string');
    assert.ok(question.length > 0);
    assert.doesNotMatch(question, /<script/i, 'questions must be plain text');
  }
});

test('buildPressConferenceDialog returns a safe bodyHtml with escaped context fields and action rows', () => {
  const dialog = buildPressConferenceDialog({
    milestone: 'transfer-accepted',
    playerName: '<img src=x>',
    clubName: '<b>Rheintal</b>',
    ledgerEventId: 'event-42',
  });
  assert.match(dialog.bodyHtml, /&lt;img src=x&gt;/);
  assert.match(dialog.bodyHtml, /&lt;b&gt;Rheintal&lt;\/b&gt;/);
  assert.match(dialog.bodyHtml, /Reference: event-42/);
  assert.equal(dialog.actions.length, getPressConferenceChoices('transfer-accepted').length);
  // first action gets primary variant
  assert.equal(dialog.actions[0].variant, 'primary');
});

test('buildPressConferenceRecord returns canonical-fields-only effects (no invented stats)', () => {
  const record = buildPressConferenceRecord({
    milestone: 'transfer-accepted',
    ledgerEventId: 'event-42',
    choiceId: 'professional',
    tick: 60,
    playerName: 'Alex',
    clubName: 'Hartshill',
  });
  assert.equal(record.choiceId, 'professional');
  assert.equal(record.tick, 60);
  assert.equal(record.ledgerEventId, 'event-42');
  assert.deepEqual(Object.keys(record.effects).sort(), [
    'confidenceDelta', 'memoryWeight', 'relationshipDelta', 'relationshipTargetId',
  ]);
  // No invented stats like 'fame', 'instagram', 'salary'.
  assert.doesNotMatch(JSON.stringify(record.effects), /fame|instagram|salary|brand/i);
});

test('renderPressConferenceList returns the honest empty-state paragraph when there are no records', () => {
  const html = renderPressConferenceList({ pressConferences: [] }, { playerName: 'Alex' });
  assert.match(html, /senior-epilogue__press-empty/);
  assert.match(html, /No press conferences recorded yet/);
});

test('renderPressConferenceList escapes hostile authored text and respects newest-first ordering', () => {
  const html = renderPressConferenceList({
    pressConferences: [
      { id: 'e-old', tick: 10, milestone: 'transfer-accepted', question: 'Older Q',
        choiceId: 'professional', choiceLabel: 'Old <script>alert(1)</script>', effects: {}, ledgerEventId: 'e-old' },
      { id: 'e-new', tick: 90, milestone: 'transfer-accepted', question: 'New <b>Q</b>',
        choiceId: 'gracious', choiceLabel: 'Newer label', effects: {}, ledgerEventId: 'e-new' },
    ],
  }, { playerName: 'Alex' });

  // Escape hostile + rich text.
  assert.match(html, /Old &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /Old <script>alert\(1\)<\/script>/);
  assert.match(html, /New &lt;b&gt;Q&lt;\/b&gt;/);
  // Newest-first: tick 90 must render before tick 10.
  const newer = html.indexOf('Tick 90');
  const older = html.indexOf('Tick 10');
  assert.ok(newer > -1 && older > -1);
  assert.ok(newer < older);
});
