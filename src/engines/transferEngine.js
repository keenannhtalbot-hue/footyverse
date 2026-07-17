// Transfer engine: permanent transfer offer acceptance.
// DOM-independent, pure — validates before cloning so failures are atomic and does not mutate input.

function assertContainers(state) {
  for (const field of ['contractsById', 'registrationsById', 'negotiationsById', 'clubsById']) {
    if (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) {
      throw new Error(`${field} must be an object.`);
    }
  }
}

function findActiveOwningContract(state, personId, clubId) {
  return Object.values(state.contractsById).find(
    (contract) => contract.personId === personId && contract.clubId === clubId && contract.status === 'active',
  );
}

function findActiveRegistration(state, personId) {
  return Object.values(state.registrationsById).find(
    (registration) => registration.personId === personId && registration.active,
  );
}

function allocateId(next, containerName, counterKey, prefix) {
  const idPattern = new RegExp(`^${prefix}-(\\d+)$`);
  let maxNumber = next.idCounters[counterKey] ?? 0;
  for (const id of Object.keys(next[containerName])) {
    const match = id.match(idPattern);
    if (match) {
      const number = Number(match[1]);
      if (number > maxNumber) maxNumber = number;
    }
  }
  const number = maxNumber + 1;
  next.idCounters[counterKey] = number;
  return `${prefix}-${number}`;
}

export function acceptTransferOfferWithResult(state, negotiationId) {
  assertContainers(state);

  const negotiation = state.negotiationsById[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  if (negotiation.kind !== 'transfer') throw new Error(`Negotiation is not a transfer offer: ${negotiationId}`);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  if (state.clock.tick > negotiation.expiresTick) {
    throw new Error(`Negotiation has expired: ${negotiationId}`);
  }
  // Defensive guard: a transfer from a club to itself is a no-op
  // for fee accounting (the from-club write would overwrite the
  // to-club write at the un-debited original finances). The happy
  // path inserts only other-club targets, but the engine MUST NOT
  // silently perform arithmetic that nets to a zero budget change.
  // This was surfaced by Claude review on the 2026-07-15 mobility
  // slice (finding severity: low, blocking: no) and folded back here
  // as a defensive guard with no behavioural change for canonical
  // gameplay.
  if (negotiation.fromClubId === negotiation.toClubId) {
    throw new Error(`Transfer origin and destination are the same club: ${negotiation.fromClubId}`);
  }

  const sellingContract = findActiveOwningContract(state, negotiation.personId, negotiation.fromClubId);
  if (!sellingContract) {
    throw new Error(`No active owning contract for ${negotiation.personId} at ${negotiation.fromClubId}`);
  }

  const activeRegistration = findActiveRegistration(state, negotiation.personId);
  if (!activeRegistration) {
    throw new Error(`No active registration for ${negotiation.personId}`);
  }

  const buyingClub = state.clubsById[negotiation.toClubId];
  if (!buyingClub) throw new Error(`Unknown buying club: ${negotiation.toClubId}`);
  const sellingClub = state.clubsById[negotiation.fromClubId];
  if (!sellingClub) throw new Error(`Unknown selling club: ${negotiation.fromClubId}`);

  const feeMinor = negotiation.terms.transferFeeMinor;
  if (buyingClub.finances.transferBudgetMinor < feeMinor) {
    throw new Error(`Buying club has insufficient transfer budget: ${negotiation.toClubId}`);
  }

  const next = structuredClone(state);
  const tick = next.clock.tick;

  next.contractsById[sellingContract.id].status = 'terminated';
  next.registrationsById[activeRegistration.id].active = false;
  next.registrationsById[activeRegistration.id].endTick = tick;

  const contractId = allocateId(next, 'contractsById', 'contract', 'contract');
  next.contractsById[contractId] = {
    id: contractId,
    personId: negotiation.personId,
    clubId: negotiation.toClubId,
    status: 'active',
    kind: 'professional',
    startTick: tick,
    endTick: tick + negotiation.terms.durationTicks,
    wagePerWeekMinor: negotiation.terms.wagePerWeekMinor,
    signingBonusMinor: negotiation.terms.signingBonusMinor,
    squadRole: negotiation.terms.squadRole,
    releaseFeeMinor: null,
    parentContractId: null,
  };

  const registrationId = allocateId(next, 'registrationsById', 'registration', 'registration');
  next.registrationsById[registrationId] = {
    id: registrationId,
    personId: negotiation.personId,
    teamId: negotiation.toTeamId,
    kind: 'permanent',
    startTick: tick,
    endTick: null,
    parentClubId: null,
    active: true,
  };

  next.clubsById[negotiation.toClubId] = {
    ...buyingClub,
    finances: {
      ...buyingClub.finances,
      transferBudgetMinor: buyingClub.finances.transferBudgetMinor - feeMinor,
    },
  };
  next.clubsById[negotiation.fromClubId] = {
    ...sellingClub,
    finances: {
      ...sellingClub.finances,
      transferBudgetMinor: sellingClub.finances.transferBudgetMinor + feeMinor,
    },
  };

  next.negotiationsById[negotiationId] = {
    ...next.negotiationsById[negotiationId],
    status: 'accepted',
  };

  // Mobility parity with contractEngine: flip the player's canonical
  // career pointer to the buying club. Stage stays 'senior' — a transfer
  // is not a promotion/demotion event, the player is still senior. If
  // the person record is missing (defensive), do not touch the pointer.
  const person = next.peopleById?.[negotiation.personId];
  if (person && typeof person === 'object' && person.career && typeof person.career === 'object') {
    person.career = {
      ...person.career,
      currentTeamId: next.registrationsById[registrationId].teamId,
      currentContractId: contractId,
      parentClubTeamId: null,
      loanTeamId: null,
    };
  }

  return { state: next, contractId, registrationId };
}

export function acceptTransferOffer(state, negotiationId) {
  return acceptTransferOfferWithResult(state, negotiationId).state;
}
