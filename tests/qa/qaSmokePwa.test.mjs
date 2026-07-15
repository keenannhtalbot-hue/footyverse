// tests/qaSmokePwa.test.mjs
//
// QA release-readiness smoke: PWA assets, viewport, and shell CSS.
//
// Pure static checks — does not boot jsdom. Verifies the on-disk and
// in-source assets the service worker pre-caches are still in place
// after every change, and that the mobile viewport / iOS-safe-area
// shell wiring is intact.
//
// Failure modes caught:
//   * index.html losing its manifest link, stylesheet link, or module
//     entry point (silently breaks cold offline launch)
//   * manifest.webmanifest dropping a required PWA field
//   * manifest pointing at an icon that no longer exists on disk
//   * an icon or CSS file being deleted while still listed in the SW
//   * shell CSS dropping the iOS-safe dynamic-viewport unit (`dvh`)
//   * index.html losing its viewport meta tag

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../helpers/qaSmokeHarness.mjs';

test('PWA assets: index.html, manifest, sw.js, css, and three icons all exist on disk', () => {
  const required = [
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'vercel.json',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'styles/main.css',
  ];
  for (const rel of required) {
    const abs = join(repoRoot, rel);
    assert.ok(existsSync(abs), `PWA asset ${rel} must exist on disk (required for cold offline launch)`);
  }
});

test('PWA assets: manifest.webmanifest parses as JSON with required PWA fields', () => {
  const raw = readFileSync(join(repoRoot, 'manifest.webmanifest'), 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    assert.fail(`manifest.webmanifest is not valid JSON: ${err.message}`);
  }
  for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
    assert.ok(manifest[field], `manifest.webmanifest must declare "${field}"`);
  }
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must list at least one icon');
  for (const icon of manifest.icons) {
    assert.ok(icon.src && icon.sizes && icon.type, `manifest icon entry must have src/sizes/type: ${JSON.stringify(icon)}`);
    const iconPath = join(repoRoot, icon.src.replace(/^\.\//, ''));
    assert.ok(existsSync(iconPath), `manifest icon ${icon.src} must exist on disk`);
  }
});

test('PWA assets: index.html wires manifest, theme-color, stylesheet, and module entry', () => {
  const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
  assert.match(html, /<link\s+rel="manifest"\s+href="\.\/manifest\.webmanifest"\s*\/?>/, 'index.html must link manifest.webmanifest');
  assert.match(html, /<link\s+rel="stylesheet"\s+href="\.\/styles\/main\.css"\s*\/?>/, 'index.html must link styles/main.css');
  assert.match(html, /<script\s+type="module"\s+src="\.\/src\/main\.js"\s*>/, 'index.html must load src/main.js as a module');
  assert.match(html, /<meta\s+name="theme-color"/, 'index.html must declare theme-color');
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width[^"]*"/, 'index.html must declare a mobile-friendly viewport');
});

test('PWA assets: sw.js APP_SHELL covers every referenced asset (no drift)', () => {
  // The full drift check lives in tests/swCache.test.mjs. Here we just
  // assert that the SW declares both a versioned cache name and the
  // boot-time static assets, so a regression that wipes the install
  // event fails here even if swCache.test.mjs is skipped.
  const sw = readFileSync(join(repoRoot, 'sw.js'), 'utf8');
  assert.match(sw, /const\s+CACHE_VERSION\s*=\s*'[^']+'/, 'sw.js must declare a CACHE_VERSION string');
  assert.match(sw, /const\s+APP_SHELL\s*=\s*\[/, 'sw.js must declare APP_SHELL = [...]');
  for (const asset of [
    './', './index.html', './styles/main.css', './manifest.webmanifest',
    './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  ]) {
    assert.ok(sw.includes(`'${asset}'`), `sw.js APP_SHELL must include ${asset}`);
  }
});

test('shell CSS: app-root uses the iOS-safe dynamic-viewport unit (dvh) and safe-area insets', () => {
  const css = readFileSync(join(repoRoot, 'styles/main.css'), 'utf8');
  // The CSS uses the standard fallback pattern: `height: 100vh;` then
  // `height: 100dvh;` — the second declaration wins in supporting
  // browsers and falls back gracefully in older ones.
  assert.match(css, /height:\s*100dvh/, 'shell layout must use 100dvh (not 100vh) so iOS Safari dynamic viewport does not leave a black gap');
  assert.match(css, /env\(safe-area-inset-(top|bottom)\)/, 'shell layout must reserve safe-area insets so notched devices do not clip content');
});
