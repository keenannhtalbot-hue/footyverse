// Football engine: age-gated organized-football entry, coach evaluation and
// position recommendation, and interactive match-moment resolution.
// DOM-independent and pure aside from mutating the passed player/relationship.

import { COUNTRIES } from '../data/countries.js';
import { POSITIONS, POSITION_LIST } from '../data/positions.js';
import { adjustRelationship, addMemory } from './relationshipEngine.js';
import { applyStatChange, recordMatchObservation } from './playerEngine.js';
import { isInjured } from './trainingEngine.js';

const OFFER_CHANCE_PER_QUARTER = 0.35;
const RECOMMENDATION_THRESHOLD = 6;
const MATCH_OBSERVATION_CHANCE = 0.85;
const INTERACTIVE_MATCH_CHANCE = 0.35;

export const MATCH_CHOICES = ['shoot', 'pass', 'dribble', 'defend'];

const CHOICE_STAT = {
  shoot: 'shooting',
  pass: 'passing',
  dribble: 'dribbling',
  defend: 'defending',
};

export function checkPathwayOffer(player, country, rng) {
  const info = COUNTRIES[country];
  const [minAge, maxAge] = info.entryAgeRange;
  if (player.age < minAge || player.age > maxAge) return null;
  if (player.club) return null;
  if (!rng.chance(OFFER_CHANCE_PER_QUARTER)) return null;
  const club = rng.pick(info.clubs);
  return { club, pathway: info.pathwayName };
}

export function joinClub(player, offer) {
  player.club = offer.club;
  player.pathway = offer.pathway;
  player.careerHistory.push({ type: 'joined_club', club: offer.club, age: player.age, year: player.year });
  return player;
}

export function scheduleMatchObservation(player, rng) {
  if (!player.club || isInjured(player)) return { observed: false, interactive: false };

  const roll = rng.next();
  return {
    observed: roll < MATCH_OBSERVATION_CHANCE,
    interactive: roll < INTERACTIVE_MATCH_CHANCE,
  };
}

export function processMatchObservation(player, rng) {
  const schedule = scheduleMatchObservation(player, rng);
  if (schedule.observed) recordMatchObservation(player);
  return schedule;
}

export function recommendPosition(player) {
  if (player.matchObservations < RECOMMENDATION_THRESHOLD) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const id of POSITION_LIST) {
    const { weights } = POSITIONS[id];
    let score = 0;
    for (const [stat, weight] of Object.entries(weights)) {
      score += (player.stats[stat] ?? 0) * weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return { position: best, label: POSITIONS[best].label, confidence: Math.round(bestScore) };
}

export function respondToRecommendation(player, coachRelationship, positionId, accept) {
  if (accept) {
    player.position = positionId;
    player.positionAccepted = true;
    adjustRelationship(coachRelationship, { trust: 6, respect: 4 });
    addMemory(coachRelationship, `Accepted the recommendation to play ${POSITIONS[positionId].label}.`, 2);
  } else {
    player.positionAccepted = false;
    adjustRelationship(coachRelationship, { trust: -4, respect: -2 });
    addMemory(coachRelationship, `Turned down the recommendation to play ${POSITIONS[positionId].label}.`, 2);
  }
  return player;
}

// mode 'go' plays the odds as they lie and swings harder on the outcome
// (bigger confidence gain plus a stat bump on success, bigger confidence hit
// on failure); mode 'safe' trades that upside for a flatter, more forgiving
// outcome — the dialog choice a player makes has to change what happens.
export function resolveMatchChoice(player, choiceId, rng, mode = 'go') {
  const stat = CHOICE_STAT[choiceId];
  if (!stat) throw new Error(`Unknown match choice: ${choiceId}`);

  const statFactor = (player.stats[stat] ?? 0) / 100;
  const confidenceFactor = (player.hidden.confidence ?? 50) / 100;
  const baseProbability = statFactor * 0.7 + confidenceFactor * 0.3;
  const safeBonus = mode === 'safe' ? 0.15 : 0;
  const probability = Math.min(0.95, Math.max(0.05, baseProbability + safeBonus));
  const success = rng.chance(probability);

  const confidenceSwing = mode === 'safe' ? 2 : success ? 4 : 6;
  player.hidden.confidence = clamp(player.hidden.confidence + (success ? confidenceSwing : -confidenceSwing), 0, 100);

  if (mode === 'go' && success) {
    applyStatChange(player, stat, 1);
  }

  return { success, choice: choiceId, stat, probability, mode };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
