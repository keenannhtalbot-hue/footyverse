// Contract inbox: player-facing formatting and DOM wiring only.

import { card, emptyState, escapeHtml, capitalize } from './helpers.js';

const TICKS_PER_YEAR = 32;

function formatMoney(minor) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(minor / 100);
}

function formatDuration(ticks) {
  const years = ticks / TICKS_PER_YEAR;
  return Number.isInteger(years)
    ? `${years} year${years === 1 ? '' : 's'}`
    : `${ticks} ticks`;
}

export function getContractOffers(careerState) {
  return Object.values(careerState?.negotiationsById ?? {})
    .filter((offer) => offer.kind === 'professional-offer' && offer.personId === careerState.playerId)
    .sort((left, right) => left.expiresTick - right.expiresTick || left.id.localeCompare(right.id))
    .map((offer) => ({
      ...offer,
      clubName: careerState.clubsById?.[offer.toClubId]?.name ?? 'Unknown club',
      expired: careerState.clock.tick > offer.expiresTick,
    }));
}

function offerHtml(offer, currentTick) {
  const roundsRemaining = Math.max(0, offer.maxRounds - offer.roundsUsed);
  const stale = offer.expired || offer.status !== 'open';
  const status = offer.expired ? 'Expired' : capitalize(offer.status);
  return card(
    `<span class="offer-card__club">${escapeHtml(offer.clubName)}</span>`,
    `<p class="text-dim">${offer.expired ? 'This offer has expired.' : `Expires in ${offer.expiresTick - currentTick} ticks`}</p>
    <dl class="offer-terms">
      <div><dt>Duration</dt><dd>${formatDuration(offer.terms.durationTicks)}</dd></div>
      <div><dt>Weekly wage</dt><dd>${formatMoney(offer.terms.wagePerWeekMinor)}/week</dd></div>
      <div><dt>Signing bonus</dt><dd>${formatMoney(offer.terms.signingBonusMinor)}</dd></div>
      <div><dt>Squad role</dt><dd>${escapeHtml(capitalize(offer.terms.squadRole))}</dd></div>
      ${offer.terms.releaseFeeMinor == null ? '' : `<div><dt>Release fee</dt><dd>${formatMoney(offer.terms.releaseFeeMinor)}</dd></div>`}
      <div><dt>Negotiation</dt><dd>${roundsRemaining} counter round${roundsRemaining === 1 ? '' : 's'} remaining</dd></div>
    </dl>
    ${stale
      ? `<p class="offer-feedback" role="status">${escapeHtml(status)} — no action is available.</p>`
      : `<button type="button" class="btn btn--primary btn--block" data-accept-contract="${escapeHtml(offer.id)}" aria-label="Accept contract offer from ${escapeHtml(offer.clubName)}">Accept offer</button>`}`,
    { accent: !stale, fullSpan: true },
  );
}

export function renderContractInbox(careerState, feedback = null) {
  const offers = getContractOffers(careerState);
  return `<section class="contract-inbox full-span" aria-labelledby="contract-inbox-title">
    <h1 id="contract-inbox-title">Contract offers</h1>
    <p class="text-dim">Review professional terms before making your decision.</p>
    ${feedback ? `<p class="offer-feedback offer-feedback--${feedback.type}">${escapeHtml(feedback.message)}</p>` : ''}
    <div class="contract-inbox__offers">
      ${offers.length ? offers.map((offer) => offerHtml(offer, careerState.clock.tick)).join('') : emptyState('No contract offers right now. Keep playing — clubs will get in touch when the time is right.')}
    </div>
  </section>`;
}

export function render(container, { state, actions }) {
  container.innerHTML = renderContractInbox(state.careerState, state.contractFeedback);
  container.querySelectorAll('[data-accept-contract]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      await actions.acceptContract(button.getAttribute('data-accept-contract'));
    });
  });
}
