# E2E Testing Boundary

When an assertion belongs in Playwright (e2e) versus Vitest (unit/integration).
Source: `docs/specs/e2e-suite-boundary-cleanup.md`. The rule of thumb —
**e2e observes app-owned behavior in a controlled environment; it never depends on
third-party site state, pixel baselines, or live external services it cannot mock.**

## Put it in e2e when

- The behavior is **external-visible through the real DOM**: URL strings, geometry
  (`boundingBox`), computed styles (`getComputedStyle`), request counts, or UI-state
  transitions (e.g. a label changing from "Connect" to "Viewing 0x…").
- The regression is a **cross-component integration** no single hook/component unit
  test can express — e.g. watch-mode reconnect after refresh, or `urql` refetch
  firing on watch-address re-submit.
- A **layout/collapse** regression needs a guard — express it as geometry
  (non-zero box, height ≥ child, within viewport), **not** a pixel screenshot.

## Keep it out of e2e (move the guard elsewhere)

- **Third-party site behavior** — explorer SPAs rendering, Cloudflare/WAF
  reachability, the `<title>` of an external site. Unit-test the URL *construction*
  instead; let operators monitor site uptime.
- **Pixel screenshot baselines** — macOS-render-specific, skipped in CI, and unable
  to tell a real regression from a font/antialias drift. Use geometry/computed-style
  assertions.
- **Live staging frontend behind Vercel auth** — `networkidle` never settles there,
  and deployment health is not an app regression. Use the `request` fixture for API
  availability, or a local UI-flow e2e.
- **Live external GraphQL / real wallet holdings as a hard dependency** — flaky and
  environment-coupled. **Mock it with `page.route`** and keep request-count assertions.
- **Anything a Vitest unit/integration test already covers deterministically**
  (pure functions, hook logic). e2e must not duplicate it.

## Deterministic waiting (app-ready signal)

- After `page.goto('/')`, wait for the canonical app-ready signal:
  `page.getByTestId('portfolio-mode-toggle')`. It renders in both modes only
  after `/markets` data has loaded and the app shell has committed — verified
  as the reliable "data is on screen" gate.
- Do not wait on layout/state-dependent elements (e.g. the "Borrow amount"
  input): their presence varies with layout and app state, so they flap under
  load.
- For UI states that settle asynchronously (selection ranges, carousel snaps,
  resorting), poll with `expect.poll` instead of `waitForTimeout` + one-shot
  read; fixed-delay one-shot reads turn settle races into load flakes.
- When an assertion classifies what the app *did* during a window (e.g. "no
  reorder ⇒ no forced pin scroll"), observe the window continuously — a
  MutationObserver or in-page probe — not via before/after snapshots. The app
  reacts per React commit; a transient intermediate state that restores before
  the next snapshot is real behavior the snapshots can't see (seen in
  `reserves-table-scenario-pin.spec.ts`: the pin fired on a debounce-window
  intermediate sort while before == after).
- A `test.skip` conditioned on a page query ("no such reserve in staging")
  must come after the ready wait — otherwise a slow load masquerades as
  absence and the test silently false-skips.

## Acceptable skips

- `test.skip(!!process.env.CI, …)` only for a **genuine environment dependency**
  (external service unreachable, real wallet required), documented per file.
- A file that is `describe.skip` in CI is acceptable only as a **deliberate local
  operator check** (e.g. staging API smoke) with its rationale in the file header.
- **Never** skip by platform to dodge work (`test.skip(mobile, 'Desktop-only')`).
  Use a project-filtered `test.describe` instead — desktop-only tests run in the
  desktop project, mobile-only in the mobile project.

## Seams (reuse, don't invent)

- Pure-function unit tests — e.g. `src/lib/poolExplorerLinks.test.ts`.
- Playwright `page.route` — network interception that replaces live integration.
- Playwright geometry assertions — `boundingBox` / `getComputedStyle`.

## Red flag

A test that passes locally but fails in CI "because the network/environment drifted"
is a boundary violation, not a flaky test to re-run. Move its guard inward
(unit test) or make it deterministic (`page.route`).
