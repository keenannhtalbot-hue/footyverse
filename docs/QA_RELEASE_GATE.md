# FootyVerse QA / Release-Readiness Gate

Date: 2026-07-15
Owner: Forge supercrunch B (kanban task t_93426ff0)
Status: Implemented and green at HEAD `wt/supercrunch-qa-release-20260715`.

This document describes the repeatable, evidence-backed gate that
closes Optimus's "no automated browser harness" gap (audit
`2026-07-14_crunch-audit-58-to-60.md` §4, item G4) and earns the
QA / release-readiness credit on the FootyVerse ledger.

## What the gate covers

The gate is a small, focused jsdom-driven smoke harness that boots the
real production entry point (`src/main.js`) inside a Node test
process. It asserts five concrete regression classes that previously
could only be caught by manual browser QA:

1. **Cold boot is silent** — no uncaught JS error or unhandled
   rejection during module evaluation of the full import graph
   (15 engine modules + 14 UI modules + 7 data modules).
2. **Fresh install renders the onboarding form** with name, gender,
   country, start year, and submit — i.e. a first-time visitor sees
   something useful.
3. **PWA assets exist and parse** — `index.html`, `manifest.webmanifest`,
   `sw.js`, three icons, and the stylesheet are all present and
   wired correctly. A regression that drops one of these silently
   breaks cold offline launch.
4. **Post-onboarding shell renders primary navigation** — both
   `#nav-rail` (desktop) and `#bottom-nav` (mobile) mount, with the
   five primary apps (home / football / training / relationships /
   contracts) reachable via `[data-app="..."]` buttons, AND clicking
   a nav button actually re-renders `#app-content`.
5. **iOS-safe shell CSS** is intact — `#app-root` uses
   `height: 100dvh` (not `100vh`) and reserves `env(safe-area-inset-*)`
   insets so the dynamic-viewport / notched-device regressions the
   iOS hardening commit closed cannot quietly come back.

## The command

```bash
npm run qa:smoke
```

This runs three test files sequentially, each in its own `node --test`
process so the cached ESM module for `src/main.js` is re-evaluated per
file:

```
node --test tests/qa/qaSmokePwa.test.mjs        # 5 tests, ~0.3s
node --test tests/qa/qaSmokeColdBoot.test.mjs   # 3 tests, ~4.5s
node --test tests/qa/qaSmokeShell.test.mjs      # 2 tests, ~4.5s
```

Total: 10 tests in ~9.5 seconds. Exit code is non-zero on any
failure; the standard `node --test` TAP output reports which
assertion failed.

The harness depends only on **jsdom** (a devDependency). It does NOT
require a browser, Chrome, Playwright, Puppeteer, or any system-level
service. It runs anywhere `node` runs.

## How it works (one paragraph)

`tests/helpers/qaSmokeHarness.mjs` creates a jsdom DOM, stubs
`window` / `document` / `localStorage` / `navigator.serviceWorker` /
`matchMedia` / `requestAnimationFrame` onto `globalThis`, then
dynamically imports `src/main.js`. The cache buster is a unique
`?boot=N` query string on the entry URL, so each call re-evaluates
`src/main.js` and `boot()` runs against the fresh DOM. The harness
captures every `window.error`, `unhandledrejection`, and
`console.error` into a recorder the test asserts on.

## First-time setup

```bash
cd /home/kbot/footyverse
npm install          # installs jsdom as a devDependency (~40 packages, ~10s)
npm run qa:smoke     # should print "10/10 pass"
```

`package.json` now declares `"jsdom": "^29.1.1"` under
`devDependencies`. The runtime bundle stays empty — jsdom is loaded
only inside the test process.

## Regression classes caught (validated examples)

During RED-phase TDD development of the harness, the following
real, evidence-backed issues surfaced and were fixed:

- **`package.json` had no `qa:smoke` script** → users had no entry
  point to re-run the gate.
- **The harness initially relied on the cached ESM module** → a
  second `import('src/main.js')` returned the same instance and
  `boot()` never re-ran, so subsequent tests saw an empty DOM.
  Fix: append a unique `?boot=N` query string so Node treats each
  boot as a fresh module.
- **A hand-rolled minimal save did not match the canonical save
  shape** (missing `storyLedger`, `apMax`, `careerHistory`, `year`).
  This caused `src/ui/home.js:220` to throw
  `Cannot read properties of undefined (reading 'slice')` — a real
  bug class: any production save that omits a field would crash the
  Home render. Fix: build the save fixture using the actual engine
  factories (`createPlayer`, `createWorld`, `createRelationship`,
  `ensureCareerState`, `serializeState`) so the harness exercises the
  real hydration path.

## What the gate deliberately does NOT do

Per the task body's scope rules:

- **No real iOS Safari verification.** jsdom does not layout, does
  not execute WebKit, and does not have a 390px viewport. The shell
  CSS check (`100dvh` + `safe-area-inset-*`) catches *deletions* of
  the iOS-safe properties but cannot catch a layout regression only
  visible on a real device. Keenan / Cori still need to run the
  device QA checklist separately.
- **No fake metrics.** Every assertion is grounded in a real DOM
  query, a real file-existence check, or a real import. The harness
  does not record arbitrary numbers (no "page load time", no "DOM
  size").
- **No giant CI system.** `qa:smoke` is one shell command; it does
  not require Docker, GitHub Actions runners, or a queue. It runs
  locally in ~9.5s.
- **No deploy / preview mutation.** The harness boots the app
  entirely inside Node; it does not touch `footyverse-mvp-preview`,
  does not call `vercel`, and does not write to `progress.json`.
  The stable production alias is not contacted.

## CI integration (optional, future)

The command is idempotent and side-effect-free, so dropping it into a
pre-push hook or a CI step is straightforward:

```yaml
# .github/workflows/qa-smoke.yml (sketch — not shipped in this slice)
- run: npm install
- run: npm run qa:smoke
```

This is intentionally out of scope for the v0.5 ship: the gate is
authoritative as a local pre-merge command and a documented
post-deploy verification step. Apex decides whether to wire it into
the Vercel preview pipeline.

## Repeatable post-deploy checklist

After every Vercel deploy of a `feat/full-mvp` change, run these
two commands from `/home/kbot/footyverse`:

```bash
npm test            # 347 unit tests must stay green
npm run qa:smoke    # 10 QA smoke tests must stay green
```

If either fails, do not bump the readiness score until the
underlying regression is fixed. The gate's failure messages name the
exact assertion and the exact line, so triage is one read away.

## File map

```
package.json                          # adds "qa:smoke" + jsdom devDep
tests/helpers/qaSmokeHarness.mjs      # the boot + DOM-stub harness
tests/qa/qaSmokePwa.test.mjs          # static asset / shell CSS checks
tests/qa/qaSmokeColdBoot.test.mjs     # fresh-install DOM + error capture
tests/qa/qaSmokeShell.test.mjs        # save-resume + nav click
docs/QA_RELEASE_GATE.md               # this document
```

## Sources

- Optimus audit: `~/.hermes/kanban/boards/footyverse/attachments/t_bc3b7f66/2026-07-14_crunch-audit-58-to-60.md` (G4: "no automated browser harness")
- Authoritative ledger: `~/.hermes/kanban/boards/footyverse/progress.json` (do not edit from this slice)
- Task spec: kanban task `t_93426ff0`
