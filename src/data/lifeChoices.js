// Life app choices: shopping, diet/rest. Same effect shape as activities.js
// ({ stats, hidden, school }) so main.js can apply them uniformly.

export const LIFE_CHOICES = [
  {
    id: 'rest',
    label: 'Rest up',
    apCost: 1,
    description: 'A quiet day off. Lowers fatigue, does little else.',
    effects: { hidden: { fatigue: -15 } },
  },
  {
    id: 'good_meal',
    label: 'Home-cooked meal',
    apCost: 1,
    description: 'A proper family meal. Small physical and confidence boost.',
    effects: { stats: { physical: 1 }, hidden: { confidence: 1 } },
  },
  {
    id: 'new_boots',
    label: 'Shop for new boots',
    apCost: 2,
    description: 'A better fit underfoot. Small confidence boost.',
    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'family_time',
    label: 'Family time',
    apCost: 1,
    description: 'An afternoon with the family. Improves morale at home.',
    effects: { hidden: { confidence: 2, fatigue: -5 } },
  },
];

export function getLifeChoice(id) {
  return LIFE_CHOICES.find((c) => c.id === id);
}
