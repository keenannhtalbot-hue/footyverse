// Contract engine: offer acceptance, contract validity.
// DOM-independent, pure — does not mutate input.

function assertObjectContainer(state, field) {
  if (!state?.[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) {
    throw new Error(`${field} must be an object.`);
  }
}

function assertContractState(state) {
  for (const field of [
    'clock', 'peopleById', 'clubsById', 'teamsById', 'contractsById',
    'registrationsById', 'negotiationsById', 'idCounters',
  ]) {
    assertObjectContainer(state, field);
  }
  if (!Number.isInteger(state.clock.tick) || state.clock.tick < 0) {
    throw new Error('clock.tick must be a non-negative integer.');
  }
}

function hasActiveOwningContract(state, personId) {
  assertObjectContainer(state, 'contractsById');
  return Object.values(state.contractsById).some(
    (contract) => contract.personId === personId && contract.status === 'active',
  );
}

function allocateId(next, containerName, counterKey, prefix) {
  let maxNumber = next.idCounters[counterKey] ?? 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of Object.keys(next[containerName])) {
    const match = id.match(pattern);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  const number = maxNumber + 1;
  next.idCounters[counterKey] = number;
  return `${prefix}-${number}`;
}

function assertContractOffer(negotiation, negotiationId) {
  if (negotiation.kind !== 'professional-offer') {
    throw new Error(`Negotiation is not a contract offer: ${negotiationId}`);
  }
}

function assertOfferNotExpired(state, negotiation, negotiationId) {
  if (state.clock.tick > negotiation.expiresTick) {
    throw new Error(`Negotiation has expired: ${negotiationId}`);
  }
}

function assertContractTerms(terms) {
  const validReleaseFee = terms?.releaseFeeMinor == null
    || (Number.isInteger(terms.releaseFeeMinor) && terms.releaseFeeMinor >= 0);
  if (!terms
    || typeof terms !== 'object'
    || Array.isArray(terms)
    || !Number.isInteger(terms.durationTicks)
    || terms.durationTicks <= 0
    || !Number.isInteger(terms.wagePerWeekMinor)
    || terms.wagePerWeekMinor < 0
    || !Number.isInteger(terms.signingBonusMinor)
    || terms.signingBonusMinor < 0
    || typeof terms.squadRole !== 'string'
    || terms.squadRole.length === 0
    || !validReleaseFee) {
    throw new Error('Contract terms are invalid.');
  }
}

export function acceptContractOfferWithResult(state, negotiationId) {
  assertContractState(state);
  const negotiation = state.negotiationsById[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  assertContractOffer(negotiation, negotiationId);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  assertOfferNotExpired(state, negotiation, negotiationId);
  assertContractTerms(negotiation.terms);
  if (hasActiveOwningContract(state, negotiation.personId)) {
    throw new Error(`Person already has an active owning contract: ${negotiation.personId}`);
  }

  const person = state.peopleById[negotiation.personId];
  if (!person?.career || typeof person.career !== 'object' || Array.isArray(person.career)) {
    throw new Error(`Unknown person or career: ${negotiation.personId}`);
  }
  const destinationClub = state.clubsById[negotiation.toClubId];
  if (!destinationClub || !Array.isArray(destinationClub.teamIds)) {
    throw new Error(`Unknown or malformed destination club: ${negotiation.toClubId}`);
  }
  const destinationTeam = destinationClub.teamIds
    .map((teamId) => state.teamsById[teamId])
    .find((team) => team?.level === 'senior');
  if (!destinationTeam || destinationTeam.clubId !== negotiation.toClubId
    || !Array.isArray(destinationTeam.squadPersonIds)) {
    throw new Error(`Destination club has no valid senior team: ${negotiation.toClubId}`);
  }
  if (Object.values(state.registrationsById).some(
    (registration) => registration.personId === negotiation.personId && registration.active,
  )) {
    throw new Error(`Person already has an active registration: ${negotiation.personId}`);
  }

  const next = structuredClone(state);
  const tick = next.clock.tick;
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
    releaseFeeMinor: negotiation.terms.releaseFeeMinor ?? null,
    parentContractId: null,
  };

  const registrationId = allocateId(next, 'registrationsById', 'registration', 'registration');
  next.registrationsById[registrationId] = {
    id: registrationId,
    personId: negotiation.personId,
    teamId: destinationTeam.id,
    kind: 'permanent',
    startTick: tick,
    endTick: null,
    parentClubId: null,
    active: true,
  };

  next.teamsById[destinationTeam.id].squadPersonIds.push(negotiation.personId);
  const career = next.peopleById[negotiation.personId].career;
  career.stage = 'senior';
  career.currentTeamId = destinationTeam.id;
  career.currentContractId = contractId;
  career.parentClubTeamId = null;
  career.loanTeamId = null;
  next.negotiationsById[negotiationId] = {
    ...next.negotiationsById[negotiationId],
    status: 'accepted',
  };

  return { state: next, contractId, registrationId };
}

export function acceptContractOffer(state, negotiationId) {
  return acceptContractOfferWithResult(state, negotiationId).state;
}

export function rejectContractOffer(state, negotiationId) {
  const negotiation = state.negotiationsById?.[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  assertContractOffer(negotiation, negotiationId);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  assertOfferNotExpired(state, negotiation, negotiationId);

  const next = structuredClone(state);
  next.negotiationsById[negotiationId] = {
    ...next.negotiationsById[negotiationId],
    status: 'rejected',
  };

  return next;
}

export function counterContractOffer(state, negotiationId, terms) {
  const negotiation = state.negotiationsById?.[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  assertContractOffer(negotiation, negotiationId);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  assertOfferNotExpired(state, negotiation, negotiationId);
  if (negotiation.roundsUsed >= negotiation.maxRounds) {
    throw new Error(`Negotiation counter round limit reached: ${negotiationId}`);
  }
  assertContractTerms(terms);

  const next = structuredClone(state);
  next.negotiationsById[negotiationId] = {
    ...next.negotiationsById[negotiationId],
    terms: structuredClone(terms),
    roundsUsed: negotiation.roundsUsed + 1,
  };

  return next;
}

export function expireContracts(state) {
  assertObjectContainer(state, 'contractsById');
  const tick = state.clock.tick;
  const next = structuredClone(state);

  for (const contract of Object.values(next.contractsById)) {
    if (contract.status === 'active' && contract.endTick <= tick) {
      contract.status = 'expired';
    }
  }

  return next;
}
