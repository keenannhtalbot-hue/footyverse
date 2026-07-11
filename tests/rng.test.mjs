import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engines/rng.js';

test('createRng produces deterministic sequence for a given seed', () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  assert.deepEqual(seqA, seqB);
});

test('createRng.next() stays within [0, 1)', () => {
  const rng = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('different seeds produce different sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a.next(), b.next());
});

test('int(min, max) is inclusive of bounds and stays within range', () => {
  const rng = createRng(42);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = rng.int(1, 3);
    assert.ok(Number.isInteger(v));
    assert.ok(v >= 1 && v <= 3);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('pick(array) returns an element from the array deterministically', () => {
  const rng1 = createRng(7);
  const rng2 = createRng(7);
  const arr = ['a', 'b', 'c', 'd'];
  assert.equal(rng1.pick(arr), rng2.pick(arr));
  assert.ok(arr.includes(rng1.pick(arr)));
});

test('chance(probability) respects extremes', () => {
  const rng = createRng(9);
  for (let i = 0; i < 50; i++) {
    assert.equal(rng.chance(0), false);
    assert.equal(rng.chance(1), true);
  }
});

test('getState() changes as the rng is consumed', () => {
  const rng = createRng(5);
  const before = rng.getState();
  rng.next();
  const after = rng.getState();
  assert.notEqual(before, after);
});

test('createRng(seed, state) resumes exactly where a captured state left off', () => {
  const original = createRng(777);
  original.next();
  original.next();
  original.next();
  const capturedState = original.getState();
  const expectedNext = original.next();
  const expectedAfter = original.next();

  const resumed = createRng(777, capturedState);
  assert.equal(resumed.next(), expectedNext);
  assert.equal(resumed.next(), expectedAfter);
});

test('resuming from a captured state does not replay from the start of the seed', () => {
  const rng = createRng('call-continuity-seed');
  const freshFirstValue = createRng('call-continuity-seed').next();
  rng.next();
  rng.next();
  const capturedState = rng.getState();
  const resumed = createRng('call-continuity-seed', capturedState);
  assert.notEqual(resumed.next(), freshFirstValue);
});
