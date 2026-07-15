// tests/helpers/qaSmokeHarness.mjs
//
// Shared harness for the QA smoke gate. Boots `src/main.js` inside a
// jsdom-backed browser environment, exposes a tiny localStorage stub,
// and captures every JS error + unhandled rejection thrown anywhere
// inside the import graph.
//
// IMPORTANT: ES modules are cached per Node process. Each test file
// that uses this harness must be run in its own `node --test`
// invocation (separate process) so the module-level `let state = null`
// in `src/main.js` starts fresh. The `qa:smoke` npm script runs three
// such files in sequence.

import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const ENTRY_URL_BASE = pathToFileURL(join(REPO_ROOT, 'src/main.js')).href;

// Each call to `bootFootyVerse` gets a fresh module evaluation by
// appending a unique query parameter — Node's ESM loader treats
// `main.js?v=N` as a distinct module from `main.js?v=N+1`. This is
// critical because `src/main.js` runs `boot()` at module-bottom,
// which mutates module-level `state`. Without the cache buster the
// second test would see the cached, already-bootstrapped module.
let bootCounter = 0;

// Browser globals the booted app expects to find on `globalThis`.
// Keeping the list explicit so a missing stub is obvious in a diff.
export const REQUIRED_STUBS = Object.freeze([
  'window', 'document', 'navigator', 'HTMLElement',
  'HTMLDivElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLFormElement',
  'HTMLSelectElement', 'HTMLOptionElement', 'HTMLDialogElement',
  'Element', 'Node', 'MouseEvent', 'CustomEvent', 'Event', 'localStorage',
  'fetch', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
]);

function makeLocalStorageStub(initial = {}) {
  const store = { ...initial };
  return {
    getItem(k) { return k in store ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

function makeErrorRecorder(window) {
  const errors = [];
  const warnings = [];
  const onError = (e) => {
    errors.push(e?.error?.message || e?.message || String(e));
  };
  const onRejection = (e) => {
    const reason = e?.reason;
    errors.push(
      'unhandled: ' + (reason?.message || (typeof reason === 'string' ? reason : String(reason)))
    );
  };
  const origError = window.console.error.bind(window.console);
  window.console.error = (...args) => {
    errors.push(args.map((x) => (x && x.message) || String(x)).join(' '));
    origError(...args);
  };
  window.console.warn = (...args) => {
    warnings.push(args.map((x) => (x && x.message) || String(x)).join(' '));
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return { errors, warnings, onError, onRejection };
}

/**
 * Boot FootyVerse inside a jsdom-backed browser environment.
 *
 * @param {Object} [options]
 * @param {Object} [options.localStorageSeed] initial keys for the localStorage stub
 * @param {number} [options.drainMs] time to wait for microtasks after import (default 50)
 * @returns {Promise<{window, document, ls, recorder, teardown}>}
 */
export async function bootFootyVerse({ localStorageSeed = {}, drainMs = 50 } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="app-root" role="main"></div>' +
    '<div id="toast-region" class="toast-region" aria-live="polite" aria-atomic="true"></div>' +
    '<div id="dialog-root"></div>' +
    '</body></html>',
    { url: pathToFileURL(REPO_ROOT + '/').href, pretendToBeVisual: true }
  );
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.navigator = window.navigator;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLDivElement = window.HTMLDivElement;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement;
  globalThis.HTMLFormElement = window.HTMLFormElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.HTMLOptionElement = window.HTMLOptionElement;
  globalThis.HTMLDialogElement = window.HTMLDialogElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.Event = window.Event;

  const ls = makeLocalStorageStub(localStorageSeed);
  Object.defineProperty(window, 'localStorage', { value: ls, writable: false, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: false, configurable: true });

  globalThis.fetch = () => Promise.resolve({ ok: false, status: 404 });
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  // Service worker registration must succeed silently. Failure here is
  // a real install-path regression even before any DOM check runs.
  window.navigator.serviceWorker = {
    register: () => Promise.resolve({ scope: '/' }),
  };

  const recorder = makeErrorRecorder(window);

  const entryUrl = `${ENTRY_URL_BASE}?boot=${++bootCounter}`;
  await import(entryUrl);
  await new Promise((r) => setTimeout(r, drainMs));

  function teardown() {
    try {
      window.removeEventListener('error', recorder.onError);
      window.removeEventListener('unhandledrejection', recorder.onRejection);
    } catch (_) { /* may already be torn down */ }
    for (const key of REQUIRED_STUBS) {
      try { delete globalThis[key]; } catch (_) { /* non-configurable */ }
    }
    // jsdom docs recommend close() to release timers + listeners; the
    // window goes out of scope at process exit anyway, but close() makes
    // the harness safe to embed in a longer-running test runner.
    try { dom.window.close(); } catch (_) { /* already torn down */ }
  }

  return { window, document: window.document, ls, recorder, teardown };
}

export const repoRoot = REPO_ROOT;
