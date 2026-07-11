import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateStateToCurrent } from '../src/engines/stateMigrations.js';

function makeV1State() {
  return {
    player: {
      name: 'Alex Morgan', gender: 'nonbinary', country: 'England',
      year: 2028, age: 7, quarter: 'Fall', quarterIndex: 2,
      stats: { passing: 31, shooting: 27 },
      hidden: { potential: 81, workEthic: 66 },
      club: 'Redbrook Juniors', careerHistory: [{ type: 'joined-club' }],
      storyLedger: [{ text: 'Made the school team.' }],
    },
    world: {
      year: 2028, season: 'Fall', quarterIndex: 2,
      npcs: [{ id: 'npc-0', name: 'Sam', age: 8, country: 'England' }],
      newsLog: [{ text: 'A youth tournament began.' }],
      transferLog: [],
    },
    relationships: { coach: { id: 'coach', trust: 61 } },
    settings: { theme: 'dark' },
    quarterCounter: 10,
    seed: 'career-seed',
    rngState: 123456,
    eventHistory: { firedIds: ['first-day'], lastFiredAt: [['first-day', 1]], log: [] },
  };
}

test('migrateStateToCurrent upgrades a v1 childhood save without losing legacy progress', () => {
  const original = makeV1State();
  const migrated = migrateStateToCurrent(original);

  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.legacy.player, original.player);
  assert.deepEqual(migrated.legacy.world, original.world);
  assert.deepEqual(migrated.legacy.relationships, original.relationships);
  assert.deepEqual(migrated.legacy.eventHistory, original.eventHistory);
  assert.equal(migrated.playerId, 'person-player');
  assert.equal(migrated.peopleById['person-player'].identity.birthYear, 2021);
  assert.equal(migrated.peopleById['person-player'].identity.name, 'Alex Morgan');
  assert.deepEqual(migrated.peopleById['person-player'].attributes, original.player.stats);
  assert.deepEqual(migrated.clock, { tick: 10, year: 2028, quarterIndex: 2, week: 0 });
  assert.deepEqual(migrated.rng, { legacyState: 123456, algorithm: 'mulberry32-v1' });
  for (const container of [
    'clubsById', 'teamsById', 'competitionsById', 'seasonsById', 'fixturesById',
    'contractsById', 'negotiationsById', 'registrationsById', 'nationalTeamsById',
    'callUpsById', 'awardsById',
  ]) {
    assert.deepEqual(migrated[container], {}, `${container} starts empty`);
  }
  assert.deepEqual(migrated.activeSeasonIds, []);
  assert.deepEqual(migrated.pendingDecisionIds, []);
  assert.deepEqual(migrated.idCounters, {});
  assert.equal(migrated.seed, original.seed);
  assert.deepEqual(original, makeV1State(), 'migration must not mutate the imported save');
});
