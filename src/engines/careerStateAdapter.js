// Bridges the childhood app state to the canonical schema-v2 career state.
// The adapter is deterministic and keeps the professional simulation JSON-safe.

import { reduceCareerCommand } from './careerOrchestrator.js';
import { expireContracts } from './contractEngine.js';

const PROFESSIONAL_AGE = 16;
const TICKS_PER_YEAR = 32;
// Maximum number of post-expiry offer negotiations generated from other
// eligible senior clubs after the player's professional contract expires.
// Bounded so the inbox never balloons; deterministic so the reruns agree.
const MAX_POST_EXPIRY_OFFERS = 2;
// Offer TTL in ticks (8 = one quarter); matches the seeded
// negotiation-contract-1 expiry so existing UI copy stays honest.
const POST_EXPIRY_OFFER_TTL_TICKS = 8;

export function createCareerStateForPlayer(player, tick) {
  const playerId = 'person-player';
  const eligible = player.age >= PROFESSIONAL_AGE;
  const careerState = {
    schemaVersion: 2,
    seed: `career-${player.name}-${player.country}`,
    clock: {
      tick,
      year: player.year,
      quarterIndex: player.quarterIndex,
      week: 0,
    },
    playerId,
    peopleById: {
      [playerId]: {
        id: playerId,
        kind: 'player',
        identity: {
          name: player.name,
          gender: player.gender,
          birthYear: player.year - player.age,
          countryId: player.country,
          nationalityIds: [player.country],
        },
        attributes: structuredClone(player.stats ?? {}),
        hidden: structuredClone(player.hidden ?? {}),
        career: {
          stage: 'grassroots',
          currentTeamId: null,
          currentContractId: null,
          parentClubTeamId: null,
          loanTeamId: null,
        },
      },
    },
    // Seed three senior clubs so a truthful other-club offer can fire
    // after a contract expiry (or appear as a transfer target). The
    // seeded club list mirrors what the senior-epilogue audit called
    // out as a structural gap (single-club seeding blocked truthful
    // other-club offers).
    clubsById: eligible ? {
      'club-redbrook': {
        id: 'club-redbrook',
        name: 'Redbrook Town FC',
        countryId: player.country,
        teamIds: ['team-redbrook-senior'],
        finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 50000000 },
      },
      'club-bluemeadow': {
        id: 'club-bluemeadow',
        name: 'Bluemeadow City FC',
        countryId: player.country,
        teamIds: ['team-bluemeadow-senior'],
        finances: { wageBudgetMinor: 22000000, transferBudgetMinor: 40000000 },
      },
      'club-hartshill': {
        id: 'club-hartshill',
        name: 'Hartshill United FC',
        countryId: player.country,
        teamIds: ['team-hartshill-senior'],
        finances: { wageBudgetMinor: 20000000, transferBudgetMinor: 50000000 },
      },
    } : {},
    teamsById: eligible ? {
      'team-redbrook-senior': {
        id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior', squadPersonIds: [],
      },
      'team-bluemeadow-senior': {
        id: 'team-bluemeadow-senior', clubId: 'club-bluemeadow', level: 'senior', squadPersonIds: [],
      },
      'team-hartshill-senior': {
        id: 'team-hartshill-senior', clubId: 'club-hartshill', level: 'senior', squadPersonIds: [],
      },
    } : {},
    competitionsById: {},
    seasonsById: {},
    fixturesById: {},
    contractsById: {},
    negotiationsById: eligible ? {
      'negotiation-contract-1': {
        id: 'negotiation-contract-1',
        kind: 'professional-offer',
        personId: playerId,
        fromClubId: 'club-redbrook',
        toClubId: 'club-redbrook',
        createdTick: tick,
        expiresTick: tick + 8,
        status: 'open',
        terms: {
          durationTicks: TICKS_PER_YEAR * 2,
          wagePerWeekMinor: 120000,
          signingBonusMinor: 500000,
          squadRole: 'rotation',
          releaseFeeMinor: 5000000,
          transferFeeMinor: 0,
        },
        roundsUsed: 0,
        maxRounds: 2,
      },
    } : {},
    registrationsById: {},
    nationalTeamsById: {},
    callUpsById: {},
    awardsById: {},
    activeSeasonIds: [],
    pendingDecisionIds: eligible ? ['negotiation-contract-1'] : [],
    ledger: [],
    newsLog: [],
    idCounters: {},
    settings: {},
    // Press-conference records: appended by acceptTransferInAppState
    // via recordPressConference, never mutated otherwise. Legacy saves
    // load with `undefined` and are normalised via ensureCareerState.
    pressConferences: [],
  };
  return careerState;
}

export function ensureCareerState(appState) {
  if (appState.careerState?.schemaVersion === 2) {
    // Migration-safe default: a legacy v2 save predating pressConferences
    // loads with `[]` rather than `undefined`. Same pattern as Storylines
    // `announced` field — see stateSerializer.js lines 33-35.
    if (!Array.isArray(appState.careerState.pressConferences)) {
      return {
        ...appState.careerState,
        pressConferences: [],
      };
    }
    return appState.careerState;
  }
  return createCareerStateForPlayer(appState.player, appState.quarterCounter ?? 0);
}

export function syncCareerState(appState) {
  const current = ensureCareerState(appState);
  const hasCareerActivity = Object.keys(current.negotiationsById).length > 0
    || Object.keys(current.contractsById).length > 0;
  if (appState.player.age >= PROFESSIONAL_AGE && !hasCareerActivity) {
    return createCareerStateForPlayer(appState.player, appState.quarterCounter ?? 0);
  }
  const expired = expireContracts({
    ...current,
    clock: {
      ...current.clock,
      tick: appState.quarterCounter ?? current.clock.tick,
      year: appState.player.year,
      quarterIndex: appState.player.quarterIndex,
    },
  });
  // Post-expiry offer hook: idempotent under repeat syncCareerState calls.
  // We hand the already-expired state to the helper so it doesn't re-run
  // expireContracts. The helper still runs its defensive expire pass when
  // called directly (e.g. from tests with hand-crafted fixtures).
  return generatePostExpiryOffers(expired, { skipExpire: true });
}

// ----------------------------------------------------------------------------
// Post-expiry offer generator (pure)
// ----------------------------------------------------------------------------
// After `expireContracts` clears the player's active registration/contract,
// this engine asks: which senior clubs are eligible to offer the player a
// new professional contract? It generates a deterministic, bounded (≤ 2)
// list of "professional-offer" negotiations from clubs OTHER than the
// player's last club. It is idempotent, never duplicates an existing open
// offer, and is safe to call after every endQuarter via syncCareerState.
//
// The function NEVER mutates input. Returns next state.
//
// Called both from syncCareerState (after its own expireContracts) AND
// from tests that hand-craft post-expiry state: when called directly
// without `{ skipExpire: true }`, the helper runs an expireContracts
// pass first so it operates on post-expiry truth.
export function generatePostExpiryOffers(state, options = {}) {
  if (!state || typeof state !== 'object') return state;
  const afterExpiry = options.skipExpire ? state : expireContracts(state);
  const playerId = afterExpiry?.playerId ?? 'person-player';
  const person = afterExpiry?.peopleById?.[playerId];
  const career = person?.career;
  if (!career) return afterExpiry;

  // We only offer when the player USED to have an active professional
  // contract (now expired this tick). Active contracts block — there
  // is no expiry event to react to.
  if (career.currentContractId) return afterExpiry;
  if (career.stage !== 'senior') return afterExpiry;
  // "Just expired" signal: at least one record has endTick <= clock.tick
  // in the player's history. If the player has never had a contract,
  // there is nothing post- to react to.
  const playerContracts = Object.values(afterExpiry.contractsById ?? {})
    .filter((contract) => contract.personId === playerId);
  if (playerContracts.length === 0) return afterExpiry;
  const justExpired = playerContracts.some((contract) =>
    typeof contract.endTick === 'number' && contract.endTick <= afterExpiry.clock.tick);
  if (!justExpired) return afterExpiry;

  // Snapshot lastClubId as the most-recently-expired contract's clubId.
  const lastContract = playerContracts
    .filter((contract) => contract.endTick != null)
    .sort((left, right) => (right.endTick ?? 0) - (left.endTick ?? 0))[0];
  const lastClubId = lastContract.clubId;

  // Eligible alternative senior clubs: senior-level teams NOT the
  // player's last club.
  const otherClubs = Object.values(afterExpiry.clubsById ?? {})
    .filter((club) => {
      if (!club || typeof club !== 'object') return false;
      if (club.id === lastClubId) return false;
      if (!Array.isArray(club.teamIds) || club.teamIds.length === 0) return false;
      return club.teamIds
        .map((teamId) => afterExpiry.teamsById?.[teamId])
        .some((team) => team?.level === 'senior');
    });

  if (otherClubs.length === 0) return afterExpiry;

  // Dedupe: skip clubs that already have an open professional-offer
  // negotiation for this player.
  const existingOpenOffersByClub = new Set(
    Object.values(afterExpiry.negotiationsById ?? {})
      .filter((neg) => neg?.personId === playerId
        && neg.kind === 'professional-offer'
        && neg.status === 'open')
      .map((neg) => neg.toClubId),
  );
  const eligibleClubs = otherClubs.filter((club) => !existingOpenOffersByClub.has(club.id));

  if (eligibleClubs.length === 0) return afterExpiry;

  // Deterministic ordering: sort by clubId. Cap at MAX_POST_EXPIRY_OFFERS.
  const picked = eligibleClubs
    .slice()
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .slice(0, MAX_POST_EXPIRY_OFFERS);

  const next = structuredClone(afterExpiry);
  const tick = next.clock?.tick ?? 0;
  picked.forEach((club, index) => {
    const id = `negotiation-offer-${tick}-${index + 1}`;
    if (next.negotiationsById[id]) return;
    next.negotiationsById[id] = {
      id,
      kind: 'professional-offer',
      personId: playerId,
      fromClubId: club.id,
      toClubId: club.id,
      createdTick: tick,
      expiresTick: tick + POST_EXPIRY_OFFER_TTL_TICKS,
      status: 'open',
      terms: {
        durationTicks: TICKS_PER_YEAR * 2,
        wagePerWeekMinor: 110000,
        signingBonusMinor: 250000,
        squadRole: 'rotation',
        releaseFeeMinor: 4000000,
        transferFeeMinor: 0,
      },
      roundsUsed: 0,
      maxRounds: 1,
      fromPostExpiry: true,
    };
  });
  return next;
}

// ----------------------------------------------------------------------------
// Accept-transfer adapter (mirrors the contract pattern)
// ----------------------------------------------------------------------------
// Pure except for the persist callback. Reflects the canonical orchestrator
// result into appState.player.club/pathway/careerHistory/quarterEvidence and
// a transferFeedback shape mirroring contractFeedback.
export function acceptTransferInAppState(appState, negotiationId, persist) {
  try {
    const { state: careerState } = reduceCareerCommand(appState.careerState, {
      type: 'ACCEPT_TRANSFER',
      negotiationId,
    });
    const negotiation = careerState.negotiationsById[negotiationId];
    const clubId = negotiation?.toClubId;
    const clubName = careerState.clubsById[clubId]?.name ?? 'your new club';
    const transferFeeMinor = negotiation?.terms?.transferFeeMinor ?? 0;
    const player = {
      ...appState.player,
      club: clubName,
      pathway: 'Senior team',
      careerHistory: [
        ...(appState.player.careerHistory ?? []),
        {
          type: 'transferred',
          from: appState.player.club ?? careerState.clubsById[negotiation?.fromClubId]?.name ?? null,
          to: clubName,
          fee: transferFeeMinor,
          age: appState.player.age,
          year: appState.player.year,
        },
      ],
    };
    const quarterEvidence = [...(appState.quarterEvidence ?? [])];
    quarterEvidence.push({
      kind: 'career',
      label: 'New club',
      outcome: `Transferred to ${clubName}.`,
      id: `${appState.quarterCounter ?? careerState.clock.tick}-${quarterEvidence.length}`,
    });
    const next = {
      ...appState,
      player,
      careerState,
      quarterEvidence,
      transferFeedback: {
        type: 'success',
        message: `Transfer accepted — welcome to ${clubName}!`,
      },
    };
    persist(next);
    return next;
  } catch (error) {
    return {
      ...appState,
      transferFeedback: {
        type: 'error',
        message: `Could not accept transfer: ${error.message}`,
      },
    };
  }
}

// ----------------------------------------------------------------------------
// Press-conference recorder (pure, once-only per milestone/ledgerEventId)
// ----------------------------------------------------------------------------
// Appends a press-conference record to careerState.pressConferences,
// guarded by (milestone, ledgerEventId) so repeat calls for the same
// trigger are no-ops. Effect fields are bounded to existing canonical
// fields (confidence/relationship/quarterEvidence), no invented stats.
export function recordPressConference(careerState, payload) {
  if (!careerState || typeof careerState !== 'object') return careerState;
  if (!payload || typeof payload !== 'object') return careerState;
  const existing = Array.isArray(careerState.pressConferences)
    ? careerState.pressConferences
    : [];
  const dup = existing.some((entry) => entry
    && entry.milestone === payload.milestone
    && entry.ledgerEventId === payload.ledgerEventId);
  if (dup) return careerState;
  const entry = {
    id: payload.ledgerEventId ?? `press-${existing.length + 1}`,
    tick: payload.tick ?? null,
    milestone: payload.milestone,
    question: typeof payload.question === 'string' ? payload.question : '',
    choiceId: typeof payload.choiceId === 'string' ? payload.choiceId : '',
    choiceLabel: typeof payload.choiceLabel === 'string' ? payload.choiceLabel : '',
    effects: payload.effects && typeof payload.effects === 'object' ? payload.effects : {},
    ledgerEventId: payload.ledgerEventId ?? null,
  };
  return {
    ...careerState,
    pressConferences: [...existing, entry],
  };
}

export function acceptContractInAppState(appState, negotiationId, persist) {
  try {
    const { state: careerState } = reduceCareerCommand(appState.careerState, {
      type: 'ACCEPT_CONTRACT',
      negotiationId,
    });
    const clubId = careerState.negotiationsById[negotiationId].toClubId;
    const clubName = careerState.clubsById[clubId]?.name ?? 'your new club';
    const player = {
      ...appState.player,
      club: clubName,
      pathway: 'Senior team',
      careerHistory: [
        ...(appState.player.careerHistory ?? []),
        {
          type: 'signed_professional_contract',
          club: clubName,
          age: appState.player.age,
          year: appState.player.year,
        },
      ],
    };
    const quarterEvidence = [...(appState.quarterEvidence ?? [])];
    quarterEvidence.push({
      kind: 'career',
      label: 'Senior debut',
      outcome: `Signed a professional contract with ${clubName}.`,
      id: `${appState.quarterCounter ?? careerState.clock.tick}-${quarterEvidence.length}`,
    });
    const next = {
      ...appState,
      player,
      careerState,
      quarterEvidence,
      contractFeedback: {
        type: 'success',
        message: `Contract accepted — welcome to ${clubName}!`,
      },
    };
    persist(next);
    return next;
  } catch (error) {
    return {
      ...appState,
      contractFeedback: {
        type: 'error',
        message: `Could not accept offer: ${error.message}`,
      },
    };
  }
}

export function rejectContractInAppState(appState, negotiationId, persist) {
  try {
    const { state: careerState } = reduceCareerCommand(appState.careerState, {
      type: 'REJECT_CONTRACT',
      negotiationId,
    });
    const clubId = careerState.negotiationsById[negotiationId].toClubId;
    const clubName = careerState.clubsById[clubId]?.name ?? 'the club';
    const next = {
      ...appState,
      careerState,
      contractFeedback: {
        type: 'success',
        message: `Offer rejected — no hard feelings, ${clubName}.`,
      },
    };
    persist(next);
    return next;
  } catch (error) {
    return {
      ...appState,
      contractFeedback: {
        type: 'error',
        message: `Could not reject offer: ${error.message}`,
      },
    };
  }
}

export function counterContractInAppState(appState, negotiationId, terms, persist) {
  try {
    const { state: careerState } = reduceCareerCommand(appState.careerState, {
      type: 'COUNTER_CONTRACT', negotiationId, terms,
    });
    const negotiation = careerState.negotiationsById[negotiationId];
    const roundsRemaining = Math.max(0, negotiation.maxRounds - negotiation.roundsUsed);
    const next = {
      ...appState,
      careerState,
      contractFeedback: {
        type: 'success',
        message: `Counter sent — ${roundsRemaining} round${roundsRemaining === 1 ? '' : 's'} remaining.`,
      },
    };
    persist(next);
    return next;
  } catch (error) {
    return {
      ...appState,
      contractFeedback: {
        type: 'error',
        message: `Could not counter offer: ${error.message}`,
      },
    };
  }
}
