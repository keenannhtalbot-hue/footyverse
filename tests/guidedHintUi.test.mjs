import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGuidedHint } from '../src/ui/guidedHint.js';

function makeStep(overrides = {}) {
  return {
    id: 'home.objective',
    app: 'home',
    title: 'Read your game plan',
    body: 'Home is your team sheet. The Right now, This season and Youth journey cards tell you what to focus on each quarter.',
    next: 'ap.spend',
    ...overrides,
  };
}

test('renderGuidedHint returns empty string when given no step', () => {
  assert.equal(renderGuidedHint({ step: null, onDismiss: () => {} }), '');
  assert.equal(renderGuidedHint({ step: undefined, onDismiss: () => {} }), '');
});

test('renderGuidedHint returns a semantic region with role and aria-labelledby', () => {
  const html = renderGuidedHint({ step: makeStep(), onDismiss: () => {} });
  assert.match(html, /<section[^>]+class="[^"]*guided-hint[^"]*"/);
  assert.match(html, /role="region"/);
  assert.match(html, /aria-labelledby="guided-hint-\d+-title"/);
  assert.match(html, /id="guided-hint-\d+-title"/);
  assert.match(html, /data-guided-step="home\.objective"/);
});

test('renderGuidedHint renders the title heading and body content', () => {
  const html = renderGuidedHint({
    step: makeStep({ title: 'Foo', body: 'Bar baz.' }),
    onDismiss: () => {},
  });
  assert.match(html, /Foo/);
  assert.match(html, /Bar baz\./);
  assert.match(html, /<p[^>]*>Bar baz\.<\/p>/);
});

test('renderGuidedHint exposes an accessible dismiss button with a stable label', () => {
  const html = renderGuidedHint({
    step: makeStep({ id: 'home.objective' }),
    onDismiss: () => {},
  });
  assert.match(html, /<button[^>]+data-guided-dismiss/);
  assert.match(html, /<button[^>]+type="button"[^>]+data-guided-dismiss|data-guided-dismiss[^>]+type="button"/);
  // Visually hidden but available to assistive tech: no icon-only reliance.
  assert.match(html, /Dismiss/);
});

test('renderGuidedHint includes a player-facing next-step affordance when a follow-up step is queued', () => {
  const html = renderGuidedHint({
    step: makeStep({ next: 'ap.spend' }),
    onDismiss: () => {},
  });
  assert.match(html, /Next:/);
  assert.match(html, /train once/i);
});

test('renderGuidedHint keeps every guided next-step message player-facing', () => {
  const journeyCopyByStep = {
    'home.objective': 'train once to start building your game',
    'ap.spend': 'rest after hard training to recover',
    'fatigue': 'make a choice that shapes your journey',
    'choice.moment': 'finish the quarter when your activity points are spent',
    'quarter.advance': 'read your recap to see how your choices mattered',
    'recap.read': 'keep playing and make the journey your own',
  };
  const forbiddenMetaLanguage = /teaching hints|explain|next up|button|story beat|pause/i;

  for (const [id, expectedCopy] of Object.entries(journeyCopyByStep)) {
    const html = renderGuidedHint({
      step: makeStep({ id, next: 'queued-step' }),
      onDismiss: () => {},
    });
    const renderedNextCopy = html.match(/<p class="guided-hint__next[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';

    assert.ok(renderedNextCopy, `${id} should render next-step copy`);
    assert.ok(renderedNextCopy.includes(expectedCopy), `${id} should describe the player's journey`);
    assert.doesNotMatch(renderedNextCopy, forbiddenMetaLanguage, `${id} should not expose engine language`);
  }
});

test('renderGuidedHint omits the "next up" affordance when this is the last step', () => {
  const html = renderGuidedHint({
    step: makeStep({ next: null }),
    onDismiss: () => {},
  });
  assert.doesNotMatch(html, /Next:/);
});

test('renderGuidedHint keeps unknown queued steps player-facing', () => {
  const html = renderGuidedHint({
    step: makeStep({ id: 'unknown.step', next: 'queued-step' }),
    onDismiss: () => {},
  });
  const renderedNextCopy = html.match(/<p class="guided-hint__next[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
  assert.ok(renderedNextCopy);
  assert.match(renderedNextCopy, /keep exploring your football journey/i);
  assert.doesNotMatch(renderedNextCopy, /teaching hints|explain|next up|button|story beat|pause/i);
});

test('renderGuidedHint renders an explanatory icon role for context-only visuals', () => {
  const html = renderGuidedHint({ step: makeStep(), onDismiss: () => {} });
  // The decorative emoji/icon must announce as decorative for screen readers.
  assert.match(html, /aria-hidden="true"/);
});

test('Guided hint CSS provides reduced-motion opt-out, high-contrast emphasis, and stable focus', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cssPath = resolve(here, '..', 'styles', 'main.css');
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.guided-hint\s*\{[^}]*animation:\s*guided-hint-enter/s);
  assert.match(css, /@keyframes\s+guided-hint-enter/);
  assert.match(
    css,
    /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\.guided-hint\s*\{[\s\S]*?animation:\s*none/
  );
  assert.match(css, /html\[data-motion='reduced'\] \.guided-hint\s*\{[^}]*animation:\s*none/);
  assert.match(css, /\.guided-hint__dismiss\s*\{[^}]*min-height:\s*36px/);
});
