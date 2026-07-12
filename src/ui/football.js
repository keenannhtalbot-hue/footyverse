// Football app: pathway, team, coach recommendation status, and a nudge
// toward the next fixture/match decision, which happens via the quarter
// pipeline in main.js. No game-rule math lives here.

import { escapeHtml, card, emptyState } from './helpers.js';
import { POSITIONS } from '../data/positions.js';

export function render(container, { state }) {
  const p = state.player;
  const coach = state.relationships.coach;
  const career = state.careerState?.peopleById?.[state.careerState.playerId]?.career;
  const activeContract = career?.currentContractId
    ? state.careerState?.contractsById?.[career.currentContractId]
    : null;
  const pathwayLabel = career?.stage === 'senior' && !activeContract ? 'Last club' : 'Club';
  const pathwayStatus = career?.stage === 'senior' && !activeContract
    ? '<p class="text-dim">Professional contract ended — your senior history is saved while the next step is decided.</p>'
    : '';

  container.innerHTML = `
    ${card(
      'Pathway',
      p.club
        ? `
        <p><strong>${pathwayLabel}:</strong> ${escapeHtml(p.club)}</p>
        <p><strong>Pathway:</strong> ${escapeHtml(p.pathway)}</p>
        ${pathwayStatus}
        <p><strong>Coach:</strong> ${escapeHtml(coach.name)} (${escapeHtml(coach.personality)})</p>
      `
        : emptyState(
            `No club yet. Organized football usually opens up around age 6–8 in ${escapeHtml(p.country)} — end a few more quarters and a trial invitation may come.`
          ),
      { fullSpan: true }
    )}
    ${card(
      'Position',
      p.position
        ? `<p><strong>${escapeHtml(POSITIONS[p.position]?.label ?? p.position)}</strong> — recommended by ${escapeHtml(coach.name)} and accepted.</p>`
        : p.positionAccepted === false
        ? `<p class="text-dim">A position recommendation was made and turned down. ${escapeHtml(p.name)} stays without a fixed position for now.</p>`
        : `<p class="text-dim">No recommendation yet. Coaches need to see ${escapeHtml(p.name)} play a number of matches first (currently ${p.matchObservations} observed).</p>`
    )}
    ${card(
      'Match involvement',
      `<p class="text-dim">Matches observed by coaching staff: <strong>${p.matchObservations}</strong>.</p>
       <p class="text-dim text-small">Interactive match moments — shoot, pass, dribble, or defend — appear automatically when you end a quarter while on a club.</p>`
    )}
  `;
}
