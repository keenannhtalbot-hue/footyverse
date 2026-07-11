// Profile app: identity, school, club/academy, position, potential (as a
// vague coach-style descriptor, not a raw number), coach notes, career
// history. No overall/position is shown until the game state provides one.

import { escapeHtml, card, emptyState, capitalize } from './helpers.js';
import { getOverall } from '../engines/playerEngine.js';
import { COUNTRIES } from '../data/countries.js';

function potentialDescriptor(hiddenPotential, matchObservations) {
  if (matchObservations < 3) return 'Too early to tell — coaches need to see more.';
  if (hiddenPotential >= 80) return 'Coaches whisper this one could go all the way.';
  if (hiddenPotential >= 60) return 'Clear promise, still raw.';
  if (hiddenPotential >= 40) return 'Solid and dependable, room to grow.';
  return 'Enjoying the game — that matters most right now.';
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
