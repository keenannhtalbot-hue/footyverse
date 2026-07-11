// Home app: status, current quarter, headline, recent story. No game logic.

import { escapeHtml, card, emptyState } from './helpers.js';

export function render(container, { state, actions }) {
  const p = state.player;
  const recentStory = p.storyLedger.slice(-3).reverse();

  container.innerHTML = `
    ${card(
      'Right now',
      `
      <p class="text-dim">${escapeHtml(state.headline || 'A new season is underway.')}</p>
      <div class="pill-row mt-4">
        <span class="pill">${p.quarter} ${p.year}</span>
        <span class="pill">Age ${p.age}</span>
        <span class="pill">${p.ap} AP left${p.ap > p.apMax ? ` · ${p.ap - p.apMax} carried` : ''}</span>
        ${p.club ? `<span class="pill">${escapeHtml(p.club)}</span>` : `<span class="pill">No club yet</span>`}
        ${p.position ? `<span class="pill">${escapeHtml(p.position)}</span>` : ''}
        ${p.injury ? `<span class="pill">Injured: ${escapeHtml(p.injury.label)}</span>` : ''}
      </div>
      <div class="btn-row mt-4">
        <button type="button" class="btn btn--primary" id="end-quarter-btn">End ${p.quarter} &amp; move on</button>
      </div>
      `,
      { accent: true, fullSpan: true }
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

  container.querySelector('#end-quarter-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await actions.endQuarter();
    } finally {
      e.target.disabled = false;
    }
  });
}
