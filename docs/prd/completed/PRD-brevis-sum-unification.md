# PRD: Unify `sumBrevisIncentiveApr` — Eliminate Per-Source vs Total Current Discrepancy

**Issue**: AAV-978
**Project**: Incentive Source Upper-Layer Unification

## Problem Statement

两个 `sumBrevisIncentiveApr` 同名但签名和计算逻辑完全不同。dispatch map 的 per-source `sumCurrent` 使用 `rateSimulationCalculator.ts` 版本（纯 headline，无 forecastStates），而 `buildIncentiveCurrent` → `calculateTotalIncentiveApr` 使用 `incentiveAggregation.ts` 版本（支持 forecastStates）。当 forecastStates 存在时，per-source Brevis current ≠ total current 中的 Brevis 分量，用户在 UI 上看到分项之和 ≠ 总值。

## Solution

将 `rateSimulationCalculator.ts` 中的 `sumBrevisIncentiveApr` 替换为 `incentiveAggregation.ts` 中的版本，使 dispatch map 的 per-source current 与 `buildIncentiveCurrent` 使用同一口径。同时引入 `sumBrevisIncentiveApy` 配对函数，遵循 APR-only + 独立 APY 转换的模式，与 Merit/Merkl 保持一致。

## User Stories

1. As a user, I want per-source Brevis incentive current values to match the Brevis portion of total current incentive, so that the source breakdown adds up correctly
2. As a user, I want the Brevis per-source current to reflect forecast-adjusted APR when forecast data is available, so that I see the most accurate current incentive estimate
3. As a user, I want the delta (after - current) to be calculated on a consistent basis for Brevis incentive, so that the delta reflects only the real simulation effect without forecast-related jumps
4. As a developer, I want a single `sumBrevisIncentiveApr` function with one canonical implementation, so that there is no ambiguity about which version to use
5. As a developer, I want the dispatch map's Brevis `sumCurrent` to accept `forecastStates` like Merkl's `sumCurrent` already does, so that all sources have consistent forecast support in per-source current
6. As a developer, I want `sumBrevisIncentiveApr` and `sumBrevisIncentiveApy` to follow the same APR-only + separate APY pattern as Merit and Merkl, so that the codebase has a uniform style

## Implementation Decisions

### 1. Delete calculator version, use aggregation version

Delete `sumBrevisIncentiveApr` from `rateSimulationCalculator.ts` (line 416-433). The canonical implementation lives in `incentiveAggregation.ts` (line 123-137), which uses `sumActiveCampaignBreakdownValues` and supports `forecastStates`.

### 2. Export `sumBrevisIncentiveApr` and `sumBrevisIncentiveApy` from `incentiveAggregation.ts`

Both functions are currently private (no `export`). They need to be exported so the dispatch map can import them.

### 3. Dispatch map `sumCurrent` change

Before:
```
sumCurrent: (data, ctx) => sumBrevisIncentiveApr(data, ctx.isApy)
```

After:
```
sumCurrent: (data, ctx) => ctx.isApy
  ? sumBrevisIncentiveApy(data, ctx.forecastStates)
  : sumBrevisIncentiveApr(data, ctx.forecastStates)
```

This mirrors the pattern used by `sumAfter` which already passes `ctx.forecastStates`.

### 4. SideSourceContext already has `forecastStates`

The `SideSourceContext` interface (line 1269-1285) already includes `forecastStates?: Record<string, MerklForecastWireItem>`. No context changes needed.

### 5. Update `buildBrevisCampaignDetails` per-campaign `current` to include forecastStates

`buildBrevisCampaignDetails` (line 653+) constructs per-campaign detail rows. Its `current` field should also use forecast-aware calculation when `forecastStates` is available, to maintain consistency with the per-source sum. The function already receives `forecastStates` as a parameter.

### 6. No changes to `buildIncentiveCurrent` or `calculateTotalIncentiveApr`

These functions already use the `incentiveAggregation.ts` version. No changes needed.

### 7. Sanitize behavior alignment

The aggregation version uses `!isNaN(apr) && apr >= 0 ? apr : 0` for negative value filtering. The old calculator version used `sanitizePercent(resolved.campaignApr)` without this guard. The new behavior is more defensive and aligns with the Merit/Merkl pattern in `incentiveAggregation.ts`.

## Testing Decisions

### What makes a good test

Tests should verify external behavior (per-source current equals Brevis portion of total current) rather than implementation details (which function is called).

### Modules to test

1. **`sumBrevisIncentiveApr` / `sumBrevisIncentiveApy`** — direct unit tests:
   - Without forecastStates: returns sum of active campaign APRs
   - With forecastStates: uses `forecastMerklApr` instead of raw `campaignApr`
   - Empty/undefined input returns 0
   - Inactive campaigns are excluded
   - Negative/NaN APR values are filtered to 0
   - APY version converts each campaign APR to APY before summing

2. **Dispatch map integration** — via `buildRateSimulationResult` end-to-end tests:
   - `sources.brevis.current` equals Brevis portion of `currentIncentive` when forecastStates is present
   - `sources.brevis.current` + other sources' current ≈ total `currentIncentive`
   - `sources.brevis.after` is not affected by this change (uses `sumForecastBrevisIncentiveApr`)

### Prior art

- `src/lib/rateSimulationCalculator.test.ts` — existing end-to-end tests for `buildRateSimulationResult`
- `src/lib/incentiveAggregation.test.ts` — existing tests for `getReserveIncentiveValues` and `getIncentiveSources`
- `src/lib/brevis.test.ts` — existing tests for `getBrevisResolvedBreakdown` and `forecastMerklApr` in Brevis context

## Out of Scope

1. **Merit per-source current position cap dilution** — confirmed as bug (separate issue to be created)
2. **Merkl per-source current pointRateMap / groupMultiplier alignment** — needs deeper architecture analysis (separate issue)
3. **Renaming `sumForecastBrevisIncentiveApr` or other Brevis forecast functions** — out of scope for this PRD
4. **Changing the `sumActiveCampaignBreakdownValues` generic itself** — the shared infrastructure is correct; the fix is in the per-source wrappers

## Further Notes

### Discovered bugs in other sources

During Grill with Docs analysis, two additional bugs were confirmed:

1. **Merit**: `dispatch sumCurrent` uses `sumMeritIncentiveApr` (headline, no position cap dilution), but `buildIncentiveCurrent` applies position cap dilution when wallet has position. Per-source Merit current + other sources ≠ total current when position cap is active. Fix requires adding `walletPositionUsd` to `SideSourceContext`.

2. **Merkl**: `rateSimulationCalculator.sumMerklIncentiveApr` doesn't support `pointRateMap` (dynamic rate routing by reward token symbol), while `incentiveAggregation.sumMerklIncentiveApr` does. When Merkl campaigns have non-TYDRO reward tokens, per-source current uses wrong rate. Fix requires aligning pointRateMap support.

Both should be tracked as separate issues in the "Incentive Source Upper-Layer Unification" project.
