import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGuidedHint } from '../src/ui/guidedHint.js';
import { createGuidedSeason, ensureGuidedSeason } from '../src/engines/guidedSeason.js';

function makeStep(id) {
  return {
    id,
    app: id.startsWith('ap') ? 'football' : 'home',
    title: `Test ${id}`,
    body: `Hint body for ${id}`,
    next: null,
  };
}

test('renderGuidedHint returns empty string when step is null so it can be inlined safely', () => {
  // The Home/Football renders will call renderGuidedHint({ step, onDismiss })
  // on every render — when there is no active step, we get an empty string.
  assert.equal(renderGuidedHint({ step: null, onDismiss: () => {} }), '');
});

test('Home and Football can compose the hint card on top of their existing markup', () => {
  // Simulates how a host app would assemble its HTML.
  const hint = renderGuidedHint({ step: makeStep('home.objective'), onDismiss: () => {} });
  const hostHtml = `
    <section class="card">Existing home card</section>
    ${hint}
  `;
  assert.match(hostHtml, /Existing home card/);
  assert.match(hostHtml, /class="card card--accent full-span guided-hint"/);
  assert.match(hostHtml, /data-guided-step="home\.objective"/);
});

test('ensureGuidedSeason accepts whatever shape main.js constructs and never throws', () => {
  const inputs = [
    null,
    undefined,
    {},
    { schemaVersion: 99 },
    { schemaVersion: 1, seen: 'oops' },
    { schemaVersion: 1, seen: {}, resetCount: 'nope' },
    { schemaVersion: 1, seen: {}, resetCount: 0, lastUpdatedAt: NaN },
  ];
  for (const input of inputs) {
    const out = ensureGuidedSeason(input);
    assert.equal(out.schemaVersion, 1);
    assert.deepEqual(out.seen, {});
    assert.equal(out.resetCount, 0);
    assert.ok(Number.isFinite(out.lastUpdatedAt));
  }
});

test('createGuidedSeason returns a fresh instance with no shared references between calls', () => {
  const a = createGuidedSeason();
  const b = createGuidedSeason();
  assert.notEqual(a, b);
  assert.notEqual(a.seen, b.seen);
});
