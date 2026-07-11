// Match engine: deterministic match plan generation from selected lineups.
// DOM-independent, pure — does not mutate input.

import { scopedRng } from './scopedRng.js';

const INCIDENT_COUNT = 10;
const INCIDENT_TYPE = 'chance';
const FIRST_MINUTE = 1;
const LAST_MINUTE = 90;

function lineupPersonIds(lineup) {
  return lineup.map((entry) => entry.personId).filter(Boolean);
}

export function createMatchPlan(gameSeed, fixture, homeLineup, awayLineup) {
  const rng = scopedRng(gameSeed, 'fixture', fixture.id);
  const homePersonIds = lineupPersonIds(homeLineup);
  const awayPersonIds = lineupPersonIds(awayLineup);

  const incidents = [];
  for (let i = 0; i < INCIDENT_COUNT; i++) {
    const teamId = rng.pick([fixture.homeTeamId, fixture.awayTeamId]);
    const personId = rng.pick(teamId === fixture.homeTeamId ? homePersonIds : awayPersonIds);
    incidents.push(Object.freeze({
      minute: rng.int(FIRST_MINUTE, LAST_MINUTE),
      teamId,
      personId,
      type: INCIDENT_TYPE,
    }));
  }

  return Object.freeze({
    fixtureId: fixture.id,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    incidents: Object.freeze(incidents),
  });
}

const BASE_RATING_X100 = 600;
const GOAL_RATING_BONUS_X100 = 80;
const MIN_RATING_X100 = 100;
const MAX_RATING_X100 = 1000;
const MINUTES_PLAYED = 90;
const AI_SHOT_CHANCE = 0.3;
const DECISION_SHOT_CHANCE = { shoot: 0.6, pass: 0.15 };

function clampRating(ratingX100) {
  return Math.min(MAX_RATING_X100, Math.max(MIN_RATING_X100, ratingX100));
}

function buildInitialPerformances(homeLineup, awayLineup, homeTeamId, awayTeamId) {
  const performances = new Map();
  for (const [lineup, teamId] of [[homeLineup, homeTeamId], [awayLineup, awayTeamId]]) {
    for (const entry of lineup) {
      if (!entry.personId) continue;
      performances.set(entry.personId, {
        personId: entry.personId,
        teamId,
        started: true,
        positionId: entry.slot,
        minutes: MINUTES_PLAYED,
        goals: 0,
      });
    }
  }
  return performances;
}

export function resolveMatchPlan(gameSeed, matchPlan, homeLineup, awayLineup, decisions = {}) {
  const rng = scopedRng(gameSeed, 'resolve', matchPlan.fixtureId);
  const performances = buildInitialPerformances(homeLineup, awayLineup, matchPlan.homeTeamId, matchPlan.awayTeamId);
  const score = { home: 0, away: 0 };

  matchPlan.incidents.forEach((incident, index) => {
    const decision = decisions[index];
    const shotChance = decision !== undefined && DECISION_SHOT_CHANCE[decision] !== undefined
      ? DECISION_SHOT_CHANCE[decision]
      : AI_SHOT_CHANCE;
    const isGoal = rng.chance(shotChance);
    if (!isGoal) return;

    if (incident.teamId === matchPlan.homeTeamId) score.home += 1;
    else score.away += 1;

    const performance = performances.get(incident.personId);
    if (performance) performance.goals += 1;
  });

  const result = score.home === score.away ? 'draw' : score.home > score.away ? 'home' : 'away';

  const playerPerformances = Object.freeze(
    Array.from(performances.values()).map((performance) => Object.freeze({
      ...performance,
      ratingX100: clampRating(BASE_RATING_X100 + performance.goals * GOAL_RATING_BONUS_X100),
    })),
  );

  return Object.freeze({
    fixtureId: matchPlan.fixtureId,
    homeTeamId: matchPlan.homeTeamId,
    awayTeamId: matchPlan.awayTeamId,
    score: Object.freeze(score),
    result,
    playerPerformances,
  });
}

const COUNTED_PERFORMANCE_FIELDS = [
  'minutes', 'goals', 'assists', 'cleanSheets', 'yellowCards', 'redCards',
];

function addPerformanceTotals(totals, performance) {
  const next = { ...totals };
  next.appearances = (totals.appearances ?? 0) + 1;
  next.starts = (totals.starts ?? 0) + (performance.started ? 1 : 0);
  for (const field of COUNTED_PERFORMANCE_FIELDS) {
    next[field] = (totals[field] ?? 0) + (performance[field] ?? 0);
  }
  return next;
}

export function applyMatchResult(state, matchResult) {
  const fixture = state.fixturesById?.[matchResult.fixtureId];
  if (!fixture) throw new Error(`Unknown fixture: ${matchResult.fixtureId}`);
  if (fixture.status === 'played') throw new Error(`Fixture already played: ${matchResult.fixtureId}`);

  for (const performance of matchResult.playerPerformances) {
    const person = state.peopleById?.[performance.personId];
    const careerTotals = person?.careerTotals;
    if ((careerTotals?.appearances ?? 0) > 0 && careerTotals.ratingTotalX100 === undefined) {
      throw new Error(`Missing exact career rating total for person: ${performance.personId}`);
    }
    const seasonTotals = person?.seasonStatsBySeasonId?.[fixture.seasonId];
    if ((seasonTotals?.appearances ?? 0) > 0 && seasonTotals.ratingTotalX100 === undefined) {
      throw new Error(`Missing exact season rating total for person: ${performance.personId}`);
    }
  }

  const next = structuredClone(state);
  next.fixturesById[matchResult.fixtureId] = {
    ...next.fixturesById[matchResult.fixtureId],
    status: 'played',
    score: { ...matchResult.score },
    result: matchResult.result,
    playerPerformances: structuredClone(matchResult.playerPerformances),
  };

  for (const performance of matchResult.playerPerformances) {
    const person = next.peopleById?.[performance.personId];
    if (!person) throw new Error(`Unknown person: ${performance.personId}`);

    const seasonId = fixture.seasonId;
    person.seasonStatsBySeasonId ??= {};
    const previousSeason = person.seasonStatsBySeasonId[seasonId] ?? {};
    person.seasonStatsBySeasonId[seasonId] = {
      ...addPerformanceTotals(previousSeason, performance),
      ratingTotalX100: (previousSeason.ratingTotalX100 ?? 0) + performance.ratingX100,
    };

    const previousCareer = person.careerTotals ?? {};
    const career = addPerformanceTotals(previousCareer, performance);
    const ratingTotal = (previousCareer.ratingTotalX100 ?? 0) + performance.ratingX100;
    career.ratingTotalX100 = ratingTotal;
    career.averageRatingX100 = Math.round(ratingTotal / career.appearances);
    person.careerTotals = career;
  }

  return next;
}
