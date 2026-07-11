import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveHomeNextAction,
  deriveHomeObjectives,
  render,
  renderHomeDashboard,
  renderQuarterRecap,
} from '../src/ui/home.js';

function makeState(player = {}) {
  return {
    player: {
      age: 8,
      quarter: 'Summer',
      year: 2030,
      ap: 6,
      apMax: 12,
      club: null,
      position: null,
      injury: null,
      hidden: { fatigue: 0 },
      ...player,
    },
  };
}

test('Home derives immediate, season, and youth journey objectives from current player state', () => {
  const objectives = deriveHomeObjectives(makeState());

  assert.deepEqual(Object.keys(objectives), ['immediate', 'season', 'longTerm']);
  assert.match(objectives.immediate, /6 AP|Summer/i);
  assert.match(objectives.season, /club|pathway/i);
  assert.match(objectives.longTerm, /age 16/i);

  const established = deriveHomeObjectives(makeState({
    age: 12,
    club: 'Rovers Academy',
    position: 'midfielder',
  }));
  assert.match(established.season, /Rovers Academy/);
  assert.match(established.season, /midfielder/i);
});

test('Home chooses the next meaningful destination from AP and pending choices', () => {
  assert.equal(deriveHomeNextAction(makeState()).id, 'training');
  assert.equal(deriveHomeNextAction(makeState({ ap: 1 })).id, 'activities');

  const pendingOffer = makeState({ age: 16 });
  pendingOffer.careerState = {
    clock: { tick: 44 },
    negotiationsById: {
      offer1: { kind: 'professional-offer', status: 'open', expiresTick: 50 },
    },
  };
  assert.equal(deriveHomeNextAction(pendingOffer).id, 'contracts');
});

test('Home explains injury and AP blocks while guiding recovery without mutating state', () => {
  const injured = makeState({
    injury: { label: 'Sprained ankle', quartersOut: 2 },
    physioUsedThisQuarter: false,
  });
  const snapshot = structuredClone(injured);
  const physio = deriveHomeNextAction(injured);
  assert.equal(physio.id, 'life');
  assert.match(physio.reason, /injury|sprained ankle/i);
  assert.deepEqual(injured, snapshot);

  const treated = deriveHomeNextAction(makeState({
    injury: { label: 'Sprained ankle', quartersOut: 2 },
    physioUsedThisQuarter: true,
  }));
  assert.equal(treated.id, 'end-quarter');
  assert.match(treated.reason, /physio|next quarter/i);

  const tired = deriveHomeNextAction(makeState({ ap: 0, hidden: { fatigue: 48 } }));
  assert.equal(tired.id, 'end-quarter');
  assert.match(tired.reason, /AP|rest|fatigue/i);
});

test('Home dashboard renders semantic objective horizons and one explained primary action', () => {
  const html = renderHomeDashboard(makeState({ ap: 1 }));

  assert.match(html, /<section[^>]+aria-labelledby="home-plan-title"/);
  assert.match(html, /<h2 id="home-plan-title">Your game plan<\/h2>/);
  assert.match(html, /<h3>Right now<\/h3>/);
  assert.match(html, /<h3>This season<\/h3>/);
  assert.match(html, /<h3>Youth journey<\/h3>/);
  assert.match(html, /data-home-action="activities"/);
  assert.match(html, /aria-describedby="home-action-reason"/);
  assert.match(html, /id="home-action-reason"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /Training needs 2 AP/);
  assert.equal((html.match(/data-home-action=/g) ?? []).length, 1);
});

test('Home primary action routes through the existing app action surface', async () => {
  const state = makeState();
  Object.assign(state, {
    headline: 'Ready to grow.',
    world: { season: 'Summer', weather: 'Sunny' },
  });
  Object.assign(state.player, { country: 'England', storyLedger: [] });
  let handler;
  const button = {
    disabled: false,
    isConnected: true,
    getAttribute: () => 'training',
    addEventListener: (_type, nextHandler) => { handler = nextHandler; },
  };
  const container = {
    innerHTML: '',
    querySelector: () => button,
  };
  let destination = null;

  render(container, {
    state,
    actions: { switchApp: (id) => { destination = id; }, endQuarter: () => {} },
  });
  await handler({ currentTarget: button });

  assert.equal(destination, 'training');
  assert.equal(button.disabled, false);
});

test('Home game plan uses a wrapping mobile-safe layout with a prominent full-width action', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

  assert.match(css, /\.home-objectives\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\),\s*1fr\)\)/s);
  assert.match(css, /\.home-objective\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.home-next-action\s*\{[^}]*max-width:\s*32rem/s);
});

test('Home renders a semantic dismissible and revisitable quarter recap with an honest sparse note', () => {
  const recap = {
    quarter: 3,
    dismissed: false,
    sparse: true,
    highlights: ['Rest → Fatigue -4.', 'Quarter complete → Autumn 2030 began.'],
  };
  const open = renderQuarterRecap(recap);
  assert.match(open, /<section[^>]+aria-labelledby="quarter-recap-title"/);
  assert.match(open, /<h2 id="quarter-recap-title"[^>]*tabindex="-1"/);
  assert.match(open, /<ol[^>]*>[\s\S]*<li>Rest → Fatigue -4\.<\/li>/);
  assert.match(open, /Only the changes the game could verify are shown/);
  assert.match(open, /data-quarter-recap="dismiss"/);

  assert.match(renderQuarterRecap({ ...recap, dismissed: true }), /data-quarter-recap="show"/);
});
