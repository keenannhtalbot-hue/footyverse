// Life app: physio when hurt, shopping, diet/rest choices — costs are AP,
// effects are hidden-stat nudges. Game math lives in main.js's actions.

import { escapeHtml, card, statBarHtml } from './helpers.js';
import { LIFE_CHOICES } from '../data/lifeChoices.js';

export function render(container, { state, actions }) {
  const p = state.player;
  const injured = Boolean(p.injury && p.injury.quartersOut > 0);

  container.innerHTML = `
    ${card(
      'Health',
      injured
        ? `
        <p><strong>${escapeHtml(p.injury.label)}</strong> — ${escapeHtml(p.injury.text)}</p>
        <p class="text-dim text-small">${p.injury.quartersOut} quarter(s) of recovery remaining.</p>
        <button type="button" class="btn btn--primary mt-4" id="physio-btn" ${
          p.ap < 1 || p.physioUsedThisQuarter ? 'disabled' : ''
        }>${p.physioUsedThisQuarter ? 'Physio visited this quarter' : 'See the physio (1 AP)'}</button>
        ${p.physioUsedThisQuarter ? `<p class="text-dim text-small mt-4">One physio session per quarter — check back next quarter for another.</p>` : ''}
      `
        : `<p class="text-dim">No current injuries. ${statBarHtml('Fatigue', p.hidden.fatigue)}</p>`,
      { fullSpan: true }
    )}
    ${card(
      'Shopping &amp; routine',
      `<div id="life-list">${LIFE_CHOICES.map(
        (c) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(c.label)}</strong>
            <p class="text-small text-dim">${escapeHtml(c.description)}</p>
          </div>
          <button type="button" class="btn" data-life="${c.id}" ${p.ap < c.apCost ? 'disabled' : ''}>${c.apCost} AP</button>
        </div>`
      ).join('')}</div>`,
      { fullSpan: true }
    )}
  `;

  container.querySelector('#physio-btn')?.addEventListener('click', () => actions.treatInjury());
  container.querySelectorAll('[data-life]').forEach((btn) => {
    btn.addEventListener('click', () => actions.doLifeChoice(btn.getAttribute('data-life')));
  });
}
