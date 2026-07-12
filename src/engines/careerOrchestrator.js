// Career orchestrator: authoritative, DOM-independent command routing and ledger emission.

import {
  acceptContractOfferWithResult,
  counterContractOffer,
  rejectContractOffer,
} from './contractEngine.js';
import { acceptLoanOffer, returnExpiredLoans } from './loanEngine.js';
import { acceptTransferOfferWithResult } from './transferEngine.js';

function allocateEventId(state) {
  let maxNumber = state.idCounters.event ?? 0;
  for (const event of state.ledger) {
    const match = typeof event.id === 'string' ? event.id.match(/^event-(\d+)$/) : null;
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  const number = maxNumber + 1;
  state.idCounters.event = number;
  return `event-${number}`;
}

function appendEvent(state, type, refs, payload) {
  const event = {
    id: allocateEventId(state),
    tick: state.clock.tick,
    type,
    refs,
    payload,
  };
  state.ledger.push(event);
  return event;
}

function compareNumberedIds(left, right) {
  const leftNumber = Number(left.id.match(/-(\d+)$/)?.[1]);
  const rightNumber = Number(right.id.match(/-(\d+)$/)?.[1]);
  if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function reduceCareerCommand(state, command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new Error('Career command must be an object.');
  }
  if (typeof command.type !== 'string' || command.type.length === 0) {
    throw new Error('Career command type must be a non-empty string.');
  }

  if (command.type === 'PROCESS_DUE_LOANS') {
    const dueLoans = Object.values(state.registrationsById)
      .filter((registration) => registration.kind === 'loan'
        && registration.active
        && registration.endTick <= state.clock.tick)
      .sort(compareNumberedIds);
    const transitioned = returnExpiredLoans(state);
    const events = dueLoans.map((loan) => {
      const person = state.peopleById[loan.personId];
      return appendEvent(transitioned, 'LOAN_RETURNED', {
        personId: loan.personId,
        registrationId: loan.id,
        parentClubId: loan.parentClubId,
        fromTeamId: loan.teamId,
        toTeamId: person.career.parentClubTeamId,
      }, { scheduledEndTick: loan.endTick });
    });
    return { state: transitioned, events };
  }

  if (command.type === 'ACCEPT_TRANSFER') {
    if (typeof command.negotiationId !== 'string' || command.negotiationId.length === 0) {
      throw new Error('ACCEPT_TRANSFER negotiationId must be a non-empty string.');
    }

    const transition = acceptTransferOfferWithResult(state, command.negotiationId);
    const transitioned = transition.state;
    const negotiation = transitioned.negotiationsById[command.negotiationId];
    const event = appendEvent(transitioned, 'TRANSFER_ACCEPTED', {
      negotiationId: negotiation.id,
      personId: negotiation.personId,
      fromClubId: negotiation.fromClubId,
      toClubId: negotiation.toClubId,
      contractId: transition.contractId,
      registrationId: transition.registrationId,
    }, {
      transferFeeMinor: negotiation.terms.transferFeeMinor,
      durationTicks: negotiation.terms.durationTicks,
      wagePerWeekMinor: negotiation.terms.wagePerWeekMinor,
      signingBonusMinor: negotiation.terms.signingBonusMinor,
      squadRole: negotiation.terms.squadRole,
    });
    return { state: transitioned, events: [event] };
  }

  if (command.type === 'ACCEPT_CONTRACT') {
    if (typeof command.negotiationId !== 'string' || command.negotiationId.length === 0) {
      throw new Error('ACCEPT_CONTRACT negotiationId must be a non-empty string.');
    }

    const transition = acceptContractOfferWithResult(state, command.negotiationId);
    const transitioned = transition.state;
    const negotiation = transitioned.negotiationsById[command.negotiationId];
    const event = appendEvent(transitioned, 'CONTRACT_ACCEPTED', {
      negotiationId: negotiation.id,
      personId: negotiation.personId,
      clubId: negotiation.toClubId,
      contractId: transition.contractId,
      registrationId: transition.registrationId,
    }, {
      durationTicks: negotiation.terms.durationTicks,
      wagePerWeekMinor: negotiation.terms.wagePerWeekMinor,
      signingBonusMinor: negotiation.terms.signingBonusMinor,
      squadRole: negotiation.terms.squadRole,
      releaseFeeMinor: negotiation.terms.releaseFeeMinor ?? null,
    });
    return { state: transitioned, events: [event] };
  }

  if (command.type === 'REJECT_CONTRACT') {
    if (typeof command.negotiationId !== 'string' || command.negotiationId.length === 0) {
      throw new Error('REJECT_CONTRACT negotiationId must be a non-empty string.');
    }

    const transitioned = rejectContractOffer(state, command.negotiationId);
    const negotiation = transitioned.negotiationsById[command.negotiationId];
    const event = appendEvent(transitioned, 'CONTRACT_REJECTED', {
      negotiationId: negotiation.id,
      personId: negotiation.personId,
      clubId: negotiation.toClubId,
    }, { roundsUsed: negotiation.roundsUsed });
    return { state: transitioned, events: [event] };
  }

  if (command.type === 'COUNTER_CONTRACT') {
    if (typeof command.negotiationId !== 'string' || command.negotiationId.length === 0) {
      throw new Error('COUNTER_CONTRACT negotiationId must be a non-empty string.');
    }
    const transitioned = counterContractOffer(state, command.negotiationId, command.terms);
    const negotiation = transitioned.negotiationsById[command.negotiationId];
    const event = appendEvent(transitioned, 'CONTRACT_COUNTERED', {
      negotiationId: negotiation.id,
      personId: negotiation.personId,
      clubId: negotiation.toClubId,
    }, {
      terms: {
        durationTicks: negotiation.terms.durationTicks,
        wagePerWeekMinor: negotiation.terms.wagePerWeekMinor,
        signingBonusMinor: negotiation.terms.signingBonusMinor,
        squadRole: negotiation.terms.squadRole,
        releaseFeeMinor: negotiation.terms.releaseFeeMinor ?? null,
      },
      roundsUsed: negotiation.roundsUsed,
      maxRounds: negotiation.maxRounds,
    });
    return { state: transitioned, events: [event] };
  }

  if (command.type !== 'ACCEPT_LOAN') {
    throw new Error(`Unknown career command: ${command.type}`);
  }
  if (typeof command.negotiationId !== 'string' || command.negotiationId.length === 0) {
    throw new Error('ACCEPT_LOAN negotiationId must be a non-empty string.');
  }

  const transitioned = acceptLoanOffer(state, command.negotiationId);
  const negotiation = transitioned.negotiationsById[command.negotiationId];
  const registration = Object.values(transitioned.registrationsById).find(
    (candidate) => candidate.kind === 'loan'
      && candidate.active
      && candidate.personId === negotiation.personId
      && candidate.teamId === negotiation.toTeamId,
  );
  const event = appendEvent(transitioned, 'LOAN_ACCEPTED', {
    negotiationId: negotiation.id,
    personId: negotiation.personId,
    registrationId: registration.id,
    fromClubId: negotiation.fromClubId,
    toClubId: negotiation.toClubId,
  }, { endTick: registration.endTick });
  return { state: transitioned, events: [event] };
}
