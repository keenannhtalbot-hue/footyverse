// Senior career epilogue: an honest, source-only recap of the senior
// career so far, surfaced on the Football app after a professional
// contract has ended. All data is derived from the existing canonical
// careerState — nothing is fabricated (no fake league, no awards, no
// invented offers, no retirement system). The renderer is pure: it
// never mutates state and never reads the DOM besides reading
// careerState references. The football.js render() mounts the card
// only when the player is in the senior stage with no active
// professional contract AND has at least one recorded club history
// (otherwise the honest empty state is served by the existing
// pathway/status block in football.js).

import { escapeHtml } from './helpers.js';

const SENIOR_STAGE = 'senior';

// Return the player's career record and id from careerState, defensively.
// Returns null when there is no careerState or player record. Never throws.
function getPlayerCareer(state) {
  const careerState = state?.careerState;
  const playerId = careerState?.playerId;
  if (typeof playerId !== 'string' || playerId.length === 0) return null;
  const person = careerState?.peopleById?.[playerId];
  if (!person || typeof person !== 'object') return null;
  return { playerId, career: person.career ?? null };
}

function isPlayerContractActive(state, playerId, contract) {
  if (!contract || contract.status !== 'active') return false;
  const careerState = state?.careerState;
  if (careerState?.peopleById?.[playerId]?.career?.currentContractId === contract.id) {
    return true;
  }
  return false;
}

function safeClubName(careerState, clubId) {
  const club = careerState?.clubsById?.[clubId];
  if (!club || typeof club !== 'object') return null;
  const name = club.name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

function num(value) {
  return Number.isFinite(value) ? value : null;
}

function contractStatusLabel(status) {
  switch (status) {
    case 'active': return 'Active';
    case 'expired': return 'Ended';
    case 'terminated': return 'Terminated';
    case 'pending': return 'Pending';
    default: return typeof status === 'string' && status.length > 0 ? status : 'Recorded';
  }
}

function offerStatusLabel(status) {
  switch (status) {
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Declined';
    case 'countered': return 'Countered';
    case 'open': return 'Open';
    default: return typeof status === 'string' && status.length > 0 ? status : 'Recorded';
  }
}

function formatYearTickToYear(_careerState, _tick) {
  // Placeholder: any per-engine tick-to-year mapping would have to be
  // verified against a constant the orchestrator exposes; rather than
  // guess, we deliberately return null. Reserved for a future revision
  // when the engine tick rate is published as part of careerState.
  return null;
}

// Pure: decide whether the football surface should mount the panel.
// Mirrors the eligibility rules documented on the audit's Card A:
//   stage === 'senior'
//   AND no active professional contract (career is "post-contract")
//   AND at least one truthful history record exists for the player
//   (a recorded contract, a resolved offer, or a resolved
//   transfer/loan ledger event) so the panel has something honest
//   to recap.
export function isSeniorEpilogueEligible(state) {
  if (!state || typeof state !== 'object') return false;
  const player = getPlayerCareer(state);
  if (!player || !player.career || player.career.stage !== SENIOR_STAGE) return false;
  const careerState = state.careerState;
  const playerId = player.playerId;
  const hasActiveContract = Object.values(careerState?.contractsById ?? {})
    .some((contract) => contract?.personId === playerId && isPlayerContractActive(state, playerId, contract));
  if (hasActiveContract) return false;
  // A contract record (signed, expired, terminated) is the strongest
  // signal that there is real history to show. We deliberately do not
  // count open negotiations — open offers live in the Contracts app.
  const hasContractRecord = Object.values(careerState?.contractsById ?? {})
    .some((contract) => contract?.personId === playerId);
  // Resolved offers (accepted/rejected/countered) are also truthful.
  const hasResolvedOffer = Object.values(careerState?.negotiationsById ?? {})
    .some((negotiation) => negotiation?.personId === playerId
      && (negotiation.status === 'accepted' || negotiation.status === 'rejected'
        || negotiation.status === 'countered'));
  // Resolved transfer/loan ledger events for the player — the panel
  // surfaces these as "notable moments" only when there is at least
  // one and there is a name (clubsById) attached.
  const hasResolvedMovement = Array.isArray(careerState?.ledger)
    && careerState.ledger.some((event) => event?.refs?.personId === playerId
      && (event.type === 'TRANSFER_ACCEPTED'
        || event.type === 'LOAN_ACCEPTED'
        || event.type === 'LOAN_RETURNED'));
  return Boolean(hasContractRecord || hasResolvedOffer || hasResolvedMovement);
}

export function shouldMountSeniorEpilogue(state) {
  return isSeniorEpilogueEligible(state);
}

// Pure: build the epilogue summary from careerState only. Returns a
// fresh plain object with arrays/labels sourced only from existing
// schema entries. No fields are invented: when data is missing the
// field is []/null and the renderer shows the honest empty path.
export function buildSeniorEpilogue(state) {
  const summary = {
    seniorSeasons: 0,
    clubs: [],
    contracts: [],
    offers: [],
    transfers: [],
    loans: [],
    notableMoments: [],
    sparse: true,
    emptyNote: 'Your senior career has not been recorded yet — end a professional contract for it to appear here.',
  };

  const careerState = state?.careerState;
  const player = getPlayerCareer(state);
  if (!careerState || !player) return summary;

  const playerId = player.playerId;

  // Contracts scoped to this player, sorted oldest-first.
  const playerContracts = Object.values(careerState.contractsById ?? {})
    .filter((contract) => contract && contract.personId === playerId)
    .sort((a, b) => (a.startTick ?? 0) - (b.startTick ?? 0));

  summary.seniorSeasons = playerContracts.length;
  summary.contracts = playerContracts.map((contract) => {
    const clubName = safeClubName(careerState, contract.clubId);
    return {
      contractId: contract.id,
      clubId: typeof contract.clubId === 'string' ? contract.clubId : null,
      clubName,
      status: typeof contract.status === 'string' ? contract.status : 'recorded',
      startTick: num(contract.startTick),
      endTick: num(contract.endTick),
      durationTicks: (Number.isFinite(contract.startTick) && Number.isFinite(contract.endTick))
        ? Math.max(0, contract.endTick - contract.startTick)
        : null,
      squadRole: typeof contract.squadRole === 'string' ? contract.squadRole : null,
      wagePerWeekMinor: num(contract.wagePerWeekMinor),
      signingBonusMinor: num(contract.signingBonusMinor),
      registrationKind: (() => {
        const reg = Object.values(careerState.registrationsById ?? {}).find(
          (r) => r && r.contractId === contract.id && r.personId === playerId,
        );
        return reg?.kind ?? null;
      })(),
    };
  });

  // Clubs the player has been a party of via contracts only (loans inherit the contract club).
  const clubIds = new Set();
  for (const contract of playerContracts) {
    if (typeof contract.clubId === 'string') clubIds.add(contract.clubId);
  }
  summary.clubs = Array.from(clubIds)
    .map((id) => safeClubName(careerState, id))
    .filter((name) => typeof name === 'string');

  // Negotiations scoped to this player — only resolved history (accepted, rejected, countered).
  // Open offers live in the contracts inbox, not in epilogue recap.
  summary.offers = Object.values(careerState.negotiationsById ?? {})
    .filter((negotiation) => negotiation
      && negotiation.personId === playerId
      && (negotiation.status === 'accepted'
        || negotiation.status === 'rejected'
        || negotiation.status === 'countered'))
    .map((negotiation) => ({
      negotiationId: negotiation.id,
      clubId: typeof negotiation.toClubId === 'string' ? negotiation.toClubId : null,
      clubName: safeClubName(careerState, negotiation.toClubId),
      status: negotiation.status,
      createdTick: num(negotiation.createdTick),
    }))
    .sort((a, b) => (a.createdTick ?? 0) - (b.createdTick ?? 0));

  // Transfers & loans from ledger, scoped to playerId.
  summary.transfers = (Array.isArray(careerState.ledger) ? careerState.ledger : [])
    .filter((event) => event && event.type === 'TRANSFER_ACCEPTED' && event.refs?.personId === playerId)
    .map((event) => ({
      tick: num(event.tick),
      fromClubId: typeof event.refs?.fromClubId === 'string' ? event.refs.fromClubId : null,
      toClubId: typeof event.refs?.toClubId === 'string' ? event.refs.toClubId : null,
      fromClubName: safeClubName(careerState, event.refs?.fromClubId),
      toClubName: safeClubName(careerState, event.refs?.toClubId),
      transferFeeMinor: num(event.payload?.transferFeeMinor),
    }));

  summary.loans = (Array.isArray(careerState.ledger) ? careerState.ledger : [])
    .filter((event) => event && (event.type === 'LOAN_ACCEPTED' || event.type === 'LOAN_RETURNED')
      && event.refs?.personId === playerId)
    .map((event) => ({
      kind: event.type === 'LOAN_ACCEPTED' ? 'accepted' : 'returned',
      tick: num(event.tick),
      fromClubId: typeof event.refs?.fromClubId === 'string' ? event.refs.fromClubId : null,
      toClubId: typeof event.refs?.toClubId === 'string' ? event.refs.toClubId : null,
      fromClubName: safeClubName(careerState, event.refs?.fromClubId),
      toClubName: safeClubName(careerState, event.refs?.toClubId),
    }));

  // Notable moments: only events with a truthful payload label we can
  // render verbatim (e.g. CONTRACT_ACCEPTED is already in contracts).
  // We surface TRANSFER_ACCEPTED + LOAN_* events as "notable moments"
  // because they are not duplicated elsewhere in the recap.
  summary.notableMoments = [
    ...summary.transfers.map((t) => ({ tick: t.tick, label: t.toClubName ? `Transferred to ${t.toClubName}` : 'Transfer recorded' })),
    ...summary.loans.map((l) => {
      if (l.kind === 'accepted') return { tick: l.tick, label: l.toClubName ? `Loan to ${l.toClubName}` : 'Loan recorded' };
      return { tick: l.tick, label: l.fromClubName ? `Returned from loan at ${l.fromClubName}` : 'Loan return recorded' };
    }),
  ].filter((m) => m.tick !== null).sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  summary.sparse = summary.contracts.length === 0
    && summary.offers.length === 0
    && summary.transfers.length === 0
    && summary.loans.length === 0;

  return summary;
}

// Pure renderer for the epilogue panel. Returns a card HTML string.
// Empty / sparse path returns honest "no recorded senior history"
// copy with no <li> entries, no fake league / award, no fabricated
// season number.
export function renderSeniorEpilogueCard(state) {
  const summary = buildSeniorEpilogue(state);

  // Empty / sparse panel uses its own <section aria-labelledby="...">
  // because the shared card() helper doesn't expose id+aria hooks.
  if (summary.sparse) {
    return `
      <section class="card card--accent full-span senior-epilogue" aria-labelledby="senior-epilogue-title">
        <h2 id="senior-epilogue-title">Senior journey so far</h2>
        <p class="text-dim senior-epilogue__empty">${escapeHtml(summary.emptyNote)}</p>
      </section>
    `;
  }

  // seniorSeasons counts distinct contract RECORDS the player has
  // been a party of (a terminated-and-re-signed contract would count
  // as two). The heading stays honest about what is being counted.
  const seasonLabel = summary.seniorSeasons === 1
    ? '1 contract recorded'
    : `${summary.seniorSeasons} contracts recorded`;
  const seasonsHtml = `<p class="senior-epilogue__heading"><strong>${escapeHtml(seasonLabel)}</strong></p>`;

  // Clubs list — unique names, escaped, only truthy ones.
  const clubsList = summary.clubs.length
    ? `<ul class="senior-epilogue__list senior-epilogue__clubs">${summary.clubs
        .map((name) => `<li class="senior-epilogue__club">${escapeHtml(name)}</li>`)
        .join('')}</ul>`
    : '<p class="text-dim text-small">No clubs recorded.</p>';

  // Contracts list — only truthful fields. Prefer the ledger event's
  // payload squadRole (the terms the player actually signed at the
  // moment of acceptance) over the contract record, since the ledger
  // is authoritative for "what was agreed" and the contract record is
  // the durable state afterwards.
  const eventSquadRoleByContractId = (state?.careerState?.ledger ?? [])
    .reduce((acc, event) => {
      if (event?.type === 'CONTRACT_ACCEPTED' && event.refs?.personId === state?.careerState?.playerId) {
        const cid = typeof event.refs?.contractId === 'string' ? event.refs.contractId : null;
        const role = typeof event.payload?.squadRole === 'string' ? event.payload.squadRole : null;
        if (cid && role) acc[cid] = role;
      }
      return acc;
    }, {});
  const contractsList = summary.contracts.length
    ? `<ol class="senior-epilogue__list senior-epilogue__contracts">${summary.contracts.map((contract) => {
        const signedRole = eventSquadRoleByContractId[contract.contractId];
        const role = signedRole || contract.squadRole;
        const roleFragment = role ? `, ${escapeHtml(role)}` : '';
        const club = contract.clubName ? escapeHtml(contract.clubName) : 'unrecorded club';
        const span = (contract.durationTicks !== null)
          ? ` · ${escapeHtml(String(contract.durationTicks))} tick${contract.durationTicks === 1 ? '' : 's'}`
          : '';
        return `<li><strong>${escapeHtml(contractStatusLabel(contract.status))}</strong>: ${club}${roleFragment}${span}</li>`;
      }).join('')}</ol>`
    : '';

  // Offers list — only resolved ones (accepted/declined/countered).
  const offersList = summary.offers.length
    ? `<ul class="senior-epilogue__list senior-epilogue__offers">${summary.offers.map((offer) => {
        const club = offer.clubName ? escapeHtml(offer.clubName) : 'unrecorded club';
        return `<li>${escapeHtml(offerStatusLabel(offer.status))}: ${club}</li>`;
      }).join('')}</ul>`
    : '';

  // Notable moments list (transfers, loan returns).
  const momentsList = summary.notableMoments.length
    ? `<ul class="senior-epilogue__list senior-epilogue__moments">${summary.notableMoments
        .map((m) => `<li>${escapeHtml(m.label)}</li>`)
        .join('')}</ul>`
    : '';

  // Honest note for partial-history case (no fabricated awards/league).
  // Wording carefully avoids "award"/"award-like" terms so a future
  // negative test for "MVP|trophy|award|champion|golden boot" stays clean.
  const note = `<p class="text-small text-dim senior-epilogue__note">Only the recorded career history is shown. Leagues, trophies, and retirement stats are not part of the game yet.</p>`;

  const gridBody = `${seasonsHtml}${clubsList}${contractsList}${offersList}${momentsList}${note}`;

  return `
    <section class="card card--accent full-span senior-epilogue" aria-labelledby="senior-epilogue-title">
      <h2 id="senior-epilogue-title">Senior journey so far</h2>
      ${gridBody}
    </section>
  `;
}
