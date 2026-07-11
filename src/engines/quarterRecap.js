// Builds a concise, deterministic recap from evidence captured by existing game actions.

const LABELS = {
  confidence: 'Confidence',
  fatigue: 'Fatigue',
  fitness: 'Fitness',
  schoolStanding: 'School standing',
};

export function captureQuarterSnapshot(player) {
  return {
    quarter: player.quarter,
    year: player.year,
    age: player.age,
    fatigue: player.hidden?.fatigue ?? 0,
  };
}

export function buildQuarterRecap({ quarter, from, to, evidence = [] }) {
  const highlights = [];
  const seen = new Set();

  for (const fact of evidence) {
    const text = formatEvidence(fact);
    const identity = fact?.id ?? text;
    if (text && !seen.has(identity)) {
      seen.add(identity);
      highlights.push(text);
    }
  }

  const passage = formatPassage(from, to);
  if (passage && !seen.has(passage)) highlights.push(passage);

  return {
    quarter,
    dismissed: false,
    sparse: highlights.length < 3,
    highlights: highlights.slice(0, 6),
  };
}

function formatEvidence(fact) {
  if (!fact?.label) return null;
  if (fact.kind === 'training' && fact.gain > 0) {
    const stat = titleCase(fact.stat);
    const fatigue = fact.fatigue > 0 ? `, but fatigue +${fact.fatigue}` : '';
    return `${fact.label} → ${stat} +${fact.gain}${fatigue}.`;
  }
  if ((fact.kind === 'match' || fact.kind === 'event') && fact.outcome) {
    const punctuation = /[.!?]$/.test(fact.outcome) ? '' : '.';
    return `${fact.label} → ${fact.outcome}${punctuation}`;
  }
  const changes = (fact.changes ?? [])
    .filter((change) => Number.isFinite(change.delta) && change.delta !== 0)
    .map((change) => `${LABELS[change.key] ?? titleCase(change.key)} ${signed(change.delta)}`);
  return changes.length ? `${fact.label} → ${changes.join(', ')}.` : null;
}

function formatPassage(from, to) {
  if (!from || !to) return null;
  const age = to.age > from.age ? ` and age ${to.age}` : '';
  if (from.quarter === to.quarter && from.year === to.year && !age) return null;
  return `Quarter complete → ${to.quarter} ${to.year} began${age}.`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function titleCase(value = '') {
  return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
}
