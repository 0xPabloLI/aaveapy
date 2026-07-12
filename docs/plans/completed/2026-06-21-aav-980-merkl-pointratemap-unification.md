# AAV-980: Unify sumMerklIncentiveApr — dispatch map uses aggregation canonical version

**Status**: ✅ Completed (verified 2026-06-27)
**Issue**: AAV-980
**Parent**: AAV-978 (Brevis 同模式统一)
**Project**: Incentive Source Upper-Layer Unification
**Date**: 2026-06-21

## Problem

Two `sumMerklIncentiveApr` implementations exist with divergent capabilities:

| Location | Signature | Key Differences |
|---|---|---|
| `rateSimulationCalculator.ts:520` | `(opportunities, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates?, groupMultiplier?, campaignAccessStatuses?)` | Has `isApy` + `groupMultiplier`, **no `pointRateMap`** |
| `incentiveAggregation.ts:77` | `(opportunities, pointToUsdRate?, options?)` | Has `pointRateMap` in options, **no `groupMultiplier`** |

When dispatch map calls calculator version, per-source Merkl APR can't route per-symbol rates via `pointRateMap`. Same divergence for `sumMerklIncentiveApy`.

## Current Impact

**Zero**. `pointRateMap` is never passed to `calculateTotalIncentiveApr/Apy` at runtime. All Merkl campaigns use `tydroPointToUsdRate` uniformly.

## Design Decisions

### D1: `getPointToUsdRate` fallback behavior — keep returning 0 for unknown symbols

**Rationale**: `tydroPointToUsdRate` is TydroInk-specific. A different symbol (e.g., `NewTokenPoints`) should NOT silently fallback to TydroInk's rate. "Can't find the symbol" = "don't know the rate" = 0. This is safer than silently using an unrelated symbol's rate.

**Implication**: When `pointRateMap` is eventually passed to dispatch map, any Merkl campaign with an unlisted `rewardTokenSymbol` will have 0 APR. This is correct behavior — the data source needs to be updated, not the code.

### D2: Dispatch map does NOT pass `pointRateMap` yet

**Rationale**: Current runtime has no `pointRateMap` in the calculator flow. Passing it now would require plumbing through the entire `buildRateSimulationResult` call chain with no benefit. `SideSourceContext` will reserve the field for future use.

### D3: APR/APY split follows Brevis pattern (AAV-978)

**Rationale**: Calculator version's `isApy` parameter conflates two responsibilities (compute APR + optionally convert to APY). Aggregation version separates them into `sumMerklIncentiveApr` and `sumMerklIncentiveApy`. Dispatch map will use `ctx.isApy ? sumMerklIncentiveApy(...) : sumMerklIncentiveApr(...)`.

### D4: `groupMultiplier` added to aggregation version

**Rationale**: Aggregation version lacks `groupMultiplier` support. Since `sumActiveCampaignBreakdownValues` already supports it, just add `groupMultiplier` to `IncentiveCalculationOptions` and wire it through.

## Implementation Plan

### Step 1: Add `groupMultiplier` to `IncentiveCalculationOptions`

```ts
// incentiveAggregation.ts
export interface IncentiveCalculationOptions {
  // ... existing fields ...
  /** Per-group multiplier for Merkl opportunity groups (e.g., cross-reserve eligibility). */
  merklGroupMultiplier?: (group: MerklOpportunityGroup) => number;
}
```

Wire `options.merklGroupMultiplier` into `sumMerklIncentiveApr` and `sumMerklIncentiveApy` via `sumActiveCampaignBreakdownValues`'s `groupMultiplier` option.

### Step 2: Export `sumMerklIncentiveApr` and `sumMerklIncentiveApy` from aggregation

Change from `const` to `export const`.

### Step 3: Delete calculator version `sumMerklIncentiveApr`

Remove `rateSimulationCalculator.ts:520-542`. All call sites switch to aggregation version.

### Step 4: Update dispatch map merkl entries

```ts
merkl: {
  // AAV-980: unified to aggregation canonical version
  sumCurrent: (data, ctx) =>
    ctx.isApy
      ? sumMerklIncentiveApy(data, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, forecastStates: ctx.forecastStates, campaignAccessStatuses: ctx.campaignAccessStatuses, merklGroupMultiplier: ctx.merklGroupMul })
      : sumMerklIncentiveApr(data, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, forecastStates: ctx.forecastStates, campaignAccessStatuses: ctx.campaignAccessStatuses, merklGroupMultiplier: ctx.merklGroupMul }),
  sumAfter: (data, ctx) => {
    const forecasted = buildForecastMerklOpportunities({ ... });
    return ctx.isApy
      ? sumMerklIncentiveApy(forecasted, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, merklGroupMultiplier: ctx.merklGroupMul })
      : sumMerklIncentiveApr(forecasted, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, merklGroupMultiplier: ctx.merklGroupMul });
  },
  // buildDetails unchanged
}
```

### Step 5: Update `buildIncentiveAfter` Merkl path

Replace inline calculator `sumMerklIncentiveApr` call with aggregation version.

### Step 6: Add `pointRateMap` to `SideSourceContext` (reserved, not wired)

```ts
interface SideSourceContext {
  // ... existing ...
  pointRateMap?: PointRateMap; // AAV-980: reserved for per-symbol rate routing
}
```

Not passed to `sumMerklIncentiveApr` yet — will be wired when backend provides `pointRateMap` in the calculator flow.

### Step 7: Tests

- TDD: Add tests for `sumMerklIncentiveApr` with `groupMultiplier` in `incentiveAggregation.test.ts`
- TDD: Add tests for `sumMerklIncentiveApy` with `groupMultiplier`
- Existing `rateSimulationCalculator.test.ts` tests should pass unchanged (behavior is identical)
- Architecture guard: verify per-source Merkl current + other sources = total current

## Key Code Locations

| What | File | Lines |
|---|---|---|
| Calculator `sumMerklIncentiveApr` (to delete) | `rateSimulationCalculator.ts` | 520-542 |
| Aggregation `sumMerklIncentiveApr` (canonical) | `incentiveAggregation.ts` | 77-98 |
| Aggregation `sumMerklIncentiveApy` | `incentiveAggregation.ts` | 100-121 |
| `IncentiveCalculationOptions` | `incentiveAggregation.ts` | 17-26 |
| Dispatch map merkl entry | `rateSimulationCalculator.ts` | 1282-1295 |
| `buildIncentiveAfter` Merkl path | `rateSimulationCalculator.ts` | ~898 |
| `SideSourceContext` | `rateSimulationCalculator.ts` | 1248-1265 |
| `getPointToUsdRate` (unchanged) | `tydro.ts` | 32-37 |

## Risks

- **Low**: No `pointRateMap` is passed yet, so behavior is identical to current state
- **Medium**: `groupMultiplier` addition to aggregation version must match calculator behavior exactly
- **Regression protection**: Add AAV-980 comment annotation in dispatch map alongside AAV-978/AAV-979 comments

## Acceptance Criteria

1. `rateSimulationCalculator.ts` no longer has a local `sumMerklIncentiveApr`
2. Dispatch map merkl uses aggregation `sumMerklIncentiveApr`/`sumMerklIncentiveApy`
3. Aggregation version supports `groupMultiplier`
4. All existing tests pass (zero behavior change)
5. New tests cover `groupMultiplier` in aggregation version
6. CI gate passes: `npm run lint && npm test && npm run build && npx tsc --noEmit`
