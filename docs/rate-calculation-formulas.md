# Rate Calculation Formulas

Frontend interest rate simulation based on `/rate-inputs` API data (native Aave rates).

This document also describes **Merkl incentive forecast** (`forecastWithTVL`), used when simulating **incentive APR** after a hypothetical **USD** supply/borrow change. Sources: `src/lib/merklForecast.ts`, `src/hooks/useRateSimulation.ts`.

Source (native rates): `src/lib/interestRateCalculator.ts`

## Constants

| Name | Value | Usage |
|------|-------|-------|
| RAY | 10^27 | Aave's fixed-point precision unit |
| PERCENTAGE_FACTOR | 10000 | Basis points (bps) denominator |
| SECONDS_PER_YEAR | 31536000 | 365 × 24 × 60 × 60 |

## Input Fields (from `/rate-inputs`)

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `availableLiquidity` | string (bigint) | token decimals | Pool liquidity available for borrowing |
| `totalScaledVariableDebt` | string (bigint) | scaled units | Accumulated variable debt (needs index multiplication) |
| `variableBorrowIndex` | string (bigint) | ray (10^27) | Interest accumulation index |
| `deficit` | string (bigint) | token decimals | Reserve deficit from onchain/Aave API |
| `reserveFactor` | string (bigint) | bps | Protocol fee on interest (0–10000) |
| `optimalUsageRate` | string (bigint) | ray | Target utilization (kink point) |
| `baseVariableBorrowRate` | string (bigint) | ray | Minimum borrow rate |
| `variableRateSlope1` | string (bigint) | ray | Rate slope below optimal utilization |
| `variableRateSlope2` | string (bigint) | ray | Rate slope above optimal utilization |

## Calculation Steps

### 1. Compute Total Variable Debt

```
totalVariableDebt = rayMul(totalScaledVariableDebt, variableBorrowIndex)
```

Where `rayMul(a, b) = (a × b + RAY/2) / RAY`

### 2. Adjust for User Actions (simulation)

```
totalVariableDebt' = totalVariableDebt + borrowAmount
```

### 3. Compute Usage Rates

**Important:** Aave uses two distinct usage rates:

| Rate | Formula | Purpose |
|------|---------|---------|
| `borrowUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + supplyAmount)` | Borrow rate calculation, externally displayed utilization |
| `supplyUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + deficit + supplyAmount)` | Liquidity rate calculation (includes deficit) |

```
borrowUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + supplyAmount)
supplyUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + deficit + supplyAmount)
```

Where `rayDiv(a, b) = (a × RAY + b/2) / b`

Results are in ray units (e.g., 0.8 × 10^27 = 80% utilization).

**Note:** The externally displayed "utilization" is `borrowUsageRate` (without deficit). The `supplyUsageRate` is higher when deficit exists, diluting supplier yields.

### 4. Compute Variable Borrow Rate (APR)

Two-slope linear model with kink at `optimalUsageRate`, using **borrowUsageRate**:

**If `borrowUsageRate ≤ optimalUsageRate`:**
```
normalizedUsage = rayDiv(borrowUsageRate, optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + rayMul(variableRateSlope1, normalizedUsage)
```

**If `borrowUsageRate > optimalUsageRate`:**
```
excessRatio = rayDiv(borrowUsageRate - optimalUsageRate, RAY - optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + variableRateSlope1 + rayMul(variableRateSlope2, excessRatio)
```

Result is annual rate in ray units.

### 5. Compute Liquidity Rate (Supply APR)

Uses **supplyUsageRate** (which includes deficit):

```
liquidityRate = percentMul(
  rayMul(variableBorrowRate, supplyUsageRate),
  PERCENTAGE_FACTOR - reserveFactor
)
```

Where `percentMul(v, pct) = (v × pct + 5000) / 10000`

This is the interest paid to suppliers after protocol fee. When deficit exists, `supplyUsageRate < borrowUsageRate`, resulting in lower supplier yields.

### 6. Convert APR to APY (compound)

```
ratePerSecond = aprRay / SECONDS_PER_YEAR
apyRay = rayPow(RAY + ratePerSecond, SECONDS_PER_YEAR) - RAY
```

Where `rayPow` is exponentiation via binary decomposition.

### 7. Convert Ray to Percentage

```
percent = Number(rayValue) / 1e25
```

Example: `2.5e25` ray → `2.5%`

## Output Structure

```typescript
interface NativeRateSimulation {
  utilizationRateRay: string;      // ray units
  utilizationRatePercent: number;  // e.g. 80.0
  supplyAprPercent: number;        // e.g. 2.5
  borrowAprPercent: number;        // e.g. 3.2
  supplyApyPercent: number;        // e.g. 2.53
  borrowApyPercent: number;        // e.g. 3.25
  addedLiquidityRaw: string;       // user supply input (raw)
  addedBorrowRaw: string;          // user borrow input (raw)
}
```

## Visual Model

```
Borrow Rate
    │
    │                      ╱ slope2 (steep)
    │                     ╱
    │                    ╱
    │           ╱───────•  ← kink at optimalUsageRate
    │          ╱ slope1
    │         ╱
    ├────────•  ← baseVariableBorrowRate
    │
    └──────────────────────────────► Utilization
              optimal (e.g. 80%)
```

## Debugging Checklist

| Check | How |
|-------|-----|
| Utilization mismatch | Compare `utilizationRatePercent` vs market's `utilizationPct` |
| Rate mismatch | Verify slope params, reserveFactor, index values |
| Ray precision | Ensure all inputs are parsed as bigint, not Number (precision loss) |
| Index staleness | `variableBorrowIndex` should reflect recent accrual |

## Borrow Availability Constraint

When simulating borrow actions, the available borrow amount is constrained by **both** pool liquidity and borrow cap:

```
Available to Borrow = min(Pool Liquidity + Supply Input, Borrow Cap Remaining)
```

Where:
- **Pool Liquidity** = `availableLiquidity` from `/rate-inputs` (converted to USD)
- **Supply Input** = User's supply input (adds to available liquidity)
- **Borrow Cap Remaining** = `borrowCapUsd - currentTotalBorrowedUsd`

### Constraint Application

| Constraint | When Active | UI Message |
|------------|-------------|------------|
| Borrow Cap | `borrowCapRemaining < poolLiquidity` | "limited by borrow cap" |
| Pool Liquidity | `poolLiquidity < borrowCapRemaining` | "limited by pool liquidity" |

The simulation hook (`useRateSimulation.ts`) automatically caps borrow input to the effective limit. The UI shows which constraint is binding when the user exceeds it.

## Merkl incentive forecast (`forecastWithTVL`)

Source: `src/lib/merklForecast.ts`. Wired into simulation via `forecastBreakdownApr` and `buildForecastMerklOpportunities` in `src/hooks/useRateSimulation.ts`. Campaign state is loaded from **`GET /meta/side-data`** → `forecast.items` (typed as `MerklForecastStateResponse`).

### How simulation connects

- User input is converted to **USD** for incentives: token mode uses `amount × tokenPrice` where available (`supplyInputUsd` / `borrowInputUsd`).
- For each Merkl breakdown with a `campaignId` and matching forecast row, the model uses:

```
hypotheticalTvl = max(0, latestTvl + inputUsd)
```

where `inputUsd` is the hypothetical **increment** on the campaign’s eligible TVL in **USD** (same semantics as `tvl` below). If `inputUsd ≤ 0` or there is no forecast row, the UI keeps the **current** Merkl APR from the reserve (`getMerklBreakdownApr`).

**`getMerklBreakdownApr` precedence** (`src/lib/tydro.ts`): if **`campaignApr`** coerces to a number **> 0**, use it. Otherwise, if **`pointsPerThousandUsd`** is present and the Tydro formula yields a positive APR (`points × pointToUsdRate × 36.5`), use that. Final fallback is **`campaignApr`** coerced to a number or **0**. **`pointToUsdRate` ≤ 0** falls back to `TYDRO_POINT_TO_USD_RATE` (same as `getMerklForecastUsdMultiplier`). Forecast clones in `buildForecastMerklOpportunities` clear `pointsPerThousandUsd` so simulated rows rely on forecast `campaignApr` when the model returns zero.

### Symbols

| Symbol / field | Meaning |
|----------------|---------|
| `tvl` | USD-denominated eligible TVL passed into `forecastWithTVL` (in practice `hypotheticalTvl`). |
| `aprCap` | Maximum or fixed annual APR as a **decimal fraction** (e.g. `0.05` = 5% per year), **not** a percentage label. |
| `plannedDaily` / `requiredDaily` | Backend daily emission targets; if `requiredDaily` is missing, `plannedDaily` is used. |
| `remainingBudget` | `max(0, totalBudget - distributedSoFar)` when those fields are present. |

### `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` (FIX)

In `forecastWithTVL`, the **FIX** branch uses **`aprCap`** (decimal, annual) and **USD-semantic `tvl`** to compute **`aprBasedDaily`**, then takes **`min` with `remainingBudget`**:

```
aprBasedDaily = (tvl × aprCap) / 365
dailyRewards   = min(aprBasedDaily, remainingBudget)
apr            = (dailyRewards × 365) / tvl          // for tvl > 0
```

The function also derives **`fixRewardableDays`** and **`fixRewardableUntilTs`** from how long the remaining budget lasts at `aprBasedDaily`, capped by the campaign end time. Regime is **`PLANNED`** for FIX in this helper.

### `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` (MAX / capped APR)

```
aprBasedDaily = (tvl × aprCap) / 365
dailyRewards   = min(requiredDaily, aprBasedDaily)
apr            = (dailyRewards × 365) / tvl
```

- **`APR_CAPPED`**: `isMaxAprCampaign && aprBasedDaily < requiredDaily` (the APR cap binds).
- **`CATCHING_UP`**: `requiredDaily > plannedDaily × 1.01` (tolerance for float noise).
- **Total budget**: This branch does **not** multiply `dailyRewards` by `remainingBudget`. If the campaign is out of budget, the backend is expected to drive **`requiredDaily` / `plannedDaily`** accordingly (e.g. to zero).

### `DUTCH_AUCTION` and other non–FIX/MAX types

There is no APR-based daily cap in this function for these types (`aprBasedDaily` is effectively unbounded for the min):

```
dailyRewards = requiredDaily
apr            = (dailyRewards × 365) / tvl
```

### Edge case: `tvl ≤ 0`

```
dailyRewards = 0
apr = 0
```

### From model `apr` to UI percentage (`forecastBreakdownApr`)

`forecastWithTVL` returns **`apr` as an annual fraction** (e.g. `0.05`). The simulation converts to **percentage points** for display:

```
forecastAprPercent = forecast.apr × 100 × multiplier
```

`multiplier` comes from `getMerklForecastUsdMultiplier` (`src/lib/tydro.ts`): it is **`1`** unless the breakdown uses Tydro **`pointsPerThousandUsd`**, in which case it scales by the configured point-to-USD rate.

## APR/APY display semantics

The app treats **native** and **incentive** rates differently at display time:

- **Native Aave rates** (`reserve.supplyApy`, `reserve.borrowApy`, and the native side of shared simulation) remain in **APY** in the UI. The global APR/APY toggle does **not** convert native rates to APR.
- **Incentive / forecast-derived rates** (Merit, Merkl, Brevis, protocol incentives, simulated incentive rows, forecast panels, incentive totals) follow the global APR/APY toggle.

### Incentive APR → APY conversion

Incentive APY uses the shared helper in `src/lib/formatters.ts`:

```
aprDecimal = aprPercent / 100
apyPercent = ((1 + aprDecimal / 12) ^ 12 - 1) × 100
```

This is a **monthly compounding** assumption and is applied consistently to:

- Merkl breakdown display values
- Merit base / self rows
- Brevis rows
- Protocol incentive rows
- Incentive totals (convert each source to APY first, then sum)

### Total rate composition

- **Supply total** = `nativeSupplyApy + incentiveDisplayValue`
- **Borrow total** = `nativeBorrowApy - incentiveDisplayValue`

Where `incentiveDisplayValue` is:

- incentive **APR** when the toggle is on APR
- incentive **APY** when the toggle is on APY

This means the toggle changes the **incentive contribution**, not the native base rate.

### Merkl product docs (concepts)

Distribution types (variable / fixed token vs dollar / capped): [Merkl — Distribution Types](https://docs.merkl.xyz/merkl-mechanisms/distributions)

## Incentive Reward Cap Reference

### Naming layers (API / domain / UI)

To keep semantics clear without breaking API contracts or UI props:

| Layer | Role | Examples |
|-------|------|----------|
| **API** | Backend field names stay stable | `perUserRewardCapUsd` on `BrevisIncentive` |
| **Domain** | Prefer *ceiling* vocabulary for new helpers and types | `depositCeilingUsd` (Merit Self), `rewardCeilingUsd` (Brevis, maps from `perUserRewardCapUsd`) |
| **UI** | Simulation row diagnostics stay `capNote` / `capWarning` | Rendered in `SimulationSubRow` from `useRateSimulation` |

Merit Self: parsed `selfCapUsd` in `meritForecast.ts` is a **deposit ceiling** (eligible deposit only). Brevis: `perUserRewardCapUsd` is a **per-user reward ceiling**. Shared simulation copy is assembled via `src/lib/incentiveCeilings.ts` → `ceilingEffectToSimulationFields`.

**Field mapping (contract unchanged):**

| Source | API or parse | Domain meaning | Notes |
|--------|----------------|------------------|--------|
| Brevis | `perUserRewardCapUsd` | Per-user **reward** ceiling | Keep API name; map in forecast/ceiling helpers |
| Merit Self | `selfCapUsd` (from `message`) | **Deposit** ceiling | Eligible deposit only, not a reward USD cap |
| Simulation UI | `capNote`, `capWarning` | Same diagnostics, stable prop names | Prefer *ceiling* in new **domain** names only |

**Why “ceiling” in code but “cap” on rows:** Renaming `capNote` / `capWarning` would touch every simulation consumer for little user benefit. Domain types and helpers use *ceiling* vocabulary; the table row props stay `cap*` for stability.

**Extending behavior:** Add or adjust incentive-cap simulation copy through `incentiveCeilings.ts` (`IncentiveCeilingEffect` kinds include `deposit_ceiling`, `reward_ceiling`, `pool_budget`, `apr_ceiling`, `informational`). Never merge **deposit ceiling** (Merit Self) semantics with **reward ceiling** (Brevis) in one helper.

Incentive programs may impose caps that limit effective APR. There are three distinct cap mechanisms in the pipeline, each acting at a different stage:

```
deposit → [deposit cap] → nominal APR (from TVL dilution) → nominal reward → [reward cap] → effective APR
           ↑ Merit self                ↑ Merkl/Merit base              ↑ Brevis per-user
```

### Cap taxonomy

| Cap type | Scope | Time grain | Mechanism | Source file |
|----------|-------|------------|-----------|-------------|
| **Pool budget** (Merkl FIX/MAX) | Pool-wide | Campaign lifetime | `dailyRewards = min(aprBasedDaily, remainingBudget)` — TVL dilution + total budget constraint | `merklForecast.ts` |
| **Deposit ceiling** (Merit self) | Per-user | Per round (cycle) | `eligibleDeposit = min(deposit, selfCapUsd)` — only counts the first N USD of deposit | `meritForecast.ts` |
| **Per-user reward ceiling** (Brevis) | Per-user | Campaign lifetime | `effectiveApr = min(nominalApr, capUsd / deposit / remainingYearFraction × 100)` | `brevisForecast.ts` |

### Brevis per-user reward cap

- `perUserRewardCapUsd`: cumulative USD reward ceiling for a single user across the entire campaign.
- **No `endDate`**: Brevis campaigns typically have no explicit end date. When `endDate` is absent, the cap formula cannot determine whether the cap binds (no `remainingYearFraction`), so the nominal APR is returned unchanged (graceful degradation). The diagnostic field `daysToHitCap` is still computable without `endDate`.
- **Shared cap across supply/borrow** (`campaignId`): When a Brevis supply row and borrow row on the same reserve represent the same campaign, they must carry the same `campaignId` and identical canonical campaign metadata (`campaignApr`, `campaignStartedAt`, `campaignEndedAt`, `latestTvl`, `totalBudget`, `perUserRewardCapUsd`, `message`, `name`, `link`). The simulation sums `supplyInputUsd + borrowInputUsd` as the combined deposit for cap evaluation. If the metadata differ, the frontend treats the payload as inconsistent and skips shared-cap simulation for that `campaignId`.
- **`isCampaignActive` for Brevis**: uses `allowOpenEnd = true` — a Brevis campaign with a valid past `startDate` and no `endDate` is treated as active.

### Merkl FIX reward cap

- `fixRewardableDays` / `fixRewardableUntilTs`: derived from `remainingBudget / aprBasedDaily`, capped by `endTimestamp`. These fields indicate how many days the campaign can sustain rewards at the current APR before budget exhaustion.
- Unlike Brevis, this is a **pool-level** cap (all users share the same budget).

### Merit Base: reserve TVL anchor (preferred)

When **`reserve.reserveSizeUsd`** is present, **supply-side** Merit Base simulation passes **`anchorTvlUsd = reserveSizeUsd`** into `forecastMeritCampaign` (assumption: Merit’s rate denominator matches pool supply TVL). **Borrow-side** Merit uses **`anchorTvlUsd = reserveSizeUsd × (utilizationPct / 100)`** when `utilizationPct` is available (borrowed USD proxy).

- **Daily reward (USD)** is then **`anchorTvlUsd × (Base APR / 100) / 365`**, i.e. consistent with headline Base APR at that TVL.
- **After a hypothetical deposit**, **TVL** is treated as **`anchorTvlUsd + scenarioDepositUsd`** with **daily rewards held flat**, so **APR dilutes** (same intuition as fixed daily rewards elsewhere).
- If **`anchorTvlUsd`** cannot be resolved (e.g. missing `reserveSizeUsd`, or borrow side without utilization), the implementation **falls back** to the **`lastRoundRewardUsd` / cycle-days** path.

**Shared simulation UI (`capNote`):** Merit **Base** rows intentionally emit **no** per-row `capNote` — same rule as Merkl **`DUTCH_AUCTION`** (scenario-adjusted APR only; no TVL / last-round / fallback diagnostic line). If product adds a row-level note for Dutch, add Merit Base in the **same** change (`buildMerklCampaignDetails` + `buildMeritCampaignDetails` in `useRateSimulation.ts`). Merit **Self** still uses `capNote` when a deposit ceiling applies (`incentiveCeilings.ts`).

**Staging snapshot (anchor vs last-round):** For a concrete numeric comparison when both paths are computable from live data, see `docs/merit-base-anchor-vs-last-round-staging.md`.

### Merit self deposit cap

- `selfCapUsd`: extracted from campaign `message` text (e.g. "first $1000 USDT supplied per user").
- Caps the **eligible deposit**, not the reward directly. `eligibleDeposit = min(deposit, selfCapUsd)`.
- `eligibleDepositUsd` is only used for Merit self-auth campaigns — other incentive types do not use deposit capping. Simulation copy uses **`Eligible deposit capped at $Z`** (same “capped” vocabulary as Merkl APR notes).

### UI surfaces: Brevis cap (simulation only)

**Incentive tooltip** (`IncentiveTooltip`): static context only (dates, messages). It does **not** repeat per-user caps or deposit-dependent Brevis diagnostics.

**Shared simulation** (`useRateSimulation` → per-campaign rows on `SimulationSubRow` via `capNote` / `capWarning`): with supply/borrow scenario input, `buildBrevisCampaignDetails` shows `Reward capped at …/user` and optional `supply + borrow` when `perUserRewardCapUsd` is present. **Reward horizon** (single number, **`~Nd earn`**): **`N = min(daysToHitCap, remainingDays)`** when both are computable — i.e. the earlier of (a) days to exhaust the per-user cap at **nominal** daily reward rate, and (b) calendar days until `endDate`. If only one bound exists, that value is used (still shown as **`~Nd earn`**). If the API omits `perUserRewardCapUsd`, only **`~Xd to end`** is shown (`remainingDays` only). **UI**: a single Brevis campaign is merged onto the **Brevis Incentive** row. `capWarning` when `isCapBinding`.

## Related Files

- `src/lib/interestRateCalculator.ts` – Core native rate calculation functions
- `src/lib/merklForecast.ts` – Merkl `forecastWithTVL` and progress flags
- `src/lib/merklForecast.test.ts` – Unit tests for forecast branches
- `src/lib/meritForecast.ts` – Merit forecast (base + self-auth deposit cap)
- `src/lib/incentiveCeilings.ts` – Domain-layer ceiling effects → simulation `capNote` / `capWarning`
- `src/lib/brevisForecast.ts` – Brevis per-user reward cap forecast
- `src/lib/brevisForecast.test.ts` – Unit tests for Brevis cap (shared cap, no endDate, edge cases)
- `src/lib/tydro.ts` – Tydro points → APR and forecast USD multiplier
- `src/hooks/useRateSimulation.ts` – React hook: native simulation + incentive forecast overlay (Merkl, Merit, Brevis); exposes per-campaign `capNote` for `SimulationSubRow`
- `src/components/dashboard/SimulationSubRow.tsx` – Shared table simulation UI (per-campaign incentive rows)
- `src/components/dashboard/IncentiveTooltip.tsx` – Static incentive context only (no deposit/TVL forecasts)
- `src/hooks/useReserveRateInputs.ts` – Fetches `/rate-inputs` API
- `src/hooks/useSideDataMeta.ts` – Fetches `/meta/side-data` (includes forecast items)
- `src/components/dev/RateInputsVsMarketCheck.tsx` – Dev panel for validation
