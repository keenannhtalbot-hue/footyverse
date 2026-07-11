// Deterministic seeded RNG (mulberry32). DOM-independent, pure.

function mulberry32(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  next.getState = () => a >>> 0;
  return next;
}

/**
 * @param {string|number} seed
 * @param {number} [internalState] resume point captured via rng.getState(),
 *   so a reloaded save continues the same call sequence instead of restarting it.
 */
export function createRng(seed = Date.now(), internalState) {
  const initialSeed = typeof seed === 'number' ? seed : hashString(String(seed));
  const rand = mulberry32(internalState !== undefined ? internalState : initialSeed);

  const rng = {
    next() {
      return rand();
    },
    getState() {
      return rand.getState();
    },
    int(min, max) {
      return Math.floor(rand() * (max - min + 1)) + min;
    },
    float(min, max) {
      return rand() * (max - min) + min;
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(rand() * arr.length)];
    },
    chance(probability) {
      if (probability <= 0) return false;
      if (probability >= 1) return true;
      return rand() < probability;
    },
    shuffle(arr) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    weightedPick(entries) {
      // entries: [{ item, weight }]
      const total = entries.reduce((sum, e) => sum + e.weight, 0);
      let roll = rand() * total;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) return entry.item;
      }
      return entries[entries.length - 1]?.item;
    },
  };

  return rng;
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
