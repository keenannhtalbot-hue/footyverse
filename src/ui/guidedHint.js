// Pure, presentational renderer for one guided-season teaching hint.
// DOM-independent: mounts via existing app containers, no extra fetch,
// no global state.

import { escapeHtml } from './dialog.js';

const STEP_ICONS = {
  'home.objective': '📋',
  'ap.spend': '⚽',
  'fatigue': '💤',
  'choice.moment': '🤝',
  'quarter.advance': '⏭️',
  'recap.read': '📖',
};

const STEP_NEXT_COPY = {
  'home.objective': 'train once to start building your game',
  'ap.spend': 'rest after hard training to recover',
  'fatigue': 'make a choice that shapes your journey',
  'choice.moment': 'finish the quarter when your activity points are spent',
  'quarter.advance': 'read your recap to see how your choices mattered',
  'recap.read': 'keep playing and make the journey your own',
};

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `guided-hint-${hintCounter}`;
}

/**
 * @param {{step: object|null, onDismiss: (id:string) => void}} props
 */
export function renderGuidedHint({ step, onDismiss }) {
  if (!step) return '';
  const hintId = nextHintId();
  const titleId = `${hintId}-title`;
  const icon = STEP_ICONS[step.id] ?? '💡';
  const nextCopy = step.next ? STEP_NEXT_COPY[step.id] ?? 'keep exploring your football journey' : null;

  // Note: the renderer only emits markup. Click handling is wired up by the
  // caller (Home/Football render fns), which already own the app container
  // and know which step is currently shown. The data attribute lets the
  // caller wire a single delegated handler.
  return `
    <section class="card card--accent full-span guided-hint" role="region" aria-labelledby="${titleId}" data-guided-step="${escapeHtml(step.id)}" data-guided-hint-id="${escapeHtml(hintId)}">
      <div class="guided-hint__heading">
        <span class="guided-hint__icon" aria-hidden="true">${icon}</span>
        <h2 id="${titleId}" class="guided-hint__title">${escapeHtml(step.title)}</h2>
      </div>
      <p class="guided-hint__body">${escapeHtml(step.body)}</p>
      ${nextCopy
        ? `<p class="guided-hint__next text-small text-dim"><span class="visually-hidden">Coming up: </span><strong>Next:</strong> ${escapeHtml(nextCopy)}</p>`
        : ''}
      <div class="guided-hint__actions">
        <button type="button" class="btn btn--ghost guided-hint__dismiss" data-guided-dismiss aria-label="Dismiss hint: ${escapeHtml(step.title)}">
          Got it
        </button>
      </div>
    </section>
  `;
}
