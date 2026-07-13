// Multi-step event chains for the youth arc. Each chain has exactly three
// steps; each step references an existing event by id. The first step's
// nextStepId points to step 2, step 2's to step 3, and step 3's nextStepId
// is null (terminal). Chains are consumed by the chainState recorder.

export const CHAINS = [
  // 1. First club trial arc — joining a real club and proving yourself.
  {
    id: 'chain_first_club_trial',
    steps: [
      { id: 'step-1', eventId: 'scouted_local_coach', nextStepId: 'step-2' },
      { id: 'step-2', eventId: 'first_training_session', nextStepId: 'step-3' },
      { id: 'step-3', eventId: 'coach_praises_effort', nextStepId: null },
    ],
  },
  // 2. School transition arc — settling into a new school environment.
  {
    id: 'chain_school_transition',
    steps: [
      { id: 'step-1', eventId: 'first_day_jitters', nextStepId: 'step-2' },
      { id: 'step-2', eventId: 'new_kid_at_school', nextStepId: 'step-3' },
      { id: 'step-3', eventId: 'class_assembly_singer', nextStepId: null },
    ],
  },
  // 3. Family pet arc — the household gets and eventually mourns a pet.
  {
    id: 'chain_pet_companion',
    steps: [
      { id: 'step-1', eventId: 'pet_adopted', nextStepId: 'step-2' },
      { id: 'step-2', eventId: 'family_gets_new_pet', nextStepId: 'step-3' },
      { id: 'step-3', eventId: 'household_pet_passes_away', nextStepId: null },
    ],
  },
  // 4. Bike and travel arc — independent outdoor freedom.
  {
    id: 'chain_independent_travel',
    steps: [
      { id: 'step-1', eventId: 'learns_to_ride_bike', nextStepId: 'step-2' },
      { id: 'step-2', eventId: 'walks_to_friends_house_alone', nextStepId: 'step-3' },
      { id: 'step-3', eventId: 'learns_to_use_public_transport', nextStepId: null },
    ],
  },
  // 5. Football rising arc — first match, first set-piece goal, first hat-trick.
  {
    id: 'chain_rising_talent',
    steps: [
      { id: 'step-1', eventId: 'first_match_assist', nextStepId: 'step-2' },
      { id: 'step-2', eventId: 'first_set_piece_goal', nextStepId: 'step-3' },
      { id: 'step-3', eventId: 'first_match_hat_trick', nextStepId: null },
    ],
  },
  // 6. Work and responsibility arc — small jobs leading to bigger trust.
  {
    id: 'chain_responsibility',
    steps: [
      { id: 'step-1', eventId: 'first_chore_chart', nextStepId: 'step-2' },
      { id: 'step-2', eventId: 'first_time_babysitting', nextStepId: 'step-3' },
      { id: 'step-3', eventId: 'paper_round_started', nextStepId: null },
    ],
  },
];

export function getChainStep(chainId, stepId) {
  const chain = CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error(`unknown chain: ${chainId}`);
  const step = chain.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`unknown step: ${chainId}/${stepId}`);
  return step;
}

/**
 * Resolve the next step in a chain, or null if at the terminal step.
 * @param {string} chainId
 * @param {string} stepId
 * @returns {object|null} next step object, or null at the end of the chain
 */
export function advanceChain(chainId, stepId) {
  const step = getChainStep(chainId, stepId);
  if (step.nextStepId === null) return null;
  return getChainStep(chainId, step.nextStepId);
}

/**
 * Build a deterministic chainState recorder. The recorder tracks which step
 * each chain is currently on. It does not gate eligibility — the chainState
 * object is pure data and chain consumers decide how to use it.
 */
export function createChainState() {
  const chains = {};
  for (const chain of CHAINS) {
    chains[chain.id] = { currentStepId: chain.steps[0].id, completed: false };
  }
  return { chains };
}

export function markChainStepFired(chainState, chainId, stepId) {
  const chain = CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error(`unknown chain: ${chainId}`);
  if (!chainState.chains[chainId]) {
    chainState.chains[chainId] = { currentStepId: chain.steps[0].id, completed: false };
  }
  const state = chainState.chains[chainId];
  // Refuse to advance or re-fire on a completed chain — the terminal step is
  // a single point of no return. This keeps `markChainStepFired` idempotent
  // in the strong sense: completing a chain means it stays completed, no
  // matter which stepId the engine happens to pass us again. Absorbing
  // arbitrary stepIds here is intentional — completed chains are sealed.
  if (state.completed) return state;
  // Only advance if the fired step is the current step.
  if (state.currentStepId !== stepId) return state;
  const step = getChainStep(chainId, stepId);
  if (step.nextStepId === null) {
    state.completed = true;
  } else {
    state.currentStepId = step.nextStepId;
  }
  return state;
}

// Validate every chain has exactly three steps. Exported so tests can exercise
// the negative path against a tampered CHAINS array without re-importing the
// module under a fresh URL.
export function validateChains(chains = CHAINS) {
  for (const chain of chains) {
    if (chain.steps.length !== 3) {
      throw new Error(`chain ${chain.id} must have exactly 3 steps, has ${chain.steps.length}`);
    }
  }
  return true;
}

validateChains();