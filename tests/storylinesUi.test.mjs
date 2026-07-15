// Player-facing Storylines progress surface tests.
//
// The Profile surface must expose a "Storylines" card that renders all six
// authored chains with deterministic titles and accurate progress indicators,
// derived from the live chainState (no parallel state). It must be honest
// when chainState is missing/legacy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/ui/profile.js';
import {
  CHAINS,
  createChainState,
  markChainStepFired,
} from '../src/data/eventChains.js';

// Profile.render writes innerHTML on the passed container; tests give it a
// stub that records the rendered HTML so assertions can read it back.
function renderToString(state) {
  let html = '';
  const container = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  render(container, { state });
  return html;
}

function makeProfileState(chainState = createChainState(), overrides = {}) {
  return {
    player: {
      name: 'Robin Test',
      gender: 'nonbinary',
      country: 'Canada',
      age: 9,
      club: null,
      pathway: null,
      position: null,
      careerHistory: [],
      matchObservations: 0,
      hidden: { potential: 50, confidence: 50 },
      ...overrides.player,
    },
    world: { year: 2026 },
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    relationships: {
      coach: { name: 'Coach Baker' },
    },
    chainState,
  };
}

test('Storylines renders all six authored chains with deterministic titles', () => {
  const html = renderToString(makeProfileState());
  const cardMatch = html.match(/<section[^>]+class="[^"]*storylines[^"]*"[\s\S]*?<\/section>/);

  assert.ok(cardMatch, 'Profile must expose a Storylines section');

  const cardHtml = cardMatch[0];
  assert.match(cardHtml, /aria-labelledby="storylines-title"/, 'Storylines section must be a labelled region');
  assert.match(cardHtml, /<h2[^>]+id="storylines-title"[^>]*>Storylines<\/h2>/);

  for (const chain of CHAINS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(chain, 'title'),
      `Authored chain ${chain.id} must carry a deterministic title to display in the Storylines surface`
    );
    assert.ok(
      typeof chain.title === 'string' && chain.title.length > 0,
      `Authored chain ${chain.id}.title must be a non-empty string`
    );
    assert.match(cardHtml, new RegExp(escapeRegExp(chain.title)));
    assert.match(cardHtml, new RegExp(`data-storyline-id="${escapeRegExp(chain.id)}"`));
  }
});

test('Storylines renders deterministic step indicators for not-started chains (zero filled chips)', () => {
  const html = renderToString(makeProfileState());

  // Every chain starts at step-1 not-yet-completed, so every chain shows the
  // first chip as current and the others as upcoming — never as completed.
  const chipMatches = html.match(/data-storyline-chip/g) ?? [];
  // 6 chains × 3 chips per chain = 18 chips.
  assert.equal(chipMatches.length, CHAINS.length * 3);

  // The chain panel that is still at step-1 must NOT carry any aria-current="step".
  const blockRegex = /data-storyline-id="([^"]+)"[\s\S]*?(?=data-storyline-id=|<\/section>)/g;
  const blocks = [...html.matchAll(blockRegex)].map((m) => m[0]);
  assert.equal(blocks.length, CHAINS.length);
  for (const block of blocks) {
    assert.doesNotMatch(block, /aria-current="true"/, 'not-started chains must not mark any step as completed');
  }
});

test('Storylines missing-state rows show no fabricated current/done progress or in-progress badge', () => {
  const html = renderToString(makeProfileState(null));
  const cardMatch = html.match(/<section[^>]+class="[^\"]*storylines[^\"]*"[\s\S]*?<\/section>/);
  assert.ok(cardMatch, 'Profile must expose a Storylines section for legacy saves');

  const blocks = [...cardMatch[0].matchAll(/data-storyline-id="([^\"]+)"[\s\S]*?(?=data-storyline-id=|<\/section>)/g)].map((m) => m[0]);
  assert.equal(blocks.length, CHAINS.length);
  for (const block of blocks) {
    assert.doesNotMatch(block, />In progress<\/span>/, 'missing progress must not claim a chain is in progress');
    assert.doesNotMatch(block, /data-storyline-step-state="(?:current|done)"/, 'missing progress must not invent current or completed steps');
    assert.match(block, /data-storyline-step-state="upcoming"/, 'missing progress must use an explicit not-started chip state');
    assert.match(block, />Not started<\/span>/, 'missing progress must expose an explicit not-started badge');
  }
});

test('Storylines also treats an empty chainState container as no progress', () => {
  const html = renderToString(makeProfileState({ chains: {} }));
  assert.doesNotMatch(html, />In progress<\/span>/);
  assert.doesNotMatch(html, /data-storyline-step-state="(?:current|done)"/);
  assert.match(html, /class="text-small text-dim storylines__summary">No chain progress recorded/i);
});

test('Storylines surfaces a chain at mid-flight (current step chip marked, no completion)', () => {
  const chainState = createChainState();
  const chain = CHAINS.find((c) => c.id === 'chain_rising_talent');
  markChainStepFired(chainState, chain.id, chain.steps[0].id);
  // chain_rising_talent is now at step-2.

  const html = renderToString(makeProfileState(chainState));
  const block = extractChainBlock(html, chain.id);
  assert.ok(block, 'Profile must render the mid-flight chain block');
  assert.match(block, /data-storyline-step="2"/, 'Mid-flight chain must mark its current step');
  assert.match(block, /data-storyline-state="in-progress"/);
  // Step 1 (already fired) must render as completed (lime), step 3 must NOT.
  assert.match(block, /data-storyline-step="1"[^>]*data-storyline-step-state="done"/);
  assert.match(block, /data-storyline-step="3"[^>]*data-storyline-step-state="upcoming"/);
});

test('Storylines surfaces a chain at completed with all chips filled and a completion badge', () => {
  const chainState = createChainState();
  const chain = CHAINS[0];
  markChainStepFired(chainState, chain.id, chain.steps[0].id);
  markChainStepFired(chainState, chain.id, chain.steps[1].id);
  markChainStepFired(chainState, chain.id, chain.steps[2].id);
  assert.equal(chainState.chains[chain.id].completed, true);

  const html = renderToString(makeProfileState(chainState));
  const block = extractChainBlock(html, chain.id);
  assert.ok(block, 'Profile must render the completed chain block');
  assert.match(block, /data-storyline-state="completed"/);
  assert.match(block, /Completed/);
  assert.match(block, /data-storyline-step="1"[^>]*data-storyline-step-state="done"/);
  assert.match(block, /data-storyline-step="2"[^>]*data-storyline-step-state="done"/);
  assert.match(block, /data-storyline-step="3"[^>]*data-storyline-step-state="done"/);
});

test('Storylines is honest when chainState is null (legacy save)', () => {
  const html = renderToString(makeProfileState(null));

  // The section must still render (card is part of Profile regardless of
  // chain availability), but each chain row must carry a "missing" tag and
  // an honest explanation so the player never sees fabricated progress.
  const blockRegex = /data-storyline-id="([^"]+)"[\s\S]*?(?=data-storyline-id=|<\/section>)/g;
  const blocks = [...html.matchAll(blockRegex)].map((m) => m[0]);
  assert.equal(blocks.length, CHAINS.length);
  for (const block of blocks) {
    assert.match(
      block,
      /data-storyline-state="missing"/,
      'all chains must show a missing tag when chainState is absent'
    );
  }
  // Honest copy — never invent progress out of nothing.
  const cardMatch = html.match(/<section[^>]+class="[^"]*storylines[^"]*"[\s\S]*?<\/section>/);
  assert.match(cardMatch[0], /no chain progress/i);
});

test('Storylines rows are keyboard-focusable and screen-reader labelled', () => {
  const html = renderToString(makeProfileState());
  const cardMatch = html.match(/<section[^>]+class="[^"]*storylines[^"]*"[\s\S]*?<\/section>/);
  const cardHtml = cardMatch[0];

  // Each chain row must be a focusable group with an accessible name and a
  // status announcement region for screen readers.
  assert.match(cardHtml, /role="group"/);
  assert.match(cardHtml, /aria-label="[^"]*"/);
  assert.match(cardHtml, /aria-describedby="[^"]*"/);
  assert.match(cardHtml, /role="status"[^>]+aria-live="polite"/);
});

test('Storylines row chips expose deterministic step labels without an aria-hidden ancestor', () => {
  const html = renderToString(makeProfileState());
  const cardMatch = html.match(/<section[^>]+class="[^\"]*storylines[^\"]*"[\s\S]*?<\/section>/);
  const cardHtml = cardMatch[0];

  // Each step chip must carry an aria-label naming the chain and the step
  // number, and the progress rail must not hide those labels from assistive
  // technology.
  const progressRailMatches = [...cardHtml.matchAll(/<div class="storyline-row__progress"([^>]*)>([\s\S]*?)<\/div>/g)];
  assert.equal(progressRailMatches.length, CHAINS.length);
  for (const [, attrs, railHtml] of progressRailMatches) {
    assert.doesNotMatch(attrs, /aria-hidden="true"/, 'step labels must not be hidden from assistive technology');
    const chipLabels = [...railHtml.matchAll(/data-storyline-step="(\d)"[^>]*aria-label="([^"]+)"/g)];
    assert.equal(chipLabels.length, 3);
    for (const [, , label] of chipLabels) {
      assert.match(label, /step\s+\d/i, 'step chips must be labelled with their step number');
    }
  }
});

test('Storylines treats a present-but-corrupt per-chain record (unknown currentStepId) as not-started', () => {
  // Regression: a chainState with `chains[chainId]` present but its
  // `currentStepId` pointing at an id that is NOT one of the authored steps
  // (legacy migration, save corruption, etc.) must render the same way as a
  // missing record — never fabricate a current step, never mark any chip as
  // done, never claim "In progress". The summary must still be the honest
  // no-progress copy because no chain is verifiably in flight.
  const chain = CHAINS.find((c) => c.id === 'chain_rising_talent');
  const chainState = createChainState();
  // Plant a record that exists (so we exercise the present-but-corrupt path,
  // not the missing-record path) but whose currentStepId is not in the chain.
  chainState.chains[chain.id] = {
    currentStepId: 'step-99-corrupt',
    completed: false,
  };

  const html = renderToString(makeProfileState(chainState));
  const block = extractChainBlock(html, chain.id);
  assert.ok(block, 'Profile must render the corrupt-record chain block');

  // No fabricated progress on the corrupt chain.
  assert.doesNotMatch(
    block,
    /data-storyline-step-state="(?:current|done)"/,
    'corrupt record must not invent current or completed chips'
  );
  assert.doesNotMatch(
    block,
    />In progress<\/span>/,
    'corrupt record must not show an In progress badge'
  );
  assert.match(
    block,
    />Not started<\/span>/,
    'corrupt record must show the explicit Not started badge'
  );
  assert.match(
    block,
    /data-storyline-state="missing"/,
    'corrupt record must render the row-level state as missing'
  );
  assert.match(
    block,
    /No chain progress recorded for this save yet\./,
    'corrupt record must surface the honest no-progress blurb'
  );

  // Every chip on the corrupt chain must be upcoming.
  const chipStates = [
    ...block.matchAll(/data-storyline-step="(\d)"[^>]*data-storyline-step-state="([^"]+)"/g),
  ];
  assert.equal(chipStates.length, chain.steps.length, 'all authored chips must render');
  for (const [, , chipState] of chipStates) {
    assert.equal(chipState, 'upcoming', 'corrupt record chips must all be upcoming');
  }

  // The summary copy must reflect no verifiable progress overall.
  const cardMatch = html.match(/<section[^>]+class="[^"]*storylines[^"]*"[\s\S]*?<\/section>/);
  assert.match(
    cardMatch[0],
    /No chain progress recorded for this save yet/,
    'summary must use the honest no-progress copy when only corrupt records are present'
  );

  // The other five chains (legitimately at step-1 / not-started) must still
  // render their deterministic first-chip-as-current / others-as-upcoming
  // pattern. The corrupt chain must not poison the rest of the surface.
  for (const other of CHAINS) {
    if (other.id === chain.id) continue;
    const otherBlock = extractChainBlock(html, other.id);
    assert.ok(otherBlock, `unrelated chain ${other.id} must still render`);
    assert.match(
      otherBlock,
      /data-storyline-step="1"[^>]*data-storyline-step-state="current"/,
      `unrelated chain ${other.id} must keep its deterministic step-1 current chip`
    );
  }
});

function extractChainBlock(html, chainId) {
  const blockRegex = new RegExp(
    `data-storyline-id="${chainId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[\\s\\S]*?(?=data-storyline-id=|</section>)`,
  );
  const m = html.match(blockRegex);
  return m ? m[0] : null;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
