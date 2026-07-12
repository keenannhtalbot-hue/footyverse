// Progressive first-run guided-season state: pure, DOM-independent.
// Owns only the smallest possible flags for contextual teaching, and
// never mutates gameplay state. Old saves default to a fully-off state.

export const GUIDED_SEASON_SCHEMA_VERSION = 1;

const STEP_ORDER = [
  'home.objective',
  'ap.spend',
  'fatigue',
  'choice.moment',
  'quarter.advance',
  'recap.read',
];

const STEP_META = {
  'home.objective': {
    app: 'home',
    title: 'Read your game plan',
    body: 'Home is your team sheet. The Right now, This season and Youth journey cards tell you what to focus on each quarter — start there whenever you are not sure.',
  },
  'ap.spend': {
    app: 'football',
    title: 'Spend one activity point',
    body: 'You earn 12 activity points (AP) each quarter. Head to Football and pick a training move — that costs 2 AP and is the main way your game grows.',
  },
  'fatigue': {
    app: 'home',
    title: 'Rest recovers fatigue',
    body: 'Hard training piles up fatigue. When you end a quarter, your body recovers a little — that is why short bursts of effort beat grinding the same move every quarter.',
  },
  'choice.moment': {
    app: 'home',
    title: 'Choices shape the story',
    body: 'Each quarter gives a few yes/no decisions (training focus, family time, a club invite). Pick whichever feels right — every choice is written down for the recap.',
  },
  'quarter.advance': {
    app: 'home',
    title: 'End the quarter when AP is spent',
    body: 'When you are ready, tap End the quarter on Home. The world ticks forward, your age moves on, and the recap explains what changed.',
  },
  'recap.read': {
    app: 'home',
    title: 'Read the recap',
    body: 'The quarter recap lists up to six things that really happened — no fill-in copy. If a quarter was quiet the recap says so honestly.',
  },
};

function nowTick() {
  return Date.now();
}

function next(stepId, state) {
  const idx = STEP_ORDER.indexOf(stepId);
  if (idx === -1 || idx === STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

function isStepCleared(seen, stepId) {
  const entry = seen?.[stepId];
  return Boolean(entry && (entry.dismissed || entry.completed));
}

function ensureEntry(seen, stepId) {
  if (!seen[stepId]) {
    seen[stepId] = { dismissed: false, completed: false, at: 0 };
  }
  return seen[stepId];
}

function seenOnes(seen) {
  return STEP_ORDER.filter((id) => isStepCleared(seen, id));
}

function hasAnyEngagement(seen) {
  // Home.objective should auto-complete the moment the player actually does
  // anything, even if they never opened Home. Reading the next sequential
  // step's completion is a stable proxy: choose.moment→ap.spend→fatigue...
  // are non-UI-affordance markers that the player must trigger through play.
  return Boolean(
    seen['ap.spend']?.completed
    || seen['fatigue']?.completed
    || seen['choice.moment']?.completed
    || seen['quarter.advance']?.completed
    || seen['recap.read']?.completed
  );
}

function firstUnseenStepId(seen) {
  for (const id of STEP_ORDER) {
    if (!isStepCleared(seen, id)) return id;
  }
  return null;
}

export function createGuidedSeason() {
  return {
    schemaVersion: GUIDED_SEASON_SCHEMA_VERSION,
    seen: {},
    resetCount: 0,
    lastUpdatedAt: nowTick(),
  };
}

export function ensureGuidedSeason(state) {
  if (state && typeof state === 'object' && state.schemaVersion === GUIDED_SEASON_SCHEMA_VERSION) {
    const seen = (state.seen && typeof state.seen === 'object') ? state.seen : {};
    return {
      schemaVersion: GUIDED_SEASON_SCHEMA_VERSION,
      seen,
      resetCount: Number.isFinite(state.resetCount) ? state.resetCount : 0,
      lastUpdatedAt: Number.isFinite(state.lastUpdatedAt) ? state.lastUpdatedAt : nowTick(),
    };
  }
  return createGuidedSeason();
}

export function resetGuidedHints(state) {
  return {
    ...state,
    seen: {},
    resetCount: (state.resetCount ?? 0) + 1,
    lastUpdatedAt: nowTick(),
  };
}

export function markStepDismissed(state, stepId) {
  if (!stepId || !STEP_META[stepId]) return state;
  const seen = { ...state.seen };
  const entry = ensureEntry(seen, stepId);
  if (entry.dismissed && entry.completed) return state;
  seen[stepId] = { ...entry, dismissed: true, completed: true, at: nowTick() };
  return { ...state, seen, lastUpdatedAt: nowTick() };
}

export function markStepCompleted(state, stepId) {
  if (!stepId || !STEP_META[stepId]) return state;
  const seen = { ...state.seen };
  const entry = ensureEntry(seen, stepId);
  if (entry.completed) {
    if (entry.at === state.lastUpdatedAt) {
      return state;
    }
    seen[stepId] = { ...entry };
    return { ...state, seen, lastUpdatedAt: state.lastUpdatedAt };
  }
  seen[stepId] = { ...entry, completed: true, at: nowTick() };
  return { ...state, seen, lastUpdatedAt: nowTick() };
}

function flagSeen(seen, stepId, partial) {
  const entry = ensureEntry(seen, stepId);
  const nextEntry = { ...entry, ...partial };
  if (entry.dismissed === nextEntry.dismissed && entry.completed === nextEntry.completed && entry.at === nextEntry.at) {
    return seen;
  }
  seen[stepId] = nextEntry;
  return seen;
}

function withSeen(state, stepId, partial) {
  // Defense in depth: callers may not have run ensureGuidedSeason yet
  // (e.g. an older save deserialized mid-flow, or a future call site that
  // forgets). recordProgress always re-hydrates before delegating, but
  // guarding here keeps the function safe to use directly.
  const safeState = state && typeof state === 'object' && state.seen && typeof state.seen === 'object'
    ? state
    : ensureGuidedSeason(state);
  const seen = { ...safeState.seen };
  flagSeen(seen, stepId, partial);
  const touched = lastEntryChanged(safeState.seen, seen, stepId);
  return {
    ...safeState,
    seen,
    lastUpdatedAt: touched ? nowTick() : safeState.lastUpdatedAt,
  };
}

function lastEntryChanged(prev, next, stepId) {
  const a = prev[stepId];
  const b = next[stepId];
  if (!a || !b) return true;
  return a.dismissed !== b.dismissed || a.completed !== b.completed || a.at !== b.at;
}

// Pure: returns the active step for the current state, with auto-completion
// applied to seen entries whose trigger is already satisfied. Always returns
// the earliest still-relevant step; the caller (UI) decides whether to render
// it inline or surface only on the matching app.
export function resolveActiveStep(state) {
  const guided = ensureGuidedSeason(state.guidedSeason);
  const player = state.player ?? {};
  const recap = state.quarterRecap ?? null;

  let seen = { ...guided.seen };
  let active = firstUnseenStepId(seen);

  // Auto-complete steps whose triggers are already satisfied so the player
  // never sees a hint that they have already done.
  if (active === 'home.objective' && (player.openedHomeOnce ?? hasAnyEngagement(seen))) {
    seen = finalizeSeen(seen, 'home.objective');
    active = firstUnseenStepId(seen);
  }

  if (active === 'ap.spend' && (player.apSpentCount ?? 0) > 0) {
    seen = finalizeSeen(seen, 'ap.spend');
    active = firstUnseenStepId(seen);
  }

  if (active === 'fatigue' && (player.apRefilledFromZero ?? false)) {
    seen = finalizeSeen(seen, 'fatigue');
    active = firstUnseenStepId(seen);
  }

  if (active === 'choice.moment' && (player.choicesTaken ?? 0) > 0) {
    seen = finalizeSeen(seen, 'choice.moment');
    active = firstUnseenStepId(seen);
  }

  // quarter.advance, recap.read, and home.objective are UI affordance nudges,
  // not state transitions. They clear only when the player dismisses them
  // (or the resolver records that they engaged with the relevant control).
  if (active === 'recap.read' && recap && recap.dismissed) {
    seen = finalizeSeen(seen, 'recap.read');
    active = firstUnseenStepId(seen);
  }

  if (active === null) return null;
  const meta = STEP_META[active];
  if (!meta) return null;

  return {
    id: active,
    app: meta.app,
    title: meta.title,
    body: meta.body,
    next: next(active, state),
  };
}

function finalizeSeen(seen, stepId) {
  return flagSeen(seen, stepId, { completed: true });
}

// Convenience for the UI: returns the step if it belongs to the active app,
// otherwise null. The renderer can call this on every render to know whether
// to mount the hint card.
export function resolveActiveStepForApp(state, appId) {
  const step = resolveActiveStep(state);
  if (!step) return null;
  if (step.app !== appId) return null;
  return step;
}

function tallySpent(player) {
  return Number.isFinite(player.apSpentCount) ? player.apSpentCount : 0;
}

function recordProgress(state, stepId, playerPatch, seenPatch) {
  return {
    ...state,
    guidedSeason: withSeen(state.guidedSeason, stepId, seenPatch),
    player: { ...state.player, ...playerPatch },
  };
}

export function recordApSpend(state) {
  if (isStepCleared(state.guidedSeason?.seen, 'ap.spend')) return state;
  const before = tallySpent(state.player);
  return recordProgress(state, 'ap.spend', { apSpentCount: before + 1 }, { completed: true });
}

export function recordApRefill(state) {
  if (isStepCleared(state.guidedSeason?.seen, 'fatigue')) return state;
  return recordProgress(
    state,
    'fatigue',
    { apRefilledFromZero: true },
    { completed: true }
  );
}

export function recordChoiceTaken(state) {
  if (isStepCleared(state.guidedSeason?.seen, 'choice.moment')) return state;
  const before = Number.isFinite(state.player.choicesTaken) ? state.player.choicesTaken : 0;
  return recordProgress(state, 'choice.moment', { choicesTaken: before + 1 }, { completed: true });
}

export function recordHomeOpened(state) {
  if (isStepCleared(state.guidedSeason?.seen, 'home.objective')) return state;
  return recordProgress(state, 'home.objective', { openedHomeOnce: true }, { completed: true });
}

export function recordQuarterAdvanceTriggered(state) {
  if (isStepCleared(state.guidedSeason?.seen, 'quarter.advance')) return state;
  return recordProgress(state, 'quarter.advance', {}, { completed: true });
}

export function recordRecapEngaged(state) {
  if (isStepCleared(state.guidedSeason?.seen, 'recap.read')) return state;
  return recordProgress(state, 'recap.read', {}, { completed: true });
}

export function recordQuarterAdvance(state, { previousQuarterCounter } = {}) {
  const prior = Number.isFinite(previousQuarterCounter)
    ? previousQuarterCounter
    : Math.max(0, (state.player.quarterCounter ?? 1) - 1);
  if ((state.player.quarterCounter ?? 0) > prior) {
    return recordProgress(state, 'quarter.advance', {}, { completed: true });
  }
  return state;
}

export const GUIDED_STEP_IDS = Object.freeze([...STEP_ORDER]);

export function guidedStepMeta(stepId) {
  return STEP_META[stepId] ? { ...STEP_META[stepId] } : null;
}
