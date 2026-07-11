// Football positions and the visible-stat weighting used to score a player
// against each one. Used by the football engine's coach recommendation logic.

export const POSITIONS = {
  GK: {
    label: 'Goalkeeper',
    weights: { goalkeeping: 0.6, physical: 0.2, passing: 0.1, pace: 0.1 },
  },
  CB: {
    label: 'Centre Back',
    weights: { defending: 0.45, physical: 0.35, passing: 0.1, pace: 0.1 },
  },
  FB: {
    label: 'Full Back',
    weights: { defending: 0.3, pace: 0.3, dribbling: 0.2, passing: 0.2 },
  },
  DM: {
    label: 'Defensive Midfielder',
    weights: { defending: 0.35, passing: 0.35, physical: 0.2, dribbling: 0.1 },
  },
  CM: {
    label: 'Central Midfielder',
    weights: { passing: 0.4, dribbling: 0.25, physical: 0.15, defending: 0.2 },
  },
  AM: {
    label: 'Attacking Midfielder',
    weights: { passing: 0.3, dribbling: 0.35, shooting: 0.25, pace: 0.1 },
  },
  W: {
    label: 'Winger',
    weights: { pace: 0.35, dribbling: 0.35, shooting: 0.2, passing: 0.1 },
  },
  ST: {
    label: 'Striker',
    weights: { shooting: 0.45, pace: 0.25, dribbling: 0.2, physical: 0.1 },
  },
};

export const POSITION_LIST = Object.keys(POSITIONS);
