// Tests for the player-facing "Senior epilogue" panel on the Football app.
//
// Contract (acceptance for Card A from the release-readiness audit):
//   * The panel renders ONLY when:
//       - stage === 'senior' AND no active professional contract exists
//         (i.e. the contract has ended honestly), AND
//       - careerState carries truthful data the panel can show.
//   * When the panel is not eligible, the football render still works
//     and contains no epilogue markup (no dangling aria-labelledby or
//     data-* hooks pointing at a hidden modal that isn't there).
//   * The data seam `buildSeniorEpilogue(state)` returns a fresh object
//     sourced ONLY from careerState — never from player hidden fields
//     or fabricated. Every field documented below is derived directly
//     from existing schema entries:
//       - seniorSeasons   = distinct contractsById entries for playerId
//       - clubs           = distinct clubsById from those contracts,
//                           mapped to name via clubsById
//       - contracts       = sorted by startTick; status, kind, duration
//       - offers          = resolved negotiations where player is the
//                           person (accepted / rejected / countered /
//                           open-but-recorded) — never invented
//       - transfers       = TRANSFER_ACCEPTED ledger entries
//       - loans           = LOAN_ACCEPTED + LOAN_RETURNED
//       - notableMoments  = ledger entries of the player that carry a
//                           presentable payload (no guessing)
//   * The renderer `renderSeniorEpilogueCard(state)` produces escaped,
//     responsive HTML: only honest copy, never a fake league / award /
//     fabricated trophy / score / win-loss record.
//   * The Football renderer mounts the card only when the panel is
//     eligible, and never mutates state in the process.
//   * A dedicated CSS class exists so the panel can be styled
//     separately from the existing football cards.
//
// All tests are pure: no jsdom, no DOM. The football render is exercised
// against a tiny stub container that records registered click handlers,
// mirroring the existing Football render pattern in tests/contractsUi
// .test.mjs and tests/homeUi.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSeniorEpilogue,
  renderSeniorEpilogueCard,
  isSeniorEpilogueEligible,
  shouldMountSeniorEpilogue,
} from '../src/ui/seniorEpilogue.js';
import { render as renderFootball } from '../src/ui/football.js';

function makeState(overrides = {}) {
  return {
    player: {
      name: 'Alex Morgan',
      age: 34,
      club: 'Redbrook Town FC',
      pathway: 'Senior team',
      position: 'midfielder',
      injury: null,
      ...overrides.player,
    },
    careerState: overrides.careerState ?? null,
    relationships: { coach: { name: 'Coach Rowan', personality: 'supportive' } },
    world: { season: 'Autumn', weather: 'Crisp' },
    ...overrides,
  };
}

// The smallest truthful senior careerState: one accepted permanent
// contract that has since expired. Redbrook Town FC is the recorded
// club. The contract has known start/end ticks and squad role.
function makeCareerState(extra = {}) {
  const base = {
    schemaVersion: 2,
    seed: 'senior-epilogue-test',
    clock: { tick: 96, year: 2038, quarterIndex: 2, week: 0 },
    playerId: 'person-player',
    peopleById: {
      'person-player': {
        id: 'person-player',
        kind: 'player',
        career: {
          stage: 'senior',
          currentTeamId: null,
          currentContractId: null,
          parentClubTeamId: null,
          loanTeamId: null,
        },
      },
    },
    clubsById: {
      'club-redbrook': { id: 'club-redbrook', name: 'Redbrook Town FC' },
    },
    teamsById: {
      'team-redbrook-senior': { id: 'team-redbrook-senior', clubId: 'club-redbrook' },
    },
    competitionsById: {},
    seasonsById: {},
    fixturesById: {},
    contractsById: {
      'contract-1': {
        id: 'contract-1',
        personId: 'person-player',
        clubId: 'club-redbrook',
        status: 'expired',
        kind: 'professional',
        startTick: 44,
        endTick: 92,
        wagePerWeekMinor: 120000,
        signingBonusMinor: 500000,
        squadRole: 'rotation',
        releaseFeeMinor: 5000000,
        parentContractId: null,
      },
    },
    negotiationsById: {
      'negotiation-contract-1': {
        id: 'negotiation-contract-1',
        kind: 'professional-offer',
        personId: 'person-player',
        toClubId: 'club-redbrook',
        status: 'accepted',
        contractId: 'contract-1',
        createdTick: 40,
        expiresTick: 48,
      },
    },
    registrationsById: {
      'registration-1': {
        id: 'registration-1',
        personId: 'person-player',
        contractId: 'contract-1',
        teamId: 'team-redbrook-senior',
        kind: 'permanent',
        active: false,
        startTick: 44,
        endTick: 92,
      },
    },
    ledger: [
      {
        id: 'event-1',
        tick: 44,
        type: 'CONTRACT_ACCEPTED',
        refs: {
          negotiationId: 'negotiation-contract-1',
          personId: 'person-player',
          clubId: 'club-redbrook',
          contractId: 'contract-1',
          registrationId: 'registration-1',
        },
        payload: {
          durationTicks: 48,
          wagePerWeekMinor: 120000,
          signingBonusMinor: 500000,
          squadRole: 'rotation',
        },
      },
    ],
    newsLog: [],
    idCounters: { event: 1, contract: 1, registration: 1 },
    settings: {},
    activeSeasonIds: [],
    pendingDecisionIds: [],
    ...extra,
  };
  return base;
}

test('isSeniorEpilogueEligible is true only when stage is senior with no active contract and a recorded club exists', () => {
  // Eligible: senior, no active contract, last club present.
  const eligibleState = makeState({
    player: { club: 'Redbrook Town FC' },
    careerState: makeCareerState(),
  });
  assert.equal(isSeniorEpilogueEligible(eligibleState), true);

  // Not eligible: still has an active contract (no "epilogue" — career is ongoing).
  const stillActive = makeState({
    player: { club: 'Redbrook Town FC' },
    careerState: makeCareerState({
      contractsById: {
        'contract-1': {
          ...makeCareerState().contractsById['contract-1'],
          status: 'active',
        },
      },
      peopleById: {
        'person-player': {
          id: 'person-player',
          career: {
            stage: 'senior',
            currentContractId: 'contract-1',
          },
        },
      },
    }),
  });
  assert.equal(isSeniorEpilogueEligible(stillActive), false);

  // Not eligible: player is still in their youth stage.
  const youth = makeState({
    careerState: {
      ...makeCareerState(),
      peopleById: {
        'person-player': {
          id: 'person-player',
          career: { stage: 'grassroots' },
        },
      },
    },
  });
  assert.equal(isSeniorEpilogueEligible(youth), false);

  // Not eligible: no careerState at all.
  assert.equal(isSeniorEpilogueEligible(makeState()), false);

  // Not eligible: senior stage but no recorded club ever.
  const seniorNoClub = makeState({
    player: { club: null },
    careerState: {
      ...makeCareerState(),
      contractsById: {},
      negotiationsById: {},
      peopleById: {
        'person-player': {
          id: 'person-player',
          career: { stage: 'senior', currentContractId: null },
        },
      },
    },
  });
  assert.equal(isSeniorEpilogueEligible(seniorNoClub), false);
});

test('buildSeniorEpilogue returns an empty-but-honest summary when the senior stage has no recorded history yet', () => {
  // Edge case: senior stage, contract just ended (or never existed),
  // and nothing in the canonical state yet — the panel must still be
  // safe to render with a single honest "no recorded history" line.
  const state = makeState({
    careerState: {
      ...makeCareerState(),
      contractsById: {},
      negotiationsById: {},
      registrationsById: {},
      ledger: [],
    },
  });
  const summary = buildSeniorEpilogue(state);

  assert.equal(summary.sparse, true);
  assert.deepEqual(summary.seniorSeasons, 0);
  assert.deepEqual(summary.clubs, []);
  assert.deepEqual(summary.contracts, []);
  assert.deepEqual(summary.offers, []);
  assert.deepEqual(summary.transfers, []);
  assert.deepEqual(summary.loans, []);
  assert.deepEqual(summary.notableMoments, []);
  // Always-present honest note for the empty path.
  assert.match(summary.emptyNote, /no recorded senior history|has not been/i);
});

test('buildSeniorEpilogue derives seasons, clubs, and contracts purely from careerState (no fabrication)', () => {
  const state = makeState({ careerState: makeCareerState() });
  const snapshot = structuredClone(state.careerState);
  const summary = buildSeniorEpilogue(state);

  // seniorSeasons = distinct contracts the player has been a party of.
  assert.equal(summary.seniorSeasons, 1);

  // Clubs come only from clubsById lookup of contract.clubId.
  assert.deepEqual(summary.clubs, ['Redbrook Town FC']);

  // Contracts surface the truthful record (no invented years / scores).
  assert.equal(summary.contracts.length, 1);
  const contract = summary.contracts[0];
  assert.equal(contract.clubId, 'club-redbrook');
  assert.equal(contract.clubName, 'Redbrook Town FC');
  assert.equal(contract.status, 'expired');
  assert.equal(contract.startTick, 44);
  assert.equal(contract.endTick, 92);
  assert.equal(contract.durationTicks, 48);
  assert.equal(contract.squadRole, 'rotation');
  assert.equal(contract.wagePerWeekMinor, 120000);
  assert.equal(contract.signingBonusMinor, 500000);

  // No fabricated awards / trophies / MVP / league / win / loss.
  assert.doesNotMatch(JSON.stringify(summary), /MVP|trophy|award|champion|golden boot/i);

  // Original state must not be mutated.
  assert.deepEqual(state.careerState, snapshot);
});

test('buildSeniorEpilogue renders declined/countered offers WITHOUT inventing new ones', () => {
  const base = makeCareerState();
  base.negotiationsById = {
    ...base.negotiationsById,
    'negotiation-contract-2': {
      id: 'negotiation-contract-2',
      kind: 'professional-offer',
      personId: 'person-player',
      toClubId: 'club-redbrook',
      status: 'rejected',
      createdTick: 60,
      expiresTick: 68,
    },
    'negotiation-contract-3': {
      id: 'negotiation-contract-3',
      kind: 'professional-offer',
      personId: 'person-player',
      toClubId: 'club-redbrook',
      status: 'open',
      createdTick: 70,
      expiresTick: 78,
    },
    // A negotiation that doesn't belong to this player must be ignored.
    'negotiation-other-player': {
      id: 'negotiation-other-player',
      kind: 'professional-offer',
      personId: 'person-someone-else',
      toClubId: 'club-redbrook',
      status: 'accepted',
      createdTick: 50,
    },
  };
  const state = makeState({ careerState: base });
  const summary = buildSeniorEpilogue(state);

  // Exactly 2 of this player's offers surface (the accepted + the rejected),
  // never the open one in this epilogue-context (open offers already live
  // in the contracts inbox — epilogue is history, not inbox).
  const offerIds = summary.offers.map((o) => o.negotiationId).sort();
  assert.deepEqual(offerIds, ['negotiation-contract-1', 'negotiation-contract-2']);
  assert.ok(summary.offers.every((offer) => offer.status === 'accepted' || offer.status === 'rejected'));
  // No foreign player's records leaked in.
  assert.ok(!summary.offers.some((offer) => offer.negotiationId === 'negotiation-other-player'));
});

test('buildSeniorEpilogue surfaces transfers + loan returns derived from ledger events for this player only', () => {
  const base = makeCareerState();
  base.ledger.push({
    id: 'event-2',
    tick: 70,
    type: 'TRANSFER_ACCEPTED',
    refs: { personId: 'person-player', fromClubId: 'club-redbrook', toClubId: 'club-northshore', contractId: 'contract-2', negotiationId: 'negotiation-transfer-1' },
    payload: { transferFeeMinor: 1500000 },
  }, {
    id: 'event-3',
    tick: 70,
    type: 'LOAN_ACCEPTED',
    refs: { personId: 'person-player', registrationId: 'registration-2', fromClubId: 'club-redbrook', toClubId: 'club-portfleet' },
    payload: { endTick: 80 },
  }, {
    id: 'event-4',
    tick: 80,
    type: 'LOAN_RETURNED',
    refs: { personId: 'person-player', registrationId: 'registration-2' },
    payload: { scheduledEndTick: 80 },
  }, {
    // Foreign player's ledger event — must NOT leak.
    id: 'event-5',
    tick: 70,
    type: 'TRANSFER_ACCEPTED',
    refs: { personId: 'person-other', fromClubId: 'club-foo', toClubId: 'club-bar' },
    payload: {},
  });
  base.clubsById = {
    ...base.clubsById,
    'club-northshore': { id: 'club-northshore', name: 'Northshore United' },
    'club-portfleet': { id: 'club-portfleet', name: 'Portfleet FC' },
  };

  const state = makeState({ careerState: base });
  const summary = buildSeniorEpilogue(state);

  // Transfers scoped to playerId.
  assert.equal(summary.transfers.length, 1);
  assert.equal(summary.transfers[0].toClubName, 'Northshore United');
  assert.equal(summary.transfers[0].transferFeeMinor, 1500000);

  // Loans scoped to playerId, both directions counted distinctly.
  assert.equal(summary.loans.length, 2);
  const loanKinds = summary.loans.map((l) => l.kind).sort();
  assert.deepEqual(loanKinds, ['accepted', 'returned']);
});

test('buildSeniorEpilogue never mutates the supplied state', () => {
  const state = makeState({ careerState: makeCareerState() });
  const snapshot = structuredClone(state);
  buildSeniorEpilogue(state);
  assert.deepEqual(state, snapshot);
});

test('renderSeniorEpilogueCard emits an honest empty panel for a player with no recorded history', () => {
  const state = makeState({
    careerState: {
      ...makeCareerState(),
      contractsById: {},
      negotiationsById: {},
      registrationsById: {},
      ledger: [],
    },
  });
  const html = renderSeniorEpilogueCard(state);

  // Empty state: card title, honest copy, no <li>/<tr> entries.
  assert.match(html, /<section[^>]+aria-labelledby="senior-epilogue-title"/);
  assert.match(html, /<h2 id="senior-epilogue-title">/);
  assert.match(html, /Senior journey so far|senior journey/i);
  assert.match(html, /no recorded senior history|has not been recorded/i);
  assert.doesNotMatch(html, /<li>/);
  // No fabricated content.
  assert.doesNotMatch(html, /MVP|trophy|award|champion|golden boot|league title/i);
});

test('renderSeniorEpilogueCard escapes hostile text and only renders truthful fields', () => {
  const base = makeCareerState();
  // Plant a club name with HTML and a hostile ledger payload text.
  base.clubsById = {
    ...base.clubsById,
    'club-redbrook': { id: 'club-redbrook', name: '<script>alert(1)</script>' },
  };
  base.ledger.push({
    id: 'event-x',
    tick: 50,
    type: 'CONTRACT_ACCEPTED',
    refs: { personId: 'person-player', clubId: 'club-redbrook', contractId: 'contract-1' },
    payload: { hostileNote: '<img src=x onerror=alert(1)>', squadRole: 'starter' },
  });
  const state = makeState({ careerState: base });
  const html = renderSeniorEpilogueCard(state);

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /onerror=alert/);
  // Squad role rendered truthfully.
  assert.match(html, /starter/);
});

test('renderSeniorEpilogueCard shows accepted clubs, contract span, declined offers, and a counted season total', () => {
  const state = makeState({ careerState: makeCareerState() });
  const html = renderSeniorEpilogueCard(state);

  // Honest count label is present.
  assert.match(html, /Senior seasons?|contracts recorded|[Ss]enior journey|1 contract/);
  assert.match(html, /Redbrook Town FC/);
  assert.match(html, /rotation/i);

  // Declined / accepted offers — surfaces only this player's recorded ones.
  assert.match(html, /Accepted:/);

  // No fake numbers / win-loss / season count fabrication.
  assert.doesNotMatch(html, /trophy|award|champion|golden boot/i);
});

test('Football surface mounts the senior epilogue card when eligible and never mutates state', () => {
  const state = makeState({ careerState: makeCareerState() });
  const snapshot = structuredClone(state);

  const container = { innerHTML: '', querySelector: () => null };
  renderFootball(container, { state, actions: {} });

  // The card is mounted (its labelled section is present).
  assert.match(container.innerHTML, /senior-epilogue-title/);
  assert.match(container.innerHTML, /Redbrook Town FC/);

  // State was not touched.
  assert.deepEqual(state, snapshot);
});

test('Football surface does NOT mount the senior epilogue card while the senior career is still active', () => {
  const state = makeState({
    careerState: makeCareerState({
      contractsById: {
        'contract-1': {
          ...makeCareerState().contractsById['contract-1'],
          status: 'active',
        },
      },
      peopleById: {
        'person-player': {
          id: 'person-player',
          career: {
            stage: 'senior',
            currentContractId: 'contract-1',
          },
        },
      },
    }),
  });
  const container = { innerHTML: '', querySelector: () => null };
  renderFootball(container, { state, actions: {} });
  assert.doesNotMatch(container.innerHTML, /senior-epilogue-title/);
});

test('Football surface does NOT mount the senior epilogue card for a youth player', () => {
  const state = makeState({
    player: { age: 10, club: null, pathway: 'School team', position: null },
    careerState: {
      ...makeCareerState(),
      peopleById: {
        'person-player': {
          id: 'person-player',
          career: { stage: 'grassroots' },
        },
      },
    },
  });
  const container = { innerHTML: '', querySelector: () => null };
  renderFootball(container, { state, actions: {} });
  assert.doesNotMatch(container.innerHTML, /senior-epilogue-title/);
});

test('shouldMountSeniorEpilogue decision helper agrees with renderFootball eligibility', () => {
  const eligible = makeState({ careerState: makeCareerState() });
  assert.equal(shouldMountSeniorEpilogue(eligible), true);

  const stillActive = makeState({
    careerState: makeCareerState({
      contractsById: {
        'contract-1': { ...makeCareerState().contractsById['contract-1'], status: 'active' },
      },
      peopleById: {
        'person-player': {
          id: 'person-player',
          career: { stage: 'senior', currentContractId: 'contract-1' },
        },
      },
    }),
  });
  assert.equal(shouldMountSeniorEpilogue(stillActive), false);

  const youth = makeState({
    player: { age: 10, club: null, pathway: 'School team', position: null },
    careerState: {
      ...makeCareerState(),
      peopleById: {
        'person-player': { id: 'person-player', career: { stage: 'grassroots' } },
      },
    },
  });
  assert.equal(shouldMountSeniorEpilogue(youth), false);
});

// Regression: pending offer (open negotiation) plus an expired contract
// must NOT mount the epilogue — the player is between contracts, not
// in an "ended career" state. This is a guard against future schema
// expansion where 'pending' is a real contract status (or a
// pendingContractId pointer exists on career), and an open offer is a
// real "decision still pending" signal.
test('isSeniorEpilogueEligible returns false when an open offer is pending alongside an expired contract', () => {
  const state = makeState({
    careerState: {
      ...makeCareerState(), // has contract-1 status=expired
      negotiationsById: {
        ...makeCareerState().negotiationsById,
        // Open offer for the player — a real decision pending.
        'negotiation-pending': {
          id: 'negotiation-pending',
          kind: 'professional-offer',
          personId: 'person-player',
          toClubId: 'club-redbrook',
          status: 'open',
          createdTick: 96,
          expiresTick: 104,
        },
      },
    },
  });
  // Even though the player has a real expired contract in their
  // history, there is also an open offer on the table. The career is
  // "between contracts", not "ended". Epilogue must not mount.
  assert.equal(isSeniorEpilogueEligible(state), false);
  assert.equal(shouldMountSeniorEpilogue(state), false);
});

// Regression: when the schema later supports a 'pending' contract
// status (e.g. accepted-but-not-started), the epilogue must not mount
// while that pointer exists on career, even if older contracts are
// expired. Mirrors the active/currentContractId guard.
test('isSeniorEpilogueEligible returns false when career has a pending contract pointer alongside expired contracts', () => {
  const state = makeState({
    careerState: makeCareerState({
      // Add a pending contract alongside the expired one.
      contractsById: {
        ...makeCareerState().contractsById,
        'contract-pending': {
          id: 'contract-pending',
          personId: 'person-player',
          clubId: 'club-redbrook',
          status: 'pending',
          kind: 'professional',
          startTick: 100,
          endTick: 200,
        },
      },
      // The pending contract is the player's current pointer (analogous
      // to currentContractId, which here we mirror on a dedicated
      // pendingContractId field for the future-proof schema).
      peopleById: {
        'person-player': {
          id: 'person-player',
          kind: 'player',
          career: {
            stage: 'senior',
            currentContractId: null,
            pendingContractId: 'contract-pending',
          },
        },
      },
    }),
  });
  assert.equal(isSeniorEpilogueEligible(state), false);
  assert.equal(shouldMountSeniorEpilogue(state), false);
});

// Regression: a player whose ONLY history is a single TRANSFER_ACCEPTED
// ledger event with a missing/non-finite tick must render the empty
// state — sparse must agree with what the renderer would actually show.
// Previously, transfers.length > 0 forced sparse=false, but the renderer
// filtered tick=null events out of notableMoments AND rendered no
// contracts/clubs/offers, so the user would see "no contracts
// recorded" with a misleading non-sparse header.
test('buildSeniorEpilogue sparse state agrees with rendered body when ledger tick is missing', () => {
  const base = {
    ...makeCareerState(),
    contractsById: {}, // no contract history
    negotiationsById: {}, // no offer history
    registrationsById: {},
    ledger: [
      {
        id: 'event-tickless',
        type: 'TRANSFER_ACCEPTED',
        // tick intentionally omitted / undefined to simulate a
        // sparse/missing entry from the orchestrator.
        refs: { personId: 'person-player', fromClubId: 'club-redbrook', toClubId: 'club-northshore' },
        payload: { transferFeeMinor: 1000000 },
      },
    ],
  };
  base.clubsById = {
    ...base.clubsById,
    'club-northshore': { id: 'club-northshore', name: 'Northshore United' },
  };
  const state = makeState({ careerState: base });
  const summary = buildSeniorEpilogue(state);

  // The contract list, offers list, and the visible notable-moments
  // list all filter tick-null events out. The user-visible summary
  // shows zero contracts, zero offers, zero notable moments.
  assert.equal(summary.contracts.length, 0);
  assert.equal(summary.offers.length, 0);
  assert.equal(summary.notableMoments.length, 0);

  // sparse must agree with the rendered body — otherwise the renderer
  // shows the empty path (header + honest copy) but the data layer
  // claims non-empty, which is misleading downstream consumers.
  assert.equal(summary.sparse, true);

  const html = renderSeniorEpilogueCard(state);
  // Empty-state copy is present.
  assert.match(html, /Senior journey so far/);
  assert.match(html, /no recorded senior history|has not been recorded/i);
  // No <li> entries (the rendered body is the honest empty path).
  assert.doesNotMatch(html, /<li>/);
  // No fabricated award/league tokens.
  assert.doesNotMatch(html, /MVP|trophy|award|champion|golden boot/i);
});

test('senior epilogue uses a dedicated CSS class so it can be styled separately', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.match(css, /\.senior-epilogue\s*\{/);
  assert.match(css, /\.senior-epilogue__list\s*\{/);
});

// ---------------------------------------------------------------------------
// Press-conference slice — render the recorded conferences inline.
// ---------------------------------------------------------------------------

test('renderSeniorEpilogueCard renders a "Press conferences" card section with newest-first records and escaped text', () => {
  const base = makeCareerState();
  base.pressConferences = [
    {
      id: 'event-9', tick: 60, milestone: 'transfer-accepted',
      question: 'Q?<script>alert(1)</script>',
      choiceId: 'professional', choiceLabel: 'I am here to <b>work</b> hard.',
      effects: {},
      ledgerEventId: 'event-9',
    },
    {
      id: 'event-2', tick: 50, milestone: 'transfer-accepted',
      question: 'Earlier presser.', choiceId: 'gracious', choiceLabel: 'Grateful.',
      effects: {}, ledgerEventId: 'event-2',
    },
  ];
  const state = makeState({ careerState: base });
  const html = renderSeniorEpilogueCard(state);

  // Press-conference list rendered.
  assert.match(html, /senior-epilogue__press-list/);
  // Hostile + rich text are escaped.
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /I am here to &lt;b&gt;work&lt;\/b&gt; hard\./);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  // Newest-first ordering: tick 60 must come before tick 50 in the list.
  const tick60 = html.indexOf('Tick 60');
  const tick50 = html.indexOf('Tick 50');
  assert.ok(tick60 > -1 && tick50 > -1, 'both presser entries should be present');
  assert.ok(tick60 < tick50, 'newest press record must render before the older one');
});

test('renderSeniorEpilogueCard press-conference list shows the empty-state honest copy when there are no records', () => {
  const state = makeState({ careerState: makeCareerState() });
  const html = renderSeniorEpilogueCard(state);
  assert.match(html, /senior-epilogue__press-empty/);
  assert.match(html, /No press conferences recorded yet/);
});
