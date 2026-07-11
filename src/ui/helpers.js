// Shared presentational helpers for UI app modules. No game-rule logic.

export { escapeHtml } from './dialog.js';
import { escapeHtml } from './dialog.js';

export function statBarHtml(label, value, max = 100) {
  const hasValidScale = Number.isFinite(value) && Number.isFinite(max) && max > 0;
  const safeMax = Number.isFinite(max) && max > 0 ? Math.round(max) : 100;
  const safeValue = hasValidScale ? Math.round(Math.max(0, Math.min(max, value))) : 0;
  const rawPct = hasValidScale ? (safeValue / max) * 100 : 0;
  const pct = Number(Math.max(0, Math.min(100, rawPct)).toFixed(4));
  const safeLabel = escapeHtml(label);
  return `
    <div class="stat-row">
      <span class="stat-row__label">${safeLabel}</span>
      <span class="stat-row__bar" role="progressbar" aria-label="${safeLabel}: ${safeValue} out of ${safeMax}" aria-valuemin="0" aria-valuemax="${safeMax}" aria-valuenow="${safeValue}"><span class="stat-row__fill" style="--stat-fill-width:${pct}%" aria-hidden="true"></span></span>
      <span class="stat-row__value">${safeValue}</span>
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
