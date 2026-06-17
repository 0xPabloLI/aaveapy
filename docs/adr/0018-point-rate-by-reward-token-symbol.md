# ADR-0018: Point-to-USD Rate Routing by Reward Token Symbol

**Status**: Accepted
**Date**: 2026-06-17
**Issues**: AAV-898, AAV-81

## Context

`TYDRO_POINT_TO_USD_RATE = 1` was a global default for all points campaigns. AMOUNT variant POINT tokens (ipor-fusion-points, Gravity Points, LendPoints) used rate=1, producing phantom APR.

Ink (TydroInkPoints) is the only points token with a user-adjustable rate (FDV slider). All other points tokens have no USD price — rate should be 0.

## Decision

### 1. `safePointToUsdRate` fallback: 1 → 0

Invalid inputs (NaN/Infinity/negative) now fall back to 0 instead of `TYDRO_POINT_TO_USD_RATE=1`. Explicit 0 is preserved (user intent to zero out).

`TYDRO_POINT_TO_USD_RATE = 1` constant stays — it's Ink's default, not the global fallback.

### 2. Per-campaign rate routing via `rewardTokenSymbol`

Backend adds `rewardTokenSymbol` (from Merkl `rewardToken.symbol`) and `rewardTokenIconUrl` (from Merkl `rewardToken.icon`) to `MerklCampaignBreakdown`.

Frontend routes rate by symbol (case-insensitive):

```typescript
const pointRateMap = useMemo(() => ({
  tydroinkpoints: tydroPointToUsdRate,
}), [tydroPointToUsdRate]);

function getPointToUsdRate(symbol, pointRateMap): number {
  if (!symbol) return 0;
  return pointRateMap[symbol.toLowerCase()] ?? 0;
}
```

- `TydroInkPoints` → FDV slider rate
- All other symbols → 0
- Missing symbol → 0

### 3. Remove `pointToUsdRate = TYDRO_POINT_TO_USD_RATE` default parameters

All functions (`getMerklBreakdownApr`, `forecastMerklApr`, `mergeForecastState`, etc.) no longer default to `TYDRO_POINT_TO_USD_RATE`. Callers compute per-campaign rate via `getPointToUsdRate(breakdown.rewardTokenSymbol, pointRateMap)` and pass it explicitly.

Component prop changes from `tydroPointToUsdRate: number` to `pointRateMap: Record<string, number>`.

### 4. Reward token icon in IncentiveTooltip

`rewardTokenIconUrl` displayed as a small icon before APR%: `[Name] [RewardIcon] APR%`.

### 5. `mergeForecastState` / `normalizeUsdUnit` for AMOUNT variants

Rate=0 for non-Ink points means `convertMerklPointsAmountToUsd(value, 0) = 0`. For AMOUNT variants with `campaignApr = 0`, APR=0% is the expected behavior (no USD price available). For campaigns with `campaignApr > 0`, the first branch in `getMerklBreakdownApr` returns `campaignApr` directly, bypassing the points path entirely.

## Consequences

- Non-Ink points campaigns no longer show phantom APR
- Ink FDV slider continues to work unchanged
- New points tokens with custom rates only require adding an entry to `pointRateMap`
- All test fixtures using `tydroPointToUsdRate: 0` or `tydroPointToUsdRate: 1` migrate to `pointRateMap: { tydroinkpoints: 0 }` or `{ tydroinkpoints: 1 }`

## Implementation

**Status**: Completed (2026-06-17)

### Frontend commits (aaveapy, branch `lovable`)

- `619fac4a` — remove `missingSymbolFallback` from `getPointToUsdRate`
- `0be584d7` — unify badge and tooltip to use `getPointToUsdRate` via `pointRateMap`

### Backend commits (aave-protocol-analysis)

- `3fbc146` — add `rewardTokenSymbol` + `rewardTokenIconUrl` to `MerklCampaignBreakdown`

### Linear issues

- AAV-937 (PRD) → Done
- AAV-941 (safePointToUsdRate fallback) → Done
- AAV-943 (getPointToUsdRate + pointRateMap prop drill) → Done
- AAV-945 (IncentiveTooltip reward token icon) → Done

### Deployment note

Backend commit `3fbc146` must deploy before frontend for `rewardTokenSymbol` to appear in production API.
