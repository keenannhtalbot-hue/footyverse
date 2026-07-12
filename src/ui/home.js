// Home app: status, current quarter, headline, recent story. No game logic.

import { escapeHtml, card, emptyState } from './helpers.js';
import {
  resolveActiveStepForApp,
  markStepDismissed as markGuidedHintDismissed,
} from '../engines/guidedSeason.js';
import { renderGuidedHint } from './guidedHint.js';

export function renderGuidedHintForApp(state, actions, appId) {
  const step = resolveActiveStepForApp(state, appId);
  if (!step) return '';
  return renderGuidedHint({
    step,
    onDismiss: () => actions.dismissGuidedHint(step.id),
  });
}

function isSeniorCareer(state) {
  return state.careerState?.peopleById?.[state.careerState.playerId]?.career?.stage === 'senior';
}

function hasActiveProfessionalContract(state) {
  const contractId = state.careerState?.peopleById?.[state.careerState.playerId]?.career?.currentContractId;
  return Boolean(contractId && state.careerState?.contractsById?.[contractId]?.status === 'active');
}

export function deriveHomeObjectives(state) {
  const p = state.player;
  const isSenior = isSeniorCareer(state);
  const hasActiveContract = hasActiveProfessionalContract(state);
  const endedContract = isSenior && !hasActiveContract && p.club;
  const injured = Boolean(p.injury && p.injury.quartersOut > 0);
  const immediate = injured
    ? `Recover from ${p.injury.label} before returning to full training.`
    : p.ap > 0
      ? `Use your ${p.ap} AP to improve before ${p.quarter} ends.`
      : `${p.quarter} is complete. Move on when you are ready.`;
  const season = endedContract
    ? `Your contract with ${p.club} has ended. Choose your next senior step.`
    : !p.club
    ? 'Build your skills and look for a club pathway this season.'
    : p.position
      ? `Keep growing as a ${p.position} with ${p.club}.`
      : `Play for ${p.club} so your coach can learn your best position.`;
  const longTerm = endedContract
    ? `Your contract with ${p.club} has ended. Choose your next senior step.`
    : isSenior
    ? `Build your senior career with ${p.club ?? 'your professional club'}.`
    : p.age < 16
      ? 'Grow your game step by step on the journey to age 16.'
      : 'Finish your youth journey and choose your first senior step.';

  return { immediate, season, longTerm };
}

export function deriveHomeNextAction(state) {
  const p = state.player;
  const currentTick = state.careerState?.clock?.tick ?? 0;
  const hasPendingOffer = Object.values(state.careerState?.negotiationsById ?? {}).some(
    (offer) => offer.kind === 'professional-offer'
      && offer.status === 'open'
      && currentTick <= offer.expiresTick,
  );
  if (hasPendingOffer) {
    return {
      id: 'contracts',
      label: 'Review your offer',
      reason: 'A club is waiting for your choice before your journey moves on.',
    };
  }

  const injured = Boolean(p.injury && p.injury.quartersOut > 0);
  if (injured && p.ap >= 1 && !p.physioUsedThisQuarter) {
    return {
      id: 'life',
      label: 'Visit the physio',
      reason: `Training is paused by your ${p.injury.label}. Physio can speed up recovery.`,
    };
  }
  if (injured) {
    return {
      id: 'end-quarter',
      label: 'Recover next quarter',
      reason: p.physioUsedThisQuarter
        ? 'You already visited the physio. Move on to continue recovery next quarter.'
        : 'You need 1 AP for physio. Move on to rest and recover next quarter.',
    };
  }
  if (p.ap >= 2) {
    return {
      id: 'training',
      label: 'Go to training',
      reason: `${p.ap} AP remains. Training costs 2 AP.`,
    };
  }
  if (p.ap === 1) {
    return {
      id: 'activities',
      label: 'Use your final AP',
      reason: 'Training needs 2 AP, but a lighter activity can use your final point.',
    };
  }
  return {
    id: 'end-quarter',
    label: 'Start the next quarter',
    reason: p.hidden?.fatigue > 0
      ? 'No AP remains. Move on to rest, lower fatigue, and refill your AP.'
      : 'No AP remains. Move on to refill your AP.',
  };
}

export function renderHomeDashboard(state) {
  const objectives = deriveHomeObjectives(state);
  const nextAction = deriveHomeNextAction(state);
  return `<section class="card card--accent full-span home-plan" aria-labelledby="home-plan-title">
    <h2 id="home-plan-title">Your game plan</h2>
    <div class="home-objectives">
      <div class="home-objective"><h3>Right now</h3><p>${escapeHtml(objectives.immediate)}</p></div>
      <div class="home-objective"><h3>This season</h3><p>${escapeHtml(objectives.season)}</p></div>
      <div class="home-objective"><h3>${isSeniorCareer(state) ? 'Senior career' : 'Youth journey'}</h3><p>${escapeHtml(objectives.longTerm)}</p></div>
    </div>
    <div class="home-next-action">
      <p class="section-title">Next action</p>
      <button type="button" class="btn btn--primary btn--block" data-home-action="${nextAction.id}" aria-describedby="home-action-reason">${escapeHtml(nextAction.label)}</button>
      <p id="home-action-reason" class="text-small text-dim" role="status" aria-live="polite">${escapeHtml(nextAction.reason)}</p>
    </div>
  </section>`;
}

export function renderQuarterRecap(recap) {
  if (!recap) return '';
  if (recap.dismissed) {
    return `<button type="button" class="btn btn--ghost quarter-recap-show" data-quarter-recap="show">Review last quarter</button>`;
  }
  return `<section class="card card--accent full-span quarter-recap" aria-labelledby="quarter-recap-title">
    <div class="quarter-recap__heading">
      <h2 id="quarter-recap-title" tabindex="-1">Your quarter recap</h2>
      <button type="button" class="btn btn--ghost" data-quarter-recap="dismiss">Dismiss</button>
    </div>
    <ol class="quarter-recap__list">${recap.highlights.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ol>
    ${recap.sparse ? '<p class="text-small text-dim">Only the changes the game could verify are shown — nothing has been made up.</p>' : ''}
  </section>`;
}

export function render(container, { state, actions }) {
  const p = state.player;
  const recentStory = p.storyLedger.slice(-3).reverse();
  const guidedHintHtml = renderGuidedHintForApp(state, actions, 'home');

  container.innerHTML = `
    ${renderQuarterRecap(state.quarterRecap)}
    ${guidedHintHtml}
    ${renderHomeDashboard(state)}
    ${card(
      'Current status',
      `<p class="text-dim">${escapeHtml(state.headline || 'A new season is underway.')}</p>
      <div class="pill-row mt-4">
        <span class="pill">${p.quarter} ${p.year}</span>
        <span class="pill">Age ${p.age}</span>
        <span class="pill">${p.ap} AP left${p.ap > p.apMax ? ` · ${p.ap - p.apMax} carried` : ''}</span>
        ${p.club ? `<span class="pill">${escapeHtml(p.club)}</span>` : '<span class="pill">No club yet</span>'}
        ${p.position ? `<span class="pill">${escapeHtml(p.position)}</span>` : ''}
        ${p.injury ? `<span class="pill">Injured: ${escapeHtml(p.injury.label)}</span>` : ''}
      </div>`
    )}
    ${card(
      'Recent story',
      recentStory.length
        ? `<ul style="list-style:none;padding:0;margin:0;">${recentStory
            .map((s) => `<li class="list-item"><span>${escapeHtml(s.text)}</span></li>`)
            .join('')}</ul>`
        : emptyState('Nothing has happened yet — end a quarter to see the world move.')
    )}
    ${card(
      'World weather',
      `<p class="text-dim">${escapeHtml(state.world.season)} in ${escapeHtml(p.country)}: ${escapeHtml(state.world.weather)}.</p>`
    )}
  `;

  container.querySelector('[data-home-action]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const actionId = button.getAttribute('data-home-action');
    button.disabled = true;
    try {
      if (actionId === 'end-quarter') await actions.endQuarter();
      else actions.switchApp(actionId);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
  if (state.quarterRecap) {
    container.querySelector('[data-quarter-recap]')?.addEventListener('click', (event) => {
      actions.setQuarterRecapDismissed(event.currentTarget.getAttribute('data-quarter-recap') === 'dismiss');
    });
  }
  const guidedDismiss = container.querySelector?.('[data-guided-dismiss]');
  if (guidedDismiss && typeof guidedDismiss.closest === 'function' && typeof guidedDismiss.addEventListener === 'function') {
    guidedDismiss.addEventListener('click', (event) => {
      const dismissEl = event.currentTarget?.closest?.('[data-guided-step]');
      const stepId = dismissEl?.getAttribute?.('data-guided-step');
      if (stepId) actions.dismissGuidedHint(stepId);
    });
  }
}
