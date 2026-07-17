// Converts the in-memory game state (which holds a Set/Map inside
// eventHistory) to and from a plain JSON-safe shape for the save engine.
// DOM-independent and pure.

import { ensureGuidedSeason } from './guidedSeason.js';

export function serializeState(state) {
  return {
    player: state.player,
    world: state.world,
    relationships: state.relationships,
    settings: state.settings,
    careerState: state.careerState,
    contractFeedback: state.contractFeedback,
    quarterRecap: state.quarterRecap ?? null,
    quarterEvidence: state.quarterEvidence ?? [],
    quarterCounter: state.quarterCounter,
    seed: state.seed,
    rngState: typeof state.rng?.getState === 'function' ? state.rng.getState() : undefined,
    eventHistory: {
      firedIds: [...state.eventHistory.firedIds],
      lastFiredAt: [...state.eventHistory.lastFiredAt.entries()],
      log: state.eventHistory.log,
    },
    guidedSeason: state.guidedSeason ?? null,
    // chainState is JSON-safe by construction (plain object of
    // { currentStepId, completed }). We only emit it when present so legacy
    // saves do not gain a phantom chainState field — hydration is the
    // single place that defaults a missing chainState to createChainState().
    //
    // The `announced` sub-field (per-chainId completion map) is created by
    // createChainState() and carried forward on every save. Legacy saves
    // predating this field ride through deserialize with `announced` left
    // as {} — the announcer hook treats missing and empty identically.
    chainState: state.chainState ?? null,
    // careerState is passed through verbatim; legacy v2 saves predating
    // the press-conferences feature carry no `pressConferences` field and
    // hydrate to `[]` via the adapter's ensureCareerState — the same
    // migration-safe pattern used for Storylines `announced`. See the
    // ensureCareerState implementation in src/engines/careerStateAdapter.js.
  };
}

export function deserializeState(saved) {
  return {
    player: saved.player,
    world: saved.world,
    relationships: saved.relationships,
    settings: saved.settings,
    careerState: saved.careerState,
    contractFeedback: saved.contractFeedback,
    quarterRecap: saved.quarterRecap ?? null,
    quarterEvidence: saved.quarterEvidence ?? [],
    quarterCounter: saved.quarterCounter,
    seed: saved.seed,
    rngState: saved.rngState,
    eventHistory: {
      firedIds: new Set(saved.eventHistory.firedIds),
      lastFiredAt: new Map(saved.eventHistory.lastFiredAt),
      log: saved.eventHistory.log,
    },
    // Legacy saves predating guidedSeason get a null in the serialized JSON;
    // we hydrate at the deserialization boundary so callers can use the
    // returned object without an extra ensureGuidedSeason pass. main.js still
    // calls ensureGuidedSeason on hydrateRuntimeFields as belt-and-braces.
    guidedSeason: ensureGuidedSeason(saved.guidedSeason),
    // Legacy saves predating chainState stay null here; main.js
    // hydrateRuntimeFields defaults this to createChainState() so the
    // gameplay path can always call applyEvent(.., chainState). The
    // `announced` sub-field is left as-is (or {}) — legacy saves predating
    // the field are equivalent to a never-announced save, which the
    // announcer hook reads as the empty map.
    chainState: saved.chainState ?? null,
  };
}
