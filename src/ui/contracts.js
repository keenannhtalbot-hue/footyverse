// Contract inbox: player-facing formatting and DOM wiring only.

import { card, emptyState, escapeHtml, capitalize } from './helpers.js';

const TICKS_PER_YEAR = 32;
const SQUAD_ROLES = ['prospect', 'rotation', 'starter', 'star'];

function parseWholeNumber(value, label, { minimum = 0 } = {}) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a whole number.`);
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`${label} must be a whole ${minimum > 0 ? 'positive ' : ''}number.`);
  }
  return number;
}

export function parseCounterTerms(existingTerms, values) {
  const wage = parseWholeNumber(values.wage, 'Weekly wage');
  const duration = parseWholeNumber(values.duration, 'Duration', { minimum: 1 });
  const role = String(values.role ?? '');
  if (!SQUAD_ROLES.includes(role)) throw new Error('Choose a valid squad role.');
  const releaseFeeText = String(values.releaseFee ?? '').trim();
  const releaseFee = releaseFeeText === ''
    ? null
    : parseWholeNumber(releaseFeeText, 'Release fee');
  const durationTicks = duration * TICKS_PER_YEAR;
  const wagePerWeekMinor = wage * 100;
  const releaseFeeMinor = releaseFee == null ? null : releaseFee * 100;
  if (![durationTicks, wagePerWeekMinor, releaseFeeMinor]
    .filter((value) => value != null)
    .every(Number.isSafeInteger)) {
    throw new Error('Counter values are too large.');
  }
  return {
    ...existingTerms,
    durationTicks,
    wagePerWeekMinor,
    squadRole: role,
    releaseFeeMinor,
  };
}

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
  const currentContractId = careerState?.peopleById?.[careerState.playerId]?.career?.currentContractId;
  const currentContract = currentContractId
    ? careerState.contractsById?.[currentContractId]
    : null;
  return Object.values(careerState?.negotiationsById ?? {})
    .filter((offer) => offer.kind === 'professional-offer' && offer.personId === careerState.playerId)
    .sort((left, right) => left.expiresTick - right.expiresTick || left.id.localeCompare(right.id))
    .map((offer) => ({
      ...offer,
      clubName: careerState.clubsById?.[offer.toClubId]?.name ?? 'Unknown club',
      contractStatus: offer.status === 'accepted'
        ? careerState.contractsById?.[offer.contractId]?.status ?? currentContract?.status ?? null
        : null,
      expired: offer.status === 'open' && careerState.clock.tick > offer.expiresTick,
    }));
}

function offerHtml(offer, currentTick) {
  const roundsRemaining = Math.max(0, offer.maxRounds - offer.roundsUsed);
  const stale = offer.expired || offer.status !== 'open';
  const termEnded = offer.status === 'accepted' && offer.contractStatus === 'expired';
  const status = offer.expired ? 'Expired' : capitalize(offer.status);
  const timing = offer.expired
    ? 'This offer has expired.'
    : termEnded
      ? 'The contract term has ended.'
      : offer.status === 'accepted'
        ? 'This contract is active; the offer is no longer time-limited.'
        : `Expires in ${offer.expiresTick - currentTick} ticks`;
  const acceptedNote = termEnded
    ? '<p class="offer-feedback" role="status">The contract term has ended. Your senior club status remains recorded; a post-contract career decision is not implemented yet.</p>'
    : offer.status === 'accepted'
      ? '<p class="offer-feedback" role="status">Senior contract in place. The youth chapter is closed; see your club panel for next steps.</p>'
      : '';
  return card(
    `<span class="offer-card__club">${escapeHtml(offer.clubName)}</span>`,
    `<p class="text-dim">${timing}</p>
    <dl class="offer-terms">
      <div><dt>Duration</dt><dd>${formatDuration(offer.terms.durationTicks)}</dd></div>
      <div><dt>Weekly wage</dt><dd>${formatMoney(offer.terms.wagePerWeekMinor)}/week</dd></div>
      <div><dt>Signing bonus</dt><dd>${formatMoney(offer.terms.signingBonusMinor)}</dd></div>
      <div><dt>Squad role</dt><dd>${escapeHtml(capitalize(offer.terms.squadRole))}</dd></div>
      ${offer.terms.releaseFeeMinor == null ? '' : `<div><dt>Release fee</dt><dd>${formatMoney(offer.terms.releaseFeeMinor)}</dd></div>`}
      <div><dt>Negotiation</dt><dd>${roundsRemaining} counter round${roundsRemaining === 1 ? '' : 's'} remaining</dd></div>
    </dl>
    ${acceptedNote}
    ${stale
      ? `<p class="offer-feedback" role="status">${escapeHtml(status)} — no action is available.</p>`
      : `<div class="offer-actions">
        <button type="button" class="btn btn--primary" data-accept-contract="${escapeHtml(offer.id)}" aria-label="Accept contract offer from ${escapeHtml(offer.clubName)}">Accept offer</button>
        ${roundsRemaining > 0 ? `<details class="counter-offer">
          <summary class="btn" aria-label="Counter contract offer from ${escapeHtml(offer.clubName)}">Counter</summary>
          <form data-counter-contract="${escapeHtml(offer.id)}" class="counter-offer__form">
            <p class="text-small text-dim">Ask for different terms. Sending this uses one counter round.</p>
            <div class="counter-offer__fields">
              <div class="form-field"><label for="counter-wage-${escapeHtml(offer.id)}">Weekly wage (£)</label><input id="counter-wage-${escapeHtml(offer.id)}" name="wage" type="number" min="0" step="1" required value="${offer.terms.wagePerWeekMinor / 100}"></div>
              <div class="form-field"><label for="counter-duration-${escapeHtml(offer.id)}">Duration (years)</label><input id="counter-duration-${escapeHtml(offer.id)}" name="duration" type="number" min="1" step="1" required value="${offer.terms.durationTicks / TICKS_PER_YEAR}"></div>
              <div class="form-field"><label for="counter-role-${escapeHtml(offer.id)}">Squad role</label><select id="counter-role-${escapeHtml(offer.id)}" name="role">${SQUAD_ROLES.map((role) => `<option value="${role}"${role === offer.terms.squadRole ? ' selected' : ''}>${capitalize(role)}</option>`).join('')}</select></div>
              <div class="form-field"><label for="counter-release-${escapeHtml(offer.id)}">Release fee (£, optional)</label><input id="counter-release-${escapeHtml(offer.id)}" name="releaseFee" type="number" min="0" step="1" value="${offer.terms.releaseFeeMinor == null ? '' : offer.terms.releaseFeeMinor / 100}"></div>
            </div>
            <button type="submit" class="btn btn--primary btn--block">Send counter</button>
            <p class="offer-feedback offer-feedback--error" data-counter-error hidden role="alert"></p>
          </form>
        </details>` : '<span class="text-small text-dim">No counter rounds remaining.</span>'}
        <button type="button" class="btn btn--ghost" data-reject-contract="${escapeHtml(offer.id)}" aria-label="Reject contract offer from ${escapeHtml(offer.clubName)}">Reject</button>
      </div>`}`,
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
  container.querySelectorAll('[data-reject-contract]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      await actions.rejectContract(button.getAttribute('data-reject-contract'));
      if (button.isConnected) button.disabled = false;
    });
  });
  container.querySelectorAll('form[data-counter-contract]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const negotiationId = form.getAttribute('data-counter-contract');
      const offer = state.careerState.negotiationsById[negotiationId];
      const submit = form.querySelector('button[type="submit"]');
      const error = form.querySelector('[data-counter-error]');
      if (submit.disabled) return;
      try {
        const values = Object.fromEntries(new FormData(form));
        const terms = parseCounterTerms(offer.terms, values);
        submit.disabled = true;
        await actions.counterContract(negotiationId, terms);
        if (submit.isConnected) submit.disabled = false;
      } catch (caught) {
        error.textContent = caught.message;
        error.hidden = false;
        error.focus?.();
      }
    });
  });
}
