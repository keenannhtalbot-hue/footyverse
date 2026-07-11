import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRelationship,
  adjustRelationship,
  addMemory,
  describeRelationship,
  MAX_RECENT_MEMORIES,
} from '../src/engines/relationshipEngine.js';

test('createRelationship initializes dimensions at neutral 50 and empty memories', () => {
  const rel = createRelationship({ id: 'coach-1', name: 'Coach Lena', role: 'coach', personality: 'strict' });
  assert.equal(rel.trust, 50);
  assert.equal(rel.respect, 50);
  assert.equal(rel.opinion, 50);
  assert.equal(rel.morale, 50);
  assert.deepEqual(rel.memories, []);
  assert.deepEqual(rel.coreMemories, []);
  assert.equal(rel.personality, 'strict');
});

test('createRelationship stores likes and dislikes when provided', () => {
  const rel = createRelationship({ id: 'friend-1', name: 'Sam', role: 'friend', likes: ['jokes'], dislikes: ['losing'] });
  assert.deepEqual(rel.likes, ['jokes']);
  assert.deepEqual(rel.dislikes, ['losing']);
});

test('adjustRelationship applies deltas and clamps between 0 and 100', () => {
  const rel = createRelationship({ id: 'parent-1', name: 'Mom', role: 'parent' });
  adjustRelationship(rel, { trust: 10, respect: -5 });
  assert.equal(rel.trust, 60);
  assert.equal(rel.respect, 45);
  adjustRelationship(rel, { trust: 1000 });
  assert.equal(rel.trust, 100);
  adjustRelationship(rel, { respect: -1000 });
  assert.equal(rel.respect, 0);
});

test('addMemory appends a memory entry', () => {
  const rel = createRelationship({ id: 'coach-2', name: 'Coach Ade', role: 'coach' });
  addMemory(rel, 'Praised effort in training', 2, 0);
  assert.equal(rel.memories.length, 1);
  assert.equal(rel.memories[0].text, 'Praised effort in training');
});

test('memory conversion compresses oldest memories into coreMemories once over the cap', () => {
  const rel = createRelationship({ id: 'coach-3', name: 'Coach Priya', role: 'coach' });
  for (let i = 0; i < MAX_RECENT_MEMORIES + 3; i++) {
    addMemory(rel, `Memory number ${i}`, 1, i);
  }
  assert.equal(rel.memories.length, MAX_RECENT_MEMORIES);
  assert.ok(rel.coreMemories.length >= 1, 'expected at least one core memory summary');
  assert.equal(rel.memories[rel.memories.length - 1].text, `Memory number ${MAX_RECENT_MEMORIES + 2}`);
});

test('describeRelationship returns a warmer label for high scores than low scores', () => {
  const warm = createRelationship({ id: 'a', name: 'A', role: 'friend' });
  adjustRelationship(warm, { trust: 40, respect: 40, opinion: 40 });
  const cold = createRelationship({ id: 'b', name: 'B', role: 'friend' });
  adjustRelationship(cold, { trust: -40, respect: -40, opinion: -40 });
  assert.notEqual(describeRelationship(warm), describeRelationship(cold));
});
