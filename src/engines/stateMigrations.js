// Sequential, DOM-independent migrations for canonical JSON-safe career state.

export const CURRENT_SCHEMA_VERSION = 2;

const EMPTY_ENTITY_CONTAINERS = [
  'clubsById',
  'teamsById',
  'competitionsById',
  'seasonsById',
  'fixturesById',
  'contractsById',
  'negotiationsById',
  'registrationsById',
  'nationalTeamsById',
  'callUpsById',
  'awardsById',
];

export function migrateStateToCurrent(savedState) {
  if (!savedState || typeof savedState !== 'object' || Array.isArray(savedState)) {
    throw new TypeError('Save state must be an object.');
  }

  if (savedState.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return cloneJson(savedState);
  }

  if (savedState.schemaVersion !== undefined && savedState.schemaVersion !== 1) {
    throw new Error(`Unsupported save schema version: ${savedState.schemaVersion}`);
  }

  return v1ToV2(savedState);
}

export function v1ToV2(savedState) {
  const legacy = cloneJson(savedState);
  const player = legacy.player;
  const world = legacy.world;
  const peopleById = {
    'person-player': {
      id: 'person-player',
      kind: 'player',
      identity: {
        name: player.name,
        gender: player.gender,
        birthYear: world.year - player.age,
        countryId: player.country,
        nationalityIds: [player.country],
      },
      attributes: cloneJson(player.stats),
      hidden: cloneJson(player.hidden),
    },
  };

  const migrated = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seed: legacy.seed,
    clock: {
      tick: legacy.quarterCounter,
      year: world.year,
      quarterIndex: world.quarterIndex,
      week: 0,
    },
    rng: { legacyState: legacy.rngState, algorithm: 'mulberry32-v1' },
    playerId: 'person-player',
    peopleById,
    activeSeasonIds: [],
    pendingDecisionIds: [],
    ledger: [],
    newsLog: cloneJson(world.newsLog ?? []),
    idCounters: {},
    settings: cloneJson(legacy.settings ?? {}),
    legacy: {
      player: legacy.player,
      world: legacy.world,
      relationships: legacy.relationships,
      eventHistory: legacy.eventHistory,
    },
  };

  for (const key of EMPTY_ENTITY_CONTAINERS) migrated[key] = {};
  return migrated;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
