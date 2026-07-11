// Bridges the childhood app state to the canonical schema-v2 career state.
// The adapter is deterministic and keeps the professional simulation JSON-safe.

import { reduceCareerCommand } from './careerOrchestrator.js';

const PROFESSIONAL_AGE = 16;
const TICKS_PER_YEAR = 32;

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
          stage: eligible ? 'senior' : 'grassroots',
          currentTeamId: null,
          currentContractId: null,
          parentClubTeamId: null,
          loanTeamId: null,
        },
      },
    },
    clubsById: eligible ? {
      'club-redbrook': {
        id: 'club-redbrook',
        name: 'Redbrook Town FC',
        countryId: player.country,
        teamIds: ['team-redbrook-senior'],
        finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 50000000 },
      },
    } : {},
    teamsById: eligible ? {
      'team-redbrook-senior': {
        id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior', squadPersonIds: [],
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
  };
  return careerState;
}

export function ensureCareerState(appState) {
  if (appState.careerState?.schemaVersion === 2) return appState.careerState;
  return createCareerStateForPlayer(appState.player, appState.quarterCounter ?? 0);
}

export function syncCareerState(appState) {
  const current = ensureCareerState(appState);
  const hasCareerActivity = Object.keys(current.negotiationsById).length > 0
    || Object.keys(current.contractsById).length > 0;
  if (appState.player.age >= PROFESSIONAL_AGE && !hasCareerActivity) {
    return createCareerStateForPlayer(appState.player, appState.quarterCounter ?? 0);
  }
  return {
    ...current,
    clock: {
      ...current.clock,
      tick: appState.quarterCounter ?? current.clock.tick,
      year: appState.player.year,
      quarterIndex: appState.player.quarterIndex,
    },
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
    const next = {
      ...appState,
      careerState,
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
