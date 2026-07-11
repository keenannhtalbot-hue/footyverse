// Standings engine: deterministic league table state and ranking.
// DOM-independent, pure.

export function initStandings(teamIds) {
  const standingsByTeamId = {};
  for (const teamId of teamIds) {
    standingsByTeamId[teamId] = {
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0, form: [],
    };
  }
  return { standingsByTeamId, playedFixtureIds: [] };
}

export function applyFixtureResult(state, fixture) {
  const { id, homeTeamId, awayTeamId, score } = fixture;
  if (state.playedFixtureIds.includes(id)) {
    throw new Error(`Fixture already played: ${id}`);
  }
  const standingsByTeamId = { ...state.standingsByTeamId };
  standingsByTeamId[homeTeamId] = updateTeamStanding(standingsByTeamId[homeTeamId], score.home, score.away);
  standingsByTeamId[awayTeamId] = updateTeamStanding(standingsByTeamId[awayTeamId], score.away, score.home);
  return { standingsByTeamId, playedFixtureIds: [...state.playedFixtureIds, id] };
}

function updateTeamStanding(standing, goalsFor, goalsAgainst) {
  const result = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
  return {
    played: standing.played + 1,
    won: standing.won + (result === 'W' ? 1 : 0),
    drawn: standing.drawn + (result === 'D' ? 1 : 0),
    lost: standing.lost + (result === 'L' ? 1 : 0),
    goalsFor: standing.goalsFor + goalsFor,
    goalsAgainst: standing.goalsAgainst + goalsAgainst,
    points: standing.points + (result === 'W' ? 3 : result === 'D' ? 1 : 0),
    form: [...standing.form, result],
  };
}

const TIEBREAKER_ACCESSORS = {
  points: (standing) => standing.points,
  goalDifference: (standing) => standing.goalsFor - standing.goalsAgainst,
  goalsFor: (standing) => standing.goalsFor,
  wins: (standing) => standing.won,
};

export function rankStandings(standingsByTeamId, tiebreakers) {
  const entries = Object.keys(standingsByTeamId).map((teamId) => ({ teamId, standing: standingsByTeamId[teamId] }));
  entries.sort((a, b) => {
    for (const key of tiebreakers) {
      if (key === 'teamId') {
        if (a.teamId !== b.teamId) return a.teamId < b.teamId ? -1 : 1;
        continue;
      }
      const accessor = TIEBREAKER_ACCESSORS[key];
      const diff = accessor(b.standing) - accessor(a.standing);
      if (diff !== 0) return diff;
    }
    return 0;
  });
  return entries.map((entry) => entry.teamId);
}

export function getChampion(standingsByTeamId, seasonStatus, tiebreakers) {
  if (seasonStatus !== 'complete') {
    return null;
  }
  const [champion] = rankStandings(standingsByTeamId, tiebreakers);
  return champion ?? null;
}
