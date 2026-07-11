# FootyVerse Public MVP Product & Quality Plan

**Goal:** Turn v0.5’s stable childhood vertical slice into a polished, content-rich public MVP that reliably creates 3–8 hours of replayable fun without pretending to be a full professional-career simulator.

**Product promise:** “Raise a young footballer from age five through a decisive youth-career chapter; make seasonal tradeoffs, earn a place, shape relationships and identity, and see a living football world remember what happened.”

**MVP ending:** A complete youth arc ending around age 16 with one of several meaningful outcomes (academy/pro pathway offer, grassroots/local pathway, football-adjacent future, or stepping away), followed by a career scrapbook and “start a new life” prompt. Do not ship an endless but shallow adulthood placeholder.

**Constraints:** Free forever; offline-first static PWA; no accounts, analytics, ads, microtransactions, backend, or paid dependencies; saves remain local and portable.

---

## 1. Priority model

- **P0 — Public-release blocker:** trust, accessibility, onboarding, save safety, complete core loop, and a satisfying endpoint.
- **P1 — Fun multiplier:** systems/content that cause distinct stories, hard choices, and replayability.
- **P2 — Polish after validation:** extra variety and presentation that deepen proven loops.
- **Not MVP:** expensive breadth that adds screens or nouns but few decisions.

Use this ordering rigidly: fix comprehension and consequence visibility before adding content; deepen the season loop before adding new “apps”; finish one youth arc before adding senior football.

---

## 2. What creates hours of fun

### High-leverage depth

1. **Meaningful seasonal planning** — limited AP forces tradeoffs among training, recovery, school, friends, and family; the best choice is contextual, not always “train.”
2. **Football moments with readable risk** — match choices depend on position, form, fatigue, confidence, opposition, and coach tactics; feedback explains why an outcome was likely without exposing every hidden roll.
3. **Relationships that remember** — recurring characters react to promises, neglect, match behavior, and prior choices; thresholds unlock help, conflict, selection, or story branches.
4. **A coherent personal story** — quarter summaries connect causes to consequences (“extra shooting helped, but fatigue cost a start”), and the scrapbook records turning points rather than raw logs.
5. **Distinct runs** — country pathway, personality/hidden tendencies, coach style, family circumstances, injuries, rivals, and player choices produce materially different routes.
6. **Goals at three horizons** — immediate quarter objective, season objective, and multi-year dream, all visible and achievable in increments.
7. **Setbacks with recovery routes** — injury, deselection, poor grades, and conflict create new decisions; they should rarely become silent death spirals.
8. **A proper ending** — a youth-career outcome, summary, notable relationships, biggest match, turning points, and seed/share code make completion rewarding and replay inviting.

### Required content density for the MVP

Content should be tagged by age band, context, prerequisites, relationship, tone, rarity, and outcome family so the engine selects coherent events rather than a larger random soup.

- **120+ authored events**, including at least 70 choice events; no age band (5–7, 8–10, 11–13, 14–16) has fewer than 20 eligible events.
- **30+ multi-step story chains** (2–5 beats), with at least 5 each for family, school, friendship, football, and setbacks; branches must alter a later beat or outcome.
- **40+ match scenarios**, distributed across attacking, defending, transition, goalkeeper, set-piece, leading, trailing, and high-pressure contexts.
- **15+ recurring NPC archetypes** with generated identity plus memory hooks; at least rival, best friend, demanding/supportive coach, teacher, scout, and teammate conflicts.
- **25+ season/age milestones** and **8+ youth-arc endings** grouped into at least four genuinely different pathway families.
- In a normal 60-minute run, **<10% verbatim event repetition**; once-only story beats never repeat.

### Superficial feature bloat to reject

Do **not** prioritize these for public MVP unless a playtest proves they solve a core-loop problem:

- More phone apps, decorative social feeds, chat simulations, houses, cars, pets, wardrobes, or collectible cosmetics.
- Real club/player databases, licenses, giant league tables, full transfer markets, or exhaustive country breadth.
- Senior contracts, loans, agents, international football, dating, marriage, children, retirement, or Hall of Fame.
- Manual match animation, 3D/2D match engine, commentary libraries, or tactical formation editors.
- Currencies, loot, daily streaks, achievements-as-checklists, battle passes, shops, or monetization scaffolding.
- Huge stat sheets where values do not change decisions.
- AI-generated infinite events: they conflict with offline reliability, consistency, safety, and authored consequence chains.
- Multiplayer, cloud accounts/sync, leaderboards, or social dependency.

**Bloat test:** reject or defer any proposed feature that does not improve at least one measured outcome—choice quality, story recall, run differentiation, clarity, accessibility, or save trust—and cannot name the recurring decision it changes.

---

## 3. Prioritized work plan

## P0.1 — Define and instrument the complete youth loop

1. Formalize the quarter loop: **Review → Plan → Spend AP → Resolve football/life moments → World advances → Explain consequences → Set next objective**.
2. Add a first-run 6–8 quarter “guided season” with contextual prompts that disappear permanently once understood.
3. Add visible quarter, season, and long-term objectives with progress and plain-language failure/recovery conditions.
4. Implement the age-16 youth-arc evaluation, endings, scrapbook, and new-life flow.
5. Add a developer-only local playtest journal (no network): anonymous session seed, selected choices, age reached, ending, repeated event IDs, and balance snapshots exportable as JSON by the tester. Default off and never collect remotely.

**Acceptance:** three first-time testers can independently describe the loop after 10 minutes; all can reach the next quarter without coaching; a full accelerated test run reaches a valid ending without dead state.

## P0.2 — Save safety and offline trust

1. Maintain two rotating local autosave slots plus last-known-good recovery; write atomically and checksum the payload.
2. Display “Saved locally” status and timestamp; explain in onboarding that clearing browser data removes saves.
3. Add explicit save schema migrations, unsupported-future-version messaging, import preview, and destructive-action confirmations.
4. Provide one-click export with a human-readable filename and test restoration into a clean browser profile.
5. Test first load online, repeat launch offline, service-worker update, interrupted/corrupt write, quota failure, and stale-cache recovery.

**Acceptance:** 100 scripted save/load cycles have zero state loss; every supported old fixture migrates; corrupt newest save recovers the prior slot with a clear message; core game launches and advances offline after caching.

## P0.3 — Accessibility baseline (WCAG 2.2 AA target)

1. Audit every app, dialog, toast, meter, form, and choice flow with keyboard only and a screen reader.
2. Ensure semantic landmarks/headings, skip link, logical tab order, visible focus, focus trap/restore for modals, and status announcements that do not spam.
3. Give stat bars and relationship meters text equivalents; never rely on color, emoji, motion, position, or hidden hover text alone.
4. Meet 4.5:1 normal-text and 3:1 large-text/UI contrast across every theme and state; maintain minimum 44×44 CSS-pixel targets.
5. Respect `prefers-reduced-motion` automatically; make reduced motion remove nonessential animation, not merely shorten it.
6. Support 200% browser zoom, 320 CSS-pixel width/reflow, text resizing, landscape phones, safe areas, and keyboard viewport behavior.
7. Use plain language; offer a glossary for AP, potential, form, fatigue, and pathway terms.
8. Do not make gender affect ability or outcomes; ensure inclusive labels and generated names are correctly pronounced/read where possible.

**Acceptance:** zero critical/serious axe findings on all ten apps and onboarding; complete game loop using keyboard only; screen-reader smoke passes in at least NVDA+Firefox and VoiceOver+Safari (or documented equivalent device coverage); no loss of content/function at 200% zoom or 320px reflow.

## P0.4 — Onboarding and information architecture

1. Replace a feature tour with **progressive teaching in context**: create player → inspect objective → spend AP → understand fatigue → make one choice → end quarter → read recap.
2. Keep creation to identity, country, and optional start seed/year; explain that position/potential are intentionally discovered.
3. Add “Why?” explanations beside disabled actions and unknown values.
4. Put “Continue” and the next meaningful action on Home; reduce launcher hunting.
5. Add a Help/How to Play overlay available everywhere, plus reset tutorial hints in Settings.
6. Use confirmations only for irreversible/high-cost decisions; allow undo for AP spending until quarter resolution.

**Acceptance:** in five moderated first-run tests, 4/5 create a player in under 2 minutes, spend AP and advance a quarter in under 8 minutes, and correctly answer what AP, fatigue, and position discovery mean; no tester encounters an unexplained disabled control.

## P0.5 — Balance foundation and anti-degeneracy

1. Write a balance model with target ranges by age for attributes, fatigue, injury frequency, relationship movement, selection probability, and ending distribution.
2. Make diminishing returns and age-appropriate caps readable; avoid a single optimal activity loop.
3. Balance AP so a player can make 3–5 meaningful actions per quarter, cannot maximize every axis, and always has at least one recovery option.
4. Add soft catch-up and alternate routes after setbacks; cap cascading penalties from injury + fatigue + deselection.
5. Build seeded Monte Carlo simulation over at least 10,000 careers, reporting ending, country, position, injury burden, max/min stats, and stalled states.
6. Add deterministic regression seeds for best-case, worst-case, high-training, high-social, goalkeeper, repeated injury, and no-football runs.

**Initial target bands (tune with playtests):**
- No single repeatable action selected in >35% of all available choice opportunities.
- Typical player has 1–3 consequential setbacks per youth run, but <5% enter an unrecoverable downward spiral before age 14.
- Meaningful injury incidence: 0.5–1.5 per full run; severe career-shaping injury in 3–8% of runs, never as an unexplained random ending.
- At least 60% of endings are attainable through two or more broad strategies.
- Across 10,000 balanced-policy simulations, no ending family exceeds 45% or falls below 8% unless explicitly labeled rare.
- No NaN, negative AP, impossible age/state transition, or simulation stall in 10,000 seeded careers.

## P0.6 — Content pass for a complete arc

Build in vertical slices, not category dumps:

1. **Ages 5–7:** discovery, school/family, first friends, playful football, first pathway opportunity.
2. **Ages 8–10:** organized-team identity, first rival, coach evaluation, position experimentation, confidence and school tradeoffs.
3. **Ages 11–13:** selection pressure, growth differences, deeper friendships, injury recovery, competing commitments.
4. **Ages 14–16:** academy decisions, exams, scout pressure, release/retention, values conflicts, youth-arc outcome.
5. For each band, ship a coherent set of objectives, football moments, relationship chains, setbacks, world reactions, and transitions before starting the next band.
6. Add editorial checks for tone, age appropriateness, stereotypes, consequence clarity, and continuity.

**Acceptance:** content-density targets above are met; every event validates against schema; no dangling chain; every choice branch changes immediate state or schedules a later callback; 20 seeded editorial runs contain no continuity contradiction or inappropriate age/context event.

## P0.7 — Public-ready UX and reliability

1. Make the Home screen answer: what happened, what matters now, what can I do, and what happens if I advance?
2. Add quarter recap with 3–6 causal highlights, not a long feed.
3. Standardize loading/empty/error/disabled/success states, terminology, date/season formatting, and button hierarchy.
4. Prevent accidental double actions and race conditions; all action handlers must be idempotent or guarded.
5. Verify responsive layouts at 320, 360, 390, 768, 1024, and 1440 CSS px.
6. Add a privacy statement: no account, ads, tracking, remote analytics, or purchases; data stays on device unless exported.
7. Provide credits, version/changelog, feedback link, known limitations, and an honest “youth chapter” scope statement.

## P1 — Fun multipliers after P0 is stable

1. **Recurring rival/friend arcs:** NPCs appear in match moments, news, selection, and endings.
2. **Coach philosophies:** patient developer, results-first, tactical teacher, disciplinarian; each changes feedback and viable strategy without arbitrary punishment.
3. **Promises and commitments:** choose a season focus or make a promise; fulfillment/breach creates remembered consequences.
4. **Dynamic objectives:** generated from current weakness, relationship, and pathway; offer two viable approaches.
5. **Position identity:** scenario and training value differ by role; goalkeeper receives enough unique content to be equally fun.
6. **World callbacks:** headlines and NPC progress mention prior encounters and make the world feel connected to the player.
7. **Seeded replay:** optional seed entry and copyable end-of-run seed, with no online leaderboard.
8. **Difficulty/access presets:** Story, Balanced, and Challenge change recovery margin and information—not hidden rubber-banding or accessibility settings.

**Promotion rule:** a P1 feature stays only if at least 60% of testers encounter it, at least 40% can recall its consequence after the session, and it does not worsen onboarding or defect gates.

## P2 — Post-MVP polish/content

- More countries only as complete pathway packs, not reskins.
- Additional story chains for underrepresented positions, family structures, personalities, and non-elite outcomes.
- Richer scrapbook presentation and optional local share card.
- Advanced tactical choices, tournament brackets, and awards only after core match decisions test well.
- Senior-career chapter as a separate future milestone with its own complete ending, never piecemeal in this MVP.

---

## 4. Release gates

A gate fails the release if unmet. “Mostly” is not a pass.

### Gate A — Functional correctness

- All automated tests pass on two current Node LTS versions; zero uncaught browser errors or unhandled promise rejections in smoke tests.
- 100% of ten apps have useful states and no dead buttons or “Coming Soon.”
- Ten full seeded careers reach a valid ending; 10,000 simulated careers have zero invalid/stalled states.
- Save migration, import/export, corruption recovery, and offline update suites pass.
- No open severity-1/2 defects; at most five severity-3 defects, each documented with workaround and owner.

### Gate B — Accessibility

- WCAG 2.2 AA checklist complete; zero critical/serious automated findings.
- Keyboard-only and screen-reader completion of onboarding, action spending, match choice, quarter advance, save export/import, and reset.
- 4.5:1/3:1 contrast targets met; 44×44 targets; 200% zoom and 320px reflow without loss, overlap, or horizontal page scrolling.
- Reduced-motion and high-contrast modes verified in every app.

### Gate C — Onboarding and comprehension

- At least 8 first-time target players tested; 7/8 create and advance one quarter without moderator intervention.
- Median time to first meaningful decision ≤3 minutes; median time to first quarter completion ≤8 minutes.
- ≥75% correctly explain AP, fatigue, and why position/overall are initially hidden.
- Tutorial skip, replay, and reset all work.

### Gate D — Fun and retention proxy (offline playtest, not tracking)

Use consented moderated sessions or tester-exported local journals; do not add network analytics.

- At least 15 representative playtesters, including 5 football-light players and 5 mobile-primary players.
- ≥70% voluntarily complete 8 quarters or play 60 minutes; ≥50% voluntarily start or say they intend to start a second life.
- Median “meaningful choice” rating ≥4/5; median “I understood why outcomes happened” ≥4/5.
- ≥80% can name one memorable story and one tradeoff after play.
- Verbatim content repetition <10% during the first hour; no tester reports a dominant spam strategy that trivializes the game.
- No demographic/accessibility cohort in the small test sample scores comprehension or enjoyment more than 1 point (on a 5-point scale) below the overall median without a documented fix/retest.

### Gate E — Performance and offline PWA

Test on representative low/mid-range Android plus iPhone/Safari and desktop Chrome/Firefox/Safari or documented closest available matrix.

- Lighthouse mobile (fresh production build): Performance ≥90, Accessibility ≥95, Best Practices ≥95, PWA installability criteria pass.
- Initial compressed transfer ≤500 KB excluding optional audio; no single critical asset >200 KB.
- LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 on a mid-tier test device under simulated Fast 4G.
- Warm offline launch reaches playable Home in ≤2s on the test device.
- Install, standalone launch, offline progression, refresh, and service-worker upgrade preserve the save.

### Gate F — Content and editorial quality

- Density targets met: 120 events/70 choices, 30 chains, 40 match scenarios, 15 NPC archetypes, 25 milestones, 8 endings.
- Automated schema validation has zero errors, duplicate IDs, missing references, impossible prerequisites, or dangling callbacks.
- Two editorial passes cover clarity, grammar, age appropriateness, inclusivity, football plausibility, and consequence text.
- Twenty seeded manual runs have zero continuity blockers; repeated text and content distribution meet targets.

### Gate G — Public trust and launch operations

- Production HTTPS URL, manifest, icons, service worker, privacy statement, feedback link, credits, version, and changelog return correctly.
- No third-party requests in a clean gameplay session except an explicit feedback-link navigation.
- Export/import instructions and local-data warning are visible before destructive reset.
- Rollback procedure tested; release candidate is tagged and archived; known limitations truthfully state that MVP ends at the youth chapter.

---

## 5. Balance and playtest process

1. **Define target experience first:** write expected AP pressure, setbacks, progression, and ending distributions by age band.
2. **Automated simulation:** run deterministic policies (balanced, train-only, social-only, rest-heavy, random, optimizer-like) over 10,000+ seeds.
3. **Exploit review:** compare outcomes; if one simple policy dominates, change opportunity costs or consequences rather than merely nerfing rewards.
4. **Human comprehension test:** observe without explaining. Record confusion, not just preference.
5. **Story-quality review:** ask what happened and why; poor recall indicates disconnected events or weak callbacks.
6. **Tune one variable family at a time:** AP economy, progression, fatigue/injury, relationships, then selection/endings.
7. **Freeze balance before launch:** only blocker fixes in the final release-candidate week; rerun deterministic seeds and all gates after every rule change.

Maintain a small local balance report containing seed, strategy, age reached, ending, injuries, attribute ranges, relationship ranges, repeated content, and invalid states. Never transmit it automatically.

---

## 6. Suggested delivery sequence

### Milestone 1 — Trustworthy foundation (P0, 1–2 weeks)
Accessibility audit/fixes, save recovery/migrations, offline update tests, action guards, Home clarity, and local test journal.

### Milestone 2 — Comprehensible loop (P0, 1 week)
Progressive onboarding, objectives, undo-before-advance, causal quarter recap, help/glossary, and first-run testing.

### Milestone 3 — Complete youth arc (P0, 3–5 weeks)
Age-band vertical slices, match scenario expansion, recurring characters/chains, age-16 endings, and scrapbook.

### Milestone 4 — Balance and replayability (P0/P1, 1–2 weeks)
Monte Carlo harness, regression seeds, anti-degeneracy tuning, rival/coach identity, and seeded replay.

### Milestone 5 — Release candidate (1 week)
Editorial pass, browser/device matrix, performance budget, accessibility retest, public trust pages, feedback channel, gate review, tagged production release.

**Scope-cut rule:** If schedule slips, reduce event count only while preserving the minimum per age band and complete chains/endings. Never cut save safety, accessibility, onboarding validation, offline reliability, causal feedback, or the youth-arc ending.

---

## 7. Likely implementation surfaces

- Rules/simulation: `src/engines/playerEngine.js`, `footballEngine.js`, `eventEngine.js`, `relationshipEngine.js`, `worldEngine.js`, `trainingEngine.js`, `saveEngine.js`, `stateSerializer.js`
- Content: `src/data/events.js`, `activities.js`, `lifeChoices.js`, `countries.js`, `positions.js`, plus new schema-validated story-chain/milestone/ending data modules
- Experience: `src/main.js`, `src/ui/home.js`, `football.js`, `relationships.js`, `statistics.js`, `settings.js`, shared dialog/toast/helpers, `index.html`, `styles/main.css`
- Offline/release: `sw.js`, `manifest.webmanifest`, `README.md`, privacy/changelog documentation
- Verification: existing `tests/*.test.mjs` plus simulation, migration fixtures, content-schema, accessibility smoke, and end-to-end browser tests

---

## 8. Definition of MVP success

FootyVerse is public-ready when a first-time player can install or open it, understand and complete the loop without help, trust that their local save is safe, play the entire youth chapter with keyboard/touch/screen reader as applicable, experience remembered choices and multiple viable paths, reach a satisfying ending, and want to try a different life—not when the game has the most apps, leagues, stats, or life-stage labels.
