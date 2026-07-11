// Training / injury engine: AP-gated stat training, fatigue accrual, and
// age-gated injury risk with realistic severities and recovery timelines.

import { applyStatChange, spendAP, VISIBLE_STATS } from './playerEngine.js';

export const TRAINING_STATS = VISIBLE_STATS;
const TRAIN_AP_COST = 2;
const FATIGUE_PER_SESSION = 8;
const BASE_INJURY_CHANCE = 0.03;

const INJURY_WEIGHTS = {
  bruise: 65,
  sprain: 28,
  broken_ankle: 6,
  acl: 1,
};

export const INJURY_INFO = {
  bruise: {
    label: 'Bruise',
    severity: 'minor',
    minAge: 5,
    quartersOut: 0,
    text: 'picked up a knock in training but should be fine to carry on.',
  },
  sprain: {
    label: 'Sprained ankle',
    severity: 'moderate',
    minAge: 6,
    quartersOut: 1,
    text: 'twisted an ankle in training and will need to rest for the rest of the quarter.',
  },
  broken_ankle: {
    label: 'Broken ankle',
    severity: 'severe',
    minAge: 8,
    quartersOut: 3,
    text: 'suffered a broken ankle in a heavy fall, a long spell on the sidelines ahead.',
  },
  acl: {
    label: 'ACL tear',
    severity: 'severe',
    minAge: 10,
    quartersOut: 4,
    text: 'went down clutching the knee: a torn ACL, surgery and months of rehab lie ahead.',
  },
};

export function eligibleInjuryTypes(age) {
  return Object.entries(INJURY_INFO)
    .filter(([, info]) => age >= info.minAge)
    .map(([key]) => key);
}

export function selectInjuryType(age, rng) {
  const entries = eligibleInjuryTypes(age).map((item) => ({ item, weight: INJURY_WEIGHTS[item] }));
  if (typeof rng.weightedPick === 'function') return rng.weightedPick(entries);

  const weightedPool = entries.flatMap(({ item, weight }) => Array(weight).fill(item));
  return rng.pick(weightedPool);
}

export function trainStat(player, statId, rng, apCost = TRAIN_AP_COST) {
  if (isInjured(player)) {
    return { success: false, reason: 'injured' };
  }
  if (!spendAP(player, apCost)) {
    return { success: false, reason: 'insufficient_ap' };
  }

  const fatigueFactor = 1 + player.hidden.fatigue / 100;
  const pronenessFactor = 1 + player.hidden.injuryProneness / 100;
  const injuryChance = Math.min(0.5, BASE_INJURY_CHANCE * fatigueFactor * pronenessFactor);

  player.hidden.fatigue = Math.min(100, player.hidden.fatigue + FATIGUE_PER_SESSION);

  if (rng.chance(injuryChance)) {
    const type = selectInjuryType(player.age, rng);
    const info = INJURY_INFO[type];
    player.injury = { type, quartersOut: info.quartersOut, ...info };
    return { success: true, injury: player.injury, gain: 0 };
  }

  const gain = Math.max(1, Math.round((player.hidden.workEthic / 100) * rng.int(1, 3)));
  applyStatChange(player, statId, gain);
  return { success: true, gain };
}

export function isInjured(player) {
  return Boolean(player.injury && player.injury.quartersOut > 0);
}

export function recoverQuarter(player) {
  player.hidden.fatigue = Math.max(0, player.hidden.fatigue - 15);
  player.physioUsedThisQuarter = false;
  if (player.injury) {
    player.injury.quartersOut -= 1;
    if (player.injury.quartersOut <= 0) {
      player.injury = null;
    }
  }
  return player;
}

// Physio can only speed up recovery once per quarter — repeated visits in the
// same quarter would otherwise let AP-button-mashing clear an injury instantly.
export function treatInjury(player) {
  if (!isInjured(player)) {
    return { success: false, reason: 'not_injured' };
  }
  if (player.physioUsedThisQuarter) {
    return { success: false, reason: 'already_treated' };
  }
  player.injury.quartersOut = Math.max(0, player.injury.quartersOut - 1);
  if (player.injury.quartersOut === 0) player.injury = null;
  player.physioUsedThisQuarter = true;
  return { success: true };
}

export function canPerformActivity(player, activity) {
  return !(activity?.physicallyDemanding && isInjured(player));
}
