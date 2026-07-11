// Relationships app: parents, coach, teacher, friends/teammates with
// trust/respect/opinion/morale, personality, and likes/dislikes.

import { escapeHtml, statBarHtml, card, capitalize } from './helpers.js';
import { describeRelationship } from '../engines/relationshipEngine.js';

function relCard(rel, roleLabel) {
  return `
    <section class="card">
      <h2>${escapeHtml(rel.name)} <span class="text-dim text-small">· ${escapeHtml(roleLabel)}</span></h2>
      <span class="badge badge--lime">${describeRelationship(rel)}</span>
      <div class="mt-4">
        ${statBarHtml('Trust', rel.trust)}
        ${statBarHtml('Respect', rel.respect)}
        ${statBarHtml('Opinion', rel.opinion)}
        ${statBarHtml('Morale', rel.morale)}
      </div>
      <p class="text-small text-dim">Personality: ${escapeHtml(capitalize(rel.personality))}</p>
      ${rel.likes?.length ? `<p class="text-small">Likes: ${rel.likes.map(escapeHtml).join(', ')}</p>` : ''}
      ${rel.dislikes?.length ? `<p class="text-small">Dislikes: ${rel.dislikes.map(escapeHtml).join(', ')}</p>` : ''}
      ${
        rel.memories.length
          ? `<p class="text-small text-dim mt-4">Recent: “${escapeHtml(rel.memories[rel.memories.length - 1].text)}”</p>`
          : ''
      }
    </section>
  `;
}

export function render(container, { state }) {
  const r = state.relationships;
  container.innerHTML = `
    ${relCard(r.parentA, 'Parent')}
    ${relCard(r.parentB, 'Parent')}
    ${relCard(r.teacher, 'Teacher')}
    ${relCard(r.coach, 'Coach')}
    ${r.friends.map((f) => relCard(f, 'Friend / teammate')).join('')}
  `;
}
