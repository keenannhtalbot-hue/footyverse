// tests/swCache.test.mjs
//
// Regression guard for the FootyVerse service-worker pre-cache.
//
// The PWA registers sw.js from src/main.js, so any runtime module that is
// dynamically imported from src/ but not listed in APP_SHELL will fail on a
// cold offline launch. This test walks the real source tree and asserts the
// cache list covers every module the game can import at runtime, plus the
// boot-time static assets (HTML, CSS, manifest, icons).
//
// It parses APP_SHELL out of sw.js as plain text — we never execute the
// service worker here — so this test runs in any Node test runner without
// needing a DOM, a fetch shim, or a service-worker polyfill.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(HERE, '..');
const SW_PATH = join(REPO_ROOT, 'sw.js');

function loadSw() {
  return readFileSync(SW_PATH, 'utf8');
}

// Extract the literal entries between `const APP_SHELL = [` and `];`.
// Returns the array as a list of trimmed, single-quoted strings. This is
// deliberately tolerant of trailing commas and whitespace — sw.js is hand-
// written so we don't need to bring in a full JS parser for this regression
// guard.
function parseAppShell(swSource) {
  const startMarker = 'const APP_SHELL = [';
  const startIdx = swSource.indexOf(startMarker);
  assert.notEqual(startIdx, -1, 'sw.js must declare const APP_SHELL = [ ... ];');
  const afterMarker = startIdx + startMarker.length;
  const endIdx = swSource.indexOf('];', afterMarker);
  assert.notEqual(endIdx, -1, 'sw.js APP_SHELL array must terminate with ];');
  const body = swSource.slice(afterMarker, endIdx);
  // Match single-quoted string literals only — the sw.js convention.
  const re = /'([^']+)'/g;
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

function listSrcJsModules() {
  const roots = ['src/engines', 'src/ui', 'src/data'];
  const out = new Set();
  for (const root of roots) {
    const abs = join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (name.endsWith('.js')) out.add(`./${root}/${name}`);
    }
  }
  return out;
}

function listStaticAssets() {
  // The boot-time static assets that the index page and manifest reference.
  // The test asserts they are present in APP_SHELL; the actual on-disk
  // existence is checked separately so a deleted asset doesn't silently
  // pass.
  return new Set([
    './',
    './index.html',
    './styles/main.css',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
  ]);
}

test('sw.js parses and exposes APP_SHELL as an array of string entries', () => {
  const sw = loadSw();
  const entries = parseAppShell(sw);
  assert.ok(entries.length > 0, 'APP_SHELL must not be empty');
  for (const entry of entries) {
    assert.equal(typeof entry, 'string');
    assert.ok(entry.length > 0, 'APP_SHELL entries must be non-empty strings');
    assert.ok(
      entry.startsWith('./'),
      `APP_SHELL entry ${JSON.stringify(entry)} must be a same-origin './' relative path`
    );
  }
});

test('APP_SHELL declares a CACHE_VERSION string so deploys can evict old caches', () => {
  const sw = loadSw();
  const m = sw.match(/const\s+CACHE_VERSION\s*=\s*'([^']+)'/);
  assert.ok(m, 'sw.js must declare const CACHE_VERSION = \'...\';');
  assert.ok(m[1].length > 0, 'CACHE_VERSION must be a non-empty string');
});

test('APP_SHELL pre-caches every runtime JavaScript module under src/', () => {
  const sw = loadSw();
  const entries = new Set(parseAppShell(sw));
  const modules = listSrcJsModules();

  assert.ok(modules.size > 0, 'expected at least one src/ JS module to be discoverable on disk');

  const missing = [...modules].filter((m) => !entries.has(m)).sort();
  assert.deepEqual(
    missing,
    [],
    `APP_SHELL is missing ${missing.length} src/ module(s) — these will fail to load on a cold offline launch:\n  ${missing.join('\n  ')}`
  );
});

test('APP_SHELL pre-caches the boot-time static assets referenced by index.html and the manifest', () => {
  const sw = loadSw();
  const entries = new Set(parseAppShell(sw));
  const assets = listStaticAssets();

  // Confirm each asset actually exists on disk so a deleted file can't
  // silently pass the coverage check.
  for (const asset of assets) {
    const abs = join(REPO_ROOT, asset.replace(/^\.\//, ''));
    if (asset === './') {
      assert.ok(
        existsSync(join(abs, 'index.html')),
        'boot asset "./" must resolve to index.html on disk'
      );
    } else {
      assert.ok(existsSync(abs), `boot asset ${asset} must exist on disk`);
    }
  }

  const missing = [...assets].filter((a) => !entries.has(a)).sort();
  assert.deepEqual(
    missing,
    [],
    `APP_SHELL is missing boot-time static asset(s):\n  ${missing.join('\n  ')}`
  );
});

test('APP_SHELL entries are unique (no accidental duplicates)', () => {
  const sw = loadSw();
  const entries = parseAppShell(sw);
  const seen = new Set();
  const dups = [];
  for (const e of entries) {
    if (seen.has(e)) dups.push(e);
    seen.add(e);
  }
  assert.deepEqual(dups, [], `APP_SHELL contains duplicate entries: ${dups.join(', ')}`);
});