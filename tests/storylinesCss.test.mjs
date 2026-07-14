// CSS-level regression guard for the Storylines surface.
//
// Companion to tests/storylinesUi.test.mjs. We assert the rules in
// styles/main.css that are critical for accessibility and narrow-screen
// honesty, so a future CSS tweak can't silently strip the reduced-motion
// guard or the high-contrast border.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const CSS_PATH = resolve(REPO_ROOT, 'styles/main.css');

function loadCss() {
  return readFileSync(CSS_PATH, 'utf8');
}

test('Storylines card defines a keyframed entrance animation', () => {
  const css = loadCss();
  assert.match(css, /\.storylines\s*\{[^}]*animation:[^}]*storylines-enter/s);
  assert.match(css, /@keyframes\s+storylines-enter/);
});

test('Storylines respects prefers-reduced-motion and html[data-motion=reduced]', () => {
  const css = loadCss();
  // Both selectors must cancel the animation, not just one of them.
  const reducedMotion = /@media\s+\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.storylines\s*,\s*\.storyline-row\s*,[\s\S]*?animation:\s*none\s*!important/;
  const dataAttrReduced = /html\[data-motion='reduced'\]\s+\.storylines\s*,\s*html\[data-motion='reduced'\]\s+\.storyline-row[\s\S]*?animation:\s*none\s*!important/;
  assert.match(css, reducedMotion, 'prefers-reduced-motion must cancel .storylines animation');
  assert.match(css, dataAttrReduced, 'html[data-motion=reduced] .storylines must cancel animation');
});

test('Storylines chip "current" pulse respects reduced-motion', () => {
  const css = loadCss();
  assert.match(css, /\.storyline-chip--current\s*\{[^}]*animation:\s*storyline-chip-pulse/s);
  // reduced-motion guards must include the chip too.
  assert.match(
    css,
    /@media\s+\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.storyline-chip--current[\s\S]*?animation:\s*none\s*!important/,
  );
  assert.match(
    css,
    /html\[data-motion='reduced'\]\s+\.storyline-chip--current[\s\S]*?animation:\s*none\s*!important/,
  );
});

test('Storylines badge "done" glow respects reduced-motion', () => {
  const css = loadCss();
  assert.match(css, /\.storyline-badge--done\s*\{[^}]*animation:\s*storyline-badge-glow/s);
  assert.match(
    css,
    /@media\s+\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.storyline-badge--done[\s\S]*?animation:\s*none\s*!important/,
  );
});

test('Storylines high-contrast selector bumps borders', () => {
  const css = loadCss();
  assert.match(css, /html\[data-contrast='high'\]\s+\.storylines\s*\{[^}]*border-width:\s*2px/s);
  assert.match(css, /html\[data-contrast='high'\]\s+\.storyline-row\s*\{[^}]*border-width:\s*2px/s);
  assert.match(css, /html\[data-contrast='high'\]\s+\.storyline-chip\s*\{[^}]*border-width:\s*2px/s);
});

test('Storylines provides a 380px narrow-screen rule so 320px renders cleanly', () => {
  const css = loadCss();
  assert.match(css, /@media\s+\(max-width:\s*380px\)\s*\{/);
  assert.match(
    css,
    /@media\s+\(max-width:\s*380px\)\s*\{[\s\S]*?\.storyline-row__heading[\s\S]*?flex-direction:\s*column/s,
    'narrow screens must stack the heading above the badge'
  );
});

test('Storylines rows are keyboard-navigable: the row itself is not declared as a focus target that would steal the rail focus', () => {
  // Sanity: the CSS does not introduce an outline:none or a negative tabindex
  // on the storyline rows, otherwise the navigator/keyboard list becomes
  // invisible to keyboard users.
  const css = loadCss();
  assert.doesNotMatch(css, /\.storyline-row\s*\{[^}]*outline:\s*none/s);
  assert.doesNotMatch(css, /\.storyline-row\s*\{[^}]*tab-index:\s*-1|tabindex:\s*-1/);
});
