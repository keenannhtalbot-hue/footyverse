import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMatchResult, createMatchPlan, resolveMatchPlan } from '../src/engines/matchEngine.js';

function makeFixture(overrides = {}) {
  return {
    id: 'fixture-2039-0001',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    ...overrides,
  };
}

test('createMatchPlan produces the same deterministic incidents for the same seed, fixture, and lineups without mutating inputs', () => {
  const fixture = makeFixture();
  const homeLineup = [{ slot: 'ST', personId: 'p-home-1' }, { slot: 'GK', personId: 'p-home-2' }];
  const awayLineup = [{ slot: 'ST', personId: 'p-away-1' }, { slot: 'GK', personId: 'p-away-2' }];
  const homeLineupCopy = structuredClone(homeLineup);
  const awayLineupCopy = structuredClone(awayLineup);

  const planA = createMatchPlan(12345, fixture, homeLineup, awayLineup);
  const planB = createMatchPlan(12345, fixture, homeLineup, awayLineup);

  assert.deepEqual(planA, planB);
  assert.ok(planA.incidents.length > 0);
  assert.deepEqual(homeLineup, homeLineupCopy);
  assert.deepEqual(awayLineup, awayLineupCopy);
  assert.ok(Object.isFrozen(planA));
  assert.ok(Object.isFrozen(planA.incidents));
});

test('resolveMatchPlan resolves the same plan and decisions to a byte-equivalent immutable result bundle with a score and per-player performances, without mutating plan or decisions', () => {
  const fixture = makeFixture();
  const homeLineup = [{ slot: 'ST', personId: 'p-home-1' }, { slot: 'GK', personId: 'p-home-2' }];
  const awayLineup = [{ slot: 'ST', personId: 'p-away-1' }, { slot: 'GK', personId: 'p-away-2' }];
  const plan = createMatchPlan(12345, fixture, homeLineup, awayLineup);
  const planCopy = structuredClone(plan);
  const decisions = { 0: 'shoot', 2: 'pass' };
  const decisionsCopy = structuredClone(decisions);

  const resultA = resolveMatchPlan(12345, plan, homeLineup, awayLineup, decisions);
  const resultB = resolveMatchPlan(12345, plan, homeLineup, awayLineup, decisions);

  assert.deepEqual(resultA, resultB);
  assert.equal(JSON.stringify(resultA), JSON.stringify(resultB));
  assert.deepEqual(plan, planCopy);
  assert.deepEqual(decisions, decisionsCopy);

  assert.equal(typeof resultA.score.home, 'number');
  assert.equal(typeof resultA.score.away, 'number');
  assert.ok(resultA.playerPerformances.length > 0);
  for (const performance of resultA.playerPerformances) {
    assert.ok(Number.isInteger(performance.ratingX100));
    assert.ok(performance.ratingX100 >= 100 && performance.ratingX100 <= 1000);
  }
  assert.ok(Object.isFrozen(resultA));
  assert.ok(Object.isFrozen(resultA.score));
  assert.ok(Object.isFrozen(resultA.playerPerformances));
  assert.ok(Object.isFrozen(resultA.playerPerformances[0]));
});

test('applyMatchResult records a played fixture and updates season and career totals exactly once', () => {
  const state = {
    fixturesById: {
      'fixture-2039-0001': {
        ...makeFixture(),
        seasonId: 'season-2039',
        status: 'scheduled',
        score: null,
        result: null,
        playerPerformances: [],
      },
    },
    peopleById: {
      'p-home-1': {
        seasonStatsBySeasonId: {},
        careerTotals: {
          appearances: 0, starts: 0, minutes: 0, goals: 0,
          assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0,
          averageRatingX100: 0,
        },
      },
    },
  };
  const result = {
    fixtureId: 'fixture-2039-0001',
    score: { home: 2, away: 1 },
    result: 'home',
    playerPerformances: [{
      personId: 'p-home-1', teamId: 'team-home', started: true, positionId: 'ST',
      minutes: 90, goals: 2, assists: 0, cleanSheets: 0, yellowCards: 0,
      redCards: 0, ratingX100: 780,
    }],
  };
  const original = structuredClone(state);

  const next = applyMatchResult(state, result);

  assert.deepEqual(state, original);
  assert.equal(next.fixturesById[result.fixtureId].status, 'played');
  assert.deepEqual(next.fixturesById[result.fixtureId].score, result.score);
  assert.deepEqual(next.peopleById['p-home-1'].seasonStatsBySeasonId['season-2039'], {
    appearances: 1, starts: 1, minutes: 90, goals: 2, assists: 0,
    cleanSheets: 0, yellowCards: 0, redCards: 0, ratingTotalX100: 780,
  });
  assert.deepEqual(next.peopleById['p-home-1'].careerTotals, {
    appearances: 1, starts: 1, minutes: 90, goals: 2, assists: 0,
    cleanSheets: 0, yellowCards: 0, redCards: 0,
    averageRatingX100: 780, ratingTotalX100: 780,
  });
  assert.throws(() => applyMatchResult(next, result), /already played/i);
});

test('applyMatchResult initializes stat containers for a migrated person without career counters', () => {
  const state = {
    fixturesById: {
      'fixture-2039-0001': {
        ...makeFixture(), seasonId: 'season-2039', status: 'scheduled',
        score: null, result: null, playerPerformances: [],
      },
    },
    peopleById: { 'p-home-1': { id: 'p-home-1', kind: 'npc' } },
  };
  const result = {
    fixtureId: 'fixture-2039-0001', score: { home: 0, away: 0 }, result: 'draw',
    playerPerformances: [{
      personId: 'p-home-1', teamId: 'team-home', started: false, positionId: 'ST',
      minutes: 20, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0,
      redCards: 0, ratingX100: 625,
    }],
  };

  const next = applyMatchResult(state, result);

  assert.equal(next.peopleById['p-home-1'].careerTotals.appearances, 1);
  assert.equal(next.peopleById['p-home-1'].careerTotals.averageRatingX100, 625);
  assert.equal(next.peopleById['p-home-1'].seasonStatsBySeasonId['season-2039'].minutes, 20);
});

test('applyMatchResult derives career average from an exact running rating total', () => {
  const state = {
    fixturesById: {
      'fixture-2039-0002': {
        ...makeFixture({ id: 'fixture-2039-0002' }), seasonId: 'season-2039',
        status: 'scheduled', score: null, result: null, playerPerformances: [],
      },
    },
    peopleById: {
      'p-home-1': {
        seasonStatsBySeasonId: {},
        careerTotals: {
          appearances: 2, starts: 2, minutes: 180, goals: 0, assists: 0,
          cleanSheets: 0, yellowCards: 0, redCards: 0,
          ratingTotalX100: 1201, averageRatingX100: 601,
        },
      },
    },
  };
  const result = {
    fixtureId: 'fixture-2039-0002', score: { home: 0, away: 0 }, result: 'draw',
    playerPerformances: [{
      personId: 'p-home-1', teamId: 'team-home', started: true, positionId: 'ST',
      minutes: 90, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0,
      redCards: 0, ratingX100: 600,
    }],
  };

  const next = applyMatchResult(state, result);

  assert.equal(next.peopleById['p-home-1'].careerTotals.ratingTotalX100, 1801);
  assert.equal(next.peopleById['p-home-1'].careerTotals.averageRatingX100, 600);
});

test('applyMatchResult rejects lossy legacy career averages that lack an exact rating total', () => {
  const state = {
    fixturesById: {
      'fixture-2039-0002': {
        ...makeFixture({ id: 'fixture-2039-0002' }), seasonId: 'season-2039',
        status: 'scheduled', score: null, result: null, playerPerformances: [],
      },
    },
    peopleById: {
      'p-home-1': {
        seasonStatsBySeasonId: {},
        careerTotals: { appearances: 2, averageRatingX100: 701 },
      },
    },
  };
  const result = {
    fixtureId: 'fixture-2039-0002', score: { home: 0, away: 0 }, result: 'draw',
    playerPerformances: [{ personId: 'p-home-1', ratingX100: 600 }],
  };

  assert.throws(() => applyMatchResult(state, result), /exact career rating total/i);
});

test('applyMatchResult rejects lossy legacy season counters that lack an exact rating total', () => {
  const state = {
    fixturesById: {
      'fixture-2039-0002': {
        ...makeFixture({ id: 'fixture-2039-0002' }), seasonId: 'season-2039',
        status: 'scheduled', score: null, result: null, playerPerformances: [],
      },
    },
    peopleById: {
      'p-home-1': {
        seasonStatsBySeasonId: { 'season-2039': { appearances: 2 } },
        careerTotals: { appearances: 0, ratingTotalX100: 0, averageRatingX100: 0 },
      },
    },
  };
  const result = {
    fixtureId: 'fixture-2039-0002', score: { home: 0, away: 0 }, result: 'draw',
    playerPerformances: [{ personId: 'p-home-1', ratingX100: 600 }],
  };

  assert.throws(() => applyMatchResult(state, result), /exact season rating total/i);
});
