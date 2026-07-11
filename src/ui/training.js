// Training app: limited AP spend across the seven visible stat categories,
// with fatigue and injury-risk indicators. All math delegates to
// trainingEngine.trainStat via actions.trainStat.

import { escapeHtml, statBarHtml, card } from './helpers.js';
import { TRAINING_STATS } from '../engines/trainingEngine.js';

const LABELS = {
  passing: 'Passing',
  shooting: 'Shooting',
  pace: 'Pace',
  dribbling: 'Dribbling',
  defending: 'Defending',
  physical: 'Physical',
  goalkeeping: 'Goalkeeping',
};

function fatigueTone(fatigue) {
  if (fatigue >= 70) return { label: 'High fatigue', cls: 'badge--danger' };
  if (fatigue >= 35) return { label: 'Moderate fatigue', cls: 'badge--warn' };
  return { label: 'Fresh', cls: 'badge--lime' };
}

export function render(container, { state, actions }) {
  const p = state.player;
  const fatigue = fatigueTone(p.hidden.fatigue);
  const injured = Boolean(p.injury && p.injury.quartersOut > 0);

  container.innerHTML = `
    ${card(
      'Condition',
      `
      <div class="pill-row">
        <span class="badge ${fatigue.cls}">${fatigue.label}</span>
        <span class="badge">${p.ap} AP${p.ap > p.apMax ? ` · ${p.ap - p.apMax} carried` : ''}</span>
        ${injured ? `<span class="badge badge--danger">Out: ${escapeHtml(p.injury.label)} (${p.injury.quartersOut}q)</span>` : ''}
      </div>
      <p class="text-dim text-small mt-4">Training spends AP, raises stats, adds fatigue, and carries a small injury risk that grows with fatigue and age. ${
        injured ? 'Training is paused until the injury clears — visit Life for physio care.' : ''
      }</p>
      `,
      { fullSpan: true }
    )}
    ${card(
      'Train a category (2 AP each)',
      `<div id="training-list">${TRAINING_STATS.map(
        (stat) => `
        <div class="list-item" style="align-items:center;">
          <div style="flex:1;">${statBarHtml(LABELS[stat], p.stats[stat])}</div>
          <button type="button" class="btn" data-stat="${stat}" ${injured || p.ap < 2 ? 'disabled' : ''}>Train</button>
        </div>`
      ).join('')}</div>`,
      { fullSpan: true }
    )}
  `;

  container.querySelectorAll('[data-stat]').forEach((btn) => {
    btn.addEventListener('click', () => actions.trainStat(btn.getAttribute('data-stat')));
  });
}
