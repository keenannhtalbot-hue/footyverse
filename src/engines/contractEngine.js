// Contract engine: offer acceptance, contract validity.
// DOM-independent, pure — does not mutate input.

function assertContractContainer(state) {
  if (!state.contractsById || typeof state.contractsById !== 'object' || Array.isArray(state.contractsById)) {
    throw new Error('contractsById must be an object.');
  }
}

function hasActiveOwningContract(state, personId) {
  assertContractContainer(state);
  return Object.values(state.contractsById).some(
    (contract) => contract.personId === personId && contract.status === 'active',
  );
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
  const negotiation = state.negotiationsById?.[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  assertContractOffer(negotiation, negotiationId);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  assertOfferNotExpired(state, negotiation, negotiationId);
  assertContractTerms(negotiation.terms);
  if (hasActiveOwningContract(state, negotiation.personId)) {
    throw new Error(`Person already has an active owning contract: ${negotiation.personId}`);
  }

  const next = structuredClone(state);
  const tick = next.clock.tick;
  const contractNumber = (next.idCounters.contract ?? 0) + 1;
  next.idCounters.contract = contractNumber;
  const contractId = `contract-${contractNumber}`;

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

  next.negotiationsById[negotiationId] = {
    ...next.negotiationsById[negotiationId],
    status: 'accepted',
  };

  return { state: next, contractId };
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
  assertContractContainer(state);
  const tick = state.clock.tick;
  const next = structuredClone(state);

  for (const contract of Object.values(next.contractsById)) {
    if (contract.status === 'active' && contract.endTick <= tick) {
      contract.status = 'expired';
    }
  }

  return next;
}
