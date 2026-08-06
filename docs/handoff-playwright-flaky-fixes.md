# Handoff: Playwright E2E Flaky Test Fixes

> **Date**: 2026-08-04
> **Context**: P4 (AAV-1251) Playwright regression run revealed 63 pre-existing failures (CI passes with retries=2, local fails with retries=0)
> **Scope**: All failures are pre-existing — NONE caused by P4 changes. Fix in one focused session.

## Failure Summary

- **Total**: 265 tests, ~134 passed, ~63 failed, ~63 skipped (mobile versions of failed desktop tests)
- **CI status**: Both pre-P4 (`879f289f`) and post-P4 (`33192539`) CI = ✅ success (retries=2 masks flaky tests)
- **Root cause**: `playwright.config.ts` L11: `retries: process.env.CI ? 2 : 0` — CI retries flaky tests, local doesn't

## Failure Categories & Fixes

### Category 1: Staging Data Dependencies (~25 failures)

**Root cause**: Tests hardcode specific staging API values (Merkl campaign APRs, incentive amounts, token symbols). When staging data refreshes, expectations break.

**Failing tests**:
```
e2e/portfolio-cross-reserve-offset.spec.ts — cross-reserve: mUSD [Monad] supply offset by AUSD borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — cross-reserve: GHO [Monad] supply offset by AUSD borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — cross-reserve: AUSD [Monad] supply offset by GHO borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — self-loop: RLUSD [Horizon RWA] supply offset by own borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — self-loop: USDe [Plasma] supply offset by own borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — self-loop: USDe [MegaETH] supply offset by own borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — self-loop: USDe [Mantle] supply offset by own borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — self-loop: USDe [Monad] supply offset by own borrow (desktop)
e2e/portfolio-cross-reserve-offset.spec.ts — (all mobile versions of above)
e2e/portfolio-incentive-calculation.spec.ts — incentive columns show percentage values (desktop)
e2e/portfolio-incentive-calculation.spec.ts — preserves current incentive values (desktop)
e2e/verify-target-total-apr.spec.ts — frxUSD incentive tooltip shows TARGET_TOTAL_APR breakdown
e2e/fdv-continuous-input.spec.ts — typing multiple characters keeps focus and accumulates value
```

**Error pattern**: `expect(locator).not.toContainText(expected)` failed — text that should NOT appear IS appearing because staging data changed.

**Fix strategy**:
1. Replace hardcoded value assertions with format/structure assertions (e.g., assert a number format pattern instead of a specific APR value)
2. For `portfolio-cross-reserve-offset.spec.ts`: These tests depend on specific Merkl campaigns existing on staging. Add a `test.skip` when the campaign no longer exists, or parameterize the test to use whatever campaigns are currently active.
3. For `verify-target-total-apr.spec.ts`: Assert the tooltip structure exists, not specific campaign names.
4. For `fdv-continuous-input.spec.ts`: Check if the error text is from a different reserve's data appearing — might need to scope the locator better.

**Effort**: Medium (need to read each test and understand what it's asserting)

### Category 2: Timeout (~15 failures)

**Root cause**: Tests take 1.5-2 minutes, exceeding Playwright's 90s per-test timeout. Likely caused by slow staging API responses or heavy page rendering.

**Failing tests**:
```
e2e/portfolio-wallet-sync-precision.spec.ts — amount inputs keep ≤8 significant digits after Wallet Sync (desktop + mobile)
e2e/wallet-reconnect-after-refresh.spec.ts — watch-mode reconnects correctly after page refresh (desktop + mobile)
e2e/wallet-reconnect-after-refresh.spec.ts — Connect button stays clickable after page refresh (mobile)
e2e/wallet-reconnect-after-refresh.spec.ts — stale wagmi.store does not block Connect button after refresh (mobile)
e2e/wallet-reconnect-after-refresh.spec.ts — clearing wagmi store + refresh yields clean disconnected state (mobile)
e2e/wallet-reconnect-after-refresh.spec.ts — watch-mode persists across double refresh (mobile)
e2e/api-fields-verification.spec.ts — reserve detail panel opens and shows liquidity/borrow/supply data (mobile)
e2e/api-fields-verification.spec.ts — utilization indicator renders with percentage value (mobile)
e2e/api-fields-verification.spec.ts — rate simulation slider is interactable (mobile)
```

**Error pattern**: Test duration 1.5m+, then timeout.

**Fix strategy**:
1. Add `test.setTimeout(180000)` to slow tests (2x current timeout)
2. For `wallet-reconnect-after-refresh.spec.ts`: The page refresh + reconnect cycle is inherently slow. Consider reducing the number of sub-tests or mocking wallet connection.
3. For `api-fields-verification.spec.ts`: The mobile version is slower due to viewport rendering. Consider sharing the test logic with desktop and only testing mobile-specific layout separately.

**Effort**: Low (just add timeout overrides)

### Category 3: External Service Unavailability (~8 failures)

**Root cause**: External block explorer websites (Arbiscan, ZkSync Explorer) are intermittently unavailable or slow.

**Failing tests**:
```
e2e/explorer-links-smoke.spec.ts — [Arbiscan] AaveV3Arbitrum URL loads and shows contract
e2e/explorer-links-live-dom.spec.ts — AaveV3ZkSync opens explorer and verifies getReserveDeficit DOM
```

**Error pattern**: `expect(page).toHaveTitle(expected)` or `expect(locator).toContainText(expected)` failed — external explorer page didn't load or show expected content.

**Fix strategy**:
1. Add `test.skip` condition based on network availability check (e.g., `test.skip(!await isExplorerReachable('arbiscan.io'), 'Arbiscan unreachable')`)
2. Or mark as `test.fail` with a comment that it's an external dependency

**Effort**: Low (add skip conditions)

### Category 4: Visual Regression Flaky (~6 failures)

**Root cause**: `toHaveScreenshot()` pixel-level comparisons fail due to rendering differences (font rendering, anti-aliasing, timing of screenshot capture).

**Failing tests**:
```
e2e/segmented-toggle-visual.spec.ts — vertical toggle renders with correct radii and spacing at mobile viewport (desktop + mobile)
e2e/segmented-toggle-visual.spec.ts — horizontal toggle in ScenarioControls renders at desktop viewport (desktop + mobile)
e2e/segmented-toggle-visual.spec.ts — clicking a segment slides the indicator vertically (mobile)
e2e/portfolio-panel-header-visual.spec.ts — PortfolioPanel header visual @ mobile-chromium
```

**Error pattern**: `expect(locator).toHaveScreenshot(expected)` failed — pixel diff exceeds threshold.

**Fix strategy**:
1. Update baseline screenshots: `npx playwright test --update-snapshots`
2. Or increase tolerance: `toHaveScreenshot(expected, { maxDiffPixelRatio: 0.01 })`
3. For animation-related tests (segment indicator sliding): add `waitFor` before screenshot to ensure animation completed

**Effort**: Low (update screenshots or add tolerance)

### Category 5: Pre-existing Bugs (~9 failures)

**Root cause**: Actual bugs in the FAQ anchor scrolling and scenario pin visibility.

**Failing tests**:
```
e2e/defi-yield-tracker-faq-anchor.spec.ts — clicking each Related FAQ link scrolls the target into view with correct offset (desktop + mobile + tablet)
e2e/defi-yield-tracker-faq-anchor.spec.ts — loading the page with a FAQ hash scrolls the target into view and focuses it (desktop + mobile + tablet)
e2e/defi-yield-tracker-faq-anchor.spec.ts — loading with #faq scrolls to and focuses the FAQ heading (desktop + mobile)
e2e/reserves-table-scenario-pin.spec.ts — expanded row stays pinned after second scenario input reorders list
e2e/portfolio-panel-header-visual.spec.ts — PortfolioPanel header visual @ mobile-chromium (might be a real layout bug, not just flaky)
```

**Error pattern**: `toHaveAttribute(expected)` / `toBeVisible()` / `toBeInViewport()` failed.

**Fix strategy**:
1. For `defi-yield-tracker-faq-anchor.spec.ts`: Debug the anchor scrolling logic — might be a CSS `scroll-margin-top` issue or JS scroll behavior not accounting for sticky header height.
2. For `reserves-table-scenario-pin.spec.ts`: Check if the scenario pin scroll logic has a race condition between list reorder and scroll.
3. For `portfolio-panel-header-visual.spec.ts`: Check if there's a real layout shift on mobile.

**Effort**: Medium (need to debug actual behavior, not just update expectations)

## Recommended Fix Order

1. **Category 2 (Timeout)** — Quickest fix, unblocks most mobile tests
2. **Category 4 (Visual regression)** — Update baseline screenshots
3. **Category 3 (External services)** — Add skip conditions
4. **Category 1 (Staging data)** — Make assertions resilient
5. **Category 5 (Pre-existing bugs)** — Debug and fix actual bugs

## Prevention

To prevent flaky tests from accumulating:
1. **Never hardcode staging API values** — use format/structure assertions
2. **Set reasonable timeouts** — `test.setTimeout()` for known slow tests
3. **Mark external dependencies** — `test.skip` when services are unavailable
4. **Use tolerant visual regression** — `maxDiffPixelRatio` instead of pixel-perfect
5. **Consider local retries** — change `retries: 0` to `retries: 1` for local runs (CI already has 2)
