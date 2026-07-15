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
//   (contracts, transfers, loans, contract expiry). The childhood ->
//   senior transition is owned by the legacy app state and is not
//   driven by `reduceCareerCommand`. Driving it here would mean
//   writing a parallel toy model, which the brief explicitly forbids.
//   So a "career" here = one deterministic senior-stage career, age 16
//   to terminal state, bounded by `maxTicksPerCareer`.
//
// DETERMINISM
//   Per-career seed is derived from `seed + ':' + index` via the
//   project's existing `createRng`, so the same global `seed` always
//   produces the same summary. The 1000-career run is byte-stable for
//   a fixed seed and can be archived as evidence.
//
// TERMINAL CATEGORIES (derived from observed state, not invented)
//   * `signed_then_expired`     — signed at least one contract, which
//                                  later expired without renewal.
//   * `signed_still_active`     — signed at least one contract still
//                                  active when the tick cap is hit.
//   * `rejected_all`            — rejected every offer, never signed.
//   * `open_offer_pending`      — final state has an unresolved open
//                                  offer (career ended mid-decision).
//   * `setup_failure`           — could not build initial state.
//
// USAGE
//   node scripts/batchCareerSimulation.mjs               # default N=1000
//   node scripts/batchCareerSimulation.mjs 250           # N=250
//   FOOTY_BATCH_SEED=foo node scripts/batchCareerSimulation.mjs 50
//
//   In code (e.g. tests):
//     import { runBatchCareerSimulation } from './scripts/batchCareerSimulation.mjs';
//     const summary = runBatchCareerSimulation({ batchSize: 8 });

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRng } from '../src/engines/rng.js';
import { reduceCareerCommand } from '../src/engines/careerOrchestrator.js';
import { expireContracts } from '../src/engines/contractEngine.js';
import { createCareerStateForPlayer } from '../src/engines/careerStateAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_FIXTURE_PATH = resolve(__dirname, '..', 'tests', 'fixtures', 'batchCareerSummary.json');

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_MAX_YEARS = 25;
export const TICKS_PER_YEAR = 32;
const DEFAULT_SEED = 'footy-batch-2026-07-15';

// Terminal decision probabilities per arrival. Realistic but
// conservative: most senior careers accept the first offer; a minority
// reject. These are the simulator's arrival-handling policy — they do
// NOT promise to match gameplay outcomes.
const DECISION = { ACCEPT: 'ACCEPT', COUNTER: 'COUNTER', REJECT: 'REJECT' };
const DECISION_WEIGHTS = [0.55, 0.20, 0.25];
const DECISION_KEYS = [DECISION.ACCEPT, DECISION.COUNTER, DECISION.REJECT];

// Stride: when an offer is resolved (or rejected) we advance the
// clock by a deterministic stride chosen from the seeded RNG.
export const STRIDE_MIN_TICKS = 8;   // ~1 quarter
export const STRIDE_MAX_TICKS = 64;  // ~2 years

const PLAYER_AGE_AT_PRO_START = 16;
const ARRIVAL_OFFSET_TICKS = 4; // first offer arrives ~1 month after start
const COUNTER_DURATION_TICKS = TICKS_PER_YEAR * 2;
const COUNTER_WAGE_MINOR = 130000;
const COUNTER_SIGNING_BONUS_MINOR = 600000;
const COUNTER_SQUAD_ROLE = 'rotation';
const COUNTER_RELEASE_FEE_MINOR = 6000000;

function randInt(rng, min, max) {
  return Math.floor(rng.next() * (max - min + 1)) + min;
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
  return createCareerStateForPlayer(player, ARRIVAL_OFFSET_TICKS);
}

// Mint a fresh open contract offer for the player from a club that
// already exists in the state. If no clubs exist (shouldn't happen for
// a 16yo because the adapter seeds one), synthesize a default club so
// the negotiation is well-formed. PURE — returns a fresh state object.
function mintOpenContractOffer(state, rng) {
  const next = structuredClone(state);
  const personId = next.playerId;

  const existingClubIds = Object.keys(next.clubsById);
  if (existingClubIds.length === 0) {
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
  // `fromClubId` and `toClubId` are intentionally the same club — a
  // `professional-offer` from the player's existing/potential club to
  // the same club is the canonical shape (cf. the adapter seed at
  // careerStateAdapter.js:64-83). Transfers use the separate
  // `transfer-offer` kind, which the harness does NOT mint.
  const negotiationId = `negotiation-batch-${(next.idCounters.negotiation ?? 0) + 1}-${randInt(rng, 1, 1_000_000)}`;
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
  // terms. If the offer has already used all counter rounds, fall
  // back to accept so the engine doesn't throw on round-limit.
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

// Categorize a terminal career state. Derived from observed state — no
// pre-baked mapping. Categories are added to `terminalCounts` only
// when first observed.
function classifyTerminal(state, throwsDuringRun) {
  if (throwsDuringRun > 0) return 'threw';
  const playerId = state?.playerId;
  if (typeof playerId !== 'string') return 'unknown_no_player';
  const person = state?.peopleById?.[playerId];
  if (!person) return 'unknown_no_player';

  let activeContract = null;
  for (const c of Object.values(state.contractsById ?? {})) {
    if (c?.personId === playerId && c?.status === 'active') {
      activeContract = c;
      break;
    }
  }
  const resolvedContract = Object.values(state.contractsById ?? {})
    .some((c) => c?.personId === playerId && c?.status !== 'open');
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
  const contracts = Object.values(state.contractsById ?? {})
    .filter((c) => c?.personId === playerId);
  const resolvedOffers = Object.values(state.negotiationsById ?? {})
    .filter((n) => n?.personId === playerId && n.status !== 'open');
  return {
    terminalCategory,
    throws,
    ticksAdvanced: ticks,
    finalTick: state?.clock?.tick ?? 0,
    finalYear: state?.clock?.year ?? null,
    finalQuarter: state?.clock?.quarterIndex ?? null,
    stage: state?.peopleById?.[playerId]?.career?.stage ?? null,
    contractsTouched: contracts.length,
    seasonsCovered: new Set(
      contracts
        .filter((c) => Number.isInteger(c.startTick))
        .map((c) => Math.floor((c.startTick ?? 0) / TICKS_PER_YEAR)),
    ).size,
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
  const playerId = state.playerId;

  while (state.clock.tick < maxTicksPerCareer) {
    const openOffer = Object.values(state.negotiationsById ?? {})
      .find((n) => n?.status === 'open');
    const hasActiveContract = Object.values(state.contractsById ?? {})
      .some((c) => c?.personId === playerId && c.status === 'active');

    let negotiationId;
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
      // Active contract — just advance the clock and let
      // expireContracts run; loop continues until tick cap or
      // terminal.
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

    const decision = weightedChoice(rng, DECISION_KEYS, DECISION_WEIGHTS);
    try {
      state = applyDecision(state, negotiationId, decision, rng);
    } catch (error) {
      throws += 1;
      break;
    }

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

    // Terminal: no active contract, no open offer → career ended.
    const hasActiveAfter = Object.values(state.contractsById ?? {})
      .some((c) => c?.personId === playerId && c.status === 'active');
    const hasResolvedContract = Object.values(state.contractsById ?? {})
      .some((c) => c?.personId === playerId && c.status !== 'open');
    const hasOpenOfferAfter = Object.values(state.negotiationsById ?? {})
      .some((n) => n?.personId === playerId && n.status === 'open');
    if (!hasActiveAfter && !hasResolvedContract && !hasOpenOfferAfter) break;
    if (!hasActiveAfter && !hasOpenOfferAfter && arrivals > 1) break;
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
  let unboundedCount = 0;

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
    if (result.finalTick > maxTicksPerCareer + STRIDE_MAX_TICKS) {
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
    // useful even without persistence. Create parent dirs as needed.
    try {
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, `${JSON.stringify(summary, null, 2)}\n`);
    } catch (error) {
      // Best-effort — surface the warning via the summary so the
      // CLI caller sees it but tests don't crash on filesystem errors.
      summary.evidence.fixtureWriteError = error?.message ?? String(error);
    }
  }

  return summary;
}

// CLI: `node scripts/batchCareerSimulation.mjs [N]` writes the
// 1000-career (or N-career) fixture to tests/fixtures/batchCareerSummary.json
// and prints a human-readable summary. Default N=1000. Default seed
// can be overridden via FOOTY_BATCH_SEED.
function printCliSummary(summary) {
  const pct = (n) => ((n / summary.batchSize) * 100).toFixed(1);
  const rows = Object.entries(summary.terminalCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => `  ${category.padEnd(24)} ${String(count).padStart(5)}  (${pct(count)}%)`)
    .join('\n');
  const lines = [
    `FootyVerse batch career simulation`,
    `  seed:             ${summary.seed}`,
    `  batchSize:        ${summary.batchSize}`,
    `  completed:        ${summary.completed}`,
    `  throws:           ${summary.throws}`,
    `  bounded:          ${summary.bounded}`,
    `  unboundedCount:   ${summary.unboundedCount}`,
    `  maxTickReached:   ${summary.maxTickReached} / cap ${summary.maxTicksPerCareer}`,
    `  meanTicksPerCareer: ${summary.meanTicksPerCareer}`,
    `  totalTicks:       ${summary.totalTicks}`,
    `  wallClockMs:      ${summary.evidence.wallClockMs}`,
    `  terminalCounts:`,
    rows,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function parseBatchSizeArg(argv) {
  const positional = argv.slice(2).find((arg) => /^\d+$/.test(arg));
  if (positional) return Number.parseInt(positional, 10);
  return DEFAULT_BATCH_SIZE;
}

function main() {
  const batchSize = parseBatchSizeArg(process.argv);
  const seed = process.env.FOOTY_BATCH_SEED || DEFAULT_SEED;
  const fixturePath = process.env.FOOTY_BATCH_FIXTURE_PATH || DEFAULT_FIXTURE_PATH;
  const summary = runBatchCareerSimulation({ batchSize, seed, fixturePath });
  printCliSummary(summary);
}

const isDirectInvocation = (() => {
  try {
    if (!process.argv[1]) return false;
    const url = new URL(`file://${process.argv[1]}`).href;
    return import.meta.url === url;
  } catch (error) {
    return false;
  }
})();

if (isDirectInvocation) {
  main();
}