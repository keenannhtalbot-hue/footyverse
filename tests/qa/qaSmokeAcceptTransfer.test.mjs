// tests/qa/qaSmokeAcceptTransfer.test.mjs
//
// QA regression: ensures the acceptTransfer action survives an
// engine-rejection failure path without throwing and without
// replacing the original in-memory/persisted state. The independent
// Claude review first found a missing-feedback TypeError after rollback;
// executing this full-app regression then exposed an earlier DataCloneError
// because runtime state contains a function-bearing RNG. The fixed action
// must avoid both failures and preserve the original open negotiation.
//
// We boot the full app via the QA harness, plant an unacceptably
// large transfer fee so the engine rejects, click Accept Transfer
// on the rendered card, and assert: the harness's error recorder
// collects no errors during the rejection path, and the persisted
// state is byte-identical to the pre-click reference (no auto-mutation
// from a partially-completed acceptTransfer).
//
// Runs in its own Node process so module-level `state` resets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootFootyVerse } from '../helpers/qaSmokeHarness.mjs';
import { createEventHistory } from '../../src/engines/eventEngine.js';
import { createPlayer } from '../../src/engines/playerEngine.js';
import { createRelationship } from '../../src/engines/relationshipEngine.js';
import { serializeState } from '../../src/engines/stateSerializer.js';
import { createWorld } from '../../src/engines/worldEngine.js';

function buildAcceptTransferSave() {
  // Start from the real app factories so every UI surface receives the
  // canonical player/world/relationship shape, then install the focused
  // senior transfer fixture that must be rejected by transferEngine.
  const player = createPlayer({
    name: 'QA Player', gender: 'nonbinary', country: 'England', startYear: 2024,
  }, 'qa-accept-transfer-player');
  Object.assign(player, {
    age: 18,
    year: 2037,
    club: 'Redbrook Town FC',
    pathway: 'Senior team',
    position: 'midfielder',
  });
  const careers = {
    schemaVersion: 2,
    seed: 'qa-accept-transfer',
    clock: { tick: 500, year: 2037, quarterIndex: 0, week: 0 },
    playerId: 'person-player',
    peopleById: { 'person-player': player },
    clubsById: {
      'club-redbrook': {
        id: 'club-redbrook', name: 'Redbrook Town FC', countryId: 'england',
        teamIds: ['team-redbrook-senior'],
        finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 50000000 },
      },
      'club-hartshill': {
        id: 'club-hartshill', name: 'Hartshill United FC', countryId: 'england',
        teamIds: ['team-hartshill-senior'],
        finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 1000000 },
      },
    },
    teamsById: {
      'team-redbrook-senior': { id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior', squadPersonIds: ['person-player'] },
      'team-hartshill-senior': { id: 'team-hartshill-senior', clubId: 'club-hartshill', level: 'senior', squadPersonIds: [] },
    },
    competitionsById: {}, seasonsById: {}, fixturesById: {},
    contractsById: {
      'contract-1': {
        id: 'contract-1', personId: 'person-player', clubId: 'club-redbrook',
        status: 'active', kind: 'professional', startTick: 480, endTick: 800,
        wagePerWeekMinor: 120000, signingBonusMinor: 500000,
        squadRole: 'rotation', releaseFeeMinor: 5000000, parentContractId: null,
      },
    },
    registrationsById: {
      'registration-1': {
        id: 'registration-1', personId: 'person-player', teamId: 'team-redbrook-senior',
        contractId: 'contract-1',
        kind: 'permanent', startTick: 480, endTick: null, parentClubId: null, active: true,
      },
    },
    negotiationsById: {
      'negotiation-transfer-1': {
        id: 'negotiation-transfer-1', kind: 'transfer', personId: 'person-player',
        fromClubId: 'club-redbrook', toClubId: 'club-hartshill',
        toTeamId: 'team-hartshill-senior',
        createdTick: 490, expiresTick: 600, status: 'open',
        terms: {
          transferFeeMinor: 999000000, // impossible — exceeds 1M budget.
          durationTicks: 128, wagePerWeekMinor: 130000,
          signingBonusMinor: 30000, squadRole: 'starter',
        },
      },
    },
    nationalTeamsById: {}, callUpsById: {}, awardsById: {},
    activeSeasonIds: [], pendingDecisionIds: ['negotiation-transfer-1'],
    ledger: [], newsLog: [], idCounters: { event: 0, contract: 1, registration: 1 },
    settings: {},
    pressConferences: [],
  };
  return {
    player,
    world: createWorld({ startYear: 2037, seed: 'qa-accept-transfer-world' }),
    relationships: {
      parentA: createRelationship({ id: 'parentA', name: 'Mom', role: 'parent' }),
      parentB: createRelationship({ id: 'parentB', name: 'Dad', role: 'parent' }),
      teacher: createRelationship({ id: 'teacher', name: 'Ms Carter', role: 'teacher' }),
      coach: createRelationship({ id: 'coach', name: 'Coach', role: 'coach', personality: 'tactical' }),
      friends: [],
    },
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    quarterCounter: 500,
    seed: 'qa-accept-transfer',
    headline: 'QA seed',
    quarterEvidence: [],
    quarterRecap: null,
    eventHistory: createEventHistory(),
    guidedSeason: null,
    chainState: null,
    careerState: careers,
  };
}

test('acceptTransfer with insufficient buying-club budget does not throw and does not mutate canonical state', async () => {
  const seed = buildAcceptTransferSave();
  const serialized = serializeState(seed);
  const saveStr = JSON.stringify({
    version: 1, savedAt: new Date().toISOString(), state: serialized,
  });
  const ctx = await bootFootyVerse({ localStorageSeed: { footyverse_save_v1: saveStr } });
  try {
    // Re-snapshot the persisted state for the regression comparison.
    // We rely on localStorage as the single source of truth for
    // "what's currently persisted to disk".
    const prePersist = ctx.window.localStorage.getItem('footyverse_save_v1');

    // Drive the UI: navigate to Contracts (offers) and click Accept Transfer.
    const offersBtn = ctx.document.querySelector('[data-app="contracts"]');
    assert.ok(offersBtn, 'shell must expose the Offers navigation control');
    offersBtn.click();
    await new Promise((r) => setTimeout(r, 30));

    const acceptBtn = ctx.document.querySelector('[data-accept-transfer="negotiation-transfer-1"]');
    assert.ok(acceptBtn, 'rejection fixture must render the transfer accept control');
    acceptBtn.click();
    await new Promise((r) => setTimeout(r, 60));

    // Pre-fix this would TypeError because `state = before; state.transferFeedback.message`
    // throws. The harness recorder captures the error if it did.
    assert.deepEqual(
      ctx.recorder.errors,
      [],
      `acceptTransfer rejection path raised ${ctx.recorder.errors.length} JS error(s):\n  ${ctx.recorder.errors.slice(0, 5).join('\n  ')}`,
    );
    assert.match(
      ctx.document.getElementById('toast-region')?.textContent ?? '',
      /Could not accept transfer: Buying club has insufficient transfer budget: club-hartshill/,
      'rejection must surface the adapter error instead of a generic or missing message',
    );
    assert.ok(
      ctx.document.querySelector('[data-accept-transfer="negotiation-transfer-1"]'),
      'rejection must restore the original open negotiation in memory and render it again',
    );

    // The persisted state must still match the pre-click snapshot.
    const postPersist = ctx.window.localStorage.getItem('footyverse_save_v1');
    assert.equal(postPersist, prePersist,
      'state persisted identically to pre-click reference (rejection path must not auto-save)');
  } finally {
    ctx.teardown();
  }
});
