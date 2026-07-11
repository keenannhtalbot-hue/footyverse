// Player engine: identity, visible/hidden stats, quarter/age clock, AP budget.
// DOM-independent and pure aside from mutating the passed player object.

import { createRng } from './rng.js';

export const QUARTERS = ['Spring', 'Summer', 'Fall', 'Winter'];

export const VISIBLE_STATS = [
  'passing',
  'shooting',
  'pace',
  'dribbling',
  'defending',
  'physical',
  'goalkeeping',
];

const AP_PER_QUARTER = 12;
const MATCH_OBSERVATIONS_FOR_OVERALL = 8;

export function createPlayer({ name, gender, country, startYear }, seed = `${name}-${startYear}`) {
  const rng = createRng(seed);

  const stats = {};
  for (const stat of VISIBLE_STATS) {
    stats[stat] = clamp(rng.int(15, 30), 0, 100);
  }

  return {
    name,
    gender,
    country,
    year: startYear,
    age: 5,
    quarter: QUARTERS[0],
    quarterIndex: 0,
    ap: AP_PER_QUARTER,
    apMax: AP_PER_QUARTER,
    stats,
    hidden: {
      potential: clamp(rng.int(40, 95), 0, 100),
      confidence: 50,
      workEthic: clamp(rng.int(30, 80), 0, 100),
      fatigue: 0,
      injuryProneness: clamp(rng.int(5, 25), 0, 100),
    },
    position: null,
    positionAccepted: null,
    injury: null,
    physioUsedThisQuarter: false,
    matchObservations: 0,
    club: null,
    pathway: null,
    school: null,
    careerHistory: [],
    storyLedger: [],
  };
}

export function advanceQuarter(player) {
  player.quarterIndex = (player.quarterIndex + 1) % QUARTERS.length;
  player.quarter = QUARTERS[player.quarterIndex];
  if (player.quarterIndex === 0) {
    player.age += 1;
    player.year += 1;
  }
  resetAP(player);
  return player;
}

export function applyStatChange(player, stat, delta) {
  if (!(stat in player.stats)) throw new Error(`Unknown stat: ${stat}`);
  player.stats[stat] = clamp(player.stats[stat] + delta, 0, 100);
  return player.stats[stat];
}

export function spendAP(player, cost) {
  if (cost > player.ap) return false;
  player.ap -= cost;
  return true;
}

export function resetAP(player) {
  player.ap = player.apMax;
  return player;
}

export function recordMatchObservation(player) {
  player.matchObservations += 1;
  return player.matchObservations;
}

export function getOverall(player) {
  if (player.matchObservations < MATCH_OBSERVATIONS_FOR_OVERALL) return null;
  const values = VISIBLE_STATS.map((s) => player.stats[s]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
