import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSquad } from '../src/engines/selectionEngine.js';

function makePerson(overrides = {}) {
  return {
    id: 'person-x',
    kind: 'player',
    identity: { name: 'X', birthYear: 2000 },
    career: {
      stage: 'senior', positionId: 'ST', secondaryPositionIds: [],
      currentTeamId: 'team-redbrook-senior', debutTick: 500,
    },
    attributes: {
      passing: 50, shooting: 50, pace: 50, dribbling: 50,
      defending: 50, physical: 50, goalkeeping: 50,
    },
    condition: {
      fitness: 100, fatigue: 0, sharpness: 50, morale: 50,
      injury: null, suspensionMatches: 0,
    },
    ...overrides,
  };
}

function makeTeam(overrides = {}) {
  return {
    id: 'team-redbrook-senior', clubId: 'club-redbrook',
    manager: { id: 'manager-1', selectionBias: 50, youthTrust: 0 },
    ...overrides,
  };
}

test('selectSquad excludes wrong-team, retired, injured, and suspended people, picking the best eligible for the slot', () => {
  const team = makeTeam();
  const people = [
    makePerson({
      id: 'p-star',
      attributes: { passing: 0, shooting: 90, pace: 90, dribbling: 90, defending: 0, physical: 90, goalkeeping: 0 },
    }),
    makePerson({
      id: 'p-decent',
      attributes: { passing: 0, shooting: 50, pace: 50, dribbling: 50, defending: 0, physical: 50, goalkeeping: 0 },
    }),
    makePerson({
      id: 'p-injured',
      attributes: { passing: 0, shooting: 99, pace: 99, dribbling: 99, defending: 0, physical: 99, goalkeeping: 0 },
      condition: { fitness: 100, fatigue: 0, sharpness: 50, morale: 50, injury: 'hamstring', suspensionMatches: 0 },
    }),
    makePerson({
      id: 'p-suspended',
      attributes: { passing: 0, shooting: 99, pace: 99, dribbling: 99, defending: 0, physical: 99, goalkeeping: 0 },
      condition: { fitness: 100, fatigue: 0, sharpness: 50, morale: 50, injury: null, suspensionMatches: 2 },
    }),
    makePerson({
      id: 'p-retired',
      attributes: { passing: 0, shooting: 99, pace: 99, dribbling: 99, defending: 0, physical: 99, goalkeeping: 0 },
      career: { stage: 'retired', positionId: 'ST', secondaryPositionIds: [], currentTeamId: 'team-redbrook-senior', debutTick: 500 },
    }),
    makePerson({
      id: 'p-other-team',
      attributes: { passing: 0, shooting: 99, pace: 99, dribbling: 99, defending: 0, physical: 99, goalkeeping: 0 },
      career: { stage: 'senior', positionId: 'ST', secondaryPositionIds: [], currentTeamId: 'team-other', debutTick: 500 },
    }),
  ];

  const result = selectSquad(people, team, ['ST']);

  assert.deepEqual(result, [{ slot: 'ST', personId: 'p-star' }]);
});

test('selectSquad ranks primary position fit above secondary above out-of-position, for identical raw ability', () => {
  const team = makeTeam();
  const cmAttributes = { passing: 70, shooting: 0, pace: 40, dribbling: 60, defending: 50, physical: 55, goalkeeping: 0 };
  const people = [
    makePerson({
      id: 'p-out-of-position',
      attributes: cmAttributes,
      career: { stage: 'senior', positionId: 'GK', secondaryPositionIds: [], currentTeamId: 'team-redbrook-senior', debutTick: 500 },
    }),
    makePerson({
      id: 'p-secondary',
      attributes: cmAttributes,
      career: { stage: 'senior', positionId: 'DM', secondaryPositionIds: ['CM'], currentTeamId: 'team-redbrook-senior', debutTick: 500 },
    }),
    makePerson({
      id: 'p-primary',
      attributes: cmAttributes,
      career: { stage: 'senior', positionId: 'CM', secondaryPositionIds: [], currentTeamId: 'team-redbrook-senior', debutTick: 500 },
    }),
  ];

  const result = selectSquad(people, team, ['CM']);

  assert.deepEqual(result, [{ slot: 'CM', personId: 'p-primary' }]);
});

test('selectSquad ranks each requested slot independently and does not reuse a person across slots', () => {
  const team = makeTeam();
  const people = [
    makePerson({
      id: 'p-striker',
      attributes: { passing: 0, shooting: 90, pace: 80, dribbling: 70, defending: 0, physical: 40, goalkeeping: 0 },
      career: { stage: 'senior', positionId: 'ST', secondaryPositionIds: [], currentTeamId: 'team-redbrook-senior', debutTick: 500 },
    }),
    makePerson({
      id: 'p-midfielder',
      attributes: { passing: 90, shooting: 0, pace: 50, dribbling: 70, defending: 60, physical: 60, goalkeeping: 0 },
      career: { stage: 'senior', positionId: 'CM', secondaryPositionIds: [], currentTeamId: 'team-redbrook-senior', debutTick: 500 },
    }),
  ];

  const result = selectSquad(people, team, ['ST', 'CM']);

  assert.deepEqual(result, [
    { slot: 'ST', personId: 'p-striker' },
    { slot: 'CM', personId: 'p-midfielder' },
  ]);
});

test('selectSquad fails clearly on an unknown position slot', () => {
  const team = makeTeam();
  const people = [makePerson()];

  assert.throws(() => selectSquad(people, team, ['ZZ']), /Unknown position slot/);
});

test('selectSquad ranks a sharper player above an equal-ability, equal-fitness, equal-morale but stale one, even against id order', () => {
  const team = makeTeam();
  const baseAttributes = { passing: 0, shooting: 60, pace: 60, dribbling: 60, defending: 0, physical: 60, goalkeeping: 0 };
  const people = [
    makePerson({
      id: 'a-stale', attributes: baseAttributes,
      condition: { fitness: 100, fatigue: 0, sharpness: 20, morale: 50, injury: null, suspensionMatches: 0 },
    }),
    makePerson({
      id: 'z-sharp', attributes: baseAttributes,
      condition: { fitness: 100, fatigue: 0, sharpness: 90, morale: 50, injury: null, suspensionMatches: 0 },
    }),
  ];

  const result = selectSquad(people, team, ['ST']);

  assert.deepEqual(result, [{ slot: 'ST', personId: 'z-sharp' }]);
});

test('selectSquad ranks a fitter player above an equal-ability, equal-sharpness, equal-morale but unfit one, even against id order', () => {
  const team = makeTeam();
  const baseAttributes = { passing: 0, shooting: 60, pace: 60, dribbling: 60, defending: 0, physical: 60, goalkeeping: 0 };
  const people = [
    makePerson({
      id: 'a-tired', attributes: baseAttributes,
      condition: { fitness: 30, fatigue: 0, sharpness: 50, morale: 50, injury: null, suspensionMatches: 0 },
    }),
    makePerson({
      id: 'z-fit', attributes: baseAttributes,
      condition: { fitness: 100, fatigue: 0, sharpness: 50, morale: 50, injury: null, suspensionMatches: 0 },
    }),
  ];

  const result = selectSquad(people, team, ['ST']);

  assert.deepEqual(result, [{ slot: 'ST', personId: 'z-fit' }]);
});

test('selectSquad ranks a higher-morale player above an equal-ability, equal-sharpness, equal-fitness but unhappy one, even against id order', () => {
  const team = makeTeam();
  const baseAttributes = { passing: 0, shooting: 60, pace: 60, dribbling: 60, defending: 0, physical: 60, goalkeeping: 0 };
  const people = [
    makePerson({
      id: 'a-unhappy', attributes: baseAttributes,
      condition: { fitness: 100, fatigue: 0, sharpness: 50, morale: 10, injury: null, suspensionMatches: 0 },
    }),
    makePerson({
      id: 'z-happy', attributes: baseAttributes,
      condition: { fitness: 100, fatigue: 0, sharpness: 50, morale: 90, injury: null, suspensionMatches: 0 },
    }),
  ];

  const result = selectSquad(people, team, ['ST']);

  assert.deepEqual(result, [{ slot: 'ST', personId: 'z-happy' }]);
});

test('selectSquad manager youth trust can favor a close undeputed prospect over a veteran', () => {
  const team = makeTeam({ manager: { id: 'manager-1', selectionBias: 50, youthTrust: 100 } });
  const prospect = makePerson({
    id: 'z-prospect',
    career: { stage: 'senior', positionId: 'ST', secondaryPositionIds: [], currentTeamId: team.id, debutTick: null },
  });
  const veteran = makePerson({
    id: 'a-veteran',
    attributes: { passing: 50, shooting: 51, pace: 51, dribbling: 51, defending: 50, physical: 51, goalkeeping: 50 },
  });

  assert.deepEqual(selectSquad([veteran, prospect], team, ['ST']), [
    { slot: 'ST', personId: 'z-prospect' },
  ]);
});
