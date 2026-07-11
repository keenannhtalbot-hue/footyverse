// Activities app: non-football pursuits with AP costs and narrative effects.

import { escapeHtml, card, emptyState } from './helpers.js';
import { ACTIVITIES } from '../data/activities.js';
import { isInjured } from '../engines/trainingEngine.js';

export function render(container, { state, actions }) {
  const p = state.player;
  const injured = isInjured(p);
  const available = ACTIVITIES.filter((a) => p.age >= a.minAge);

  container.innerHTML = `
    ${card(
      'Activities',
      available.length
        ? `<div id="activities-list">${available
            .map((a) => {
              const blocked = injured && a.physicallyDemanding;
              return `
          <div class="list-item">
            <div>
              <strong>${a.icon} ${escapeHtml(a.label)}</strong>
              <p class="text-small text-dim">${escapeHtml(a.description)}${blocked ? ' Too physical while injured.' : ''}</p>
            </div>
            <button type="button" class="btn" data-activity="${a.id}" ${
                p.ap < a.apCost || blocked ? 'disabled' : ''
              }>${a.apCost} AP</button>
          </div>`;
            })
            .join('')}</div>`
        : emptyState('No activities available yet.'),
      { fullSpan: true }
    )}
  `;

  container.querySelectorAll('[data-activity]').forEach((btn) => {
    btn.addEventListener('click', () => actions.doActivity(btn.getAttribute('data-activity')));
  });
}
