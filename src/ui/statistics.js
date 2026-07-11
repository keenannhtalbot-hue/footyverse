// Statistics app: visible progress, season/career stats, story ledger size.

import { escapeHtml, statBarHtml, card } from './helpers.js';
import { getOverall, VISIBLE_STATS } from '../engines/playerEngine.js';

const LABELS = {
  passing: 'Passing',
  shooting: 'Shooting',
  pace: 'Pace',
  dribbling: 'Dribbling',
  defending: 'Defending',
  physical: 'Physical',
  goalkeeping: 'Goalkeeping',
};

export function render(container, { state }) {
  const p = state.player;
  const overall = getOverall(p);

  container.innerHTML = `
    ${card(
      'Visible attributes',
      VISIBLE_STATS.map((s) => statBarHtml(LABELS[s], p.stats[s])).join(''),
      { fullSpan: true }
    )}
    ${card(
      'Career totals',
      `
      <p><strong>Overall rating:</strong> ${overall !== null ? overall : 'Not yet rated'}</p>
      <p><strong>Matches observed:</strong> ${p.matchObservations}</p>
      <p><strong>Story events lived:</strong> ${p.storyLedger.length}</p>
      <p><strong>Career milestones:</strong> ${p.careerHistory.length}</p>
      `
    )}
    ${card(
      'Season snapshot',
      `
      <p><strong>Quarter:</strong> ${escapeHtml(p.quarter)} ${p.year}</p>
      <p><strong>Age:</strong> ${p.age}</p>
      <p><strong>Confidence:</strong> ${p.hidden.confidence}/100</p>
      <p><strong>Work ethic:</strong> ${p.hidden.workEthic}/100</p>
      `
    )}
  `;
}
