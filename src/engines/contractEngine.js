// Contract engine: offer acceptance, contract validity.
// DOM-independent, pure — does not mutate input.

function hasActiveOwningContract(state, personId) {
  return Object.values(state.contractsById).some(
    (contract) => contract.personId === personId && contract.status === 'active',
  );
}

export function acceptContractOffer(state, negotiationId) {
  const negotiation = state.negotiationsById?.[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);
  if (state.clock.tick > negotiation.expiresTick) {
    throw new Error(`Negotiation has expired: ${negotiationId}`);
  }
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

  return next;
}

export function rejectContractOffer(state, negotiationId) {
  const negotiation = state.negotiationsById?.[negotiationId];
  if (!negotiation) throw new Error(`Unknown negotiation: ${negotiationId}`);
  if (negotiation.status !== 'open') throw new Error(`Negotiation is not open: ${negotiationId}`);

  const next = structuredClone(state);
  next.negotiationsById[negotiationId] = {
    ...next.negotiationsById[negotiationId],
    status: 'rejected',
  };

  return next;
}

export function expireContracts(state) {
  const tick = state.clock.tick;
  const next = structuredClone(state);

  for (const contract of Object.values(next.contractsById)) {
    if (contract.status === 'active' && contract.endTick <= tick) {
      contract.status = 'expired';
    }
  }

  return next;
}
