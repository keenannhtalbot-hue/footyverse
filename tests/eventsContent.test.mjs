// Regression tests for the youth-arc content density required by
// .hermes/plans/2026-07-12_footyverse-next-slice-brief.md §5 Slice 2.
// The plan mandates: ≥120 events, ≥70 with choices, ≥20 eligible per
// age band, ≥6 chains, no duplicate ids, no single-event fatigue bomb.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../src/data/events.js';
import { CHAINS, getChainStep } from '../src/data/eventChains.js';
import { getEligibleEvents } from '../src/engines/eventEngine.js';
import { createEventHistory } from '../src/engines/eventEngine.js';
import { createPlayer } from '../src/engines/playerEngine.js';

const VALID_CATEGORIES = new Set(['school', 'life', 'football', 'funny', 'rare']);

function makePlayer(overrides = {}) {
  const p = createPlayer({ name: 'Content Tester', gender: 'nonbinary', country: 'Canada', startYear: 2026 });
  return Object.assign(p, overrides);
}

test('event catalog has at least 120 events', () => {
  assert.ok(EVENTS.length >= 120, `expected ≥120 events, got ${EVENTS.length}`);
});

test('at least 70 events expose a choices array with two or more branches', () => {
  const withChoices = EVENTS.filter((e) => Array.isArray(e.choices) && e.choices.length >= 2);
  assert.ok(
    withChoices.length >= 70,
    `expected ≥70 choice-bearing events, got ${withChoices.length}`
  );
});

test('every event id is unique across the catalog', () => {
  const ids = EVENTS.map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, `duplicate ids detected: ${ids.length - unique.size}`);
});

test('every event has a valid category and required numeric fields', () => {
  for (const evt of EVENTS) {
    assert.ok(VALID_CATEGORIES.has(evt.category), `bad category on ${evt.id}: ${evt.category}`);
    assert.equal(typeof evt.weight, 'number', `${evt.id}: weight must be number`);
    assert.ok(evt.weight >= 1, `${evt.id}: weight must be >= 1`);
    assert.equal(typeof evt.minAge, 'number', `${evt.id}: minAge must be number`);
    assert.equal(typeof evt.maxAge, 'number', `${evt.id}: maxAge must be number`);
    assert.ok(evt.minAge >= 5, `${evt.id}: minAge must be ≥ 5`);
    assert.ok(evt.maxAge <= 16, `${evt.id}: maxAge must be ≤ 16`);
    assert.ok(evt.minAge <= evt.maxAge, `${evt.id}: minAge > maxAge`);
    assert.equal(typeof evt.cooldownQuarters, 'number', `${evt.id}: cooldownQuarters must be number`);
    assert.ok(evt.cooldownQuarters >= 1, `${evt.id}: cooldownQuarters must be >= 1`);
    assert.equal(typeof evt.text, 'string', `${evt.id}: text must be string`);
    assert.ok(evt.text.length > 0, `${evt.id}: text must be non-empty`);
  }
});

test('every choice event has branches with unique ids and an effects object', () => {
  for (const evt of EVENTS) {
    if (!evt.choices) continue;
    assert.ok(evt.choices.length >= 2, `${evt.id}: choices must have ≥2 branches`);
    const ids = evt.choices.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${evt.id}: duplicate choice ids`);
    for (const c of evt.choices) {
      assert.equal(typeof c.id, 'string', `${evt.id}/${c.id}: choice id must be string`);
      assert.equal(typeof c.label, 'string', `${evt.id}/${c.id}: choice label must be string`);
      assert.equal(typeof c.effects, 'object', `${evt.id}/${c.id}: effects must be object`);
    }
  }
});

test('no single event applies more than 80 fatigue in any branch', () => {
  for (const evt of EVENTS) {
    const branches = evt.choices ?? [evt];
    for (const branch of branches) {
      const fat = branch.effects?.hidden?.fatigue;
      if (fat !== undefined) {
        assert.ok(Math.abs(fat) <= 80, `${evt.id}: single branch fatigue delta ${fat} > 80`);
      }
    }
  }
});

test('eligible events at age-band midpoints clear the 20-event floor', () => {
  // Plan §2 mandates ≥20 eligible per age band at midpoint.
  const bands = [
    { label: 'ages 5-7', age: 6 },
    { label: 'ages 8-10', age: 9 },
    { label: 'ages 11-13', age: 12 },
    { label: 'ages 14-16', age: 15 },
  ];
  for (const band of bands) {
    const p = makePlayer({ age: band.age, club: band.age >= 6 ? 'Maple Ridge FC' : null });
    const history = createEventHistory();
    const eligible = getEligibleEvents(EVENTS, p, history, 0);
    assert.ok(
      eligible.length >= 20,
      `${band.label}: expected ≥20 eligible at age ${band.age}, got ${eligible.length}`
    );
  }
});

test('chains: at least 6 chains are defined with 3 steps each and unique ids', () => {
  assert.ok(CHAINS.length >= 6, `expected ≥6 chains, got ${CHAINS.length}`);
  const ids = CHAINS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate chain ids');
  for (const chain of CHAINS) {
    assert.equal(chain.steps.length, 3, `chain ${chain.id}: must have exactly 3 steps`);
    const stepIds = chain.steps.map((s) => s.id);
    assert.equal(new Set(stepIds).size, stepIds.length, `chain ${chain.id}: duplicate step ids`);
    assert.equal(chain.steps[0].nextStepId, chain.steps[1].id, `chain ${chain.id}: step 1 link broken`);
    assert.equal(chain.steps[1].nextStepId, chain.steps[2].id, `chain ${chain.id}: step 2 link broken`);
    assert.equal(chain.steps[2].nextStepId, null, `chain ${chain.id}: step 3 must terminalise`);
    // Verify each step references an event that exists in EVENTS.
    for (const step of chain.steps) {
      assert.ok(
        EVENTS.some((e) => e.id === step.eventId),
        `chain ${chain.id}/${step.id}: references unknown event ${step.eventId}`
      );
    }
  }
});

test('chains: getChainStep returns the correct step and throws on unknown ids', () => {
  const chain = CHAINS[0];
  const first = getChainStep(chain.id, chain.steps[0].id);
  assert.equal(first.id, chain.steps[0].id);
  assert.throws(() => getChainStep(chain.id, 'no-such-step'), /unknown step/);
  assert.throws(() => getChainStep('no-such-chain', 'irrelevant'), /unknown chain/);
});