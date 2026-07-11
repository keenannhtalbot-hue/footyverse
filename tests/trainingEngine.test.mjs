import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/engines/playerEngine.js';
import {
  trainStat,
  isInjured,
  recoverQuarter,
  eligibleInjuryTypes,
  treatInjury,
  canPerformActivity,
  INJURY_INFO,
  TRAINING_STATS,
} from '../src/engines/trainingEngine.js';

function noInjuryRng() {
  return { chance: () => false, pick: (arr) => arr[0], int: (min, max) => max, next: () => 0.5 };
}
function alwaysInjuryRng() {
  return { chance: () => true, pick: (arr) => arr[arr.length - 1], int: (min, max) => max, next: () => 0.5 };
}

test('TRAINING_STATS includes all seven visible stat categories', () => {
  assert.deepEqual(
    [...TRAINING_STATS].sort(),
    ['defending', 'dribbling', 'goalkeeping', 'passing', 'pace', 'physical', 'shooting'].sort()
  );
});

test('trainStat spends AP and increases the stat when no injury occurs', () => {
  const p = createPlayer({ name: 'Ash', gender: 'boy', country: 'England', startYear: 2026 });
  const before = p.stats.passing;
  const apBefore = p.ap;
  const result = trainStat(p, 'passing', noInjuryRng());
  assert.equal(result.success, true);
  assert.ok(p.ap < apBefore);
  assert.ok(p.stats.passing > before);
  assert.equal(result.injury, undefined);
});

test('trainStat fails gracefully when AP is insufficient', () => {
  const p = createPlayer({ name: 'Bo', gender: 'girl', country: 'Spain', startYear: 2026 });
  p.ap = 0;
  const result = trainStat(p, 'shooting', noInjuryRng());
  assert.equal(result.success, false);
  assert.equal(result.reason, 'insufficient_ap');
});

test('trainStat increases fatigue', () => {
  const p = createPlayer({ name: 'Cy', gender: 'boy', country: 'Germany', startYear: 2026 });
  const before = p.hidden.fatigue;
  trainStat(p, 'physical', noInjuryRng());
  assert.ok(p.hidden.fatigue > before);
});

test('trainStat can trigger an injury that sidelines the player', () => {
  const p = createPlayer({ name: 'Dee', gender: 'girl', country: 'Brazil', startYear: 2026 });
  p.age = 10; // old enough that the forced-pick injury pool includes sidelining injuries
  const result = trainStat(p, 'pace', alwaysInjuryRng());
  assert.equal(result.success, true);
  assert.ok(result.injury);
  assert.ok(isInjured(p));
});

test('a forced injury at age 5 is a minor bruise that does not sideline', () => {
  const p = createPlayer({ name: 'Gio', gender: 'boy', country: 'Brazil', startYear: 2026 });
  const result = trainStat(p, 'pace', alwaysInjuryRng());
  assert.equal(result.injury.type, 'bruise');
  assert.equal(isInjured(p), false);
});

test('eligibleInjuryTypes gates severe injuries by age', () => {
  assert.deepEqual(eligibleInjuryTypes(5), ['bruise']);
  assert.ok(eligibleInjuryTypes(6).includes('sprain'));
  assert.ok(!eligibleInjuryTypes(6).includes('broken_ankle'));
  assert.ok(eligibleInjuryTypes(8).includes('broken_ankle'));
  assert.ok(!eligibleInjuryTypes(8).includes('acl'));
  assert.ok(eligibleInjuryTypes(10).includes('acl'));
});

test('every injury type has realistic descriptive text and severity', () => {
  for (const key of Object.keys(INJURY_INFO)) {
    const info = INJURY_INFO[key];
    assert.ok(info.label);
    assert.ok(info.text);
    assert.ok(['minor', 'moderate', 'severe'].includes(info.severity));
    assert.ok(info.quartersOut >= 0);
  }
});

test('recoverQuarter counts down an injury and clears it once healed', () => {
  const p = createPlayer({ name: 'Eli', gender: 'boy', country: 'Canada', startYear: 2026 });
  p.injury = { type: 'sprain', quartersOut: 1, ...INJURY_INFO.sprain };
  recoverQuarter(p);
  assert.equal(isInjured(p), false);
  assert.equal(p.injury, null);
});

test('recoverQuarter reduces fatigue even without an injury', () => {
  const p = createPlayer({ name: 'Fay', gender: 'girl', country: 'Spain', startYear: 2026 });
  p.hidden.fatigue = 50;
  recoverQuarter(p);
  assert.ok(p.hidden.fatigue < 50);
});

test('treatInjury speeds up recovery and marks the physio as used this quarter', () => {
  const p = createPlayer({ name: 'Gale', gender: 'boy', country: 'England', startYear: 2026 });
  p.injury = { ...INJURY_INFO.sprain, type: 'sprain', quartersOut: 2 };
  const result = treatInjury(p);
  assert.equal(result.success, true);
  assert.equal(p.injury.quartersOut, 1);
  assert.equal(p.physioUsedThisQuarter, true);
});

test('treatInjury refuses a second visit in the same quarter (blocks button-mashing)', () => {
  const p = createPlayer({ name: 'Hana', gender: 'girl', country: 'England', startYear: 2026 });
  p.injury = { type: 'acl', quartersOut: 4, ...INJURY_INFO.acl };
  treatInjury(p);
  const quartersOutAfterFirstVisit = p.injury.quartersOut;
  const second = treatInjury(p);
  assert.equal(second.success, false);
  assert.equal(second.reason, 'already_treated');
  assert.equal(p.injury.quartersOut, quartersOutAfterFirstVisit);
});

test('treatInjury refuses when the player is not injured', () => {
  const p = createPlayer({ name: 'Ike', gender: 'boy', country: 'England', startYear: 2026 });
  const result = treatInjury(p);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'not_injured');
});

test('recoverQuarter resets the physio limit so it can be used again next quarter', () => {
  const p = createPlayer({ name: 'Joss', gender: 'nonbinary', country: 'England', startYear: 2026 });
  p.injury = { type: 'acl', quartersOut: 4, ...INJURY_INFO.acl };
  treatInjury(p);
  assert.equal(p.physioUsedThisQuarter, true);
  recoverQuarter(p);
  assert.equal(p.physioUsedThisQuarter, false);
  const result = treatInjury(p);
  assert.equal(result.success, true);
});

test('canPerformActivity blocks physically demanding activities while injured', () => {
  const p = createPlayer({ name: 'Kya', gender: 'girl', country: 'England', startYear: 2026 });
  p.injury = { type: 'sprain', quartersOut: 1, ...INJURY_INFO.sprain };
  assert.equal(canPerformActivity(p, { physicallyDemanding: true }), false);
});

test('canPerformActivity allows non-physical activities and any activity while healthy', () => {
  const injured = createPlayer({ name: 'Liam', gender: 'boy', country: 'England', startYear: 2026 });
  injured.injury = { type: 'sprain', quartersOut: 1, ...INJURY_INFO.sprain };
  assert.equal(canPerformActivity(injured, { physicallyDemanding: false }), true);
  assert.equal(canPerformActivity(injured, {}), true);

  const healthy = createPlayer({ name: 'Mabel', gender: 'girl', country: 'England', startYear: 2026 });
  assert.equal(canPerformActivity(healthy, { physicallyDemanding: true }), true);
});
