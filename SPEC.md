# FootyVerse v0.5 Build Specification

Build a production-quality, playable, single-player football life simulator foundation. It must run as a free static web app on Vercel and work on phones, tablets, and laptops.

## Non-negotiable product principles
- Not a BitLife clone; original football-life storytelling.
- The world evolves independently. NPCs improve, transfer, suffer injuries, become notable, and generate news.
- Stories and consequences matter more than naked stat gains.
- No dead buttons or "Coming Soon" UI.
- Player starts at age 5 with name, gender, and country; no position selection.
- Coaches later recommend position from performance. Player may accept or reject, affecting coach relationship.
- No overall rating until organized football provides enough evaluation.
- Four quarters: Spring, Summer, Fall, Winter. After four, player ages one year.
- Limited activity points must be spent or deliberately carried/forfeited before ending a quarter.
- Fully local single-player. No accounts, backend, analytics, ads, or paid dependencies.

## v0.5 playable scope
This release is a deep vertical slice, not the entire future roadmap.

### Onboarding
- Name, gender (inclusive options), country: Canada, England, Brazil, Spain, Germany.
- Country-specific football pathways and plausible local clubs.
- Start age 5, Spring, configurable start year.

### Phone apps — every app functional
1. Home: status, current quarter, headline, recent story.
2. Profile: identity, school, club/academy, position, potential, coach notes, career history.
3. Football: pathway, team, coach recommendation, fixtures/match decisions when available.
4. Training: limited AP; Passing, Shooting, Pace, Dribbling, Defending, Physical, Goalkeeping; fatigue and injury risk; colored bars.
5. Relationships: parents, coach, teacher, friends/teammates with trust, respect, opinion, morale, personality, likes/dislikes.
6. Life: doctor/physio when hurt, shopping choices, diet/rest choices with costs and hidden-stat effects.
7. Activities: basketball, chess, gaming, reading, swimming, gymnastics, lacrosse, drama, music, cooking; AP costs and narrative effects.
8. News: world and personal news generated independently.
9. Statistics: visible progress, season and career stats, story ledger.
10. Settings: save, export, import, reset, theme/accessibility toggles.

### Engines
- Player engine with visible and hidden stats.
- World engine with year, season, quarter, clubs, NPC players, managers, weather, news, transfer activity.
- Event engine with categories, weights, rarity, cooldowns, and duplicate prevention.
- Relationship engine with multi-dimensional relationships and memory conversion.
- Training/injury engine with realistic age gating and recovery.
- Football engine with age-appropriate organized football entry, coach evaluation, position recommendation, interactive match moments.
- Save engine using versioned localStorage; JSON export/import.

### Gameplay expectations
- Organized football opportunity around age 6–8, not automatically on day one.
- Early childhood has no overall and no known potential/position.
- At least 20 varied events across school, life, football, funny, and rare categories.
- NPC world includes at least 18 generated youth peers across countries and clubs.
- Quarter advancement simulates world changes and produces news.
- Interactive match choices: shoot, pass, dribble, defend depending on scenario; outcomes use attributes + hidden stats + seeded random.
- A coach position recommendation emerges only after enough organized-football observations.
- Injuries include bruise, sprain, broken ankle, ACL with realistic quarter/day text and severity.
- Childhood school stages and teacher relationship exist; graduation architecture is represented even if a normal play session will not reach it quickly.

## Architecture
Use static ES modules with no runtime dependencies and no build step:
- `index.html`
- `styles/main.css`
- `src/data/*.js`
- `src/engines/*.js`
- `src/ui/*.js`
- `src/main.js`
- `tests/*.test.mjs` using Node's built-in `node:test`
- `manifest.webmanifest`, `sw.js`, icons, `vercel.json`

Core engine modules must be DOM-independent and testable. Use deterministic injectable RNG helpers for tests. UI must not contain game-rule logic.

## Design
Primary surface: Operate, with Monitor secondary.
- Original football phone OS aesthetic, not a clone of iOS or BitLife.
- Deep navy/charcoal, pitch green, electric lime accent, warm off-white, red/yellow state colors.
- Phone-like app launcher on mobile; tablet/desktop uses side rail plus content panel.
- Minimum 44px touch targets; safe-area support; reduced motion; high contrast option.
- Clear hierarchy, polished microinteractions, no gradients-as-decoration, no glassmorphism sludge, no fake marketing hero.
- Include a compact onboarding intro and clear tutorial hints.

## Quality gates
- Strict test-first development for core engines.
- `node --test tests/*.test.mjs` must pass.
- No browser console errors.
- No horizontal overflow at 390px.
- Save/load and export/import tested.
- All ten apps provide a working interaction or meaningful information.
- Accessible labels, focus states, dialog semantics, and keyboard support.
- Service worker only caches same-origin successful GET responses and updates cleanly.
