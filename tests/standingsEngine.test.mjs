import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initStandings, applyFixtureResult, rankStandings, getChampion } from '../src/engines/standingsEngine.js';

test('initStandings creates a zeroed standings entry for each team id', () => {
  const state = initStandings(['team-a', 'team-b', 'team-c']);
  assert.deepEqual(state.standingsByTeamId, {
    'team-a': { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] },
    'team-b': { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] },
    'team-c': { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] },
  });
});

test('applyFixtureResult applies an explicit played fixture score without mutating the input state', () => {
  const state = initStandings(['team-a', 'team-b']);
  const before = JSON.parse(JSON.stringify(state));
  const fixture = { id: 'fixture-1', homeTeamId: 'team-a', awayTeamId: 'team-b', score: { home: 2, away: 1 } };

  const next = applyFixtureResult(state, fixture);

  assert.deepEqual(state, before, 'input state must not be mutated');
  assert.notEqual(next, state);
  assert.equal(next.standingsByTeamId['team-a'].played, 1);
  assert.equal(next.standingsByTeamId['team-b'].played, 1);
});

test('applyFixtureResult updates played/won/drawn/lost/goalsFor/goalsAgainst/points/form for a decisive result', () => {
  const state = initStandings(['team-a', 'team-b']);
  const fixture = { id: 'fixture-1', homeTeamId: 'team-a', awayTeamId: 'team-b', score: { home: 2, away: 1 } };

  const next = applyFixtureResult(state, fixture);

  assert.deepEqual(next.standingsByTeamId['team-a'], {
    played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, points: 3, form: ['W'],
  });
  assert.deepEqual(next.standingsByTeamId['team-b'], {
    played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 0, form: ['L'],
  });
});

test('applyFixtureResult updates both teams for a drawn result', () => {
  const state = initStandings(['team-a', 'team-b']);
  const fixture = { id: 'fixture-1', homeTeamId: 'team-a', awayTeamId: 'team-b', score: { home: 1, away: 1 } };

  const next = applyFixtureResult(state, fixture);

  assert.deepEqual(next.standingsByTeamId['team-a'], {
    played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1, form: ['D'],
  });
  assert.deepEqual(next.standingsByTeamId['team-b'], {
    played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1, form: ['D'],
  });
});

test('applyFixtureResult rejects replaying an already-played fixture', () => {
  const state = initStandings(['team-a', 'team-b']);
  const fixture = { id: 'fixture-1', homeTeamId: 'team-a', awayTeamId: 'team-b', score: { home: 2, away: 1 } };
  const next = applyFixtureResult(state, fixture);

  assert.throws(() => applyFixtureResult(next, fixture), /fixture-1/i);
});

test('rankStandings orders teams by points, goalDifference, goalsFor, wins, then teamId', () => {
  const standingsByTeamId = {
    'team-o': { played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 7, goalsAgainst: 2, points: 10, form: [] },
    'team-n': { played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 8, goalsAgainst: 5, points: 10, form: [] },
    'team-a': { played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 6, goalsAgainst: 3, points: 10, form: [] },
    'team-b': { played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 6, goalsAgainst: 3, points: 10, form: [] },
    'team-m': { played: 6, won: 2, drawn: 4, lost: 0, goalsFor: 6, goalsAgainst: 3, points: 10, form: [] },
    'team-p': { played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 2, points: 4, form: [] },
  };

  const ranked = rankStandings(standingsByTeamId, ['points', 'goalDifference', 'goalsFor', 'wins', 'teamId']);

  assert.deepEqual(ranked, ['team-o', 'team-n', 'team-a', 'team-b', 'team-m', 'team-p']);
});

test('getChampion only identifies a champion once the season status is complete', () => {
  const standingsByTeamId = {
    'team-a': { played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 7, goalsAgainst: 2, points: 10, form: [] },
    'team-b': { played: 4, won: 2, drawn: 1, lost: 1, goalsFor: 5, goalsAgainst: 4, points: 7, form: [] },
  };
  const tiebreakers = ['points', 'goalDifference', 'goalsFor', 'wins', 'teamId'];

  assert.equal(getChampion(standingsByTeamId, 'active', tiebreakers), null);
  assert.equal(getChampion(standingsByTeamId, 'complete', tiebreakers), 'team-a');
});
