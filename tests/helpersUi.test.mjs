import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statBarHtml } from '../src/ui/helpers.js';

test('stat bars expose truthful clamped progress through shared markup semantics', () => {
  const zero = statBarHtml('Pace', 0);
  const low = statBarHtml('Passing', 24);
  const mid = statBarHtml('Shooting', 55);
  const high = statBarHtml('Dribbling', 88);
  const capped = statBarHtml('Fitness', 120);

  for (const [html, label, value] of [
    [zero, 'Pace', 0],
    [low, 'Passing', 24],
    [mid, 'Shooting', 55],
    [high, 'Dribbling', 88],
    [capped, 'Fitness', 100],
  ]) {
    assert.match(html, /class="stat-row__fill"/);
    assert.match(html, new RegExp(`--stat-fill-width:${value}%`));
    assert.match(html, new RegExp(`aria-label="${label}: ${value} out of 100"`));
    assert.match(html, new RegExp(`aria-valuenow="${value}"`));
  }

  assert.match(zero, />0<\/span>/);
  assert.match(low, />24<\/span>/);
  assert.match(mid, />55<\/span>/);
  assert.match(high, />88<\/span>/);
  assert.match(capped, />100<\/span>/, 'out-of-range values are consistently capped');
  assert.doesNotMatch(low, /stat-row__fill--low/);
  assert.doesNotMatch(mid, /stat-row__fill--mid/);
});

test('stat bars expose valid zero progress when max is not positive', () => {
  const html = statBarHtml('Recovery', 10, 0);

  assert.match(html, /--stat-fill-width:0%/);
  assert.match(html, /aria-valuenow="0"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('stat bars keep custom scales aligned for visible and accessible values', () => {
  const html = statBarHtml('Recovery', 50, 200);

  assert.match(html, /--stat-fill-width:25%/);
  assert.match(html, /aria-label="Recovery: 50 out of 200"/);
  assert.match(html, /aria-valuemax="200" aria-valuenow="50"/);
  assert.match(html, />50<\/span>/);
});

test('stat bars do not render non-finite values', () => {
  const html = statBarHtml('Recovery', Number.NaN);

  assert.match(html, /--stat-fill-width:0%/);
  assert.match(html, /aria-valuenow="0"/);
  assert.match(html, />0<\/span>/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
