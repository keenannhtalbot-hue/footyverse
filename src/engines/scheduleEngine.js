// Schedule engine: deterministic double round-robin fixture generation.
// DOM-independent, pure.

export function generateRoundRobin(teamIds) {
  const sorted = [...teamIds].sort();
  const firstLeg = circleMethodSingleLeg(sorted);
  const secondLeg = firstLeg.map((round) => round.map(({ home, away }) => ({ home: away, away: home })));
  return [...firstLeg, ...secondLeg];
}

const BYE = null;

function circleMethodSingleLeg(teams) {
  const list = teams.length % 2 === 0 ? teams.slice() : [...teams, BYE];
  const n = list.length;
  const rounds = [];
  let arr = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== BYE && away !== BYE) {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}
