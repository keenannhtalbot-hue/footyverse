// Converts the in-memory game state (which holds a Set/Map inside
// eventHistory) to and from a plain JSON-safe shape for the save engine.
// DOM-independent and pure.

export function serializeState(state) {
  return {
    player: state.player,
    world: state.world,
    relationships: state.relationships,
    settings: state.settings,
    careerState: state.careerState,
    contractFeedback: state.contractFeedback,
    quarterCounter: state.quarterCounter,
    seed: state.seed,
    rngState: typeof state.rng?.getState === 'function' ? state.rng.getState() : undefined,
    eventHistory: {
      firedIds: [...state.eventHistory.firedIds],
      lastFiredAt: [...state.eventHistory.lastFiredAt.entries()],
      log: state.eventHistory.log,
    },
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
    quarterCounter: saved.quarterCounter,
    seed: saved.seed,
    rngState: saved.rngState,
    eventHistory: {
      firedIds: new Set(saved.eventHistory.firedIds),
      lastFiredAt: new Map(saved.eventHistory.lastFiredAt),
      log: saved.eventHistory.log,
    },
  };
}
