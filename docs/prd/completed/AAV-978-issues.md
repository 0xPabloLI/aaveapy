# AAV-978 Implementation Issues

## Issue 1: TDD — Add unit tests for `sumBrevisIncentiveApr` / `sumBrevisIncentiveApy`

**Priority**: High
**Labels**: tdd

### Description

为 `incentiveAggregation.ts` 中的 `sumBrevisIncentiveApr` 和 `sumBrevisIncentiveApy` 添加直接单元测试。当前两个函数都没有单独的测试覆盖。

### Test Cases

1. Empty/undefined input returns 0
2. Without forecastStates: returns sum of active campaign APRs
3. With forecastStates: uses `forecastMerklApr` instead of raw `campaignApr`
4. Inactive campaigns (past end date) are excluded
5. Open-ended campaigns (no end date) are included (allowOpenEnd: true)
6. Negative APR values are filtered to 0
7. NaN APR values are filtered to 0
8. APY version converts each campaign APR to APY before summing
9. Multiple BrevisIncentive groups with multiple breakdowns each are summed correctly
10. forecastStates present but no matching campaignId falls back to raw campaignApr

### Prior Art

- `src/lib/brevis.test.ts` — existing tests for `getBrevisResolvedBreakdown` and `forecastMerklApr`
- `src/lib/incentiveAggregation.test.ts` — existing tests for `getReserveIncentiveValues`

---

## Issue 2: TDD — Add dispatch map integration test for Brevis per-source current = total current Brevis portion

**Priority**: High
**Labels**: tdd

### Description

通过 `buildRateSimulationResult` 端到端测试验证：当 forecastStates 存在时，`sources.brevis.current` 等于 `currentIncentive` 中的 Brevis 分量。

### Test Cases

1. With forecastStates: `sources.brevis.current` = Brevis portion of total `currentIncentive`
2. Without forecastStates: same equality holds (both use raw campaignApr)
3. `sources.brevis.current` + `sources.merit.current` + `sources.merkl.current` + `sources.protocol.current` ≈ total `currentIncentive`
4. `sources.brevis.after` is not affected by this change (still uses `sumForecastBrevisIncentiveApr`)

### Prior Art

- `src/lib/rateSimulationCalculator.test.ts` — existing end-to-end tests

---

## Issue 3: Export `sumBrevisIncentiveApr` / `sumBrevisIncentiveApy` from `incentiveAggregation.ts`

**Priority**: High

### Description

Both functions are currently private (no `export`). Add `export` keyword so the dispatch map can import them.

### Changes

- `src/lib/incentiveAggregation.ts` line 123: `const sumBrevisIncentiveApr` → `export const sumBrevisIncentiveApr`
- `src/lib/incentiveAggregation.ts` line 139: `const sumBrevisIncentiveApy` → `export const sumBrevisIncentiveApy`

---

## Issue 4: Delete `sumBrevisIncentiveApr` from `rateSimulationCalculator.ts` and update dispatch map

**Priority**: High

### Description

Delete the calculator version of `sumBrevisIncentiveApr` (line 416-433) and update the dispatch map to use the aggregation version.

### Changes

1. Delete `sumBrevisIncentiveApr` from `rateSimulationCalculator.ts` (line 416-433)
2. Add import from `incentiveAggregation.ts`: `import { sumBrevisIncentiveApr, sumBrevisIncentiveApy } from './incentiveAggregation'`
3. Update dispatch map line 1315:
   - Before: `sumCurrent: (data, ctx) => sumBrevisIncentiveApr(data, ctx.isApy)`
   - After: `sumCurrent: (data, ctx) => ctx.isApy ? sumBrevisIncentiveApy(data, ctx.forecastStates) : sumBrevisIncentiveApr(data, ctx.forecastStates)`
4. Verify no other callers of the deleted function exist (grep `sumBrevisIncentiveApr` in `rateSimulationCalculator.ts`)

### Risk

- The deleted version used `isApy` parameter for inline APY conversion; the new pattern uses separate functions. Verify APY conversion produces identical results for the same input.
- The deleted version used `sanitizePercent(resolved.campaignApr)` without negative value guard; the aggregation version adds `!isNaN(apr) && apr >= 0 ? apr : 0`. This is more defensive — verify no legitimate negative APR scenarios exist for Brevis.

---

## Issue 5: Update `buildBrevisCampaignDetails` per-campaign current to include forecastStates

**Priority**: Medium

### Description

`buildBrevisCampaignDetails` constructs per-campaign detail rows. Its `current` field should also use forecast-aware calculation when `forecastStates` is available, maintaining consistency with the per-source sum.

### Analysis Needed

- Check current per-campaign `current` calculation in `buildBrevisCampaignDetails`
- If it uses `sanitizePercent(resolved.campaignApr)` (headline), change to use `forecastMerklApr` when `forecastStates` is available
- Verify per-campaign `current` values sum to per-source `current` value

---

## Issue 6 (Follow-up): Merit per-source current missing position cap dilution

**Priority**: Medium
**Labels**: bug, follow-up

### Description

Dispatch map's Merit `sumCurrent` uses `sumMeritIncentiveApr` (headline, no position cap dilution), but `buildIncentiveCurrent` applies position cap dilution when wallet has position. Per-source Merit current + other sources ≠ total current when position cap is active.

### Fix Direction

1. Add `walletPositionUsd` to `SideSourceContext`
2. Change Merit `sumCurrent` to use `sumForecastMeritIncentiveApr(data, ctx.isApy, 0, ctx.anchorTvlUsd, ctx.walletPositionUsd)`
3. Update `buildMeritCampaignDetails` per-campaign `current` similarly

---

## Issue 7 (Follow-up): Merkl per-source current missing pointRateMap support

**Priority**: Medium
**Labels**: bug, follow-up

### Description

`rateSimulationCalculator.sumMerklIncentiveApr` doesn't support `pointRateMap` (dynamic rate routing by reward token symbol), while `incentiveAggregation.sumMerklIncentiveApr` does. When Merkl campaigns have non-TYDRO reward tokens, per-source current uses wrong rate.

### Fix Direction

Align `rateSimulationCalculator.sumMerklIncentiveApr` to accept `pointRateMap` parameter, or unify to use the aggregation version.
