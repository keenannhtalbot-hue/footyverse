// Thin dispatcher that maps game-action events to guided-season progress
// markers. Lives next to the engine so main.js can stay focused on UI and
// save/load concerns. Pure: returns a new state object.

import {
  recordApSpend,
  recordApRefill,
  recordChoiceTaken,
  recordHomeOpened,
  recordQuarterAdvanceTriggered,
} from './guidedSeason.js';

const HANDLERS = {
  'home.opened': (state) => recordHomeOpened(state),
  'ap.spend': (state) => {
    // Caller's contract: the player just spent AP on something. We trust
    // the action handler to gate this on a real cost. recordApSpend
    // simply marks the step complete and increments the player's counter.
    return recordApSpend(state);
  },
  'ap.refill': (state, context = {}) => {
    const previousAp = Number.isFinite(context.previousAp) ? context.previousAp : 0;
    if ((state.player?.apSpentCount ?? 0) > 0 && previousAp <= 0 && (state.player?.ap ?? 0) > 0) {
      return recordApRefill(state);
    }
    return state;
  },
  'choice.taken': (state) => recordChoiceTaken(state),
  'quarter.advance': (state, context = {}) => {
    const previousQuarterCounter = Number.isFinite(context.previousQuarterCounter)
      ? context.previousQuarterCounter
      : Math.max(0, (state.player?.quarterCounter ?? 1) - 1);
    if ((state.player?.quarterCounter ?? 0) > previousQuarterCounter) {
      return recordQuarterAdvanceTriggered(state);
    }
    return state;
  },
};

export function applyProgressMarkers(state, event, context = {}) {
  const handler = HANDLERS[event];
  if (!handler) return state;
  return handler(state, context);
}
