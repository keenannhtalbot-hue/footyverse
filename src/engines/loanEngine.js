// Loan engine: deterministic offer acceptance and fixed-term return lifecycle.
// DOM-independent and pure: all validation happens before cloning so failures are atomic.

function assertObjectContainer(state, field) {
  if (!state?.[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) {
    throw new Error(`${field} must be an object.`);
  }
}

function assertStateContainers(state) {
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

function allocateRegistrationId(next) {
  let maxNumber = next.idCounters.registration ?? 0;
  for (const id of Object.keys(next.registrationsById)) {
    const match = id.match(/^registration-(\d+)$/);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  const number = maxNumber + 1;
  next.idCounters.registration = number;
  return `registration-${number}`;
}

export function acceptLoanOffer(state, negotiationId) {
  assertStateContainers(state);
  const negotiation = state.negotiationsById[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  if (negotiation.kind !== 'loan') throw new Error(`Negotiation is not a loan offer: ${negotiationId}`);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  if (state.clock.tick > negotiation.expiresTick) {
    throw new Error(`Negotiation has expired: ${negotiationId}`);
  }
  if (!Number.isInteger(negotiation.terms?.durationTicks) || negotiation.terms.durationTicks <= 0) {
    throw new Error('Loan durationTicks must be a positive integer.');
  }

  const person = state.peopleById[negotiation.personId];
  if (!person) throw new Error(`Unknown person: ${negotiation.personId}`);
  const parentClub = state.clubsById[negotiation.fromClubId];
  if (!parentClub) throw new Error(`Unknown parent club: ${negotiation.fromClubId}`);
  const destinationClub = state.clubsById[negotiation.toClubId];
  if (!destinationClub) throw new Error(`Unknown destination club: ${negotiation.toClubId}`);
  const destinationTeam = state.teamsById[negotiation.toTeamId];
  if (!destinationTeam) throw new Error(`Unknown destination team: ${negotiation.toTeamId}`);
  if (destinationTeam.clubId !== negotiation.toClubId) {
    throw new Error(`Destination team does not belong to destination club: ${negotiation.toTeamId}`);
  }

  const owningContracts = Object.values(state.contractsById).filter(
    (contract) => contract.personId === negotiation.personId
      && contract.clubId === negotiation.fromClubId
      && contract.status === 'active',
  );
  if (owningContracts.length !== 1) {
    throw new Error(`Expected one active owning contract for ${negotiation.personId}`);
  }
  const [owningContract] = owningContracts;

  const activeRegistrations = Object.values(state.registrationsById).filter(
    (registration) => registration.personId === negotiation.personId && registration.active,
  );
  if (activeRegistrations.length !== 1) {
    throw new Error(`Expected exactly one active registration for ${negotiation.personId}`);
  }
  const [parentRegistration] = activeRegistrations;
  const parentTeam = state.teamsById[parentRegistration.teamId];
  if (!parentTeam || parentTeam.clubId !== negotiation.fromClubId) {
    throw new Error(`Active registration is not with parent club: ${parentRegistration.id}`);
  }
  if (!Array.isArray(parentTeam.squadPersonIds) || !parentTeam.squadPersonIds.includes(negotiation.personId)) {
    throw new Error(`Parent team squad is inconsistent for ${negotiation.personId}`);
  }
  if (!Array.isArray(destinationTeam.squadPersonIds)) {
    throw new Error(`Destination team squadPersonIds must be an array: ${negotiation.toTeamId}`);
  }
  if (!person.career || typeof person.career !== 'object') {
    throw new Error(`Person career must be an object: ${negotiation.personId}`);
  }

  const next = structuredClone(state);
  const tick = next.clock.tick;
  next.registrationsById[parentRegistration.id].active = false;
  next.registrationsById[parentRegistration.id].endTick = tick;

  const registrationId = allocateRegistrationId(next);
  next.registrationsById[registrationId] = {
    id: registrationId,
    personId: negotiation.personId,
    teamId: negotiation.toTeamId,
    kind: 'loan',
    startTick: tick,
    endTick: tick + negotiation.terms.durationTicks,
    parentClubId: negotiation.fromClubId,
    active: true,
  };

  const personId = negotiation.personId;
  next.teamsById[parentRegistration.teamId].squadPersonIds = next.teamsById[
    parentRegistration.teamId
  ].squadPersonIds.filter((id) => id !== personId);
  if (!next.teamsById[negotiation.toTeamId].squadPersonIds.includes(personId)) {
    next.teamsById[negotiation.toTeamId].squadPersonIds.push(personId);
  }
  next.peopleById[personId].career.currentTeamId = negotiation.toTeamId;
  next.peopleById[personId].career.currentContractId = owningContract.id;
  next.peopleById[personId].career.parentClubTeamId = parentRegistration.teamId;
  next.peopleById[personId].career.loanTeamId = negotiation.toTeamId;
  next.negotiationsById[negotiationId].status = 'accepted';
  return next;
}

export function returnExpiredLoans(state) {
  assertStateContainers(state);
  const dueLoans = Object.values(state.registrationsById).filter(
    (registration) => registration.kind === 'loan'
      && registration.active
      && registration.endTick <= state.clock.tick,
  );
  if (dueLoans.length === 0) return structuredClone(state);

  const returnPlans = dueLoans.map((loan) => {
    const person = state.peopleById[loan.personId];
    if (!person?.career) throw new Error(`Unknown person or career for due loan: ${loan.personId}`);
    const loanTeam = state.teamsById[loan.teamId];
    if (!loanTeam || !Array.isArray(loanTeam.squadPersonIds)) {
      throw new Error(`Unknown or malformed loan team: ${loan.teamId}`);
    }
    const parentTeamId = person.career.parentClubTeamId;
    const parentTeam = state.teamsById[parentTeamId];
    if (!parentTeam || parentTeam.clubId !== loan.parentClubId || !Array.isArray(parentTeam.squadPersonIds)) {
      throw new Error(`Unknown or malformed parent team for due loan: ${parentTeamId}`);
    }
    const parentRegistrations = Object.values(state.registrationsById).filter(
      (registration) => registration.personId === loan.personId
        && registration.teamId === parentTeamId
        && registration.kind !== 'loan'
        && !registration.active,
    );
    if (parentRegistrations.length !== 1) {
      throw new Error(`Expected exactly one inactive parent registration for ${loan.personId}`);
    }
    const ownsParentContract = Object.values(state.contractsById).some(
      (contract) => contract.personId === loan.personId
        && contract.clubId === loan.parentClubId
        && contract.status === 'active',
    );
    if (!ownsParentContract) throw new Error(`No active parent contract for ${loan.personId}`);
    return {
      loanId: loan.id,
      personId: loan.personId,
      loanTeamId: loan.teamId,
      parentTeamId,
      parentRegistrationId: parentRegistrations[0].id,
    };
  });

  const next = structuredClone(state);
  for (const plan of returnPlans) {
    const person = next.peopleById[plan.personId];
    next.registrationsById[plan.loanId].active = false;
    next.registrationsById[plan.parentRegistrationId].active = true;
    next.registrationsById[plan.parentRegistrationId].endTick = null;

    next.teamsById[plan.loanTeamId].squadPersonIds = next.teamsById[
      plan.loanTeamId
    ].squadPersonIds.filter((id) => id !== plan.personId);
    if (!next.teamsById[plan.parentTeamId].squadPersonIds.includes(plan.personId)) {
      next.teamsById[plan.parentTeamId].squadPersonIds.push(plan.personId);
    }
    person.career.currentTeamId = plan.parentTeamId;
    person.career.parentClubTeamId = null;
    person.career.loanTeamId = null;
  }
  return next;
}
