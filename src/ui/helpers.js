// Shared presentational helpers for UI app modules. No game-rule logic.

export { escapeHtml } from './dialog.js';
import { escapeHtml } from './dialog.js';

export function statBarHtml(label, value, max = 100) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = pct < 30 ? 'stat-row__fill--low' : pct < 60 ? 'stat-row__fill--mid' : '';
  return `
    <div class="stat-row">
      <span class="stat-row__label">${escapeHtml(label)}</span>
      <span class="stat-row__bar"><span class="stat-row__fill ${tone}" style="width:${pct}%"></span></span>
      <span class="stat-row__value">${Math.round(value)}</span>
    </div>
  `;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function card(titleHtml, bodyHtml, { accent = false, fullSpan = false } = {}) {
  return `
    <section class="card ${accent ? 'card--accent' : ''} ${fullSpan ? 'full-span' : ''}">
      ${titleHtml ? `<h2>${titleHtml}</h2>` : ''}
      ${bodyHtml}
    </section>
  `;
}

export function emptyState(text) {
  return `<p class="empty-state">${escapeHtml(text)}</p>`;
}
