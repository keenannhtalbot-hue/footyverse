// FootyVerse v0.5 — app bootstrap and central game controller.
// Owns the mutable game state, wires UI app modules to the engines, and
// drives the end-of-quarter simulation pipeline. Contains no game-rule
// math itself beyond sequencing calls into the engines.

import { createRng } from './engines/rng.js';
import { createPlayer, advanceQuarter, spendAP } from './engines/playerEngine.js';
import { createWorld, advanceWorldQuarter, getRecentNews } from './engines/worldEngine.js';
import {
  createEventHistory,
  selectEvent,
  applyEvent,
  resolveEventText,
} from './engines/eventEngine.js';
import { createRelationship, adjustRelationship, addMemory } from './engines/relationshipEngine.js';
import { recoverQuarter, trainStat, treatInjury, canPerformActivity } from './engines/trainingEngine.js';
import {
  checkPathwayOffer,
  joinClub,
  recommendPosition,
  respondToRecommendation,
  resolveMatchChoice,
  processMatchObservation,
} from './engines/footballEngine.js';
import { saveGame, loadGame, deleteSave, exportSave, importSave } from './engines/saveEngine.js';
import { serializeState, deserializeState } from './engines/stateSerializer.js';
import {
  acceptContractInAppState,
  ensureCareerState,
  syncCareerState,
} from './engines/careerStateAdapter.js';
import { COUNTRIES, COUNTRY_LIST } from './data/countries.js';
import { EVENTS } from './data/events.js';
import { getActivity } from './data/activities.js';
import { getLifeChoice } from './data/lifeChoices.js';
import { formatTeacherName, randomNpcName } from './data/names.js';
import { openDialog, escapeHtml } from './ui/dialog.js';
import { showToast } from './ui/toast.js';

import * as HomeApp from './ui/home.js';
import * as ProfileApp from './ui/profile.js';
import * as FootballApp from './ui/football.js';
import * as TrainingApp from './ui/training.js';
import * as RelationshipsApp from './ui/relationships.js';
import * as LifeApp from './ui/life.js';
import * as ActivitiesApp from './ui/activities.js';
import * as NewsApp from './ui/news.js';
import * as ContractsApp from './ui/contracts.js';
import * as StatisticsApp from './ui/statistics.js';
import * as SettingsApp from './ui/settings.js';

const APPS = [
  { id: 'home', label: 'Home', icon: '🏠', module: HomeApp },
  { id: 'profile', label: 'Profile', icon: '🪪', module: ProfileApp },
  { id: 'football', label: 'Football', icon: '⚽', module: FootballApp },
  { id: 'training', label: 'Training', icon: '🏋️', module: TrainingApp },
  { id: 'relationships', label: 'People', icon: '💬', module: RelationshipsApp },
  { id: 'life', label: 'Life', icon: '🏡', module: LifeApp },
  { id: 'activities', label: 'Activities', icon: '🎯', module: ActivitiesApp },
  { id: 'contracts', label: 'Offers', icon: '📨', module: ContractsApp },
  { id: 'news', label: 'News', icon: '📰', module: NewsApp },
  { id: 'statistics', label: 'Stats', icon: '📊', module: StatisticsApp },
  { id: 'settings', label: 'Settings', icon: '⚙️', module: SettingsApp },
];

const PRIMARY_NAV_IDS = ['home', 'football', 'training', 'relationships', 'contracts'];

let state = null;

function buildRelationships(player, rng) {
  const relationships = {};
  const teacherIdentity = randomNpcName(rng, player.country);

  relationships.parentA = createRelationship({
    id: 'parentA',
    name: 'Mom',
    role: 'parent',
    personality: rng.pick(['warm', 'strict', 'easygoing', 'ambitious']),
    likes: ['spending time together', 'good grades'],
    dislikes: ['skipped meals'],
  });
  relationships.parentB = createRelationship({
    id: 'parentB',
    name: 'Dad',
    role: 'parent',
    personality: rng.pick(['warm', 'strict', 'easygoing', 'ambitious']),
    likes: ['effort', 'honesty'],
    dislikes: ['giving up'],
  });
  relationships.teacher = createRelationship({
    id: 'teacher',
    name: formatTeacherName(teacherIdentity),
    role: 'teacher',
    personality: rng.pick(['patient', 'no-nonsense', 'encouraging']),
    likes: ['participation'],
    dislikes: ['distraction'],
  });
  relationships.coach = createRelationship({
    id: 'coach',
    name: `Coach ${randomNpcName(rng, player.country).first.split(' ').slice(-1)[0]}`,
    role: 'coach',
    personality: rng.pick(['demanding', 'supportive', 'tactical', 'old-school']),
    likes: ['hard work', 'listening'],
    dislikes: ['showboating'],
  });

  relationships.friends = [];
  const friendCount = 3;
  for (let i = 0; i < friendCount; i++) {
    const { first, gender } = randomNpcName(rng, player.country);
    relationships.friends.push(
      createRelationship({
        id: `friend-${i}`,
        name: first,
        role: 'friend',
        personality: rng.pick(['funny', 'competitive', 'loyal', 'shy', 'confident']),
        likes: [rng.pick(['video games', 'football', 'music', 'jokes'])],
        dislikes: [rng.pick(['losing', 'being ignored', 'rain'])],
      })
    );
    relationships.friends[i].gender = gender;
  }

  return relationships;
}

function newGameState({ name, gender, country, startYear }) {
  const seed = `${name}-${country}-${startYear}-${Date.now()}`;
  const rng = createRng(seed);
  const player = createPlayer({ name, gender, country, startYear }, `${seed}-player`);
  const world = createWorld({ startYear, seed: `${seed}-world` });
  const eventHistory = createEventHistory();
  const relationships = buildRelationships(player, rng);

  const appState = {
    player,
    world,
    eventHistory,
    relationships,
    settings: { theme: 'dark', highContrast: false, reducedMotion: false },
    quarterCounter: 0,
    seed,
    rng,
    activeApp: 'home',
    recommendationOffered: false,
    headline: `${player.name}'s football journey begins in ${country}, ${startYear}.`,
  };
  appState.careerState = ensureCareerState(appState);
  return appState;
}

function hydrateRuntimeFields(loaded) {
  // activeApp etc. are runtime-only and are not persisted; rng is persisted
  // (seed + internal state) so the call sequence continues rather than restarting.
  loaded.rng = createRng(loaded.seed || `resume-${Date.now()}`, loaded.rngState);
  loaded.activeApp = 'home';
  loaded.recommendationOffered = Boolean(loaded.player?.position || loaded.player?.positionAccepted === false);
  loaded.headline = loaded.headline || `Welcome back, ${loaded.player.name}.`;
  loaded.careerState = ensureCareerState(loaded);
  return loaded;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function autosave() {
  try {
    saveGame(window.localStorage, serializeState(state));
  } catch (err) {
    console.error('Autosave failed', err);
    showToast('Autosave failed — your browser storage may be full or disabled.');
  }
}

function persistCandidate(candidate) {
  saveGame(window.localStorage, serializeState(candidate));
}

function tryLoadExisting() {
  try {
    const record = loadGame(window.localStorage);
    if (!record) return null;
    return hydrateRuntimeFields(deserializeState(record.state));
  } catch (err) {
    console.error('Failed to load save', err);
    showToast('Your saved game could not be loaded — it looks corrupted. Starting fresh.');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Quarter simulation pipeline
// ---------------------------------------------------------------------------

function resolveRelationshipTarget(who) {
  if (who === 'coach') return state.relationships.coach;
  if (who === 'teacher') return state.relationships.teacher;
  if (who === 'parent') return state.rng.pick([state.relationships.parentA, state.relationships.parentB]);
  if (who === 'teammate' || who === 'friend') return state.rng.pick(state.relationships.friends);
  return null;
}

async function confirmApSpend() {
  if (state.player.ap <= 0) return true;
  const choice = await openDialog({
    title: 'End the quarter?',
    bodyHtml: `<p>You still have <strong>${state.player.ap} activity point${state.player.ap === 1 ? '' : 's'}</strong> unspent this quarter. You can carry half forward as a head start next quarter, forfeit the rest, or go back and use them.</p>`,
    actions: [
      { id: 'carry', label: 'Carry half forward', variant: 'primary' },
      { id: 'forfeit', label: 'Forfeit remaining AP' },
      { id: 'cancel', label: 'Keep training this quarter', variant: 'ghost' },
    ],
  });
  if (choice === 'cancel' || choice === null) return false;
  if (choice === 'carry') {
    state.carryBonus = Math.floor(state.player.ap / 2);
  }
  return true;
}

async function offerClubTrial() {
  if (state.player.club) return;
  const offer = checkPathwayOffer(state.player, state.player.country, state.rng);
  if (!offer) return;
  const choice = await openDialog({
    title: 'Trial invitation',
    bodyHtml: `<p><strong>${escapeHtml(offer.club)}</strong> has invited ${escapeHtml(state.player.name)} to join organized training as part of the ${escapeHtml(offer.pathway)}.</p>`,
    actions: [
      { id: 'accept', label: 'Join the club', variant: 'primary' },
      { id: 'decline', label: 'Not yet' },
    ],
  });
  if (choice === 'accept') {
    joinClub(state.player, offer);
    showToast(`${state.player.name} joined ${offer.club}!`);
    state.headline = `${state.player.name} signed up with ${offer.club}.`;
  }
}

async function runMatchMoment() {
  const schedule = processMatchObservation(state.player, state.rng);
  if (!schedule.observed) return;
  if (!schedule.interactive) return;

  const scenarios = [
    { id: 'shoot', label: 'A one-on-one chance with the keeper opens up. Shoot?' },
    { id: 'pass', label: 'A teammate makes a run in space. Play the pass?' },
    { id: 'dribble', label: 'Two defenders close in. Try to dribble past?' },
    { id: 'defend', label: 'An attacker bears down on goal. Step in to defend?' },
  ];
  const scenario = state.rng.pick(scenarios);

  const choice = await openDialog({
    title: 'Match moment',
    bodyHtml: `<p>${escapeHtml(scenario.label)}</p>`,
    actions: [
      { id: 'go', label: 'Go for it', variant: 'primary' },
      { id: 'safe', label: 'Play it safe' },
    ],
  });

  const mode = choice === 'go' ? 'go' : 'safe';
  const result = resolveMatchChoice(state.player, scenario.id, state.rng, mode);

  const text = result.success
    ? mode === 'go'
      ? `${state.player.name} went for it in the ${scenario.id} moment and it paid off for ${state.player.club}.`
      : `${state.player.name} played it safe in the ${scenario.id} moment and it came off for ${state.player.club}.`
    : mode === 'go'
    ? `${state.player.name} went for it in the ${scenario.id} moment but it didn't come off.`
    : `${state.player.name} played it safe in the ${scenario.id} moment but still came up short.`;
  showToast(text);
  state.headline = text;
}

async function offerPositionRecommendation() {
  if (state.recommendationOffered || state.player.position) return;
  const rec = recommendPosition(state.player);
  if (!rec) return;
  state.recommendationOffered = true;

  const choice = await openDialog({
    title: 'Coach recommendation',
    bodyHtml: `<p>${escapeHtml(state.relationships.coach.name)} has watched enough matches to make a call: <strong>${escapeHtml(rec.label)}</strong> suits ${escapeHtml(state.player.name)} best.</p>`,
    actions: [
      { id: 'accept', label: 'Accept the position', variant: 'primary' },
      { id: 'decline', label: 'Push back' },
    ],
  });

  respondToRecommendation(state.player, state.relationships.coach, rec.position, choice === 'accept');
  showToast(
    choice === 'accept'
      ? `${state.player.name} will now play ${rec.label}.`
      : `${state.player.name} pushed back on playing ${rec.label}.`
  );
}

async function rollEvent() {
  const evt = selectEvent(EVENTS, state.player, state.eventHistory, state.quarterCounter, state.rng);
  if (!evt) return;

  let choiceId = null;
  if (evt.choices) {
    choiceId = await openDialog({
      title: 'A moment worth deciding',
      bodyHtml: `<p>${escapeHtml(resolveEventText(evt, state.player))}</p>`,
      actions: evt.choices.map((c) => ({ id: c.id, label: c.label })),
    });
    if (!choiceId) choiceId = evt.choices[0].id;
  }

  const result = applyEvent(state.player, evt, choiceId, state.eventHistory, state.quarterCounter);

  if (result.effects && result.effects.relationship) {
    const target = resolveRelationshipTarget(result.effects.relationship.who);
    if (target) {
      adjustRelationship(target, result.effects.relationship.dims);
      addMemory(target, result.text, 2, state.quarterCounter);
    }
  }

  showToast(result.text);
  state.headline = result.text;
}

async function endQuarter() {
  const proceed = await confirmApSpend();
  if (!proceed) return;

  advanceQuarter(state.player);
  if (state.carryBonus) {
    state.player.ap += state.carryBonus;
    state.carryBonus = 0;
  }
  advanceWorldQuarter(state.world, state.rng);
  recoverQuarter(state.player);
  state.quarterCounter += 1;
  state.careerState = syncCareerState(state);

  await offerClubTrial();
  await runMatchMoment();
  await offerPositionRecommendation();
  await rollEvent();

  autosave();
  renderActiveApp();
}

// ---------------------------------------------------------------------------
// Actions surface passed down to UI app modules
// ---------------------------------------------------------------------------

function buildActions() {
  return {
    switchApp(appId) {
      state.activeApp = appId;
      renderShellNav();
      renderActiveApp();
    },
    async trainStat(statId) {
      const result = trainStat(state.player, statId, state.rng);
      if (!result.success) {
        showToast(result.reason === 'injured' ? 'Injured — resting until recovered.' : 'Not enough activity points.');
      } else if (result.injury) {
        showToast(`Injury: ${state.player.name} ${result.injury.text}`);
        state.headline = `${state.player.name} ${result.injury.text}`;
      } else {
        showToast(`Training paid off: +${result.gain} ${statId}.`);
      }
      autosave();
      renderActiveApp();
      renderShellStatus();
    },
    async doActivity(activityId) {
      const activity = getActivity(activityId);
      if (!activity) return;
      if (!canPerformActivity(state.player, activity)) {
        showToast(`Injured — ${activity.label} is too physical until ${state.player.name} recovers.`);
        return;
      }
      if (!spendAP(state.player, activity.apCost)) {
        showToast('Not enough activity points.');
        return;
      }
      applyActivityEffects(state.player, activity);
      showToast(`${activity.label}: ${activity.description}`);
      autosave();
      renderActiveApp();
      renderShellStatus();
    },
    async doLifeChoice(choiceId) {
      const choice = getLifeChoice(choiceId);
      if (!choice) return;
      if (!spendAP(state.player, choice.apCost)) {
        showToast('Not enough activity points.');
        return;
      }
      applyActivityEffects(state.player, choice);
      showToast(`${choice.label}: ${choice.description}`);
      autosave();
      renderActiveApp();
      renderShellStatus();
    },
    async treatInjury() {
      if (!state.player.injury) return;
      if (state.player.physioUsedThisQuarter) {
        showToast('Already saw the physio this quarter — come back next quarter.');
        return;
      }
      if (!spendAP(state.player, 1)) {
        showToast('Not enough activity points to see the physio.');
        return;
      }
      const result = treatInjury(state.player);
      showToast(
        result.success
          ? 'Physio session complete — recovery sped up.'
          : 'Already saw the physio this quarter — come back next quarter.'
      );
      autosave();
      renderActiveApp();
      renderShellStatus();
    },
    async acceptContract(negotiationId) {
      state = acceptContractInAppState(state, negotiationId, persistCandidate);
      if (state.contractFeedback.type === 'success') {
        state.headline = state.contractFeedback.message;
      }
      showToast(state.contractFeedback.message);
      renderActiveApp();
    },
    endQuarter,
    getRecentNews: (limit) => getRecentNews(state.world, limit),
    async saveGame() {
      autosave();
      showToast('Game saved.');
    },
    exportGame() {
      return exportSave(serializeState(state));
    },
    async importGame(json) {
      try {
        const restored = deserializeState(importSave(json));
        state = hydrateRuntimeFields(restored);
        autosave();
        renderAll();
        showToast('Save imported.');
      } catch (err) {
        showToast(`Import failed: ${err.message}`);
      }
    },
    async resetGame() {
      const choice = await openDialog({
        title: 'Reset FootyVerse?',
        bodyHtml: '<p>This permanently deletes your current save. This cannot be undone.</p>',
        actions: [
          { id: 'reset', label: 'Delete save', variant: 'danger' },
          { id: 'cancel', label: 'Keep playing', variant: 'ghost' },
        ],
      });
      if (choice !== 'reset') return;
      deleteSave(window.localStorage);
      state = null;
      renderOnboarding();
    },
    updateSettings(partial) {
      Object.assign(state.settings, partial);
      applySettingsToDocument();
      autosave();
      renderActiveApp();
    },
  };
}

function applyActivityEffects(player, activity) {
  const effects = activity.effects || {};
  if (effects.stats) {
    for (const [stat, delta] of Object.entries(effects.stats)) {
      player.stats[stat] = Math.min(100, Math.max(0, player.stats[stat] + delta));
    }
  }
  if (effects.hidden) {
    for (const [key, delta] of Object.entries(effects.hidden)) {
      player.hidden[key] = Math.min(100, Math.max(0, (player.hidden[key] ?? 0) + delta));
    }
  }
  if (effects.school) {
    player.schoolStanding = Math.min(100, Math.max(0, (player.schoolStanding ?? 50) + effects.school));
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

let actions = null;

function renderShellStatus() {
  const el = document.getElementById('status-bar-content');
  if (!el || !state) return;
  const p = state.player;
  el.innerHTML = `
    <div class="status-bar__identity">
      <span class="status-bar__name">${escapeHtml(p.name)}</span>
      <span class="status-bar__meta">${escapeHtml(p.country)} · Age ${p.age}${p.club ? ` · ${escapeHtml(p.club)}` : ''}</span>
    </div>
    <div class="status-bar__clock">
      <span class="badge badge--lime">${p.quarter} ${p.year}</span>
      <span class="badge ${p.ap > 0 ? '' : 'badge--warn'}">${p.ap} AP${p.ap > p.apMax ? ` · ${p.ap - p.apMax} carried` : ''}</span>
      ${p.injury ? `<span class="badge badge--danger">Injured</span>` : ''}
    </div>
  `;
}

function renderShellNav() {
  const railEl = document.getElementById('nav-rail');
  const bottomEl = document.getElementById('bottom-nav');
  if (!railEl || !bottomEl) return;

  const railButtons = APPS.map(
    (app) => `
      <button type="button" class="nav-btn" data-app="${app.id}" aria-current="${state.activeApp === app.id ? 'page' : 'false'}">
        <span class="nav-btn__icon" aria-hidden="true">${app.icon}</span>
        <span>${app.label}</span>
      </button>`
  ).join('');
  railEl.innerHTML = railButtons;

  const bottomButtons = PRIMARY_NAV_IDS.map((id) => APPS.find((a) => a.id === id))
    .map(
      (app) => `
      <button type="button" class="nav-btn" data-app="${app.id}" aria-current="${state.activeApp === app.id ? 'page' : 'false'}">
        <span class="nav-btn__icon" aria-hidden="true">${app.icon}</span>
        <span>${app.label}</span>
      </button>`
    )
    .join('');
  bottomEl.innerHTML = `${bottomButtons}<button type="button" class="nav-btn app-launcher-nav__more" id="more-apps-btn"><span class="nav-btn__icon" aria-hidden="true">▦</span><span>More</span></button>`;

  document.querySelectorAll('[data-app]').forEach((btn) => {
    btn.addEventListener('click', () => actions.switchApp(btn.getAttribute('data-app')));
  });
  document.getElementById('more-apps-btn')?.addEventListener('click', openAppGrid);
}

function openAppGrid() {
  const overlay = document.getElementById('app-grid-overlay');
  overlay.innerHTML = `
    <h2 class="visually-hidden">All apps</h2>
    <div class="app-grid-overlay__grid">
      ${APPS.map(
        (app) => `
        <button type="button" class="app-tile" data-app="${app.id}">
          <span class="app-tile__icon" aria-hidden="true">${app.icon}</span>
          <span>${app.label}</span>
        </button>`
      ).join('')}
    </div>
  `;

  const trigger = document.activeElement;
  overlay.addEventListener(
    'close',
    () => {
      (trigger instanceof HTMLElement ? trigger : document.getElementById('more-apps-btn'))?.focus();
    },
    { once: true }
  );

  overlay.querySelectorAll('[data-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.close();
      actions.switchApp(btn.getAttribute('data-app'));
    });
  });
  overlay.addEventListener(
    'click',
    (e) => {
      if (e.target === overlay) overlay.close();
    },
    { once: true }
  );

  overlay.showModal();
  overlay.querySelector('.app-tile')?.focus();
}

function renderActiveApp() {
  const container = document.getElementById('app-content');
  if (!container || !state) return;
  const app = APPS.find((a) => a.id === state.activeApp) || APPS[0];
  container.innerHTML = '';
  app.module.render(container, { state, actions });
  renderShellStatus();
  document.title = `FootyVerse — ${app.label}`;
}

function renderAll() {
  applySettingsToDocument();
  renderShellNav();
  renderActiveApp();
}

function applySettingsToDocument() {
  if (!state) return;
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  document.documentElement.setAttribute('data-contrast', state.settings.highContrast ? 'high' : 'normal');
  document.documentElement.setAttribute('data-motion', state.settings.reducedMotion ? 'reduced' : 'normal');
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

function renderOnboarding() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <main class="onboarding" id="onboarding">
      <div class="onboarding__hero">
        <h1>FootyVerse</h1>
        <p class="text-dim">A football life, from the back garden to the badge on your chest.</p>
      </div>
      <div class="card">
        <p class="onboarding__step">Step 1 of 1</p>
        <h2>Create your player</h2>
        <p class="text-small text-dim">You'll start at age 5, no position, no rating — just a name and a place to begin. Coaches will tell you what you're good at once they've seen you play.</p>
        <form id="onboarding-form">
          <div class="form-field">
            <label for="player-name">Name</label>
            <input type="text" id="player-name" name="name" required maxlength="40" autocomplete="off" />
          </div>
          <div class="form-field">
            <label id="gender-label">Gender</label>
            <div class="radio-group" role="radiogroup" aria-labelledby="gender-label">
              <label class="radio-chip"><input type="radio" name="gender" value="girl" required /> Girl</label>
              <label class="radio-chip"><input type="radio" name="gender" value="boy" /> Boy</label>
              <label class="radio-chip"><input type="radio" name="gender" value="nonbinary" /> Non-binary</label>
              <label class="radio-chip"><input type="radio" name="gender" value="prefer-not" /> Prefer not to say</label>
            </div>
          </div>
          <div class="form-field">
            <label for="player-country">Country</label>
            <select id="player-country" name="country" required>
              ${COUNTRY_LIST.map((c) => `<option value="${c}">${COUNTRIES[c].name}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="player-year">Start year</label>
            <input type="number" id="player-year" name="startYear" required min="1990" max="2100" value="${new Date().getFullYear()}" />
          </div>
          <button type="submit" class="btn btn--primary btn--block">Begin at age 5, Spring</button>
        </form>
      </div>
      <p class="text-small text-dim">FootyVerse is fully local: no accounts, no ads, no tracking. Your save lives only in this browser.</p>
    </main>
  `;

  document.getElementById('onboarding-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const name = String(form.get('name') || '').trim();
    const gender = String(form.get('gender') || '');
    const country = String(form.get('country') || '');
    const startYear = Number(form.get('startYear'));
    if (!name || !gender || !country || !startYear) return;

    state = newGameState({ name, gender, country, startYear });
    actions = buildActions();
    renderShell();
    autosave();
  });
}

function renderShell() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <header class="status-bar" id="status-bar-content"></header>
    <div class="shell">
      <nav class="nav-rail" id="nav-rail" aria-label="Primary"></nav>
      <div class="app-content" id="app-content"></div>
    </div>
    <nav class="app-launcher-nav" id="bottom-nav" aria-label="Primary"></nav>
    <dialog class="app-grid-overlay" id="app-grid-overlay" aria-label="All apps"></dialog>
  `;
  renderAll();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  const loaded = tryLoadExisting();
  if (loaded) {
    state = loaded;
    actions = buildActions();
    renderShell();
  } else {
    renderOnboarding();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.error('SW registration failed', err));
    });
  }
}

boot();
