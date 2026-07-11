import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTeacherName } from '../src/data/names.js';

test('formatTeacherName chooses an appropriate title from the generated gender', () => {
  assert.equal(formatTeacherName({ first: 'Avery Campbell', gender: 'boy' }), 'Mr. Campbell');
  assert.equal(formatTeacherName({ first: 'Maya Campbell', gender: 'girl' }), 'Ms. Campbell');
  assert.equal(formatTeacherName({ first: 'Riley Campbell', gender: 'neutral' }), 'Mx. Campbell');
});

test('formatTeacherName preserves compound surname text after the first name', () => {
  assert.equal(formatTeacherName({ first: 'Ana De la Cruz', gender: 'girl' }), 'Ms. De la Cruz');
});
