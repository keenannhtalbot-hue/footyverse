// Event engine: eligibility (age, club requirement, cooldown, dedup),
// weighted selection, and effect application. DOM-independent and pure.

import { applyStatChange } from './playerEngine.js';

export function createEventHistory() {
  return {
    firedIds: new Set(),
    lastFiredAt: new Map(), // eventId -> absolute quarter number
    log: [],
  };
}

export function getEligibleEvents(events, player, history, currentQuarter) {
  return events.filter((evt) => isEligible(evt, player, history, currentQuarter));
}

function isEligible(evt, player, history, currentQuarter) {
  if (player.age < evt.minAge || player.age > evt.maxAge) return false;
  if (evt.requiresClub && !player.club) return false;
  if (evt.once && history.firedIds.has(evt.id)) return false;
  const lastFired = history.lastFiredAt.get(evt.id);
  if (lastFired !== undefined && currentQuarter - lastFired < evt.cooldownQuarters) return false;
  return true;
}

export function selectEvent(events, player, history, currentQuarter, rng) {
  const eligible = getEligibleEvents(events, player, history, currentQuarter);
  if (eligible.length === 0) return null;
  return rng.weightedPick(eligible.map((evt) => ({ item: evt, weight: evt.weight })));
}

export function resolveEventText(evt, player) {
  return evt.text.replace(/\{name\}/g, player.name);
}

export function applyEvent(player, evt, choiceId, history, currentQuarter) {
  const branch = evt.choices ? evt.choices.find((c) => c.id === choiceId) ?? evt.choices[0] : evt;
  const effects = branch.effects || {};

  if (effects.stats) {
    for (const [stat, delta] of Object.entries(effects.stats)) {
      applyStatChange(player, stat, delta);
    }
  }
  if (effects.hidden) {
    for (const [key, delta] of Object.entries(effects.hidden)) {
      player.hidden[key] = clamp((player.hidden[key] ?? 0) + delta, 0, 100);
    }
  }
  if (effects.school) {
    player.schoolStanding = clamp((player.schoolStanding ?? 50) + effects.school, 0, 100);
  }

  history.firedIds.add(evt.id);
  history.lastFiredAt.set(evt.id, currentQuarter);

  const text = resolveEventText(evt, player);
  const entry = {
    id: evt.id,
    category: evt.category,
    text,
    quarter: currentQuarter,
    choiceId: choiceId ?? null,
    effects,
  };
  history.log.push(entry);
  player.storyLedger.push(entry);

  return entry;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
