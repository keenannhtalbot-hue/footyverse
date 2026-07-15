// Batch-career simulation gate (opt-in).
//
// RED: this test exists to lock in the **shape** of the batch-career
// evidence gate. It imports the public batch harness from
// `scripts/batchCareerSimulation.mjs` and asserts the harness:
//
//   1. exists and exports `runBatchCareerSimulation({ batchSize, maxTicksPerCareer, seed })`
//   2. returns a summary object with at least:
//        { batchSize, completed, totalTicks, throws, terminalCounts,
//          maxTickReached, bounded, evidence }
//   3. never throws (throws === 0)
//   4. is bounded — every career terminates within `maxTicksPerCareer`
//   5. runs deterministically for a fixed seed (same summary on repeat)
//
// The test itself uses a small batch (default 8) so the test stays
// fast and deterministic. The "real" ~1000-career run is opt-in via
// `npm run qa:batch` (which calls the same harness with a larger
// batchSize and writes evidence to `tests/fixtures/batch-career-summary.json`).
//
// What this test is NOT:
//   * It is not the full 1000-career gate — that's `npm run qa:batch`.
//   * It is not a stub: it imports the **real** batch driver, which in
//     turn drives the real `reduceCareerCommand` + `expireContracts`
//     seam (the same engines used by the player-facing contracts UI).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runBatchCareerSimulation,
} from '../../scripts/batchCareerSimulation.mjs';

const SMALL_BATCH = 8;
const TICKS_PER_YEAR = 32;
const MAX_YEARS = 25;

test('batch career harness exports runBatchCareerSimulation', () => {
  assert.equal(typeof runBatchCareerSimulation, 'function',
    'batchCareerSimulation.mjs must export runBatchCareerSimulation()');
});

test('batch career harness returns a well-shaped summary with no throws and bounded runs', () => {
  const summary = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: TICKS_PER_YEAR * MAX_YEARS,
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
  assert.ok(summary.totalTicks > 0,
    'totalTicks must be > 0 — at least one tick advanced');
  // The harness's main loop uses `while (tick < cap)` then performs a
  // final stride of up to STRIDE_MAX_TICKS (64) ticks, so the
  // maxTickReached can legitimately overshoot by that tolerance. This
  // is bounded termination, not an infinite loop.
  const TICK_OVERSHOOT_TOLERANCE = 64;
  assert.ok(summary.maxTickReached <= TICKS_PER_YEAR * MAX_YEARS + TICK_OVERSHOOT_TOLERANCE,
    `max tick reached (${summary.maxTickReached}) must not exceed cap+tolerance (${TICKS_PER_YEAR * MAX_YEARS + TICK_OVERSHOOT_TOLERANCE})`);
  assert.equal(summary.unboundedCount ?? 0, 0,
    'no career may overshoot the tick cap by more than the stride tolerance');
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
});

test('batch career harness is deterministic for a fixed seed', () => {
  const a = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: TICKS_PER_YEAR * MAX_YEARS,
    seed: 'qa-batch-determinism-seed',
  });
  const b = runBatchCareerSimulation({
    batchSize: SMALL_BATCH,
    maxTicksPerCareer: TICKS_PER_YEAR * MAX_YEARS,
    seed: 'qa-batch-determinism-seed',
  });
  assert.deepEqual(a.terminalCounts, b.terminalCounts,
    'identical seeds must yield identical terminal distributions');
  assert.equal(a.totalTicks, b.totalTicks,
    'identical seeds must yield identical total tick counts');
  assert.equal(a.maxTickReached, b.maxTickReached,
    'identical seeds must yield identical max tick reached');
});

test('batch career harness writes evidence fixture to tests/fixtures/', async () => {
  // Smoke that the harness can also be asked to persist evidence to disk.
  // Use an isolated fixture path under a fresh temp dir so we don't
  // pollute the canonical fixture file.
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'footy-batch-'));
  const fixturePath = path.join(tmpDir, 'batch-career-summary.json');
  const summary = runBatchCareerSimulation({
    batchSize: 4,
    maxTicksPerCareer: TICKS_PER_YEAR * MAX_YEARS,
    seed: 'qa-batch-fixture-seed',
    fixturePath,
  });
  // Either the harness wrote the fixture, or it documented that it
  // skipped (only when fixturePath is falsy). Here we passed a path
  // so it must exist.
  const stat = await fs.stat(fixturePath);
  assert.ok(stat.size > 0, 'fixture file must be non-empty');
  const written = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  assert.equal(written.batchSize, summary.batchSize,
    'persisted fixture batchSize must match returned summary');
  assert.deepEqual(written.terminalCounts, summary.terminalCounts,
    'persisted fixture terminalCounts must match returned summary');
  await fs.rm(tmpDir, { recursive: true, force: true });
});