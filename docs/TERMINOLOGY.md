# Project Terminology Reference

This document provides a consolidated reference for terminology, variable names, and field mappings used across the codebase.

---

## Rate Calculation Terminology

### Core Rate Variables

| Term / Variable | Alias | Context | Unit | Description |
|-----------------|-------|---------|------|-------------|
| `liquidityRate` | `supplyRate` | Internal calculation | ray (10^27) | Aave protocol term for supplier yield |
| `supplyAprPercent` | — | Output/display | % (percentage) | Same as `liquidityRate`, converted to percentage |
| `supplyApyPercent` | — | Output/display | % (percentage) | `liquidityRate` with compounding, as percentage |
| `variableBorrowRate` | Borrow rate | Calculation | ray (10^27) | Interest rate charged to borrowers |
| `reserveFactor` | Protocol fee | Input parameter | bps (0-10000) | Fee deducted from interest before reaching suppliers |

**Key relationship**: `liquidityRate` (internal calculation) = `supplyAprPercent` (output to UI)

### Rate Calculation Flow

```
Backend API (reserveFactor: '1000' bps)
    ↓
src/lib/interestRateCalculator.ts
    ├── liquidityRate = (borrowRate × supplyUsageRate) × (1 - reserveFactor/10000)
    └── Output: supplyAprPercent, supplyApyPercent
        ↓
src/hooks/useRateSimulation.ts
    └── UI display: reserveFactor = 10% (converted from bps)
```

### Utilization Rates

| Term | Context | Includes Deficit | Usage |
|------|---------|------------------|-------|
| `borrowUsageRate` | Borrow rate calculation | ❌ No | External utilization display |
| `supplyUsageRate` | Liquidity rate calculation | ✅ Yes | Supplier yield calculation |

### Constants

| Name | Value | Usage |
|------|-------|-------|
| `RAY` | 10^27 | Aave fixed-point precision |
| `PERCENTAGE_FACTOR` | 10000 | Basis points denominator |
| `SECONDS_PER_YEAR` | 31536000 | 365 × 24 × 60 × 60 |

---

## Data Loading Terminology

### React Query Terms

| Term | What it means |
|------|---------------|
| App-level prefetch | `queryClient.prefetchQuery(...)` started during app bootstrap before page components mount |
| Post-home warm-up / delayed warm-up | Best-effort background fetch in `useEffect(...)` after page data loads (e.g. reserves), scheduled via `requestIdleCallback` or `setTimeout` |
| Hook query | A regular `useQuery(...)` call inside a mounted component |
| Warm-up | A best-effort background fetch in `useEffect(...)` (often delayed), used to reduce first-interaction latency. Prefetch is a form of warm-up |
| React Query cache | Cache managed by TanStack Query by `queryKey` (`staleTime`, retries, dedupe by key) |
| Module in-memory cache | Custom `Map` caches in utility modules (for example forecast batch cache/in-flight dedupe) |
| Local storage cache | Persistent browser cache via `localStorage` wrappers in `src/lib/cache.ts` |

### Prefetch/Preload at Different Layers

| Layer | Technique | Meaning | Timing |
|-------|-----------|---------|--------|
| **Browser (HTML)** | `<link rel="prefetch">` | Load resources for the **next page** | Current page idle time |
| **Browser (HTML)** | `<link rel="preload">` | Prioritize critical resources for **current page** | During page load |
| **React Query** | `prefetchQuery()` | Fetch data into cache before component needs it | When code executes |
| **Native JS** | `fetch()` | Make a network request | When code executes |

### Warm-up Stage Terminology (中英对照)

| Stage | English | 中文 |
|-------|---------|------|
| App bootstrap prefetch | App-level prefetch / bootstrap prefetch | 应用级预取 / 启动预取 |
| Home fetch | Home fetch / initial page query | 首页请求 / 首屏数据请求 |
| Post-home delayed fetch | Post-home warm-up / delayed warm-up | 首页加载后预热 / 延迟预热 |
| On-demand when needed | On-demand fetch / lazy fetch | 按需请求 / 懒加载 |
| Downgrade from prefetch to warm-up | Downgrade from prefetch to post-home warm-up | 从预取降级为延迟预热 |

---

## API Field Categories

### Interest Rate Curve Parameters (Must Keep)

| Field | Unit | Description |
|-------|------|-------------|
| `reserveFactor` | bps | Protocol fee deduction |
| `variableRateSlope1` | ray | Rate curve slope (below optimal) |
| `variableRateSlope2` | ray | Rate curve slope (above optimal) |
| `baseVariableBorrowRate` | ray | Base borrow rate |
| `optimalUsageRate` | ray | Optimal utilization threshold |
| `decimals` | number | Unit conversion |

### Liquidity & Market Data (Must Keep)

| Field | Unit | Description |
|-------|------|-------------|
| `availableLiquidity` | token decimals | Pool liquidity available for borrowing |
| `totalVariableDebt` | token decimals | Variable debt before index multiplication |
| `deficit` | token decimals | Reserve deficit from onchain/Aave API |
| `tokenPrice` | USD | USD display & sorting |
| `reserveSizeUsd` | USD | Market size display & sorting |
| `supplyCapUsd` / `borrowCapUsd` | USD | Cap progress bar display |

### Derivable but Essential (Keep for Convenience)

| Field | Derivation | Keep Reason |
|-------|------------|-------------|
| `utilizationPct` | `availableLiquidity` + `totalVariableDebt` | Used in table display & sorting |
| `supplyApy` | APR + compound interest formula | Used in APR/APY toggle display |
| `borrowApy` | APR + compound interest formula | Used in APR/APY toggle display |

---

## Incentive Terminology

### Campaign Types

| Campaign Type | Description | Forecast Path |
|---------------|-------------|---------------|
| `DUTCH_AUCTION` | Dutch auction emission | Planned-only, uses fallback APR |
| `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | APR-capped with catch-up | Capped by APR, then catch-up via required daily emission |
| `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | Fixed APR budget | Fixed APR budget path with remaining budget cap |

### Cap Types

| Cap Type | Scope | Mechanism | Source |
|----------|-------|-----------|--------|
| Pool budget | Pool-wide | `dailyRewards = min(aprBasedDaily, remainingBudget)` | `merklForecast.ts` |
| Deposit ceiling | Per-user | `eligibleDeposit = min(deposit, selfCapUsd)` | `meritForecast.ts` |
| Per-user reward ceiling | Per-user | Cap by reward / remaining horizon | `brevisForecast.ts` |

### Tydro Points

| Term | Description |
|------|-------------|
| `pointsPerThousandUsd` | Only Merkl's optional points path is treated as Tydro |
| Tydro point-to-APR | `points × pointToUsdRate × 36.5` |

**Note**: `Merit` / `Brevis` / protocol incentives are **not** Tydro points.

---

## Field Naming Conventions

### API Layer vs Domain Layer

| Layer | Naming Style | Example |
|-------|--------------|---------|
| API (backend) | Stable field names | `perUserRewardCapUsd` |
| Domain (frontend) | Ceiling vocabulary | `depositCeilingUsd`, `rewardCeilingUsd` |
| UI (display) | Stable diagnostics | `capNote`, `capWarning` |

### Unit Conventions

| Unit | Format | Example |
|------|--------|---------|
| bps (basis points) | string (bigint) | `'1000'` = 10% |
| ray | string (bigint) | `'1000000000000000000000000000'` = 1.0 |
| percentage | number | `10` = 10% |
| USD | number | `1000000` = $1,000,000 |
| token decimals | string (bigint) | Depends on token (e.g., 18 for ETH) |

---

## Related Documents

- [`rate-calculation.md`](./rate-calculation.md) — Detailed rate calculation formulas
- [`frontend-data-loading-matrix.md`](./frontend-data-loading-matrix.md) — Data loading architecture
- [`api-field-optimization.md`](./api-field-optimization.md) — API field analysis
- [`design/frontend-interaction-guardrails.md`](./design/frontend-interaction-guardrails.md) — Interaction design patterns
