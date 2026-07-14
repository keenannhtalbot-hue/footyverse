// Once-only chain-completion feedback hook.
//
// When a chain transitions to `completed: true`, the player must hear about
// it exactly once. Announcements are tracked on chainState.announced so:
//   - a chain completing for the first time yields its chainId;
//   - re-renders, re-loads, and re-fires of the terminal step NEVER re-fire;
//   - legacy chainState hydrates safely (a missing `announced` is treated
//     as the empty map; detectChainCompletions still yields nothing during
//     hydration because no chain flips state during the load itself).
//
// The module is pure: it never mutates the rng, never toasts, and never
// reaches into the DOM. main.js wires these helpers together with the rest
// of the gameplay pipeline.

/**
 * Compare a freshly-walked chainState to a snapshot taken BEFORE the walk
 * and return the list of chainIds whose `completed` flag flipped from
 * false -> true during the walk. Chains already completed before the walk
 * (or those still in-progress) are excluded.
 *
 * @param {{chains: object, announced?: object}} chainState after the walk
 * @param {object} beforeChains snapshot of chainState.chains taken before
 * @param {{announced?: object}} [options]
 * @returns {string[]} chainIds that transitioned to completed
 */
export function detectChainCompletions(chainState, beforeChains, options = {}) {
  if (!chainState || !chainState.chains || !beforeChains) return [];
  const announcedMap = options.announced ?? chainState.announced ?? {};
  const ids = [];
  for (const [chainId, state] of Object.entries(chainState.chains)) {
    if (!state || state.completed !== true) continue;
    const before = beforeChains[chainId];
    // Defensive: a chain that wasn't present in `before` (legacy save with a
    // missing entry) still counts as a transition if it is now completed.
    const wasCompletedBefore = Boolean(before && before.completed === true);
    if (wasCompletedBefore) continue;
    if (announcedMap && announcedMap[chainId] === true) continue;
    ids.push(chainId);
  }
  return ids;
}

/**
 * Mark the given chainIds as announced on a fresh chainState copy. Unknown
 * chainIds are silently dropped. The function never throws and never mutates
 * the input — callers can rely on referential safety.
 *
 * @param {{chains: object, announced?: object}} chainState
 * @param {string[]} chainIds
 * @returns {object} a new chainState with the announced map merged
 */
export function markChainsAnnounced(chainState, chainIds) {
  if (!chainState || typeof chainState !== 'object') return chainState;
  const safeIds = Array.isArray(chainIds) ? chainIds.filter((id) => typeof id === 'string') : [];
  if (safeIds.length === 0) return chainState;
  const baseAnnounced = (chainState.announced && typeof chainState.announced === 'object')
    ? { ...chainState.announced }
    : {};
  for (const id of safeIds) {
    // Only mark known chain ids so we never write made-up names into the
    // save file.
    if (chainState.chains && Object.prototype.hasOwnProperty.call(chainState.chains, id)) {
      baseAnnounced[id] = true;
    }
  }
  return { ...chainState, announced: baseAnnounced };
}

/**
 * High-level hook used by main.js after a quarter pipeline runs. The caller
 * supplies the pre-walk snapshot, and this function returns the list of
 * chainIds that should be announced to the player. The caller is
 * responsible for marking them announced (via markChainsAnnounced) AND for
 * the actual delivery (toast, banner, etc.) so the announcer engine stays
 * pure and presentation-agnostic.
 *
 * @param {{chainState: object}} state
 * @param {{beforeChains: object}} options
 * @returns {string[]} chainIds newly completed
 */
export function announceNewChainCompletions(state, options = {}) {
  if (!state || !state.chainState) return [];
  const { beforeChains, announced } = options;
  return detectChainCompletions(state.chainState, beforeChains, {
    announced: announced ?? state.chainState.announced,
  });
}
