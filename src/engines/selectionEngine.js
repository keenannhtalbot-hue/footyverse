// Selection engine: deterministic squad selection by position slot.
// DOM-independent, pure — does not mutate input.

import { POSITIONS } from '../data/positions.js';

function isEligible(person, team) {
  if (person.career.currentTeamId !== team.id) return false;
  if (person.career.stage === 'retired') return false;
  if (person.condition.injury) return false;
  if (person.condition.suspensionMatches > 0) return false;
  return true;
}

function computeAbility(person, slot) {
  const { weights } = POSITIONS[slot];
  let score = 0;
  for (const [stat, weight] of Object.entries(weights)) {
    score += (person.attributes[stat] ?? 0) * weight;
  }
  return score;
}

const PRIMARY_FIT = 1;
const SECONDARY_FIT = 0.85;
const OUT_OF_POSITION_FIT = 0.65;

function computeFit(person, slot) {
  if (person.career.positionId === slot) return PRIMARY_FIT;
  if (person.career.secondaryPositionIds.includes(slot)) return SECONDARY_FIT;
  return OUT_OF_POSITION_FIT;
}

const SHARPNESS_WEIGHT = 0.1;
const FITNESS_WEIGHT = 0.1;
const MORALE_WEIGHT = 0.1;

function computeConditionScore(person) {
  const { sharpness, fitness, morale } = person.condition;
  return sharpness * SHARPNESS_WEIGHT + fitness * FITNESS_WEIGHT + morale * MORALE_WEIGHT;
}

const YOUTH_TRUST_WEIGHT = 0.1;

function computeScore(person, slot, team) {
  const youthTrustBonus = person.career.debutTick === null
    ? (team.manager?.youthTrust ?? 0) * YOUTH_TRUST_WEIGHT
    : 0;
  return computeAbility(person, slot) * computeFit(person, slot)
    + computeConditionScore(person)
    + youthTrustBonus;
}

export function selectSquad(people, team, positionSlots) {
  for (const slot of positionSlots) {
    if (!POSITIONS[slot]) {
      throw new Error(`Unknown position slot: ${slot}`);
    }
  }

  const eligible = people.filter((person) => isEligible(person, team));
  const taken = new Set();
  const result = [];

  for (const slot of positionSlots) {
    const ranked = eligible
      .filter((person) => !taken.has(person.id))
      .map((person) => ({ id: person.id, score: computeScore(person, slot, team) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

    const best = ranked[0] ?? null;
    if (best) taken.add(best.id);
    result.push({ slot, personId: best ? best.id : null });
  }

  return result;
}
