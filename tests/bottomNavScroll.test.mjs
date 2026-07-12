// Regression test for the mobile bottom-nav scroll-stability bug.
//
// Background (player-reported): "The bar at the bottom moves when you scroll
// and it makes it hard to press the buttons at the bottom without exiting the
// app or scrolling."
//
// Root cause: .app-launcher-nav uses position: fixed; bottom: 0, which on
// iOS Safari does NOT track the visual viewport. When the URL bar collapses
// on scroll (or the keyboard opens), the layout viewport changes but the
// fixed element stays glued to the old layout bottom — visually the bar
// jumps, hides under the keyboard, and the buttons become hard to tap.
// Chrome and Firefox on Android/desktop honor the visual viewport correctly,
// so the bug is iOS-Safari-specific.
//
// Fix invariant: stop relying on position: fixed; bottom: 0 for the bottom
// nav. Move the nav into normal flow at the bottom of a 100dvh flex column,
// and let .app-content be the scroll container inside that column. Then no
// matter what iOS Safari does with the URL bar / keyboard / viewport, the
// nav sits at the bottom of #app-root, which sits at the bottom of the
// dynamic visual viewport.
//
// These assertions lock the structural invariants of the fix. If anyone
// re-introduces position: fixed; bottom: 0 on .app-launcher-nav (or drops
// the safe-area-inset-bottom handling, or detaches the bar from the flex
// column), this test fails and the bug returns on iOS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadCss() {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', 'styles', 'main.css'), 'utf8');
}

function cssBlocks(css, pattern, label) {
  const blocks = [...css.matchAll(pattern)].map((match) => match[0]);
  assert.ok(blocks.length > 0, `${label} rule must exist`);
  return blocks;
}

// Reach into the CSS source rather than running a browser, because
// we already have evidence from headless Chrome that the current code
// behaves correctly there. The bug is iOS-Safari-only; we cannot drive
// Safari from this sandbox. The CSS-level invariants below are the
// minimum that makes the bug impossible to regress.

test('CSS regression: bottom nav must not rely on position: fixed (iOS Safari bar-moves bug)', () => {
  const css = loadCss();
  // The whole point of the fix is to detach the nav from position: fixed
  // so that iOS Safari's broken fixed-element / visual-viewport interaction
  // cannot move it. If this assertion fails, the iOS Safari bug is back.
  const navBlocks = cssBlocks(css, /\.app-launcher-nav\s*\{[^}]*\}/g, '.app-launcher-nav');
  for (const navBlock of navBlocks) {
    assert.doesNotMatch(
      navBlock,
      /position\s*:\s*fixed/,
      '.app-launcher-nav must not be position:fixed — that is the iOS Safari bar-moves bug'
    );
  }
});

test('CSS regression: bottom nav must not anchor to viewport edges with bottom/left/right', () => {
  const css = loadCss();
  const navBlocks = cssBlocks(css, /\.app-launcher-nav\s*\{[^}]*\}/g, '.app-launcher-nav');
  for (const navBlock of navBlocks) {
    assert.doesNotMatch(navBlock, /\bbottom\s*:\s*0/);
    assert.doesNotMatch(navBlock, /\bleft\s*:\s*0/);
    assert.doesNotMatch(navBlock, /\bright\s*:\s*0/);
    assert.doesNotMatch(navBlock, /\bz-index\s*:/);
  }
});

test('CSS regression: bottom nav must keep safe-area-inset-bottom for home-indicator handsets', () => {
  const css = loadCss();
  const navBlocks = cssBlocks(css, /\.app-launcher-nav\s*\{[^}]*\}/g, '.app-launcher-nav');
  assert.ok(
    navBlocks.some((navBlock) => /env\(\s*safe-area-inset-bottom\s*\)/.test(navBlock)),
    '.app-launcher-nav must use env(safe-area-inset-bottom) so the home-indicator gesture zone stays clear of buttons'
  );
});

test('CSS regression: shell and app-content must allow nested scrolling inside the 100dvh column', () => {
  const css = loadCss();
  // For .app-content to actually be the scroll container (and not just
  // pretend to be), its flex parent must allow it to shrink below its
  // content height. Without min-height: 0 on .shell and .app-content, flex
  // children refuse to scroll and content overflows visually instead.
  const shellBlocks = cssBlocks(css, /\.shell\s*\{[^}]*\}/g, '.shell');
  const contentBlocks = cssBlocks(css, /\.app-content\s*\{[^}]*\}/g, '.app-content');
  assert.ok(shellBlocks.some((block) => /min-height\s*:\s*0/.test(block)), '.shell must allow flex shrinking so .app-content can scroll');
  assert.ok(contentBlocks.some((block) => /min-height\s*:\s*0/.test(block)), '.app-content must allow flex shrinking to enable internal scroll');
  assert.ok(contentBlocks.some((block) => /overflow-y\s*:\s*auto/.test(block)), '.app-content must be the scroll container');
});

test('CSS regression: app-content must not reserve a phantom 88px gap for the old fixed bar', () => {
  const css = loadCss();
  const contentBlocks = cssBlocks(css, /\.app-content\s*\{[^}]*\}/g, '.app-content');
  // The 88px bottom-padding existed only to push content above the old
  // position:fixed nav. Once the nav is in normal flow, that pad is a
  // dead zone of empty space below the scroll area — confusing and ugly.
  for (const contentBlock of contentBlocks) {
    assert.doesNotMatch(
      contentBlock,
      /padding-bottom\s*:\s*calc\(\s*88px/,
      '.app-content padding-bottom must not reserve space for a non-existent fixed bar'
    );
  }
});

test('CSS regression: app-root must cap at the dynamic viewport so app-content becomes the scroll container', () => {
  const css = loadCss();
  const rootBlocks = cssBlocks(css, /#app-root\s*\{[^}]*\}/g, '#app-root');
  assert.ok(rootBlocks.some((block) => /height\s*:\s*100vh/.test(block)));
  assert.ok(
    rootBlocks.some((block) => /height\s*:\s*100dvh/.test(block)),
    '#app-root must cap to the dynamic viewport (100dvh) so the keyboard/URL-bar/visual-viewport changes push content up rather than pushing the nav off-screen'
  );
  for (const rootBlock of rootBlocks) {
    assert.doesNotMatch(
      rootBlock,
      /min-height\s*:\s*100dvh/,
      'min-height alone lets #app-root grow to content height — the nav then disappears behind the content. Use height, not min-height.'
    );
  }
});

test('CSS regression: #app-root is a flex column so the nav can live in normal flow at the bottom', () => {
  const css = loadCss();
  const rootBlocks = cssBlocks(css, /#app-root\s*\{[^}]*\}/g, '#app-root');
  assert.ok(rootBlocks.some((block) => /display\s*:\s*flex/.test(block)));
  assert.ok(rootBlocks.some((block) => /flex-direction\s*:\s*column/.test(block)));
});

test('DOM regression: renderShell must emit the bottom nav as a sibling of .shell (not inside it)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const mainJs = readFileSync(resolve(here, '..', 'src', 'main.js'), 'utf8');
  // Locate the renderShell template literal.
  const m = mainJs.match(/function renderShell\(\)\s*\{[\s\S]*?root\.innerHTML\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m, 'renderShell template literal not found');
  const tpl = m[1];
  // The bottom nav must be a direct child of #app-root (sibling of .shell),
  // NOT nested inside .shell, so the flex column can push it to the bottom.
  assert.match(tpl, /<header[^>]+class="status-bar"/, 'status-bar present');
  assert.match(tpl, /<div[^>]+class="shell"/, 'shell present');
  assert.match(tpl, /<nav[^>]+class="app-launcher-nav"/, 'bottom nav present');
  // Ensure the bottom-nav is NOT wrapped inside the .shell div.
  const shellIdx = tpl.indexOf('<div class="shell"');
  const navIdx = tpl.indexOf('<nav class="app-launcher-nav"');
  assert.notEqual(shellIdx, -1, 'shell opening tag must be found before comparing sibling order');
  assert.notEqual(navIdx, -1, 'bottom-nav opening tag must be found before comparing sibling order');
  const shellEnd = tpl.indexOf('</div>', shellIdx);
  assert.notEqual(shellEnd, -1, 'shell closing tag must be found before comparing sibling order');
  assert.ok(
    navIdx > shellEnd,
    '.app-launcher-nav must be a sibling of .shell (after </div>), not nested inside it — otherwise it cannot sit at the bottom of the flex column'
  );
});

test('DOM regression: every bottom-nav button must keep aria-current and a visible label', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const mainJs = readFileSync(resolve(here, '..', 'src', 'main.js'), 'utf8');
  // renderShellNav must still mark the active button and label each one.
  assert.match(mainJs, /PRIMARY_NAV_IDS\.map/);
  assert.match(mainJs, /nav-btn__icon[^>]*aria-hidden="true"/);
  assert.match(mainJs, /aria-current="\$\{state\.activeApp === app\.id \? 'page' : 'false'\}/);
});