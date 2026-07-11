# FootyVerse MVP Career Simulation Layer

## 1. Scope and MVP rules

This extends the existing childhood vertical slice into one replayable career arc:

`grassroots → academy → senior debut → contracts/transfers/loans → domestic and international seasons → awards → decline → retirement`

The MVP should model **one playable country deeply enough to feel coherent**, while retaining the existing five-country data shape. Other countries can use the same rules with fictional competitions and lower-detail background simulation.

Deliberate limits:

- No agents, clauses beyond release/loan options, reserve leagues, continental cups, promotion playoffs, tax, detailed club finances, or manager careers in the first slice.
- One domestic league and one knockout cup per country; one senior national team competition cycle.
- Full fixtures and match records only for competitions relevant to the player. Background leagues use aggregate season results.
- Fictional clubs and competitions remain the default.
- All persisted values are JSON-safe data: IDs, arrays, objects, integers, booleans, and strings. No class instances, functions, `Date`, `Map`, or `Set` in the canonical save.
- Money is stored as integer minor units. Ratings/probabilities are stored as integers where practical.

## 2. Time model and simulation cadence

The existing four-quarter life clock remains authoritative. A quarter contains a deterministic list of football weeks.

- `Spring`, `Summer`, `Fall`, `Winter`; advancing Winter ages everyone and increments the year.
- A `SeasonDefinition` maps competition rounds to quarter/week slots. Do not infer seasons from real dates.
- The UI may advance one fixture at a time when the player has a match, then finish the remaining quarter in one operation.
- `world.clock.tick` is a monotonic integer and the canonical ordering key. Year/quarter/week are display/index fields.
- Exactly one orchestrator owns clock advancement. Engines never advance the clock themselves.

Recommended MVP cadence: 8 football weeks per quarter, 32 per year. This is enough for a 10-club double round-robin league (18 rounds), cup rounds, international windows, and off-season weeks without daily simulation.

## 3. Canonical save model

```js
const gameState = {
  schemaVersion: 2,
  seed: 'user-visible-seed',
  clock: { tick: 0, year: 2026, quarterIndex: 0, week: 0 },
  rng: { legacyState: 123, algorithm: 'mulberry32-v1' },

  playerId: 'person-player',
  peopleById: { /* Person */ },
  clubsById: { /* Club */ },
  teamsById: { /* Team */ },
  competitionsById: { /* Competition */ },
  seasonsById: { /* CompetitionSeason */ },
  fixturesById: { /* Fixture */ },
  contractsById: { /* Contract */ },
  negotiationsById: { /* Negotiation */ },
  registrationsById: { /* Registration */ },
  nationalTeamsById: { /* NationalTeam */ },
  callUpsById: { /* CallUp */ },
  awardsById: { /* AwardResult */ },

  activeSeasonIds: [],
  pendingDecisionIds: [],
  ledger: [],
  newsLog: [],
  idCounters: {},
  settings: {},
};
```

Normalize long-lived entities by stable ID. Derived views (current club, league table, career totals, eligible teams) are selectors, not duplicated source-of-truth fields.

### 3.1 Person

Use the same shape for player and simulated footballers so aging, contracts, and matches share rules.

```js
{
  id: 'person-player',
  kind: 'player',                 // player | npc
  identity: {
    name: 'Alex Morgan', gender: 'nonbinary',
    birthYear: 2021, countryId: 'england', nationalityIds: ['england']
  },
  career: {
    stage: 'academy',             // grassroots | academy | senior | retired
    positionId: 'ST', secondaryPositionIds: [], preferredFoot: 'right',
    reputation: 120, internationalReputation: 0,
    currentTeamId: 'team-redbrook-u18', currentContractId: null,
    parentClubTeamId: null, loanTeamId: null,
    debutTick: null, retirementTick: null
  },
  attributes: {
    passing: 48, shooting: 55, pace: 61, dribbling: 52,
    defending: 24, physical: 40, goalkeeping: 8
  },
  hidden: {
    potential: 82, workEthic: 70, professionalism: 66,
    consistency: 58, bigMatches: 51, injuryProneness: 12,
    adaptability: 60, loyalty: 55
  },
  condition: {
    fitness: 100, fatigue: 10, sharpness: 60, morale: 65,
    injury: null, suspensionMatches: 0
  },
  development: {
    phase: 'growth',              // growth | peak | decline
    minutesThisSeason: 0, trainingLoad: 0, lastAgedYear: 2026
  },
  seasonStatsBySeasonId: {},      // compact counters, not per-match duplication
  careerTotals: { appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0,
    cleanSheets: 0, yellowCards: 0, redCards: 0, averageRatingX100: 0 },
  history: []                     // compact milestone refs only
}
```

Age is derived from `clock.year - birthYear`; do not persist mutable `age` in the new schema. Existing saves migrate `age` to `birthYear`.

### 3.2 Club and team

A club owns teams; contracts belong to a club, while registrations and appearances belong to a team.

```js
// Club
{
  id: 'club-redbrook', name: 'Redbrook Town FC', countryId: 'england',
  reputation: 340, finances: { wageBudgetMinor: 25000000, transferBudgetMinor: 50000000 },
  facilities: { academy: 62, training: 68, medical: 55 },
  philosophy: { youthPriority: 70, style: 'balanced' },
  teamIds: ['team-redbrook-u14', 'team-redbrook-u18', 'team-redbrook-senior']
}

// Team
{
  id: 'team-redbrook-senior', clubId: 'club-redbrook', level: 'senior',
  competitionIds: ['comp-england-league'], squadPersonIds: [],
  tactics: { formation: '4-3-3', tempo: 55, pressing: 60 },
  manager: { id: 'manager-12', selectionBias: 50, youthTrust: 65 }
}
```

Youth promotion is a registration/team move inside the same club. A professional transfer changes contract ownership and registration. A loan preserves parent contract ownership but creates a temporary destination registration.

### 3.3 Competition, season, fixture, and standings

```js
// Competition (immutable definition)
{
  id: 'comp-england-league', countryId: 'england', name: 'National Premier League',
  kind: 'league', level: 1, teamCount: 10,
  rules: { pointsWin: 3, pointsDraw: 1, pointsLoss: 0,
    tiebreakers: ['points', 'goalDifference', 'goalsFor', 'wins', 'teamId'],
    squadSize: 22, foreignLimit: null }
}

// CompetitionSeason
{
  id: 'season-comp-england-league-2039', competitionId: 'comp-england-league', year: 2039,
  status: 'scheduled',            // scheduled | active | complete
  teamIds: [], fixtureIds: [], currentRound: 0,
  standingsByTeamId: {
    'team-redbrook-senior': { played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0, form: [] }
  },
  championsTeamId: null
}

// Fixture
{
  id: 'fixture-2039-0001', seasonId: 'season-comp-england-league-2039',
  round: 1, scheduledTick: 520, homeTeamId: 'team-a', awayTeamId: 'team-b',
  status: 'scheduled',            // scheduled | played
  score: null,                    // { home: 2, away: 1 }
  result: null,                   // home | draw | away
  playerPerformances: [],         // only relevant/notable participants
  incidents: [], summarySeedKey: 'fixture-2039-0001'
}
```

`generateRoundRobin(teamIds)` uses the circle method and stable input sorting. For odd team counts, add a `null` bye. Second legs reverse home/away. Cup draws sort eligible IDs first, then use a draw-scoped shuffle.

Standings are updated once in `applyFixtureResult`; replaying an already-played fixture must return an error. Sort with the configured tiebreakers, ending in `teamId` so order is total and deterministic.

### 3.4 Match performance

```js
{
  personId: 'person-player', teamId: 'team-redbrook-senior',
  started: true, positionId: 'ST', minutes: 90,
  goals: 1, assists: 0, shots: 4, keyPasses: 1, tackles: 0,
  saves: 0, goalsConceded: 0, yellowCards: 0, redCards: 0,
  ratingX100: 742,               // 7.42, avoid persisted floats
  fatigueDelta: 16, injury: null, manOfMatch: false
}
```

The match engine works in three phases:

1. `prepareMatch` deterministically selects lineups and computes team strength from available players, tactics, morale, fitness, and home advantage.
2. `createMatchPlan` generates a fixed list of incidents/chances from a match-scoped RNG. It must not mutate state.
3. `resolveMatchPlan` accepts zero or more player decisions, resolves every incident, and returns one immutable result bundle. `applyMatchResult` is the only mutator.

The player gets 0–3 interactive moments; NPC and skipped moments use deterministic AI choices. Match ratings start near 6.00 and move through bounded event contributions. Clamp to 1.00–10.00. Selection should depend on position fit, ability, form, fitness, and manager youth trust—not player status.

### 3.5 Contracts, negotiations, transfers, and loans

```js
// Contract
{
  id: 'contract-77', personId: 'person-player', clubId: 'club-redbrook',
  status: 'active',               // offered | active | expired | terminated
  kind: 'professional',           // youth | professional
  startTick: 500, endTick: 628,
  wagePerWeekMinor: 120000, signingBonusMinor: 500000,
  squadRole: 'prospect',          // prospect | rotation | starter | star
  releaseFeeMinor: null,
  parentContractId: null
}

// Negotiation/offer
{
  id: 'negotiation-9', kind: 'renewal', personId: 'person-player',
  fromClubId: 'club-redbrook', toClubId: 'club-redbrook',
  createdTick: 590, expiresTick: 598, status: 'open',
  terms: { durationTicks: 128, wagePerWeekMinor: 180000,
    signingBonusMinor: 200000, squadRole: 'rotation', transferFeeMinor: 0 },
  roundsUsed: 0, maxRounds: 2
}

// Registration
{
  id: 'registration-44', personId: 'person-player', teamId: 'team-rheintal-senior',
  kind: 'loan', startTick: 540, endTick: 572,
  parentClubId: 'club-redbrook', active: true
}
```

Rules:

- Youth agreements have no wage and automatically expire at the senior eligibility boundary.
- Only one active owning contract per person and one active registration at a time.
- A transfer is atomic: validate eligibility/budget → expire old registration/contract → debit/credit fee → create new contract/registration → append ledger entries.
- A loan creates no new owning contract. It changes active registration, stores parent club, has a fixed end tick, then deterministically returns the player.
- Offers are generated only in fixed transfer windows and expire by tick. The user may accept, reject, or counter once/twice.
- AI acceptance uses integer utility: wage improvement + role + club reputation + playing-time need + nationality/adaptability − loyalty − relocation cost. Tie behavior is explicit (`score >= threshold` accepts).
- Club squad needs are position counts, not an expensive tactical market simulation.
- Free agents have no transfer fee. Expired contract handling runs before transfer-window offers.

### 3.6 International football

```js
// National team
{
  id: 'national-england-senior', countryId: 'england', level: 'senior',
  squadPersonIds: [], coach: { selectionBias: 50 },
  competitionIds: ['comp-world-cup']
}

// Call-up
{
  id: 'callup-18', personId: 'person-player', nationalTeamId: 'national-england-senior',
  windowTick: 650, status: 'selected', fixtureIds: [], capAwarded: false
}
```

MVP eligibility is nationality membership only. A call-up is not a cap; increment caps only when the player appears. Selection ranks eligible players by position score, club minutes, form, fitness, and international reputation, with stable ID as final tiebreaker. Use a small fictional four-team international tournament every four years and deterministic friendlies in designated windows. Do not generate a full global calendar.

### 3.7 Awards

```js
{
  id: 'award-2039-league-player', seasonId: 'season-comp-england-league-2039',
  awardType: 'player_of_season', scopeId: 'comp-england-league',
  candidatePersonIds: [], winnerPersonId: 'person-42',
  scoresByPersonId: { 'person-42': 884 }, decidedTick: 575
}
```

Awards are pure rankings over season data, never random popularity rolls. MVP awards:

- league champion, cup winner;
- player of the season;
- young player of the season (age cutoff from birth year);
- golden boot;
- club player of the year;
- international tournament champion and player of tournament.

Use transparent integer scoring from minutes, average rating, goals/assists or clean sheets by position, team finish, and discipline. Minimum-minutes eligibility prevents tiny-sample winners. Stable ID is the final tie-break.

### 3.8 Aging, development, decline, and retirement

Run aging exactly once at the year boundary, guarded by `development.lastAgedYear`.

- Ages 5–15: broad development; no decline.
- 16–20: high growth, professional transition.
- 21–27: growth slows toward potential.
- 28–31: peak/plateau; pace/physical can begin declining.
- 32+: increasing decline, partially offset by professionalism and minutes management.
- Goalkeepers shift the decline curve roughly three years later.

For each attribute, calculate an integer delta from age curve + potential gap + work ethic + training/minutes − injury/fatigue penalties. Use a person/year/attribute-scoped RNG only for a small bounded variance (`-1..1`). Potential is a ceiling influence, not a hard cap; attributes remain 0–100.

Retirement becomes eligible at 32 for outfield players and 35 for goalkeepers, but is not purely random. Compute pressure from age, decline, chronic injuries, low playing time, contract status, and morale; subtract professionalism/reputation. The player receives a decision when eligible. NPCs retire when pressure crosses a threshold, with forced retirement by a configurable maximum age (MVP: 40 outfield, 43 goalkeeper). Retirement expires registration/contract, records final totals, removes the person from selection/markets, and never deletes history.

## 4. Deterministic engine boundaries

### 4.1 Command/result contract

Every engine exports DOM-independent functions with one of these forms:

```js
// Pure query/generator
result = fn(readonlyStateOrSlice, command, randomSource)

// Explicit state transition (preferred reducer shape)
({ state, events }) = reduceCareerCommand(state, command)
```

The UI dispatches commands and renders results. It never calculates eligibility, standings, match odds, contract validity, awards, or aging.

Recommended commands:

- `ADVANCE_TO_NEXT_FIXTURE`, `PLAY_FIXTURE`, `SIMULATE_REST_OF_QUARTER`
- `RESPOND_TO_CONTRACT`, `COUNTER_CONTRACT`
- `ACCEPT_TRANSFER`, `ACCEPT_LOAN`, `REJECT_OFFER`
- `RESPOND_TO_CALL_UP`
- `RESPOND_TO_RETIREMENT`

Every accepted command emits ledger events with `{ id, tick, type, refs, payload }`. Event IDs come from persisted counters, not wall time. Ledger events support news/UI/history and debugging; canonical state remains snapshot-based for a small static app.

### 4.2 RNG isolation

A single mutable RNG stream makes saves replayable but is fragile: adding a cosmetic random draw changes all future outcomes. New career engines should use deterministic scoped streams:

```js
scopedRng(gameSeed, 'fixture', fixtureId)
scopedRng(gameSeed, 'development', year, personId, attributeId)
scopedRng(gameSeed, 'transfer-window', windowTick, clubId)
scopedRng(gameSeed, 'international-selection', windowTick, nationalTeamId)
```

Implement by hashing the joined scope into a 32-bit seed, then calling the existing `createRng`. Rules:

- Sort input ID arrays before any shuffle/weighted choice unless draw order is itself persisted.
- Never use `Math.random`, `Date.now`, locale-sensitive sorting, object-key enumeration as implicit priority, or floating-point equality.
- Persist generated fixtures, offers, match plans, and awards. Do not regenerate them after load.
- A command retry with the same state and command must produce byte-equivalent serialized output.
- Cosmetic text selection gets its own `narrative` scope and cannot affect simulation.

Keep `rng.legacyState` during migration so v0.5 saves continue their old stream until new scoped systems take ownership.

### 4.3 Module ownership

| Module | Owns | Must not own |
|---|---|---|
| `careerOrchestrator.js` | command order, clock, atomic application, emitted events | formulas, DOM |
| `scheduleEngine.js` | fixture generation, round slots, cup draws | match outcomes |
| `standingsEngine.js` | table updates/sorting/champions | fixture simulation |
| `selectionEngine.js` | squads, lineups, availability | transfer decisions |
| `matchEngine.js` | plans, incidents, score, performance bundle | standings/contracts |
| `contractEngine.js` | offers, counters, expiry, validity | market candidate search |
| `transferEngine.js` | windows, squad needs, candidate/loan generation, atomic moves | match selection |
| `internationalEngine.js` | eligibility, call-ups, caps, tournament schedule | domestic registration |
| `awardEngine.js` | candidate eligibility and deterministic rankings | stat mutation |
| `developmentEngine.js` | annual growth/decline, retirement pressure | clock advancement |
| `careerSelectors.js` | derived UI views/totals/current entities | mutation or RNG |
| `stateMigrations.js` | schema upgrades/defaults | gameplay simulation |

## 5. Quarter/season orchestration order

Order is part of the rules and must be tested:

1. Resolve pending player decision or reject advancement.
2. Resolve due fixture(s), apply performances, stats, fatigue, injuries, standings, news.
3. At window ticks: expire offers, contracts, loans; return loans; create eligible offers.
4. At international ticks: select squads, schedule/resolve fixtures, award caps.
5. At competition end: finalize table/cup, compute awards, archive season stats.
6. At Winter→Spring boundary: age/develop/decline/retire each person exactly once.
7. Create the next season and fixtures from stable team IDs.
8. Advance world clock and checkpoint save.

If a step creates a user decision, pause before later steps and persist the decision. Reloading resumes from that exact point.

## 6. Save compatibility and size

- Raise `schemaVersion` to 2 and add sequential migrations (`v1ToV2`); never scatter fallback defaults through engines.
- Convert existing `player.club` strings to stable fictional club/team IDs using country data; retain the original text as a migration alias if unmatched.
- Convert existing `world.npcs` into `peopleById`; derive `birthYear = savedYear - age`.
- Preserve old `careerHistory`, `storyLedger`, news, relationships, and RNG state.
- Validate foreign IDs, impossible duplicate active contracts/registrations, fixture status/score consistency, and clock ranges on import.
- Compact/archive completed fixture incidents after two seasons: preserve score, player performance, round, and award/history references; discard non-player narrative incidents.
- Keep only detailed fixtures for the player's competitions plus international tournaments. Background entities retain season summaries. Target a multi-decade save under roughly 5 MB.
- Save after every accepted decision and completed fixture. A failed command must leave the original state unchanged.

## 7. Vertical-slice build order

Each slice ends in a playable UI path and Node tests; do not build all schemas before any gameplay.

### Slice 0 — Compatibility foundation

Files: `src/engines/scopedRng.js`, `src/engines/stateMigrations.js`, `src/engines/stateValidator.js`, serializer/save tests.

- Add schema v2 normalized containers and deterministic ID counters.
- Migrate a frozen v0.5 fixture save and verify no childhood progress is lost.
- Test same scoped key gives same sequence; unrelated scope draws do not perturb it.
- Golden test: serialize → deserialize → continue produces byte-equivalent output.

### Slice 1 — One senior league season

Files: `src/data/competitions.js`, `scheduleEngine.js`, `standingsEngine.js`, `careerSelectors.js`.

- Create 10 senior clubs/teams for one country.
- Generate an 18-round double round-robin season.
- Apply explicit fixture scores and render fixtures/table/champion in Football/Statistics.
- Tests: every pair twice with reversed venue, no self-match, deterministic schedule, idempotent result application, all tiebreakers.

### Slice 2 — Player selection and complete matches

Files: `selectionEngine.js`, `matchEngine.js`, extend `src/ui/football.js`.

- Promote an academy player into a senior squad via a scripted milestone.
- Select lineups, offer 0–3 existing-style interactive moments, resolve a complete fixture.
- Apply match performance and season/career totals once.
- Tests: unavailable players excluded; same fixture/decisions same result; choice changes outcome distribution without changing incident count; stats and standings update once.

**First end-to-end proof:** load migrated youth save → reach promotion → play senior debut → table and career totals update → reload → next match remains identical.

### Slice 3 — Contracts and renewal

Files: `contractEngine.js`, contract UI panel.

- Youth agreement → first professional offer → accept/reject → expiry/renewal.
- Add squad role and wages, but no detailed personal finance dependency.
- Tests: one owning contract, expiry order, expired offer rejection, counter limit, reload with pending offer.

### Slice 4 — Transfers and loans

Files: `transferEngine.js`, transfer data/UI.

- Fixed summer/winter windows, one permanent offer, one loan offer, free agency.
- Atomic registration/contract changes and automatic loan return.
- Tests: budget/eligibility, no duplicate registration, fee conservation, parent contract retained, deterministic AI utility, exact end-tick return.

### Slice 5 — Full season closure and awards

Files: `awardEngine.js`, season archive selectors/UI.

- Complete league plus small knockout cup.
- Award champion, golden boot, player/young player of season, club award.
- Tests: minimum minutes, positional scoring, deterministic ties, awards only once, archived season remains readable.

### Slice 6 — International football

Files: `internationalEngine.js`, national-team data/UI.

- Eligibility, call-up, appearance/cap distinction, friendlies, four-team tournament.
- Tests: stable ranked squad, injured exclusion, call-up is not cap, tournament bracket/champion, domestic and national stats separated.

### Slice 7 — Aging, decline, retirement, and credits screen

Files: `developmentEngine.js`, retirement UI, final career summary.

- Annual age curves for player/NPCs, position-shifted goalkeeper curve.
- NPC retirement and replacement youth generation to keep squads viable.
- Player retirement decision and immutable final career summary.
- Tests: annual guard, bounded stats, reproducible deltas, no childhood decline, forced max-age retirement, retired players never selected/offered contracts.

### Slice 8 — Scale and soak hardening

- Simulate 40 years headlessly for 20 seeds.
- Assert no broken references, duplicate active contracts/registrations, impossible standings, negative budgets, fixtures stuck scheduled in completed seasons, or active players beyond max age.
- Replay the same seed/command log twice and compare canonical JSON hashes.
- Measure save size and quarter simulation time; keep active-player quarter advancement comfortably below 100 ms on desktop Node and avoid rendering unbounded lists on mobile.

## 8. Node test strategy

Use `node:test` and `node:assert/strict`; no runtime dependencies.

- Unit tests inject explicit RNG stubs only for formula boundaries. Integration tests use real scoped seeded RNG.
- Use fixture factories in `tests/helpers/careerFixtures.mjs`; avoid huge inline states.
- Maintain golden JSON fixtures for migration and one full deterministic season.
- Test invariants, not prose: total league points, played counts, contract uniqueness, registration ownership, cap rules, award eligibility.
- Add `structuredClone` before pure planning calls and assert the input did not mutate.
- For mutators, assert applying the same result twice fails cleanly.
- Add command-log replay tests: initial save + commands must equal final canonical save.

Suggested test files:

```text
tests/scopedRng.test.mjs
tests/stateMigrations.test.mjs
tests/scheduleEngine.test.mjs
tests/standingsEngine.test.mjs
tests/selectionEngine.test.mjs
tests/matchEngine.test.mjs
tests/contractEngine.test.mjs
tests/transferEngine.test.mjs
tests/awardEngine.test.mjs
tests/internationalEngine.test.mjs
tests/developmentEngine.test.mjs
tests/careerReplay.test.mjs
tests/careerSoak.test.mjs
```

## 9. Acceptance criteria for the MVP career layer

A seeded career can be played from academy to retirement; the player can debut, complete seasons, sign/decline a contract, transfer or take a loan, earn domestic/international appearances and awards, age and decline, then retire. Reloading at any pending decision or fixture yields the same future for the same actions. League tables are internally consistent, histories survive migration/archive, NPC careers continue without the player, and all engine behavior runs under static ES modules and Node's built-in test runner with no DOM dependency.
