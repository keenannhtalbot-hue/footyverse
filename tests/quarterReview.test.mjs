// Tests for the player-facing "Review this quarter" affordance on Home.
//
// Contract:
//   * When state.quarterRecap exists, Home surfaces a secondary "Review"
//     button alongside the primary next-action button.
//   * When state.quarterRecap is null, no Review button is rendered.
//   * Clicking the Review button invokes actions.openQuarterReviewDialog
//     (a new action on the main.js action surface) and does NOT mutate
//     state.quarterRecap.
//   * The pure renderer renderQuarterReviewDialog(recap) returns the body
//     HTML and the dialog actions used by main.js to drive the native
//     <dialog> surface. It must:
//       - show every recap.highlight as a list item, escaped;
//       - include the honest sparse note when recap.sparse is true;
//       - include the Close action;
//       - never fabricate a quarter label (only renders when recap has a
//         numeric `quarter`);
//       - leave the recap untouched (no mutation).
//   * The home dashboard CSS check: a dedicated class for the secondary
//     button so it can be styled separately from the primary CTA.
//
// All tests are pure: no jsdom, no DOM. The home render is exercised
// against a tiny stub container that records registered click handlers,
// mirroring the existing Home render test pattern in tests/homeUi.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  render,
  renderHomeDashboard,
  renderQuarterReviewTrigger,
  renderQuarterReviewDialog,
  buildQuarterReviewHighlights,
} from '../src/ui/home.js';

function makeState(player = {}, overrides = {}) {
  return {
    player: {
      age: 8,
      quarter: 'Summer',
      year: 2030,
      ap: 6,
      apMax: 12,
      club: null,
      position: null,
      injury: null,
      hidden: { fatigue: 0 },
      storyLedger: [],
      ...player,
    },
    quarterRecap: null,
    ...overrides,
  };
}

const SAMPLE_RECAP = {
  quarter: 4,
  dismissed: false,
  sparse: false,
  highlights: [
    'Passing training → Passing +3.',
    'Rest → Fatigue -4.',
    'Quarter complete → Summer 2030 began.',
  ],
};

// Build a fresh DOM stub that records every addEventListener call. The
// `handlersBySelector` map maps a CSS selector to a Map<eventType, fn>.
// Values can be a boolean (true → returns getAttribute = null) or an
// object { getAttribute: (name) => value } for cases where the render
// reads an attribute back (e.g. data-home-action="training").
function makeStubContainer(handlersBySelector = new Map()) {
  const buttons = new Map();
  function makeButton(spec) {
    const listeners = new Map();
    return {
      disabled: false,
      isConnected: true,
      getAttribute: typeof spec === 'object' && spec !== null && spec.getAttribute
        ? spec.getAttribute
        : () => null,
      addEventListener: (type, fn) => { listeners.set(type, fn); },
      _listeners: listeners,
    };
  }
  const container = {
    innerHTML: '',
    querySelector: (selector) => {
      if (handlersBySelector.has(selector)) {
        let btn = buttons.get(selector);
        if (!btn) {
          btn = makeButton(handlersBySelector.get(selector));
          buttons.set(selector, btn);
        }
        return btn;
      }
      return null;
    },
  };
  container._buttons = buttons;
  return container;
}

test('renderQuarterReviewTrigger returns empty string when no recap exists', () => {
  assert.equal(renderQuarterReviewTrigger(null), '');
  assert.equal(renderQuarterReviewTrigger(undefined), '');
});

test('renderQuarterReviewTrigger renders a labelled button with aria-controls when recap exists', () => {
  const html = renderQuarterReviewTrigger(SAMPLE_RECAP);
  // Class includes the secondary "home-review-quarter" hook (order may vary
  // because of btn--block) plus aria-controls + data-attribute + label.
  assert.match(html, /class="[^"]*\bhome-review-quarter\b[^"]*"/);
  assert.match(html, /data-home-review-quarter="show"/);
  assert.match(html, /aria-controls="quarter-review-dialog"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Review this quarter/);
  // Honest copy: no fake league / award / score numbers.
  assert.doesNotMatch(html, /MVP|trophy|award|win|loss|champion/i);
});

test('renderQuarterReviewTrigger remains available even when recap is dismissed (revisit affordance)', () => {
  const html = renderQuarterReviewTrigger({ ...SAMPLE_RECAP, dismissed: true });
  assert.match(html, /Review this quarter/);
});

test('Home dashboard surfaces the Review trigger alongside the primary action when a recap exists', () => {
  const html = renderHomeDashboard(makeState({}, { quarterRecap: SAMPLE_RECAP }));
  // Primary action still present.
  assert.match(html, /data-home-action="training"/);
  // Secondary review trigger is rendered and is separate from the primary button.
  assert.match(html, /data-home-review-quarter="show"/);
  // Exactly one primary action button, plus the review trigger.
  const primaryCount = (html.match(/data-home-action=/g) ?? []).length;
  const reviewCount = (html.match(/data-home-review-quarter=/g) ?? []).length;
  assert.equal(primaryCount, 1);
  assert.equal(reviewCount, 1);
});

test('Home dashboard omits the Review trigger when no recap exists yet', () => {
  const html = renderHomeDashboard(makeState({}, { quarterRecap: null }));
  assert.doesNotMatch(html, /data-home-review-quarter=/);
});

test('renderQuarterReviewDialog renders all highlights as an ordered list, escaped, with a Close action', () => {
  const recap = {
    quarter: 4,
    sparse: false,
    highlights: [
      'Passing training → Passing +3.',
      'Rest → Fatigue -4.',
    ],
  };
  const result = renderQuarterReviewDialog(recap);
  assert.equal(typeof result.bodyHtml, 'string');
  assert.ok(Array.isArray(result.actions));

  // Each highlight becomes a list item, escaped (so "&" stays intact).
  assert.match(result.bodyHtml, /<ol[^>]*class="quarter-review__list"/);
  assert.match(result.bodyHtml, /<li>Passing training → Passing \+3\.<\/li>/);
  assert.match(result.bodyHtml, /<li>Rest → Fatigue -4\.<\/li>/);

  // Honest quarter label is shown only when numeric.
  assert.match(result.bodyHtml, /Quarter 4/);
  // No fabricated number of events / no trophy / no award.
  assert.doesNotMatch(result.bodyHtml, /trophy|award|champion|MVP/i);

  // The dialog has a Close action that resolves to 'close'.
  const closeAction = result.actions.find((a) => a.id === 'close');
  assert.ok(closeAction, 'expected a close action');
  assert.match(closeAction.label, /close/i);
});

test('renderQuarterReviewDialog includes the honest sparse note when recap.sparse is true', () => {
  const recap = {
    quarter: 2,
    sparse: true,
    highlights: ['Rest → Fatigue -4.'],
  };
  const result = renderQuarterReviewDialog(recap);
  assert.match(result.bodyHtml, /Only the changes the game could verify are shown/);
});

test('renderQuarterReviewDialog omits highlights gracefully when array is empty (still safe to render)', () => {
  const recap = { quarter: 1, sparse: true, highlights: [] };
  const result = renderQuarterReviewDialog(recap);
  // Body still renders, but no <li> items.
  assert.doesNotMatch(result.bodyHtml, /<li>/);
  assert.match(result.bodyHtml, /No recorded changes this quarter/);
});

test('renderQuarterReviewDialog escapes any HTML-looking highlight text', () => {
  const recap = {
    quarter: 5,
    sparse: false,
    highlights: ['<script>alert(1)</script>', 'Rest → Fatigue -2.'],
  };
  const result = renderQuarterReviewDialog(recap);
  assert.doesNotMatch(result.bodyHtml, /<script>alert/);
  assert.match(result.bodyHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('renderQuarterReviewDialog never mutates the supplied recap', () => {
  const recap = {
    quarter: 3,
    sparse: false,
    highlights: ['Rest → Fatigue -4.'],
  };
  const snapshot = structuredClone(recap);
  renderQuarterReviewDialog(recap);
  assert.deepEqual(recap, snapshot);
});

test('buildQuarterReviewHighlights returns an empty array for an empty recap and a copy otherwise', () => {
  assert.deepEqual(buildQuarterReviewHighlights({ highlights: [] }), []);
  const recap = { highlights: ['Rest → Fatigue -4.', 'Quarter complete → Summer 2030 began.'] };
  const out = buildQuarterReviewHighlights(recap);
  assert.deepEqual(out, recap.highlights);
  // Returned array must be a fresh copy so callers can sort/filter without
  // touching the underlying state.
  assert.notEqual(out, recap.highlights);
});

test('Home render wires the Review trigger to actions.openQuarterReviewDialog and does not mutate state', async () => {
  const state = makeState({}, { quarterRecap: SAMPLE_RECAP });
  Object.assign(state, { headline: 'Ready to grow.', world: { season: 'Summer', weather: 'Sunny' } });
  Object.assign(state.player, { country: 'England' });

  const handlersBySelector = new Map([
    ['[data-home-action]', { getAttribute: (n) => (n === 'data-home-action' ? 'training' : null) }],
    ['[data-quarter-recap]', true],
    ['[data-home-review-quarter]', true],
    ['[data-guided-dismiss]', true],
  ]);
  const container = makeStubContainer(handlersBySelector);

  let opened = false;
  let switchCalled = null;
  const recapBefore = structuredClone(state.quarterRecap);

  render(container, {
    state,
    actions: {
      switchApp: (id) => { switchCalled = id; },
      endQuarter: () => {},
      openQuarterReviewDialog: () => { opened = true; },
      dismissGuidedHint: () => {},
    },
  });

  // Primary action click goes through actions.switchApp (training), not
  // openQuarterReviewDialog.
  const primaryBtn = container._buttons.get('[data-home-action]');
  await primaryBtn._listeners.get('click')({ currentTarget: primaryBtn });
  assert.equal(switchCalled, 'training');
  assert.equal(opened, false);

  // Review trigger click opens the dialog.
  const reviewBtn = container._buttons.get('[data-home-review-quarter]');
  await reviewBtn._listeners.get('click')();
  assert.equal(opened, true);

  // State.quarterRecap was NOT mutated by either handler.
  assert.deepEqual(state.quarterRecap, recapBefore);
});

test('Home render registers no review handler when there is no recap (no-op safety)', () => {
  const state = makeState({}, { quarterRecap: null });
  Object.assign(state, { headline: 'Ready.', world: { season: 'Summer', weather: 'Sunny' } });
  Object.assign(state.player, { country: 'England' });

  // Only register the primary-action handler — if home.js also queries
  // for [data-home-review-quarter] when no recap exists, the test fails
  // because the stub returns null. We probe by spying on querySelector.
  let reviewQueried = false;
  const container = {
    innerHTML: '',
    querySelector: (selector) => {
      if (selector === '[data-home-review-quarter]') reviewQueried = true;
      if (selector === '[data-home-action]') {
        return {
          disabled: false,
          isConnected: true,
          getAttribute: () => 'training',
          addEventListener: () => {},
        };
      }
      return null;
    },
  };
  render(container, {
    state,
    actions: {
      switchApp: () => {},
      endQuarter: () => {},
      openQuarterReviewDialog: () => {},
    },
  });
  // The render must NOT have queried for the review trigger when there's
  // no recap. This guarantees no dangling click listener is attached in
  // the real DOM either.
  assert.equal(reviewQueried, false);
});

test('Quarter review affordance uses a dedicated CSS class for the secondary button', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  // The class exists in the stylesheet so it can be styled without
  // inheriting the primary button's color/weight.
  assert.match(css, /\.home-review-quarter\s*\{/);
});