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

## Egress: measure before triaging a red

`tbody tr[data-reserve-id]` timing out at 30s reads like a load flake. On a host
whose direct egress is degraded it is neither: `/markets` never finishes, so the
table never renders and no waiting strategy can rescue it. Measure egress first;
classify the red afterwards.

Completion criterion — both numbers in hand before calling a red a flake:

```sh
curl -s -m 20 -o /dev/null -w '%{http_code} total=%{time_total}s size=%{size_download}\n' https://api.aaveapy.com/markets
curl -s -m 20 -o /dev/null -w '%{http_code} total=%{time_total}s size=%{size_download}\n' -x http://127.0.0.1:<port> https://api.aaveapy.com/markets
```

| Direct vs proxied | Classification |
| --- | --- |
| Direct lands near the proxied figure | the red belongs to the suite — triage it as a defect |
| Direct stalls (`http_code 000`, or `size` a fraction of the payload) while proxied completes in seconds | the red belongs to egress — fix the run, not the suite |

Observed 2026-10-09/10 on one tree: direct took 37.9s for 412,891 bytes, then 90s
to deliver 120,920 of them, then 20s for 0 bytes; the same payload through a local
proxy arrived in 1.85s. The desktop suite moved from 50 passed / 3 failed / 10
flaky in 36.7m direct to **64 passed / 0 failed in 3.9m** proxied. All three direct
failures were that one selector.

So rerun an isolated red with `E2E_PROXY=…` before filing it.
`reserves-table-simulation-nested-scroll:38` reached the ticket queue on the
strength of an isolated red; it passed 2/2 in 16.5s once proxied.

## Asserting on network requests

- Cover **every** host the client talks to and **both** body shapes. The Aave SDK
  posts V4 ops to `api.aave.com` and V3 ops to `api.v3.aave.com`, and its
  batching exchange (`@aave/core`) collapses same-tick queries into one POST whose
  body is an **array** of `{ query, variables, operationName }`. A top-level
  `JSON.parse(body).operationName` read plus a single-host whitelist matched
  *nothing* while three position requests were actually in flight — that is how
  `watch-resubmit-refresh.spec.ts` asserted a refetch it could never observe.
- `page.route` mocks must use the **same** host set as the counter, and answer a
  batched POST with a same-length array (`body.map(() => ({ data: {} }))`) — an
  object response leaves every batched op unresolved.

## Acceptable skips

- `test.skip(!!process.env.CI, …)` only for a **genuine environment dependency**
  (external service unreachable, live third-party API required), documented per file.
- Tests that need the **real** Aave API from inside the browser (the live-SDK
  wallet family — they use the built-in view-only watch address, not a real
  wallet) depend on network egress, not on CI. Locally, run them with
  `E2E_PROXY=http://127.0.0.1:<port>` so Chromium proxies the API hosts;
  loopback is never proxied, so the dev server is unaffected.
- A file that is `describe.skip` in CI is acceptable only as a **deliberate local
  operator check** (e.g. staging API smoke) with its rationale in the file header.
- **Never** skip by platform to dodge work (`test.skip(mobile, 'Desktop-only')`).
  Use a project-filtered `test.describe` instead — desktop-only tests run in the
  desktop project, mobile-only in the mobile project.

## Discovery fetch failure is NOT a data gap

Specs discover their premise from staging `/markets` (`e2e/test-reserves.ts`).
"Staging has nothing that qualifies" and "the fetch failed" are different facts
and must not collapse into one skip — a collapsed guard turns a whole spec file
green while it verifies nothing (AAV-1352, same family as AAV-1294/1330/1349).

The contract:

- `fetchStagingReserves()` returns a **tagged outcome**: `ok` (with `reserves`,
  `[]` allowed) or `unreachable` (network error, non-2xx, timeout, bad JSON).
  Never a bare array whose emptiness is ambiguous.
- `findIncentiveReserve()` / `findAnyActiveReserve()` / `toDiscovery()` return
  `found` | `data-gap` | `unreachable`; `decideReserveGate()` maps that to
  `run` | `skip` | `fail`, and `enforceReserveGate()` applies it.
- **Data gap ⇒ `test.skip`** with a reason that says `/markets` loaded fine.
- **Unreachable ⇒ a real failure** (`throw` in `beforeEach`, or the placeholder
  test used when a scenario list is empty). `test.fail()` is wrong here: it
  records an expected failure as a pass.
- The only opt-out is `E2E_ALLOW_STAGING_UNREACHABLE=1` (same shape as
  `E2E_SKIP`): default off, `0`/empty/`yes` ignored, and the skip text still
  says the host was unreachable.
- **Fail at the live-test scope, never at module load.** A module-level throw
  would also take down variants that do not depend on staging data (the AAV-1316
  cross-asset stub), converting a live-data outage into lost coverage. Note those
  variants still share the module, so an outage costs them one bounded fetch of
  latency — not a failure.

Fetch policy lives in `e2e/stagingReservesFetch.ts`: 2 attempts × 30s, success
and failure both cached per process. Spec:
`docs/specs/aav-1352-staging-discovery-fetch-outcome.md`.

## Local pre-push gate: a missing browser is BLOCKED, not a skip

`npm run test:e2e:pre-push` (`scripts/pre-push-e2e.mjs`) is the only place a push
gets browser evidence locally. Its probing of `~/Library/Caches/ms-playwright`
used to end in `process.exit(0)` when chromium was absent — and exit code 0 here
means "the e2e gate passed". With `e2e-desktop`/`e2e-mobile` not being required
checks on any branch, that combination allowed a merge with zero browser tests
(AAV-1349).

The contract now:

- **Missing chromium ⇒ `exit 1`.** A gate that cannot run reports failure, with the
  reason, the cache path it looked in, and the fix (`npx playwright install chromium`).
- **`E2E_SKIP=1`** is the only bypass, it is per-push, and it prints that the push
  carries no e2e evidence. `E2E_SKIP=0`, empty, or any other value leaves the gate on.
- **`PLAYWRIGHT_BROWSERS_PATH=0`** (browsers inside `node_modules`) counts as
  installed — the global cache is legitimately empty in that mode.
- The decision logic lives in `scripts/lib/e2e-browser-gate.mjs`; the exit-code
  contract lives in the script. `scripts/pre-push-e2e.test.mjs` pins both, including
  a stub-`npx` case proving the run path still invokes Playwright.

This is **not** an "acceptable skip" in the sense above: those are `test.skip(...)`
calls inside a spec, this is the gate deciding not to run the suite at all.

## Seams (reuse, don't invent)

- Pure-function unit tests — e.g. `src/lib/poolExplorerLinks.test.ts`.
- Playwright `page.route` — network interception that replaces live integration.
- Playwright geometry assertions — `boundingBox` / `getComputedStyle`.

## Selectors must survive data drift

Backend data changes under the suite. Two rules, enforced by `npm run check:e2e-market-names` (pre-commit + CI `repo-policy`):

- **No chain name in a selector literal.** Pick the chip from the rendered row (`e2e/marketChips.ts`); a name in a *candidate list* that tolerates absence is fine. Arbitrum and Celo both left `/markets` and each took a spec down as a locator timeout that read like a flake.
- **Locate row chips by `data-chip-kind`, not by label text.** A row renders both `Filter by <hub> hub` and `Filter by <market> market`; `[aria-label^="Filter by "]` matches both → strict mode violation, or silently testing the hub. Use `button[data-chip-kind="market"]`. The attribute is asserted in `DesktopReserveRow.test.tsx`, so dropping it fails at the unit layer.
- **Discover the premise, don't assume the row index.** An assertion about *reordering* is only meaningful on a row whose market differs from the page it sits in. `reserves-table-market-filter-pin (5)` used "the 3rd visible row" and passed for months; on 2026-10-05 CI's snapshot had every visible row in one market (`Filter by Ink market` ×13), the filter changed nothing, nothing pinned, and it failed identically on both attempts (`y=376.75` vs a `274.25` anchor) — a deterministic data premise, not a load flake. Use `pickReorderCapableRowIndex(labels)` from `e2e/reserveDiscovery.ts` and `test.skip(-1, reason)` when no reorder-capable row exists, the same discovery+conditional-skip shape as `portfolio-cross-asset-pairing`.

Escape hatch for legitimate label collisions: `market-name-guard: allow` on the line. Coverage limits (chain names only, no hub names, no live-data comparison) are in `docs/specs/e2e-hardcoded-market-name-guard.md`.

## Red flag

A test that passes locally but fails in CI "because the network/environment drifted"
is a boundary violation, not a flaky test to re-run. Move its guard inward
(unit test) or make it deterministic (`page.route`).
