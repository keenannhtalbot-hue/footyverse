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
node --test tests/*.test.mjs
```

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
