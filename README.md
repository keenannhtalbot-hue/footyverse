# FootyVerse v0.5

A playable, single-player football life simulator built as a free static progressive web app. Start at age five, spend limited activity points, train, build relationships, enter a country-specific football pathway, make match decisions, and watch an independent football world evolve around you.

## Play locally

No installation or build step is required:

```bash
python3 -m http.server 4180
```

Open `http://localhost:4180`.

## Test

The game uses Node's built-in test runner and has no package dependencies:

```bash
npm test
```

The full regression suite (currently 368/368 tests across `tests/` and
`tests/simulations/`) covers every core engine, the senior-epilogue
renderer, the QA release gates, and the deterministic batch-career
simulation harness.

## QA gates

Two opt-in gates ship alongside the regression suite:

```bash
npm run qa:smoke      # jsdom-driven PWA, cold-boot, and post-onboarding shell smoke
npm run qa:batch      # deterministic 1000-career batch simulation (~7s on Linux)
```

`npm run qa:batch` drives 1000 senior careers from age 16 to terminal
through the **real** `reduceCareerCommand` + `expireContracts` seam
using a deterministic seeded RNG. It writes evidence to
`tests/fixtures/batch-career-summary.json` and asserts:

- zero throws across all careers
- every career terminates within the tick cap (no infinite loops)
- the terminal-distribution counts (signed_then_expired /
  signed_still_active / rejected_all / open_offer_pending) sum to N

The harness is exposed as `runBatchCareerSimulation({ batchSize, ... })`
in `scripts/batchCareerSimulation.mjs` so tests and ad-hoc probes can
reuse it. Override batch size with `npm run qa:batch -- 250`, override
seed with `FOOTY_BATCH_SEED=foo npm run qa:batch`, and override the
fixture path with `FOOTY_BATCH_FIXTURE=path/to/out.json npm run qa:batch`.

## Architecture

- `src/engines/` — DOM-independent game rules
- `src/data/` — country pathways, events, activities, positions and names
- `src/ui/` — functional phone apps and interaction views
- `src/main.js` — state orchestration and quarter simulation pipeline
- `styles/main.css` — responsive phone/tablet/desktop interface
- `tests/` — deterministic unit tests for every core engine

## Current playable scope

- Player creation at age five in Canada, England, Brazil, Spain or Germany
- Spring/Summer/Fall/Winter progression and annual aging
- Limited activity points, carrying/forfeiting unused AP
- Seven training categories, fatigue, injuries and recovery
- Activities and life choices with visible and hidden consequences
- Multi-dimensional parent, teacher, coach and friend relationships
- Country-aware grassroots/academy entry
- Interactive match moments and coach position recommendations
- Independent NPC development, injuries and world news
- Versioned local saves plus JSON export/import
- Offline-capable PWA with high-contrast and reduced-motion settings

## Honest v0.5 boundary

This is the stable architectural foundation and childhood vertical slice—not the entire lifetime roadmap. Professional contracts, transfers, senior international football, finances, social media, houses, family, retirement and the Hall of Fame belong in later versions built on these engines.
