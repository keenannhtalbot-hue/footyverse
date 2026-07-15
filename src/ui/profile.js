// Profile app: identity, school, club/academy, position, potential (as a
// vague coach-style descriptor, not a raw number), coach notes, career
// history. No overall/position is shown until the game state provides one.

import { escapeHtml, card, emptyState, capitalize } from './helpers.js';
import { getOverall } from '../engines/playerEngine.js';
import { COUNTRIES } from '../data/countries.js';
import { CHAINS } from '../data/eventChains.js';

function potentialDescriptor(hiddenPotential, matchObservations) {
  if (matchObservations < 3) return 'Too early to tell — coaches need to see more.';
  if (hiddenPotential >= 80) return 'Coaches whisper this one could go all the way.';
  if (hiddenPotential >= 60) return 'Clear promise, still raw.';
  if (hiddenPotential >= 40) return 'Solid and dependable, room to grow.';
  return 'Enjoying the game — that matters most right now.';
}

/**
 * Describe the current step of a chain in one short player-facing sentence.
 * The wording is deterministic per chain so QA can pin it. Step 1 is the
 * "not yet started" intro step on a fresh chain.
 */
function stepBlurb(chain, currentStepNumber, completed) {
  if (completed) return 'Story complete.';
  if (currentStepNumber === 1) return 'Not started yet — keep playing to begin this arc.';
  if (currentStepNumber === 2) return 'In progress — one beat from completion.';
  if (currentStepNumber === 3) return 'Final step — one moment away from wrapping this arc.';
  return '';
}

function stepStateForRow(chain, currentStepId, completed, available) {
  // Returns an array of 3 entries { step, state } where state is one of
  // `done`, `current`, `upcoming`. The renderer turns those into chips.
  const out = [];
  // A missing/legacy record has no authoritative current step, so every chip
  // stays upcoming rather than inventing a current or completed state.
  const currentIndex = chain.steps.findIndex((s) => s.id === currentStepId);
  const safeIndex = available && currentIndex >= 0 ? currentIndex : -1;
  for (let i = 0; i < chain.steps.length; i += 1) {
    const step = chain.steps[i];
    let state = 'upcoming';
    if (completed) {
      state = 'done';
    } else if (available && i === safeIndex) {
      state = 'current';
    } else if (available && i < safeIndex) {
      state = 'done';
    }
    out.push({ step, state });
  }
  return out;
}

function chainStateAvailable(chainState) {
  return Boolean(chainState && chainState.chains && typeof chainState.chains === 'object');
}

function chainRecordAvailable(chain, record) {
  if (!record || typeof record !== 'object') return false;
  if (record.completed === true) return true;
  return chain.steps.some((step) => step.id === record.currentStepId);
}

function renderChainRow(chain, chainState) {
  const hasChainState = chainStateAvailable(chainState);
  const record = hasChainState ? chainState.chains[chain.id] : null;
  const available = chainRecordAvailable(chain, record);
  const completed = available && record.completed === true;
  const currentStepId = available ? record.currentStepId : null;
  const stepRows = stepStateForRow(chain, currentStepId, completed, available);
  const currentIndex = available ? chain.steps.findIndex((s) => s.id === currentStepId) : -1;
  const currentStepNumber = completed ? chain.steps.length : currentIndex + 1;
  const stateAttr = completed
    ? 'completed'
    : available
    ? 'in-progress'
    : 'missing';
  const title = chain.title || chain.id;
  const description = chain.description || '';
  const ariaLabel = `${title} storyline, ${completed ? 'completed' : available ? `step ${currentStepNumber} of ${chain.steps.length}` : 'no chain progress yet'}`;
  const describedBy = `storyline-${chain.id}-desc`;
  const statusId = `storyline-${chain.id}-status`;

  const chips = stepRows.map(({ step, state }, idx) => {
    const stepNum = idx + 1;
    // Status word for assistive tech — paired with the row-level aria-label
    // so the screen reader announces something like "Football rising
    // storyline, step 2 of 3, in progress".
    const statusWord = state === 'done' ? 'done' : state === 'current' ? 'in progress' : 'not yet';
    const chipLabel = `${title} step ${stepNum} of ${chain.steps.length}, ${statusWord}`;
    return `<span role="listitem" class="storyline-chip storyline-chip--${escapeHtml(state)}" data-storyline-step="${stepNum}" data-storyline-step-state="${escapeHtml(state)}" data-storyline-chip aria-label="${escapeHtml(chipLabel)}"></span>`;
  }).join('');

  const badge = completed
    ? `<span class="storyline-badge storyline-badge--done" aria-hidden="true">Completed</span>`
    : available
    ? `<span class="storyline-badge storyline-badge--pending" aria-hidden="true">In progress</span>`
    : `<span class="storyline-badge storyline-badge--pending" aria-hidden="true">Not started</span>`;

  const blurb = available ? stepBlurb(chain, currentStepNumber, completed) : 'No chain progress recorded for this save yet.';

  return `
    <li class="storyline-row" role="group" data-storyline-id="${escapeHtml(chain.id)}" data-storyline-state="${escapeHtml(stateAttr)}" aria-label="${escapeHtml(ariaLabel)}" aria-describedby="${escapeHtml(describedBy)} ${escapeHtml(statusId)}">
      <div class="storyline-row__heading">
        <div class="storyline-row__title-block">
          <h3 class="storyline-row__title">${escapeHtml(title)}</h3>
          ${description ? `<p class="storyline-row__description text-dim text-small" id="${escapeHtml(describedBy)}">${escapeHtml(description)}</p>` : ''}
        </div>
        ${badge}
      </div>
      <div class="storyline-row__progress" role="list">
        ${chips}
      </div>
      <p class="storyline-row__status text-small text-dim" id="${escapeHtml(statusId)}" role="status" aria-live="polite">${escapeHtml(blurb)}</p>
    </li>
  `;
}

export function renderStorylines(state) {
  const chainState = state && state.chainState ? state.chainState : null;
  const rows = CHAINS.map((chain) => renderChainRow(chain, chainState)).join('');
  const hasProgress = chainStateAvailable(chainState)
    && CHAINS.some((chain) => chainRecordAvailable(chain, chainState.chains[chain.id]));
  const summary = hasProgress
    ? 'Each row tracks one youth-arc storyline. Chips light up as you play the moments that move them forward.'
    : 'No chain progress recorded for this save yet — start a new game to begin these arcs.';
  return `
    <section class="card card--accent full-span storylines" role="region" aria-labelledby="storylines-title" data-storylines>
      <div class="storylines__heading">
        <h2 id="storylines-title" class="storylines__title">Storylines</h2>
        <p class="text-small text-dim storylines__summary">${escapeHtml(summary)}</p>
      </div>
      <ul class="storylines__list">
        ${rows}
      </ul>
    </section>
  `;
}

export function render(container, { state }) {
  const p = state.player;
  const overall = getOverall(p);
  const stage = COUNTRIES[p.country]?.schoolStages?.[0] ?? 'School';

  container.innerHTML = `
    ${card(
      'Identity',
      `
      <div class="pill-row">
        <span class="pill">${escapeHtml(p.name)}</span>
        <span class="pill">${capitalize(p.gender)}</span>
        <span class="pill">${escapeHtml(p.country)}</span>
        <span class="pill">Age ${p.age}</span>
      </div>
      `,
      { fullSpan: true }
    )}
    ${card(
      'School &amp; club',
      `
      <p><strong>School:</strong> ${escapeHtml(stage)}</p>
      <p><strong>Club / academy:</strong> ${p.club ? escapeHtml(p.club) : 'Not yet on a pathway.'}</p>
      <p><strong>Pathway:</strong> ${p.pathway ? escapeHtml(p.pathway) : '—'}</p>
      `
    )}
    ${card(
      'Position &amp; overall',
      `
      <p><strong>Position:</strong> ${p.position ? escapeHtml(p.position) : 'Not yet determined'}</p>
      <p><strong>Overall rating:</strong> ${overall !== null ? overall : 'Not enough organized football to rate yet'}</p>
      <p class="text-dim text-small">${escapeHtml(potentialDescriptor(p.hidden.potential, p.matchObservations))}</p>
      `
    )}
    ${renderStorylines(state)}
    ${card(
      'Coach notes',
      `<p class="text-dim">${
        p.club
          ? escapeHtml(`${state.relationships.coach.name} rates ${p.name}'s attitude as ${describeConfidence(p.hidden.confidence)}.`)
          : ''
      }${p.club ? '' : escapeHtml('No coach notes yet — join a club to start getting feedback.')}</p>`
    )}
    ${card(
      'Career history',
      p.careerHistory.length
        ? `<ul style="list-style:none;padding:0;margin:0;">${p.careerHistory
            .map((h) => `<li class="list-item"><span>${escapeHtml(describeHistory(h))}</span><span class="text-dim text-small">Age ${h.age}</span></li>`)
            .join('')}</ul>`
        : emptyState('No milestones recorded yet.'),
      { fullSpan: true }
    )}
  `;
}

function describeConfidence(confidence) {
  if (confidence >= 75) return 'excellent';
  if (confidence >= 55) return 'good';
  if (confidence >= 35) return 'developing';
  return 'shaky, needs encouragement';
}

function describeHistory(entry) {
  if (entry.type === 'joined_club') return `Joined ${entry.club}`;
  return entry.type;
}
