import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, recordMatchObservation } from '../src/engines/playerEngine.js';
import { createRelationship } from '../src/engines/relationshipEngine.js';
import {
  checkPathwayOffer,
  joinClub,
  recommendPosition,
  respondToRecommendation,
  resolveMatchChoice,
  MATCH_CHOICES,
} from '../src/engines/footballEngine.js';

function rngWith({ chanceResult = false, pickIndex = 0 } = {}) {
  return {
    chance: () => chanceResult,
    pick: (arr) => arr[pickIndex],
    int: (min, max) => Math.floor((min + max) / 2),
    next: () => 0.5,
  };
}

test('checkPathwayOffer never offers before the country entry age window', () => {
  const p = createPlayer({ name: 'Ivy', gender: 'girl', country: 'England', startYear: 2026 });
  p.age = 5; // England window is 6-7
  const offer = checkPathwayOffer(p, 'England', rngWith({ chanceResult: true }));
  assert.equal(offer, null);
});

test('checkPathwayOffer is not automatic: within window but rng says no yields null', () => {
  const p = createPlayer({ name: 'Jon', gender: 'boy', country: 'England', startYear: 2026 });
  p.age = 6;
  const offer = checkPathwayOffer(p, 'England', rngWith({ chanceResult: false }));
  assert.equal(offer, null);
});

test('checkPathwayOffer returns a club offer within window when rng says yes', () => {
  const p = createPlayer({ name: 'Kim', gender: 'nonbinary', country: 'England', startYear: 2026 });
  p.age = 6;
  const offer = checkPathwayOffer(p, 'England', rngWith({ chanceResult: true }));
  assert.ok(offer);
  assert.ok(typeof offer.club === 'string' && offer.club.length > 0);
});

test('joinClub sets the player club and pathway', () => {
  const p = createPlayer({ name: 'Lou', gender: 'boy', country: 'Canada', startYear: 2026 });
  joinClub(p, { club: 'Maple Ridge FC', pathway: 'Canadian Grassroots-to-Academy Pathway' });
  assert.equal(p.club, 'Maple Ridge FC');
  assert.equal(p.pathway, 'Canadian Grassroots-to-Academy Pathway');
});

test('recommendPosition returns null before enough match observations', () => {
  const p = createPlayer({ name: 'Moe', gender: 'boy', country: 'Spain', startYear: 2026 });
  assert.equal(recommendPosition(p), null);
});

test('recommendPosition recommends a position matching the player\'s strongest attributes', () => {
  const p = createPlayer({ name: 'Nora', gender: 'girl', country: 'Spain', startYear: 2026 });
  for (const stat of Object.keys(p.stats)) p.stats[stat] = 10;
  p.stats.shooting = 95;
  p.stats.pace = 90;
  for (let i = 0; i < 8; i++) recordMatchObservation(p);
  const rec = recommendPosition(p);
  assert.ok(rec);
  assert.equal(rec.position, 'ST');
  assert.ok(rec.confidence > 0);
});

test('respondToRecommendation(accept) sets the player position and improves coach trust', () => {
  const p = createPlayer({ name: 'Omar', gender: 'boy', country: 'Germany', startYear: 2026 });
  const coach = createRelationship({ id: 'coach', name: 'Coach K', role: 'coach' });
  const trustBefore = coach.trust;
  respondToRecommendation(p, coach, 'ST', true);
  assert.equal(p.position, 'ST');
  assert.equal(p.positionAccepted, true);
  assert.ok(coach.trust > trustBefore);
});

test('respondToRecommendation(reject) leaves position unset and dents coach trust', () => {
  const p = createPlayer({ name: 'Priya', gender: 'girl', country: 'Germany', startYear: 2026 });
  const coach = createRelationship({ id: 'coach', name: 'Coach K', role: 'coach' });
  const trustBefore = coach.trust;
  respondToRecommendation(p, coach, 'ST', false);
  assert.equal(p.position, null);
  assert.equal(p.positionAccepted, false);
  assert.ok(coach.trust < trustBefore);
});

test('MATCH_CHOICES exposes shoot, pass, dribble, defend', () => {
  assert.deepEqual([...MATCH_CHOICES].sort(), ['defend', 'dribble', 'pass', 'shoot'].sort());
});

test('resolveMatchChoice success increases confidence, failure decreases it', () => {
  const p = createPlayer({ name: 'Quinn', gender: 'nonbinary', country: 'Brazil', startYear: 2026 });
  p.stats.shooting = 90;
  p.hidden.confidence = 50;
  const successResult = resolveMatchChoice(p, 'shoot', rngWith({ chanceResult: true }));
  assert.equal(successResult.success, true);
  assert.ok(p.hidden.confidence > 50);

  p.hidden.confidence = 50;
  const failResult = resolveMatchChoice(p, 'shoot', rngWith({ chanceResult: false }));
  assert.equal(failResult.success, false);
  assert.ok(p.hidden.confidence < 50);
});

test('resolveMatchChoice rejects an unknown choice id', () => {
  const p = createPlayer({ name: 'Remy', gender: 'boy', country: 'Brazil', startYear: 2026 });
  assert.throws(() => resolveMatchChoice(p, 'teleport', rngWith({})));
});

test('resolveMatchChoice "safe" has a higher success probability than "go" for identical stats', () => {
  const p = createPlayer({ name: 'Suki', gender: 'girl', country: 'Brazil', startYear: 2026 });
  p.stats.shooting = 50;
  p.hidden.confidence = 50;
  const goResult = resolveMatchChoice(p, 'shoot', rngWith({ chanceResult: true }), 'go');
  const safeResult = resolveMatchChoice(p, 'shoot', rngWith({ chanceResult: true }), 'safe');
  assert.ok(safeResult.probability > goResult.probability);
});

test('resolveMatchChoice "go" swings confidence harder than "safe" on the same outcome', () => {
  const pGo = createPlayer({ name: 'Tam', gender: 'boy', country: 'Brazil', startYear: 2026 });
  pGo.hidden.confidence = 50;
  resolveMatchChoice(pGo, 'shoot', rngWith({ chanceResult: true }), 'go');
  const goSwing = pGo.hidden.confidence - 50;

  const pSafe = createPlayer({ name: 'Uma', gender: 'girl', country: 'Brazil', startYear: 2026 });
  pSafe.hidden.confidence = 50;
  resolveMatchChoice(pSafe, 'shoot', rngWith({ chanceResult: true }), 'safe');
  const safeSwing = pSafe.hidden.confidence - 50;

  assert.ok(goSwing > safeSwing);
});

test('resolveMatchChoice "go" grants a small stat gain on success; "safe" does not', () => {
  const pGo = createPlayer({ name: 'Vik', gender: 'boy', country: 'Brazil', startYear: 2026 });
  const goBefore = pGo.stats.shooting;
  resolveMatchChoice(pGo, 'shoot', rngWith({ chanceResult: true }), 'go');
  assert.ok(pGo.stats.shooting > goBefore);

  const pSafe = createPlayer({ name: 'Wren', gender: 'girl', country: 'Brazil', startYear: 2026 });
  const safeBefore = pSafe.stats.shooting;
  resolveMatchChoice(pSafe, 'shoot', rngWith({ chanceResult: true }), 'safe');
  assert.equal(pSafe.stats.shooting, safeBefore);
});

test('resolveMatchChoice "go" is riskier on failure than "safe"', () => {
  const pGo = createPlayer({ name: 'Xander', gender: 'boy', country: 'Brazil', startYear: 2026 });
  pGo.hidden.confidence = 50;
  resolveMatchChoice(pGo, 'shoot', rngWith({ chanceResult: false }), 'go');
  const goDrop = 50 - pGo.hidden.confidence;

  const pSafe = createPlayer({ name: 'Yara', gender: 'girl', country: 'Brazil', startYear: 2026 });
  pSafe.hidden.confidence = 50;
  resolveMatchChoice(pSafe, 'shoot', rngWith({ chanceResult: false }), 'safe');
  const safeDrop = 50 - pSafe.hidden.confidence;

  assert.ok(goDrop > safeDrop);
});

test('resolveMatchChoice defaults to "go" mode when no mode is passed (back-compat)', () => {
  const p = createPlayer({ name: 'Zeke', gender: 'boy', country: 'Brazil', startYear: 2026 });
  const result = resolveMatchChoice(p, 'shoot', rngWith({ chanceResult: true }));
  assert.equal(result.mode, 'go');
});
