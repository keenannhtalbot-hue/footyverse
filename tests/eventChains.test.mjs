// Deterministic chain walking tests for the event chain system.
// A chain is a sequence of three steps referencing real events. Walking the
// chain must be deterministic, idempotent on duplicate fires, and terminalise
// at step 3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAINS,
  getChainStep,
  advanceChain,
  createChainState,
  markChainStepFired,
} from '../src/data/eventChains.js';

test('every chain step references an event that exists in the EVENTS catalog', () => {
  // Re-import lazily so we don't bind at module load before events.js exists.
  return import('../src/data/events.js').then(({ EVENTS }) => {
    const eventIds = new Set(EVENTS.map((e) => e.id));
    for (const chain of CHAINS) {
      for (const step of chain.steps) {
        assert.ok(
          eventIds.has(step.eventId),
          `chain ${chain.id}/${step.id}: eventId ${step.eventId} missing`
        );
      }
    }
  });
});

test('walking a chain advances one step per fire and stops at step 3', () => {
  const chain = CHAINS[0]; // pick the first chain deterministically
  const chainState = createChainState();
  const start = chainState.chains[chain.id];
  assert.equal(start.currentStepId, chain.steps[0].id);
  assert.equal(start.completed, false);

  // Fire step 1 → step 2.
  markChainStepFired(chainState, chain.id, chain.steps[0].id);
  assert.equal(chainState.chains[chain.id].currentStepId, chain.steps[1].id);
  assert.equal(chainState.chains[chain.id].completed, false);

  // Fire step 2 → step 3.
  markChainStepFired(chainState, chain.id, chain.steps[1].id);
  assert.equal(chainState.chains[chain.id].currentStepId, chain.steps[2].id);
  assert.equal(chainState.chains[chain.id].completed, false);

  // Fire step 3 → completed.
  markChainStepFired(chainState, chain.id, chain.steps[2].id);
  assert.equal(chainState.chains[chain.id].completed, true);
});

test('chain walk is deterministic for a given chain id', () => {
  const a = createChainState();
  const b = createChainState();
  for (const chain of CHAINS) {
    assert.equal(
      a.chains[chain.id].currentStepId,
      b.chains[chain.id].currentStepId
    );
    assert.equal(a.chains[chain.id].completed, b.chains[chain.id].completed);
  }
});

test('idempotent firing of the same step does not double-advance', () => {
  const chainState = createChainState();
  const chain = CHAINS[1];
  const startStep = chainState.chains[chain.id].currentStepId;
  markChainStepFired(chainState, chain.id, startStep);
  markChainStepFired(chainState, chain.id, startStep); // duplicate fire
  markChainStepFired(chainState, chain.id, startStep); // duplicate fire
  assert.equal(chainState.chains[chain.id].currentStepId, chain.steps[1].id);
  assert.equal(chainState.chains[chain.id].completed, false);
});

test('firing a non-current step leaves the chain state unchanged', () => {
  const chainState = createChainState();
  const chain = CHAINS[2];
  const originalStep = chainState.chains[chain.id].currentStepId;
  const notCurrent = chain.steps.find((s) => s.id !== originalStep);
  markChainStepFired(chainState, chain.id, notCurrent.id);
  assert.equal(chainState.chains[chain.id].currentStepId, originalStep);
});

test('advanceChain returns the next step object or null at the terminal', () => {
  const chain = CHAINS[0];
  const s1 = getChainStep(chain.id, chain.steps[0].id);
  const s2 = advanceChain(chain.id, s1.id);
  assert.equal(s2.id, chain.steps[1].id);
  const s3 = advanceChain(chain.id, s2.id);
  assert.equal(s3.id, chain.steps[2].id);
  const end = advanceChain(chain.id, s3.id);
  assert.equal(end, null);
});