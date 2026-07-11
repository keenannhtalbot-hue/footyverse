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
