// tests/qaSmokeShell.test.mjs
//
// QA release-readiness smoke: post-onboarding shell.
//
// Boots FootyVerse with a pre-seeded localStorage save so the app loads
// straight into the main shell (nav-rail + bottom-nav + status bar +
// app content) rather than the onboarding form. Asserts:
//
//   * The shell mounts in place of the onboarding form
//   * Both primary-nav surfaces (desktop rail and mobile bottom-nav)
//     exist in the DOM
//   * Every primary app (home, football, training, relationships,
//     contracts) is reachable via a `[data-app="..."]` button
//   * Navigation between apps re-renders the app-content region
//   * No JS errors during resume from a save
//
// Runs in its own Node process — see qaSmokeHarness.mjs for the rationale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootFootyVerse } from '../helpers/qaSmokeHarness.mjs';
import { createRng } from '../../src/engines/rng.js';
import { createPlayer } from '../../src/engines/playerEngine.js';
import { createWorld } from '../../src/engines/worldEngine.js';
import { createRelationship } from '../../src/engines/relationshipEngine.js';
import { ensureCareerState } from '../../src/engines/careerStateAdapter.js';
import { serializeState } from '../../src/engines/stateSerializer.js';

// Build a real, deterministic save by calling the same engine factories
// the app uses at onboarding time. Hand-rolling a minimal save is
// fragile — every UI module assumes a specific player shape (storyLedger,
// apMax, careerHistory, …) and we don't want this gate to become a
// second copy of the canonical save format.
function buildMinimalSave() {
  const seed = 'qa-smoke-seed-1';
  const rng = createRng(seed);
  const player = createPlayer({ name: 'QA Kid', gender: 'boy', country: 'England', startYear: 2024 }, seed);
  const world = createWorld({ startYear: 2024, seed: `${seed}-world` });
  const relationships = {
    parentA: createRelationship({ id: 'parentA', name: 'Mom', role: 'parent' }),
    parentB: createRelationship({ id: 'parentB', name: 'Dad', role: 'parent' }),
    teacher: createRelationship({ id: 'teacher', name: 'Ms Carter', role: 'teacher' }),
    coach: createRelationship({ id: 'coach', name: 'Coach Smith', role: 'coach' }),
    friends: [],
  };
  const state = {
    player,
    world,
    eventHistory: { firedIds: new Set(), lastFiredAt: new Map(), log: [] },
    relationships,
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    quarterCounter: 0,
    seed,
    rng,
    activeApp: 'home',
    recommendationOffered: false,
    headline: `${player.name}'s football journey begins in England, 2024.`,
    quarterEvidence: [],
    quarterRecap: null,
  };
  state.careerState = ensureCareerState(state);
  state.guidedSeason = null;
  state.chainState = null;
  const serialized = serializeState(state);
  return JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    state: serialized,
  });
}

test('post-onboarding shell: nav-rail and bottom-nav render with the expected primary apps', async () => {
  const serialized = buildMinimalSave();
  const ctx = await bootFootyVerse({ localStorageSeed: { footyverse_save_v1: serialized } });
  try {
    const { document } = ctx;

    const onboardForm = document.getElementById('onboarding-form');
    assert.equal(onboardForm, null, 'with a valid save, app must NOT render onboarding form');

    const rail = document.getElementById('nav-rail');
    const bottom = document.getElementById('bottom-nav');
    assert.ok(rail, 'shell must render #nav-rail for desktop');
    assert.ok(bottom, 'shell must render #bottom-nav for mobile');

    const PRIMARY_APPS = ['home', 'football', 'training', 'relationships', 'contracts'];
    for (const appId of PRIMARY_APPS) {
      const railHit = rail.querySelector(`[data-app="${appId}"]`);
      const bottomHit = bottom.querySelector(`[data-app="${appId}"]`);
      assert.ok(
        railHit || bottomHit,
        `primary nav must surface "${appId}" via either nav-rail or bottom-nav`
      );
      const hit = railHit || bottomHit;
      assert.ok(hit.tagName === 'BUTTON', `nav entry "${appId}" must be a <button>`);
    }

    assert.deepEqual(
      ctx.recorder.errors,
      [],
      `post-onboarding boot raised ${ctx.recorder.errors.length} JS error(s):\n  ${ctx.recorder.errors.slice(0, 5).join('\n  ')}`
    );
  } finally {
    ctx.teardown();
  }
});

test('post-onboarding shell: clicking a primary nav button switches the rendered app', async () => {
  const serialized = buildMinimalSave();
  const ctx = await bootFootyVerse({ localStorageSeed: { footyverse_save_v1: serialized } });
  try {
    const { document } = ctx;
    const rail = document.getElementById('nav-rail');
    const footballBtn = rail && rail.querySelector('[data-app="football"]');
    assert.ok(footballBtn, 'football nav button must exist');

    // Snapshot app-content length, click, snapshot again.
    const appContent = document.getElementById('app-content');
    assert.ok(appContent, 'shell must render #app-content');
    const beforeLength = appContent.innerHTML.length;

    footballBtn.click();
    // Allow click handlers to flush.
    await new Promise((r) => setTimeout(r, 20));

    const afterLength = appContent.innerHTML.length;
    assert.ok(
      afterLength > 0,
      'football app must render content into #app-content after navigation'
    );
    // The Home default and the Football view are different surfaces —
    // their innerHTML length almost certainly differs. Don't pin an
    // exact byte count; just confirm the click changed the DOM.
    assert.notEqual(
      afterLength,
      beforeLength,
      `nav click must re-render #app-content (before=${beforeLength}, after=${afterLength})`
    );

    // Footer of test: navigation produced no errors.
    assert.deepEqual(
      ctx.recorder.errors,
      [],
      `nav click raised ${ctx.recorder.errors.length} JS error(s):\n  ${ctx.recorder.errors.slice(0, 5).join('\n  ')}`
    );
  } finally {
    ctx.teardown();
  }
});
