// Validates canonical schema v2 career state on import. DOM-independent, pure.

export function validateState(state) {
  const errors = [];

  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { valid: false, errors: ['State must be an object.'] };
  }

  const clock = state.clock;
  if (!clock || typeof clock !== 'object') {
    errors.push('clock is missing.');
  } else {
    if (!Number.isInteger(clock.tick) || clock.tick < 0) {
      errors.push('clock.tick must be a non-negative integer.');
    }
    if (!Number.isInteger(clock.quarterIndex) || clock.quarterIndex < 0 || clock.quarterIndex > 3) {
      errors.push('clock.quarterIndex must be an integer between 0 and 3.');
    }
    if (!Number.isInteger(clock.week) || clock.week < 0) {
      errors.push('clock.week must be a non-negative integer.');
    }
    if (!Number.isInteger(clock.year)) {
      errors.push('clock.year must be an integer.');
    }
  }

  const requiredObjectContainers = [
    'peopleById', 'clubsById', 'teamsById', 'competitionsById', 'seasonsById',
    'fixturesById', 'contractsById', 'negotiationsById', 'registrationsById',
    'nationalTeamsById', 'callUpsById', 'awardsById', 'idCounters',
  ];
  for (const field of requiredObjectContainers) {
    const value = state[field];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${field} must be an object.`);
    }
  }

  const requiredArrayContainers = ['activeSeasonIds', 'pendingDecisionIds', 'ledger', 'newsLog'];
  for (const field of requiredArrayContainers) {
    if (!Array.isArray(state[field])) {
      errors.push(`${field} must be an array.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
