import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer,
  advanceQuarter,
  applyStatChange,
  spendAP,
  resetAP,
  getOverall,
  recordMatchObservation,
  QUARTERS,
} from '../src/engines/playerEngine.js';

test('createPlayer starts at age 5, Spring, no position, no overall', () => {
  const p = createPlayer({ name: 'Alex Rivera', gender: 'girl', country: 'Canada', startYear: 2026 });
  assert.equal(p.age, 5);
  assert.equal(p.quarter, 'Spring');
  assert.equal(p.quarterIndex, 0);
  assert.equal(p.year, 2026);
  assert.equal(p.position, null);
  assert.equal(getOverall(p), null);
  assert.equal(p.name, 'Alex Rivera');
  assert.equal(p.gender, 'girl');
  assert.equal(p.country, 'Canada');
  assert.ok(p.ap > 0);
  assert.ok(p.apMax > 0);
});

test('createPlayer initializes visible stats 0-100 and hidden stats present', () => {
  const p = createPlayer({ name: 'Kai', gender: 'boy', country: 'Brazil', startYear: 2026 });
  for (const stat of ['passing', 'shooting', 'pace', 'dribbling', 'defending', 'physical', 'goalkeeping']) {
    assert.ok(stat in p.stats, `missing visible stat ${stat}`);
    assert.ok(p.stats[stat] >= 0 && p.stats[stat] <= 100);
  }
  assert.ok('potential' in p.hidden);
  assert.ok('confidence' in p.hidden);
  assert.ok(p.hidden.potential >= 0 && p.hidden.potential <= 100);
});

test('advanceQuarter cycles through Spring, Summer, Fall, Winter and ages up on wrap', () => {
  const p = createPlayer({ name: 'Sam', gender: 'nonbinary', country: 'Spain', startYear: 2026 });
  assert.equal(p.quarter, 'Spring');
  advanceQuarter(p);
  assert.equal(p.quarter, 'Summer');
  assert.equal(p.age, 5);
  advanceQuarter(p);
  assert.equal(p.quarter, 'Fall');
  advanceQuarter(p);
  assert.equal(p.quarter, 'Winter');
  assert.equal(p.age, 5);
  advanceQuarter(p);
  assert.equal(p.quarter, 'Spring');
  assert.equal(p.age, 6);
  assert.equal(p.year, 2027);
});

test('advanceQuarter resets AP to apMax', () => {
  const p = createPlayer({ name: 'Ori', gender: 'boy', country: 'Germany', startYear: 2026 });
  spendAP(p, p.apMax);
  assert.equal(p.ap, 0);
  advanceQuarter(p);
  assert.equal(p.ap, p.apMax);
});

test('advanceQuarter does not touch fatigue — trainingEngine.recoverQuarter is the sole owner of fatigue recovery', () => {
  const p = createPlayer({ name: 'Pia', gender: 'girl', country: 'Germany', startYear: 2026 });
  p.hidden.fatigue = 50;
  advanceQuarter(p);
  assert.equal(p.hidden.fatigue, 50);
});

test('applyStatChange clamps between 0 and 100', () => {
  const p = createPlayer({ name: 'Nia', gender: 'girl', country: 'England', startYear: 2026 });
  applyStatChange(p, 'passing', 1000);
  assert.equal(p.stats.passing, 100);
  applyStatChange(p, 'passing', -1000);
  assert.equal(p.stats.passing, 0);
});

test('spendAP reduces AP and refuses to go negative', () => {
  const p = createPlayer({ name: 'Leo', gender: 'boy', country: 'Canada', startYear: 2026 });
  const ok = spendAP(p, 2);
  assert.equal(ok, true);
  assert.equal(p.ap, p.apMax - 2);
  const tooMuch = spendAP(p, 999);
  assert.equal(tooMuch, false);
});

test('resetAP restores AP to apMax', () => {
  const p = createPlayer({ name: 'Mia', gender: 'girl', country: 'Brazil', startYear: 2026 });
  spendAP(p, 1);
  resetAP(p);
  assert.equal(p.ap, p.apMax);
});

test('getOverall is null until enough match observations, then numeric', () => {
  const p = createPlayer({ name: 'Theo', gender: 'boy', country: 'Spain', startYear: 2026 });
  assert.equal(getOverall(p), null);
  for (let i = 0; i < 4; i++) recordMatchObservation(p);
  assert.equal(getOverall(p), null, 'still below threshold');
  for (let i = 0; i < 10; i++) recordMatchObservation(p);
  const overall = getOverall(p);
  assert.ok(typeof overall === 'number' && overall >= 0 && overall <= 100);
});

test('QUARTERS exports the four-quarter cycle in order', () => {
  assert.deepEqual(QUARTERS, ['Spring', 'Summer', 'Fall', 'Winter']);
});
