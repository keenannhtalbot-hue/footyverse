// Relationship engine: multi-dimensional relationships (trust, respect,
// opinion, morale) with personality, likes/dislikes, and memory conversion
// (recent memories compress into a summarized core memory once capped).

export const MAX_RECENT_MEMORIES = 8;
const DIMENSIONS = ['trust', 'respect', 'opinion', 'morale'];

export function createRelationship({ id, name, role, personality = 'balanced', likes = [], dislikes = [] }) {
  return {
    id,
    name,
    role,
    personality,
    likes,
    dislikes,
    trust: 50,
    respect: 50,
    opinion: 50,
    morale: 50,
    memories: [],
    coreMemories: [],
  };
}

export function adjustRelationship(rel, deltas) {
  for (const dim of DIMENSIONS) {
    if (deltas[dim] !== undefined) {
      rel[dim] = clamp(rel[dim] + deltas[dim], 0, 100);
    }
  }
  return rel;
}

export function addMemory(rel, text, weight = 1, at = rel.memories.length) {
  rel.memories.push({ text, weight, at });
  if (rel.memories.length > MAX_RECENT_MEMORIES) {
    convertOldestMemory(rel);
  }
  return rel;
}

function convertOldestMemory(rel) {
  const overflow = rel.memories.length - MAX_RECENT_MEMORIES;
  const toConvert = rel.memories.splice(0, overflow);
  const avgWeight = toConvert.reduce((sum, m) => sum + m.weight, 0) / toConvert.length;
  rel.coreMemories.push({
    summary: `${toConvert.length} earlier moments, including "${toConvert[0].text}"`,
    weight: avgWeight,
    count: toConvert.length,
  });
}

export function describeRelationship(rel) {
  const avg = (rel.trust + rel.respect + rel.opinion) / 3;
  if (avg >= 75) return 'Close';
  if (avg >= 55) return 'Cordial';
  if (avg >= 35) return 'Neutral';
  if (avg >= 15) return 'Strained';
  return 'Broken';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
