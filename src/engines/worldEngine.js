// World engine: year/season/quarter clock, NPC youth peers, clubs, weather,
// news, and transfer activity. DOM-independent, pure aside from mutating the
// passed world object. Callers supply an rng instance (see rng.js).

import { createRng } from './rng.js';
import { COUNTRY_LIST, COUNTRIES } from '../data/countries.js';
import { randomNpcName } from '../data/names.js';
import { VISIBLE_STATS } from './playerEngine.js';

export const QUARTERS = ['Spring', 'Summer', 'Fall', 'Winter'];

const NPC_MIN_PER_COUNTRY = 4; // 5 countries * 4 = 20, comfortably clears the 18 minimum
const WEATHER_BY_SEASON = {
  Spring: ['mild and breezy', 'light rain', 'sunny spells', 'overcast'],
  Summer: ['hot and sunny', 'humid', 'clear skies', 'thunderstorms'],
  Fall: ['crisp and cool', 'windy', 'foggy mornings', 'steady rain'],
  Winter: ['cold and dry', 'snow showers', 'icy mornings', 'grey and damp'],
};

const INJURY_TYPES = ['bruise', 'sprain'];

export function createWorld({ startYear, seed = `world-${startYear}` }) {
  const rng = createRng(seed);
  const npcs = generateNpcPool(rng);

  return {
    year: startYear,
    season: QUARTERS[0],
    quarterIndex: 0,
    weather: rng.pick(WEATHER_BY_SEASON[QUARTERS[0]]),
    npcs,
    newsLog: [],
    transferLog: [],
  };
}

export function generateNpcPool(rng) {
  const npcs = [];
  let id = 0;
  for (const country of COUNTRY_LIST) {
    const clubs = COUNTRIES[country].clubs;
    for (let i = 0; i < NPC_MIN_PER_COUNTRY; i++) {
      const club = clubs[i % clubs.length];
      const { first, gender } = randomNpcName(rng, country);
      const stats = {};
      for (const stat of VISIBLE_STATS) {
        stats[stat] = rng.int(15, 40);
      }
      npcs.push({
        id: `npc-${id++}`,
        name: first,
        gender,
        country,
        club,
        age: rng.int(5, 12),
        stats,
        potential: rng.int(30, 95),
        notable: false,
        injured: null,
      });
    }
  }
  return npcs;
}

export function advanceWorldQuarter(world, rng) {
  world.quarterIndex = (world.quarterIndex + 1) % QUARTERS.length;
  world.season = QUARTERS[world.quarterIndex];
  const yearWrapped = world.quarterIndex === 0;
  if (yearWrapped) world.year += 1;

  world.weather = rng.pick(WEATHER_BY_SEASON[world.season]);

  for (const npc of world.npcs) {
    if (yearWrapped) npc.age += 1;

    if (npc.injured) {
      npc.injured = null;
      pushNews(world, `${npc.name} recovered from injury and returned to training at ${npc.club}.`);
    } else if (rng.chance(0.4)) {
      const stat = rng.pick(VISIBLE_STATS);
      const before = npc.stats[stat];
      npc.stats[stat] = Math.min(100, npc.stats[stat] + rng.int(1, 3));
      if (npc.stats[stat] !== before && npc.stats[stat] >= 60 && !npc.notable) {
        npc.notable = true;
        pushNews(world, `${npc.name} of ${npc.club} is emerging as one to watch.`);
      }
    }

    if (rng.chance(0.03)) {
      npc.injured = rng.pick(INJURY_TYPES);
      pushNews(world, `${npc.name} picked up a ${npc.injured} in training at ${npc.club}.`);
    }

    if (rng.chance(0.02)) {
      transferNpc(world, npc, rng);
    }
  }

  return world;
}

function transferNpc(world, npc, rng) {
  const clubs = COUNTRIES[npc.country].clubs.filter((c) => c !== npc.club);
  if (clubs.length === 0) return;
  const from = npc.club;
  npc.club = rng.pick(clubs);
  const record = { npcId: npc.id, name: npc.name, from, to: npc.club, year: world.year, season: world.season };
  world.transferLog.push(record);
  pushNews(world, `${npc.name} transferred from ${from} to ${npc.club}.`);
}

function pushNews(world, text) {
  world.newsLog.push({ text, year: world.year, season: world.season });
}

export function getRecentNews(world, limit = 5) {
  return world.newsLog.slice(-limit).reverse();
}
