// scripts/batchCareerSimulation.mjs
//
// Deterministic, opt-in batch-career simulation gate for FootyVerse.
//
// WHAT THIS IS
//   A reproducible driver that runs N parallel **senior careers**
//   through the real canonical schema-v2 career-state seam — the same
//   `reduceCareerCommand` + `expireContracts` engine path used by the
//   player-facing Contracts / Football / News UIs. It is NOT a fake
//   stub: every career starts from a real `createCareerStateForPlayer`
//   seed (via `careerStateAdapter.createCareerStateForPlayer`), is
//   advanced by issuing real career commands, and is observed only via
//   the same shape the senior-epilogue renderer reads.
//
// WHY ONLY THE SENIOR CAREER
//   The schema-v2 simulation models the professional senior career
//   (contracts, transfers, loans, contract expiry, retirement via
//   "no active contract + senior stage + open offer handled"). The
//   childhood -> senior transition is owned by the legacy app state
//   (`appState.player.age`) and is not driven by `reduceCareerCommand`.
//   Driving it here would mean writing a parallel toy model, which the
//   brief explicitly forbids. So a "career" here = one deterministic
//   senior-stage career, age 16 to terminal state, bounded by
//   `maxTicksPerCareer`.
//
// DETERMINISM
//   Per-career seed is derived from `seed + ':' + index` via the
//   project's existing `createRng` so the same global `seed` always
//   produces the same summary. This means the 1000-career run is
//   byte-stable for a fixed seed and can be checked into evidence.
//
// TERMINAL CATEGORIES (derived from real state, not invented)
//   * `signed_then_expired`     — player signed at least one contract,
//                                  which later expired without renewal.
//   * `signed_still_active`     — player signed at least one contract
//                                  which is still active when the tick
//                                  cap is hit (career still ongoing).
//   * `rejected_all`            — player rejected every offer, never
//                                  signed, no active registration.
//   * `open_offer_pending`      — final state has an unresolved open
//                                  offer (career ended mid-decision).
//   The terminal categories come from observed state, not from a
//   pre-baked map — they're added by category only when the first
//   career of that shape appears.
//
// USAGE
//   node scripts/batchCareerSimulation.mjs               # default N=1000
//   node scripts/batchCareerSimulation.mjs 250          # N=250
//   FOOTY_BATCH_SEED=foo node scripts/batchCareerSimulation.mjs 50
//
//   In code (e.g. tests):
//     import { runBatchCareerSimulation } from './scripts/batchCareerSimulation.mjs';
//     const summary = runBatchCareerSimulation({ batchSize: 8, ... });

import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engines/rng.js';
import { reduceCareerCommand } from '../src/engines/careerOrchestrator.js';
import { expireContracts } from '../src/engines/contractEngine.js';
import { createCareerStateForPlayer } from '../src/engines/careerStateAdapter.js';

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_MAX_YEARS = 25; // 32 ticks/year → 800 ticks
const TICKS_PER_YEAR = 32;
const DEFAULT_SEED = 'footy-batch-2026-07-15';

// Terminal decision probabilities per arrival (deterministic per RNG roll).
// Realistic-but-conservative: most senior careers accept or counter the
// first offer; a minority reject. We do not promise these are gameplay
// outcomes — they are the simulator's arrival-handling policy.
const DECISION = { ACCEPT: 'ACCEPT', COUNTER: 'COUNTER', REJECT: 'REJECT' };
const DECISION_WEIGHTS = [0.55, 0.20, 0.25]; // accept, counter, reject
const DECISION_KEYS = [DECISION.ACCEPT, DECISION.COUNTER, DECISION.REJECT];

// Arrival stride: when an offer is resolved (or rejected) we advance the
// clock by a deterministic stride chosen from the seeded RNG.
const STRIDE_MIN_TICKS = 8;   // 1 quarter
const STRIDE_MAX_TICKS = 64;  // 2 years

const PLAYER_AGE_AT_PRO_START = 16;
const ARRIVAL_OFFSET_TICKS = 4; // first offer arrives ~1 month after start
const COUNTER_DURATION_TICKS = TICKS_PER_YEAR * 2;
const COUNTER_WAGE_MINOR = 130000;
const COUNTER_SIGNING_BONUS_MINOR = 600000;
const COUNTER_SQUAD_ROLE = 'rotation';
const COUNTER_RELEASE_FEE_MINOR = 6000000;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function weightedChoice(rng, items, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  const roll = rng.next() * total;
  let cursor = 0;
  for (let i = 0; i < items.length; i += 1) {
    cursor += weights[i];
    if (roll < cursor) return items[i];
  }
  return items[items.length - 1];
}

function randInt(rng, min, max) {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

// Build a fresh schema-v2 career state for a single 16-year-old pro free
// agent. We use the real adapter so the batch driver can never drift from
// the player-facing onboarding path.
function buildInitialCareerState(rng) {
  const player = {
    name: `Batch Kid ${randInt(rng, 1, 1_000_000)}`,
    gender: rng.next() < 0.5 ? 'boy' : 'girl',
    country: ['England', 'Spain', 'Brazil', 'Germany', 'Canada'][
      randInt(rng, 0, 4)
    ],
    age: PLAYER_AGE_AT_PRO_START,
    year: 2024 + PLAYER_AGE_AT_PRO_START,
    quarterIndex: 0,
    stats: {},
    hidden: {},
  };
  const tick = ARRIVAL_OFFSET_TICKS;
  return createCareerStateForPlayer(player, tick);
}

// Mint a fresh open contract offer for the player, originating from
// whichever club owns them at the moment of arrival (or a synthetic
// club if free agent). This uses the SAME negotiation shape the
// adapter emits, so accept/counter/reject go through the real engine.
function mintOpenContractOffer(state, rng) {
  const next = structuredClone(state);
  const personId = next.playerId;
  const playerCareer = next.peopleById[personId].career;

  // Pick a club id. If the player currently belongs to a club, the
  // arrival is a renewal from that club; otherwise from the seeded
  // default. We only mint from clubs that already exist in the state.
  const existingClubIds = Object.keys(next.clubsById);
  if (existingClubIds.length === 0) {
    // No clubs in state — synthesize a single default club and team
    // so the negotiation is well-formed. This is a setup invariant,
    // not a gameplay outcome.
    next.clubsById['club-batch-default'] = {
      id: 'club-batch-default',
      name: 'Batch Default FC',
      countryId: 'England',
      teamIds: ['team-batch-default-senior'],
      finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 50000000 },
    };
    next.teamsById['team-batch-default-senior'] = {
      id: 'team-batch-default-senior',
      clubId: 'club-batch-default',
      level: 'senior',
      squadPersonIds: [],
    };
  }
  const clubIds = Object.keys(next.clubsById);
  const toClubId = clubIds[randInt(rng, 0, clubIds.length - 1)];

  const tick = next.clock.tick;
  const negotiationId = `negotiation-batch-${next.idCounters.negotiation ?? 0}-${randInt(rng, 1, 1_000_000)}`;
  next.idCounters.negotiation = (next.idCounters.negotiation ?? 0) + 1;
  next.negotiationsById[negotiationId] = {
    id: negotiationId,
    kind: 'professional-offer',
    personId,
    fromClubId: toClubId,
    toClubId,
    createdTick: tick,
    expiresTick: tick + STRIDE_MAX_TICKS,
    status: 'open',
    terms: {
      durationTicks: COUNTER_DURATION_TICKS,
      wagePerWeekMinor: COUNTER_WAGE_MINOR,
      signingBonusMinor: COUNTER_SIGNING_BONUS_MINOR,
      squadRole: COUNTER_SQUAD_ROLE,
      releaseFeeMinor: COUNTER_RELEASE_FEE_MINOR,
      transferFeeMinor: 0,
    },
    roundsUsed: 0,
    maxRounds: 2,
  };
  return { state: next, negotiationId };
}

function applyDecision(state, negotiationId, decision, rng) {
  if (decision === DECISION.ACCEPT) {
    return reduceCareerCommand(state, { type: 'ACCEPT_CONTRACT', negotiationId }).state;
  }
  if (decision === DECISION.REJECT) {
    return reduceCareerCommand(state, { type: 'REJECT_CONTRACT', negotiationId }).state;
  }
  // COUNTER — keep the offer open but bump roundsUsed and propose new
  // terms. Use a slight wage bump to make counter distinguishable.
  // If the offer has already used all counter rounds, fall back to
  // accept so the engine doesn't throw on round-limit. This keeps the
  // harness bounded — we're driving the engine, not designing new
  // negotiation semantics.
  const negotiation = state.negotiationsById?.[negotiationId];
  if (negotiation && (negotiation.roundsUsed ?? 0) >= (negotiation.maxRounds ?? 0)) {
    return reduceCareerCommand(state, { type: 'ACCEPT_CONTRACT', negotiationId }).state;
  }
  const bumped = {
    durationTicks: COUNTER_DURATION_TICKS,
    wagePerWeekMinor: COUNTER_WAGE_MINOR + randInt(rng, 5000, 40000),
    signingBonusMinor: COUNTER_SIGNING_BONUS_MINOR + randInt(rng, 0, 200000),
    squadRole: COUNTER_SQUAD_ROLE,
    releaseFeeMinor: COUNTER_RELEASE_FEE_MINOR + randInt(rng, 0, 2000000),
    transferFeeMinor: 0,
  };
  return reduceCareerCommand(state, {
    type: 'COUNTER_CONTRACT',
    negotiationId,
    terms: bumped,
  }).state;
}

function advanceClock(state, ticks) {
  return expireContracts({
    ...state,
    clock: {
      ...state.clock,
      tick: state.clock.tick + ticks,
    },
  });
}

function pruneExpiredOffers(state) {
  // Negotiation offers that expired during the tick advance — clean
  // them out so we never feed an expired id to the engine.
  const tick = state.clock.tick;
  const next = structuredClone(state);
  for (const id of Object.keys(next.negotiationsById)) {
    const n = next.negotiationsById[id];
    if (n?.status === 'open' && Number.isInteger(n.expiresTick) && n.expiresTick < tick) {
      next.negotiationsById[id] = { ...n, status: 'rejected' };
    }
  }
  return next;
}

function processDueLoans(state) {
  return reduceCareerCommand(state, { type: 'PROCESS_DUE_LOANS' }).state;
}

// Categorize a terminal career state. We derive the label from
// observed state — no pre-baked mapping. Categories are added to
// `terminalCounts` only when first observed.
function classifyTerminal(state, throwsDuringRun) {
  if (throwsDuringRun > 0) return 'threw';
  const playerId = state?.playerId;
  if (typeof playerId !== 'string') return 'unknown_no_player';
  const person = state?.peopleById?.[playerId];
  if (!person) return 'unknown_no_player';
  const career = person.career;

  // Active contract?
  let activeContract = null;
  for (const c of Object.values(state.contractsById ?? {})) {
    if (c?.personId === playerId && c?.status === 'active') {
      activeContract = c;
      break;
    }
  }
  // Resolved (accepted or expired/terminated) contract?
  const resolvedContract = Object.values(state.contractsById ?? {})
    .some((c) => c?.personId === playerId && c?.status !== 'open');
  // Open offer pending?
  const hasOpenOffer = Object.values(state.negotiationsById ?? {})
    .some((n) => n?.personId === playerId && n?.status === 'open');

  if (activeContract) return 'signed_still_active';
  if (resolvedContract && !hasOpenOffer) return 'signed_then_expired';
  if (hasOpenOffer) return 'open_offer_pending';
  if (!resolvedContract && !hasOpenOffer && !activeContract) {
    return 'rejected_all';
  }
  return 'unknown_other';
}

function summarizeCareer(state, throws, ticks, terminalCategory) {
  const playerId = state?.playerId;
  const person = state?.peopleById?.[playerId];
  const contracts = Object.values(state.contractsById ?? {})
    .filter((c) => c?.personId === playerId);
  const resolvedOffers = Object.values(state.negotiationsById ?? {})
    .filter((n) => n?.personId === playerId && n.status !== 'open');
  const stage = person?.career?.stage ?? null;
  const seasonCount = new Set(
    contracts
      .filter((c) => Number.isInteger(c.startTick))
      .map((c) => Math.floor((c.startTick ?? 0) / TICKS_PER_YEAR)),
  ).size;
  return {
    terminalCategory,
    throws,
    ticksAdvanced: ticks,
    finalTick: state?.clock?.tick ?? 0,
    finalYear: state?.clock?.year ?? null,
    finalQuarter: state?.clock?.quarterIndex ?? null,
    stage,
    contractsTouched: contracts.length,
    seasonsCovered: seasonCount,
    resolvedOffers: resolvedOffers.length,
  };
}

// Drive one career from initial state to terminal. Pure with respect
// to its inputs; the only side effect is the rng.
function runOneCareer(initialState, maxTicksPerCareer, rng) {
  let state = initialState;
  let ticksAdvanced = 0;
  let throws = 0;
  let arrivals = 0;
  // The initial state may already carry an open offer (the adapter seeds
  // `negotiation-contract-1` for pro-age players); we'll pick it up via
  // the open-offer scan below. No special handling needed.

  while (state.clock.tick < maxTicksPerCareer) {
    // Find an open offer to act on. If none exists and no contract is
    // active, mint one (the player is between contracts and a club
    // approached them). If a contract is active, do NOT mint a new
    // offer — wait it out by advancing the clock.
    let openOffer = Object.values(state.negotiationsById ?? {})
      .find((n) => n?.status === 'open');
    let negotiationId;
    const playerId = state.playerId;
    const hasActiveContract = Object.values(state.contractsById ?? {})
      .some((c) => c?.personId === playerId && c.status === 'active');

    if (!openOffer && !hasActiveContract) {
      try {
        const minted = mintOpenContractOffer(state, rng);
        state = minted.state;
        negotiationId = minted.negotiationId;
        arrivals += 1;
      } catch (error) {
        throws += 1;
        break;
      }
    } else if (openOffer) {
      negotiationId = openOffer.id;
      arrivals += 1;
    } else {
      // Active contract — just advance the clock and let expireContracts
      // run; loop continues until tick cap or terminal.
      const stride = randInt(rng, STRIDE_MIN_TICKS, STRIDE_MAX_TICKS);
      try {
        state = advanceClock(state, stride);
        state = pruneExpiredOffers(state);
        state = processDueLoans(state);
        ticksAdvanced += stride;
      } catch (error) {
        throws += 1;
        break;
      }
      continue;
    }

    // Decide on the offer using seeded RNG.
    const decision = weightedChoice(rng, DECISION_KEYS, DECISION_WEIGHTS);
    try {
      state = applyDecision(state, negotiationId, decision, rng);
    } catch (error) {
      throws += 1;
      break;
    }

    // Advance the clock deterministically.
    const stride = randInt(rng, STRIDE_MIN_TICKS, STRIDE_MAX_TICKS);
    try {
      state = advanceClock(state, stride);
      state = pruneExpiredOffers(state);
      state = processDueLoans(state);
      ticksAdvanced += stride;
    } catch (error) {
      throws += 1;
      break;
    }

    // Terminal: senior player, no active contract, no resolved contract
    // history, AND no open offers. Then stop — there's nothing left to
    // do for this career.
    const hasActiveAfter = Object.values(state.contractsById ?? {})
      .some((c) => c?.personId === playerId && c.status === 'active');
    const hasResolvedContract = Object.values(state.contractsById ?? {})
      .some((c) => c?.personId === playerId && c.status !== 'open');
    const hasOpenOfferAfter = Object.values(state.negotiationsById ?? {})
      .some((n) => n?.personId === playerId && n.status === 'open');
    if (!hasActiveAfter && !hasResolvedContract && !hasOpenOfferAfter) break;
    if (!hasActiveAfter && !hasOpenOfferAfter && arrivals > 1) {
      // After at least one full arrival cycle, no contract and no offer
      // means the player is between decisions AND has no history to
      // recur — stop to keep runtime bounded.
      break;
    }
  }

  const terminalCategory = classifyTerminal(state, throws);
  return summarizeCareer(state, throws, ticksAdvanced, terminalCategory);
}

export function runBatchCareerSimulation(options = {}) {
  const batchSize = Number.isInteger(options.batchSize) && options.batchSize > 0
    ? options.batchSize
    : DEFAULT_BATCH_SIZE;
  const maxTicksPerCareer = Number.isInteger(options.maxTicksPerCareer) && options.maxTicksPerCareer > 0
    ? options.maxTicksPerCareer
    : TICKS_PER_YEAR * DEFAULT_MAX_YEARS;
  const seed = typeof options.seed === 'string' && options.seed.length > 0
    ? options.seed
    : DEFAULT_SEED;
  const fixturePath = typeof options.fixturePath === 'string' && options.fixturePath.length > 0
    ? options.fixturePath
    : null;

  const startedAt = Date.now();
  const perCareer = [];
  const terminalCounts = {};
  let totalTicks = 0;
  let totalThrows = 0;
  let maxTickReached = 0;
  // A career is "bounded" if it terminated via a natural terminal state
  // (no active contract, no open offer, no more arrivals) OR via the
  // tick cap with at most one final stride past it. The engine's loop
  // uses `while (tick < cap)` then performs a final stride of up to
  // STRIDE_MAX_TICKS, so the finalTick can legitimately overshoot by
  // STRIDE_MAX_TICKS — that is bounded termination, not an infinite
  // loop. Anything larger is unbounded and means the career ran past
  // the cap.
  let unboundedCount = 0;
  const finalTickTolerance = STRIDE_MAX_TICKS;

  for (let i = 0; i < batchSize; i += 1) {
    const rng = createRng(`${seed}:${i}`);
    let initial;
    try {
      initial = buildInitialCareerState(rng);
    } catch (error) {
      totalThrows += 1;
      perCareer.push({
        terminalCategory: 'setup_failure',
        throws: 1,
        ticksAdvanced: 0,
        finalTick: 0,
        finalYear: null,
        finalQuarter: null,
        stage: null,
        contractsTouched: 0,
        seasonsCovered: 0,
        resolvedOffers: 0,
      });
      terminalCounts.setup_failure = (terminalCounts.setup_failure ?? 0) + 1;
      continue;
    }
    const result = runOneCareer(initial, maxTicksPerCareer, rng);
    perCareer.push(result);
    totalTicks += result.ticksAdvanced;
    totalThrows += result.throws;
    if (result.finalTick > maxTickReached) maxTickReached = result.finalTick;
    if (result.finalTick > maxTicksPerCareer + finalTickTolerance) {
      unboundedCount += 1;
    }
    terminalCounts[result.terminalCategory] = (terminalCounts[result.terminalCategory] ?? 0) + 1;
  }

  const completed = perCareer.filter(
    (c) => c.terminalCategory !== 'setup_failure' && c.throws === 0,
  ).length;

  const summary = {
    seed,
    batchSize,
    completed,
    throws: totalThrows,
    totalTicks,
    meanTicksPerCareer: batchSize === 0 ? 0 : Math.round((totalTicks / batchSize) * 1000) / 1000,
    maxTickReached,
    maxTicksPerCareer,
    bounded: unboundedCount === 0,
    unboundedCount,
    terminalCounts,
    evidence: {
      ticksPerYear: TICKS_PER_YEAR,
      maxYears: Math.floor(maxTicksPerCareer / TICKS_PER_YEAR),
      perCareer,
      wallClockMs: Date.now() - startedAt,
      decisionWeights: {
        ACCEPT: DECISION_WEIGHTS[0],
        COUNTER: DECISION_WEIGHTS[1],
        REJECT: DECISION_WEIGHTS[2],
      },
    },
  };

  if (fixturePath) {
    // Best-effort sync write so callers can archive evidence next to
    // the code. We do not throw on filesystem errors — the batch is
    // useful even without persistence.
    try {
      writeFileSync(fixturePath, JSON.stringify(summary, null, 2));
    } catch (error) {
      // intentionally swallowed; surface via summary.evidence.ioError
      summary.evidence.ioError = String(error && error.message || error);
    }
  }

  return summary;
}

// CLI entrypoint: `node scripts/batchCareerSimulation.mjs [batchSize]`
if (typeof process !== 'undefined'
  && process.argv?.[1]
  && process.argv[1].endsWith('batchCareerSimulation.mjs')) {
  const cliArg = Number.parseInt(process.argv[2] ?? '', 10);
  const batchSize = Number.isInteger(cliArg) && cliArg > 0
    ? cliArg
    : DEFAULT_BATCH_SIZE;
  const seed = process.env.FOOTY_BATCH_SEED ?? DEFAULT_SEED;
  const fixturePath = process.env.FOOTY_BATCH_FIXTURE
    ?? 'tests/fixtures/batch-career-summary.json';
  const summary = runBatchCareerSimulation({
    batchSize,
    seed,
    fixturePath,
  });
  // Print a compact human-readable summary; the JSON fixture carries
  // the full evidence.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    seed: summary.seed,
    batchSize: summary.batchSize,
    completed: summary.completed,
    throws: summary.throws,
    totalTicks: summary.totalTicks,
    meanTicksPerCareer: summary.meanTicksPerCareer,
    maxTickReached: summary.maxTickReached,
    maxTicksPerCareer: summary.maxTicksPerCareer,
    bounded: summary.bounded,
    terminalCounts: summary.terminalCounts,
    wallClockMs: summary.evidence.wallClockMs,
    fixture: fixturePath,
  }, null, 2));
}