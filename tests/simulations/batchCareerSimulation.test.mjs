// tests/simulations/batchCareerSimulation.test.mjs
//
// RED-first batch-career simulation gate (default-skipped from `npm test`,
// opted into via `npm run test:batch`). The test imports the public
// batch harness from `scripts/batchCareerSimulation.mjs` and asserts
// the **shape** and **invariants** of the qaReviewAndBalance evidence
// gate.
//
// CONTRACT (pinned here before implementation):
//
//   1. `runBatchCareerSimulation({ batchSize, maxTicksPerCareer, seed, fixturePath })`
//      is exported from scripts/batchCareerSimulation.mjs.
//   2. Returned summary has at least:
//        { seed, batchSize, completed, throws, totalTicks,
//          meanTicksPerCareer, maxTickReached, maxTicksPerCareer,
//          bounded, unboundedCount, terminalCounts,
//          evidence: { ticksPerYear, maxYears, perCareer[], wallClockMs, decisionWeights } }
//   3. INVARIANTS — for any seed the run produces:
//        - throws === 0
//        - bounded === true
//        - unboundedCount === 0
//        - maxTickReached <= maxTicksPerCareer + STRIDE_MAX_TICKS_TOLERANCE
//        - completed === batchSize (every career terminates)
//        - sum(terminalCounts) === batchSize
//   4. Determinism: identical seed → identical summary.
//   5. Distribution bounds (loose, seed-stability checked via re-run):
//        - "signed_then_expired" + "signed_still_active" together >= 30%
//          (some body must accept offers, otherwise the harness isn't
//          exercising the contract engine — the most important seam
//          the qaReviewAndBalance gate exists to prove)
//        - "rejected_all" + "signed_then_expired" + "signed_still_active" >= 90%
//          (terminal categories cover almost every career; the
//          remaining ≤10% may be "open_offer_pending")
//        - meanTicksPerCareer >= 50 (every career makes material progress)
//        - meanTicksPerCareer <= 600 (cap = 800 ticks, plus a stride)
//   6. Performance budget: 250 careers with a small cap (≤200 ticks)
//      must complete in <5 seconds so the harness stays CI-friendly.
//
// Default-skip behavior: `npm test` runs node --test tests/*.test.mjs;
// that glob does NOT match tests/simulations/*.test.mjs, so this
// file is naturally excluded from CI. The full 1000-career run is
// available via `npm run test:batch`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runBatchCareerSimulation,
  STRIDE_MAX_TICKS,
  TICKS_PER_YEAR as HARNESS_TICKS_PER_YEAR,
} from '../../scripts/batchCareerSimulation.mjs';

const TICKS_PER_YEAR = 32;
const MAX_YEARS = 25;
const MAX_TICKS_PER_CAREER = TICKS_PER_YEAR * MAX_YEARS;
// The harness loop uses `while (tick < cap)` then performs a final
// stride of up to STRIDE_MAX_TICKS, so the maxTickReached can
// legitimately overshoot by that tolerance. Anything larger is an
// unbounded run, not normal termination. Import the constant from
// the script so this test cannot drift out of sync.
const STRIDE_MAX_TICKS_TOLERANCE = STRIDE_MAX_TICKS;
assert.equal(HARNESS_TICKS_PER_YEAR, TICKS_PER_YEAR,
  'harness TICKS_PER_YEAR must match the canonical 32 (test invariant)');

test('batch career harness exports runBatchCareerSimulation', () => {
  assert.equal(typeof runBatchCareerSimulation, 'function',
    'scripts/batchCareerSimulation.mjs must export runBatchCareerSimulation()');
});

test('batch career harness returns a well-shaped summary with no throws and bounded runs', () => {
  const SMALL_BATCH = 8;
  const summary = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-test-seed-1',
  });

  assert.equal(summary.batchSize, SMALL_BATCH,
    'summary.batchSize must reflect the requested batchSize');
  assert.equal(summary.completed, SMALL_BATCH,
    `every career must terminate; expected ${SMALL_BATCH} completed, got ${summary.completed}`);
  assert.equal(summary.throws, 0,
    `career loop must never throw; got ${summary.throws} throw(s)`);
  assert.equal(summary.bounded, true,
    'every career must finish within maxTicksPerCareer');
  assert.equal(summary.unboundedCount ?? 0, 0,
    'no career may overshoot the tick cap by more than the stride tolerance');
  assert.ok(summary.maxTickReached <= MAX_TICKS_PER_CAREER + STRIDE_MAX_TICKS_TOLERANCE,
    `max tick reached (${summary.maxTickReached}) must not exceed cap+tolerance (${MAX_TICKS_PER_CAREER + STRIDE_MAX_TICKS_TOLERANCE})`);
  assert.ok(summary.totalTicks > 0,
    'totalTicks must be > 0 — at least one tick advanced');
  assert.ok(summary.terminalCounts && typeof summary.terminalCounts === 'object',
    'terminalCounts must be a plain object');
  const totalTerminal = Object.values(summary.terminalCounts)
    .reduce((sum, n) => sum + (Number.isInteger(n) ? n : 0), 0);
  assert.equal(totalTerminal, SMALL_BATCH,
    `terminal counts must sum to batchSize (${SMALL_BATCH}), got ${totalTerminal}`);
  assert.ok(summary.evidence && typeof summary.evidence === 'object',
    'evidence object must be present');
  assert.ok(Array.isArray(summary.evidence.perCareer),
    'evidence.perCareer must be an array');
  assert.equal(summary.evidence.perCareer.length, SMALL_BATCH,
    'evidence.perCareer length must equal batchSize');
  assert.equal(summary.evidence.ticksPerYear, TICKS_PER_YEAR,
    'evidence.ticksPerYear must match canonical 32');
  assert.equal(summary.evidence.maxYears, MAX_YEARS,
    'evidence.maxYears must match 25');
  assert.ok(Number.isInteger(summary.wallClockMs) && summary.wallClockMs >= 0,
    'wallClockMs (top-level) must be a non-negative integer');
  assert.ok(summary.evidence.decisionWeights
    && typeof summary.evidence.decisionWeights === 'object'
    && summary.evidence.decisionWeights.ACCEPT > 0,
    'evidence.decisionWeights must document ACCEPT/COUNTER/REJECT probabilities');
});

test('batch career harness is deterministic for a fixed seed', () => {
  const SMALL_BATCH = 8;
  const a = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-determinism-seed',
  });
  const b = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-determinism-seed',
  });
  assert.deepEqual(a.terminalCounts, b.terminalCounts,
    'identical seeds must yield identical terminal distributions');
  assert.equal(a.totalTicks, b.totalTicks,
    'identical seeds must yield identical total tick counts');
  assert.equal(a.maxTickReached, b.maxTickReached,
    'identical seeds must yield identical max tick reached');
  assert.equal(a.completed, b.completed,
    'identical seeds must yield identical completed count');
});

test('batch career harness keeps distributions inside the documented envelope', () => {
  // A 250-career run is large enough that the terminal distribution
  // is statistically meaningful but small enough that the test stays
  // under a few seconds. Distribution bounds are LOOSE — they pin
  // shape, not exact percentages.
  const BATCH = 250;
  const summary = runBatchCareerSimulation({
    batchSize: BATCH,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-distribution-seed',
  });
  const counts = summary.terminalCounts;
  const signed = (counts.signed_then_expired ?? 0) + (counts.signed_still_active ?? 0);
  const resolvedTerminal = (counts.signed_then_expired ?? 0)
    + (counts.signed_still_active ?? 0)
    + (counts.rejected_exhausted_attempts ?? 0)
    + (counts.tick_cap_reached_no_contract ?? 0);
  assert.ok(signed / BATCH >= 0.30,
    `at least 30% of careers must reach a signed terminal (got ${signed}/${BATCH} = ${(signed/BATCH*100).toFixed(1)}%) — if not, the harness isn't exercising the contract engine`);
  assert.ok(resolvedTerminal / BATCH >= 0.90,
    `at least 90% of careers must reach a resolved terminal category (got ${resolvedTerminal}/${BATCH} = ${(resolvedTerminal/BATCH*100).toFixed(1)}%)`);
  assert.ok(summary.meanTicksPerCareer >= 50,
    `meanTicksPerCareer (${summary.meanTicksPerCareer}) must be >= 50 — every career makes material progress`);
  assert.ok(summary.meanTicksPerCareer <= 600,
    `meanTicksPerCareer (${summary.meanTicksPerCareer}) must be <= 600 — bounded by cap=800 + one stride`);
});

test('batch career harness writes evidence fixture when fixturePath is provided', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'footy-batch-fixture-'));
  const fixturePath = path.join(tmpDir, 'batch-career-summary.json');
  const summary = runBatchCareerSimulation({
    batchSize: 4,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-fixture-seed',
    fixturePath,
  });
  const stat = await fs.stat(fixturePath);
  assert.ok(stat.size > 0, 'fixture file must be non-empty');
  const written = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  assert.equal(written.batchSize, summary.batchSize,
    'persisted fixture batchSize must match returned summary');
  assert.deepEqual(written.terminalCounts, summary.terminalCounts,
    'persisted fixture terminalCounts must match returned summary');
  assert.equal(written.throws, 0,
    'persisted fixture throws must be 0');
  assert.equal(written.bounded, true,
    'persisted fixture bounded must be true');
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('batch career harness runs a 250-career batch in under 5 seconds', () => {
  const t0 = Date.now();
  const summary = runBatchCareerSimulation({
    batchSize: 250,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-perf-seed',
  });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 5000,
    `250-career batch must complete in under 5 seconds (took ${elapsed}ms)`);
  assert.equal(summary.completed, 250,
    'every career in the perf batch must terminate');
});

// ---------------------------------------------------------------------------
// Apex review CHANGES_REQUESTED — three new RED tests for the corrected
// harness. Each test pins the contract Apex's fresh Claude review required:
// honest exhausted-opportunity semantics, observable contract expiry
// before classification, and automated opt-in 1000-career assertions.
// ---------------------------------------------------------------------------

import {
  MAX_OFFER_ATTEMPTS_PER_CAREER,
} from '../../scripts/batchCareerSimulation.mjs';

test('rejected_all terminal truthfully means exhausted-opportunity (attempts cap reached, not single rejection)', () => {
  // Blocker 1 from Apex review: the old harness classified a single
  // rejection as "rejected_all" — a category name that lies about
  // career history. The corrected harness must:
  //   1. keep minting offers until the player signs OR hits
  //      MAX_OFFER_ATTEMPTS_PER_CAREER honest attempt cap, AND
  //   2. every `rejected_*` terminal category's perCareer record must
  //      show resolvedOffers >= the documented cap (or have a separate
  //      `tickCapReached` reason), so the name is grounded in evidence.
  // Seed chosen to deterministically produce ≥1 exhaustion with
  // batchSize 64 (verified empirically with the canonical seed).
  const SMALL_BATCH = 64;
  const summary = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-rejection-honesty-5',
  });
  // Pin the exported constant — a category can't claim "exhausted" if
  // the cap isn't exported for the test to bind against.
  assert.ok(Number.isInteger(MAX_OFFER_ATTEMPTS_PER_CAREER) && MAX_OFFER_ATTEMPTS_PER_CAREER >= 2,
    `MAX_OFFER_ATTEMPTS_PER_CAREER must be exported and >= 2 (got ${MAX_OFFER_ATTEMPTS_PER_CAREER})`);

  const rejectionTerminals = summary.terminalCounts.rejected_exhausted_attempts ?? 0;
  // Force at least one exhaustion so the assertion is real (this
  // seed deterministically produces exactly 1).
  assert.ok(rejectionTerminals > 0,
    `at least one career must reach the exhausted-opportunity terminal so the honesty claim is testable (got ${rejectionTerminals})`);

  // For every `rejected_exhausted_attempts` career, the perCareer record
  // must show resolvedOffers >= the documented attempts cap (the
  // category name is only honest if the player genuinely had that many
  // chances to sign).
  const exhaustedCareers = summary.evidence.perCareer.filter(
    (c) => c.terminalCategory === 'rejected_exhausted_attempts',
  );
  for (const c of exhaustedCareers) {
    assert.ok(c.resolvedOffers >= MAX_OFFER_ATTEMPTS_PER_CAREER,
      `rejected_exhausted_attempts career must have resolvedOffers (${c.resolvedOffers}) >= MAX_OFFER_ATTEMPTS_PER_CAREER (${MAX_OFFER_ATTEMPTS_PER_CAREER}); ` +
      'the category name is dishonest otherwise');
  }

  // There must NOT be any old-style `rejected_all` category left — that
  // was the dishonest name Apex's review flagged.
  assert.equal(summary.terminalCounts.rejected_all ?? 0, 0,
    'old `rejected_all` category must be removed; `rejected_exhausted_attempts` is the honest replacement');
});

test('signed_then_expired terminal has observable expired-contract evidence in perCareer record', () => {
  // Blocker 2 from Apex review: the header for signed_then_expired
  // promises a contract that "later expired without renewal". The
  // perCareer record must expose the evidence (expiredContractsTouched)
  // so a reviewer can prove the claim, not just trust the label.
  const SMALL_BATCH = 32;
  const summary = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-expiry-evidence',
  });
  const signedExpiredCareers = summary.evidence.perCareer.filter(
    (c) => c.terminalCategory === 'signed_then_expired',
  );
  // Force at least one signed_then_expired in this batch so the
  // assertion below is real, not vacuous.
  assert.ok(signedExpiredCareers.length > 0,
    `at least one career must reach signed_then_expired so the evidence claim is testable (got ${signedExpiredCareers.length})`);
  for (const c of signedExpiredCareers) {
    assert.ok(Number.isInteger(c.expiredContractsTouched) && c.expiredContractsTouched >= 1,
      `signed_then_expired career must have expiredContractsTouched >= 1 (got ${c.expiredContractsTouched}); ` +
      'the header claims the contract expired, so the perCareer record must show that expiry was observed');
  }
  // The exposed summary field must also be documented (top-level).
  assert.ok(summary.evidence.expiredContractsTouchedTotal >= signedExpiredCareers.length,
    `evidence.expiredContractsTouchedTotal (${summary.evidence.expiredContractsTouchedTotal}) must be >= number of signed_then_expired careers (${signedExpiredCareers.length})`);
});

test('qa:batch asserts throws, boundedness, and distribution at 1000 careers (npm run qa:batch exit non-zero on violation)', async () => {
  // Blocker 3 from Apex review: the qa:batch gate must assert, not just
  // print. We invoke the harness directly here (not the npm script —
  // node --test doesn't have an easy way to drive an npm alias and we
  // want this assertion to live with the batch tests). The harness
  // must expose `assertBatchInvariants(summary)` so the qa:batch CLI
  // can call it before exiting. If any invariant is violated, the
  // function must throw so the CLI exits non-zero.
  const {
    assertBatchInvariants,
  } = await import('../../scripts/batchCareerSimulation.mjs');
  assert.equal(typeof assertBatchInvariants, 'function',
    'scripts/batchCareerSimulation.mjs must export assertBatchInvariants() so the qa:batch CLI can exit non-zero on violations');
  // Run a 250-career batch (1000 is too slow for the test runner);
  // assertBatchInvariants should accept any non-trivial batch.
  const summary = runBatchCareerSimulation({
    batchSize: 250,
    maxTicksPerCareer: MAX_TICKS_PER_CAREER,
    seed: 'qa-batch-invariants',
  });
  // The good case: should not throw.
  assertBatchInvariants(summary);
  // The bad case: fabricate a violation and assert it throws.
  const violated = {
    ...summary,
    throws: 1, // violates the throws === 0 invariant
  };
  assert.throws(
    () => assertBatchInvariants(violated),
    /throws/,
    'assertBatchInvariants must throw on throws > 0',
  );
  const violatedBounded = {
    ...summary,
    bounded: false,
    unboundedCount: 3,
  };
  assert.throws(
    () => assertBatchInvariants(violatedBounded),
    /bounded|unboundedCount/,
    'assertBatchInvariants must throw on bounded === false',
  );
});