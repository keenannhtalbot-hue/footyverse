import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuarterRecap } from '../src/engines/quarterRecap.js';

test('quarter recap turns recorded actions and quarter changes into truthful prioritized highlights', () => {
  const recap = buildQuarterRecap({
    quarter: 4,
    from: { quarter: 'Spring', year: 2030, age: 8, fatigue: 18 },
    to: { quarter: 'Summer', year: 2030, age: 8, fatigue: 8 },
    evidence: [
      { kind: 'training', label: 'Passing training', stat: 'passing', gain: 3, fatigue: 7 },
      { kind: 'activity', label: 'Rest', changes: [{ key: 'fatigue', delta: -5 }] },
    ],
  });

  assert.equal(recap.quarter, 4);
  assert.equal(recap.dismissed, false);
  assert.equal(recap.highlights.length, 3);
  assert.match(recap.highlights[0], /Passing training → Passing \+3, but fatigue \+7\./);
  assert.match(recap.highlights[1], /Rest → Fatigue -5\./);
  assert.match(recap.highlights[2], /Quarter complete → Summer 2030 began/);
});

test('quarter recap suppresses zero changes and duplicates without inventing three causes', () => {
  const duplicate = { kind: 'activity', label: 'Rest', changes: [{ key: 'fatigue', delta: -4 }] };
  const recap = buildQuarterRecap({
    quarter: 2,
    from: { quarter: 'Summer', year: 2030, age: 8 },
    to: { quarter: 'Autumn', year: 2030, age: 8 },
    evidence: [
      duplicate,
      duplicate,
      { kind: 'activity', label: 'Quiet time', changes: [{ key: 'confidence', delta: 0 }] },
    ],
  });

  assert.deepEqual(recap.highlights, [
    'Rest → Fatigue -4.',
    'Quarter complete → Autumn 2030 began.',
  ]);
  assert.equal(recap.sparse, true);
});

test('quarter recap does not double-punctuate narrative evidence', () => {
  const recap = buildQuarterRecap({
    quarter: 3,
    from: null,
    to: null,
    evidence: [{ kind: 'event', label: 'Your event choice', outcome: 'You made a new friend.' }],
  });

  assert.deepEqual(recap.highlights, ['Your event choice → You made a new friend.']);
});

test('quarter recap keeps distinct repeated actions while suppressing the same evidence identity', () => {
  const action = { kind: 'activity', label: 'Rest', changes: [{ key: 'fatigue', delta: -5 }] };
  const recap = buildQuarterRecap({
    quarter: 4,
    from: null,
    to: null,
    evidence: [{ ...action, id: '4-0' }, { ...action, id: '4-1' }, { ...action, id: '4-1' }],
  });

  assert.deepEqual(recap.highlights, ['Rest → Fatigue -5.', 'Rest → Fatigue -5.']);
});
