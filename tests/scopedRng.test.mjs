import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopedRng } from '../src/engines/scopedRng.js';

test('scopedRng produces the same sequence for the same seed and scope parts', () => {
  const a = scopedRng(12345, 'fixture', 'fixture-2039-0001');
  const b = scopedRng(12345, 'fixture', 'fixture-2039-0001');
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  assert.deepEqual(seqA, seqB);
});

test('draws from an unrelated scope do not perturb or reuse another scoped stream', () => {
  const fixtureRng = scopedRng(12345, 'fixture', 'fixture-2039-0001');
  const expected = [fixtureRng.next(), fixtureRng.next(), fixtureRng.next()];

  const isolatedFixtureRng = scopedRng(12345, 'fixture', 'fixture-2039-0001');
  const otherRng = scopedRng(12345, 'development', 2039, 'person-42', 'pace');
  otherRng.next();
  otherRng.next();
  otherRng.next();
  otherRng.next();
  otherRng.next();

  const actual = [isolatedFixtureRng.next(), isolatedFixtureRng.next(), isolatedFixtureRng.next()];
  assert.deepEqual(actual, expected);
  assert.notDeepEqual([otherRng.next()], [expected[0]]);
});

test('structurally distinct scopes that collide under naive delimiter joining produce different sequences', () => {
  // boundary shift: ['a|b', 'c'] and ['a', 'b|c'] both naively join to 'a|b|c'
  const boundaryA = scopedRng(1, 'a|b', 'c');
  const boundaryB = scopedRng(1, 'a', 'b|c');
  assert.notEqual(boundaryA.next(), boundaryB.next());

  // type distinction: number 2 and string '2' both stringify to the same text
  const typeNumber = scopedRng(1, 'a', 2);
  const typeString = scopedRng(1, 'a', '2');
  assert.notEqual(typeNumber.next(), typeString.next());
});
