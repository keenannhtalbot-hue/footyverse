// Deterministic scoped RNG streams, isolated per scope key. DOM-independent, pure.

import { createRng } from './rng.js';

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {string|number} gameSeed
 * @param {...(string|number)} scopeParts joined into one scope key, e.g. 'fixture', fixtureId
 */
export function scopedRng(gameSeed, ...scopeParts) {
  const key = JSON.stringify([gameSeed, ...scopeParts]);
  return createRng(hashString(key));
}
