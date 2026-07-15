// tests/qaSmokeColdBoot.test.mjs
//
// QA release-readiness smoke: fresh-install cold boot.
//
// Runs in its own Node process so `src/main.js`'s module-level `boot()`
// is invoked exactly once, against an empty localStorage, exactly as a
// real first-time visitor would experience it.
//
// Failure modes caught:
//   * any uncaught JS error or unhandled rejection during boot
//   * missing required browser globals installed by the harness
//   * onboarding form failing to render or missing required fields
//   * missing submit button
//   * missing key copy (headline, hero, instructions)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootFootyVerse, REQUIRED_STUBS } from '../helpers/qaSmokeHarness.mjs';

test('cold boot: src/main.js imports without uncaught JS errors', async () => {
  const ctx = await bootFootyVerse();
  try {
    assert.deepEqual(
      ctx.recorder.errors,
      [],
      `cold-boot raised ${ctx.recorder.errors.length} JS error(s):\n  ${ctx.recorder.errors.slice(0, 5).join('\n  ')}`
    );
  } finally {
    ctx.teardown();
  }
});

test('cold boot: harness installed every required browser global', async () => {
  const ctx = await bootFootyVerse();
  try {
    for (const key of REQUIRED_STUBS) {
      assert.ok(
        globalThis[key] !== undefined,
        `harness must install globalThis.${key} before importing main.js`
      );
    }
  } finally {
    ctx.teardown();
  }
});

test('cold boot fresh install: onboarding form renders with name, gender, country, year, submit', async () => {
  const ctx = await bootFootyVerse();
  try {
    const { document } = ctx;
    const form = document.getElementById('onboarding-form');
    assert.ok(form, 'fresh install must render #onboarding-form');

    const name = document.getElementById('player-name');
    assert.ok(name && name.tagName === 'INPUT', 'name input #player-name must render');
    assert.equal(name.getAttribute('name'), 'name');
    assert.equal(name.getAttribute('required'), '');

    const genderRadios = form.querySelectorAll('input[name="gender"]');
    assert.ok(
      genderRadios.length >= 2,
      `gender radio group must have at least 2 options, got ${genderRadios.length}`
    );

    const country = document.getElementById('player-country');
    assert.ok(country && country.tagName === 'SELECT', 'country #player-country must render as a <select>');
    assert.ok(country.options.length > 0, 'country select must list at least one country');

    const year = document.getElementById('player-year');
    assert.ok(year && year.tagName === 'INPUT', 'year #player-year must render');
    assert.equal(year.getAttribute('name'), 'startYear');

    const submit = form.querySelector('button[type="submit"]');
    assert.ok(submit, 'onboarding must have a submit button');
    assert.ok(submit.textContent.trim().length > 0, 'submit button must have a visible label');

    // Visible hero copy so a returning player can recognise the game.
    const root = document.getElementById('app-root');
    const text = root.textContent.replace(/\s+/g, ' ').trim();
    assert.match(text, /FootyVerse/, 'hero text must include the FootyVerse brand name');
    assert.match(text, /Create your player/i, 'onboarding must invite the user to create a player');

    // Sanity: no errors were silently swallowed.
    assert.deepEqual(
      ctx.recorder.errors,
      [],
      `onboarding boot raised ${ctx.recorder.errors.length} JS error(s):\n  ${ctx.recorder.errors.slice(0, 5).join('\n  ')}`
    );
  } finally {
    ctx.teardown();
  }
});
