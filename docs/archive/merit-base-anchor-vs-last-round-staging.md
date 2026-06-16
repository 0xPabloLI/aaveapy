# Merit Base: anchor vs last-round paths (staging snapshot)

> Historical analysis note (dated snapshot).  
> Canonical current behavior lives in [`docs/rate-calculation.md`](../rate-calculation.md).

This note records a **one-off empirical comparison** between two ways to fix **daily USD rewards** for Merit **Base** simulation, using the **same formulas** as `src/lib/meritForecast.ts`. It is **not** a live dashboard; re-fetch `GET /markets` if you need current numbers.

## How the app chooses (production code)

`forecastMeritApr` in `meritForecast.ts` resolves Merit **Base** in this order:

1. **`reserve_tvl`** — If `anchorTvlUsd` is finite and `> 0`, daily reward is  
   `anchorTvlUsd × (Base APR % / 100) / 365`, and hypothetical TVL is `anchorTvlUsd + scenarioDepositUsd` (daily reward held flat → APR dilutes).
2. **`last_round`** — Used only when step 1 does **not** run: `lastRoundRewardUsd` and a valid `startDate`/`endDate` cycle produce  
   `daily = lastRoundRewardUsd / cycleDays`, then implied TVL from the headline APR, then the same dilution math.

`useRateSimulation` sets `anchorTvlUsd` via `getMeritAnchorTvlUsd` (`src/hooks/useRateSimulation.ts`):

| Side | Anchor when |
|------|----------------|
| **Supply** | `reserve.reserveSizeUsd` is finite and `> 0` → anchor = that value. |
| **Borrow** | Same `reserveSizeUsd` **and** `utilizationPct` in `(0, 100]` → anchor = `reserveSizeUsd × (utilizationPct / 100)`. |

So for **typical supply rows with `reserveSizeUsd`**, **`lastRoundRewardUsd` is not used for Merit Base** (it remains available for the fallback path and for diagnostics). For **borrow** Merit, if utilization is missing, anchor is undefined and **last round can be used** when the payload supports it.

## Staging API snapshot (illustrative)

- **Source:** `https://staging-api.aaveapy.com/api/markets`
- **Fetched:** 2026-03-27 (approximate wall time during analysis)
- **Filter:** reserves with `meritSupplys` where Base `apr > 0`, `lastRoundRewardUsd > 0`, valid cycle from `startDate`/`endDate`, and `reserveSizeUsd > 0`. At that time this yielded **two** Celo reserves (USDT, WETH).

**Hypothetical deposit for comparison:** `max(50_000, 0.005 × reserveSizeUsd)` → **$50,000** for both rows below.

| Reserve (Merit label) | Base APR % | `reserveSizeUsd` | Cycle days | `lastRoundRewardUsd` | Daily $ (anchor path) | Daily $ (last-round path) | Last/anchor daily ratio | Implied TVL from last round | APR after +$50k (anchor %) | APR after +$50k (last round %) | Δ (bp) |
|------------------------|------------|------------------|------------|----------------------|-------------------------|----------------------------|-------------------------|-----------------------------|------------------------------|----------------------------------|--------|
| USDT · Supply USDT | 3.8123 | ≈ 9.14e6 | 14 | ≈ 10,624.76 | ≈ 954.55 | ≈ 758.91 | 0.795 | ≈ 7.27e6 | 3.7916 | 3.7863 | −0.53 |
| WETH · Supply WETH | 2.3592 | ≈ 4.79e6 | 14 | ≈ 4,999.04 | ≈ 309.57 | ≈ 357.07 | 1.153 | ≈ 5.52e6 | 2.3348 | 2.3380 | +0.32 |

**Takeaway:** On this snapshot, anchor vs last-round **daily rewards** differed materially from 1.0×, but with **+$50k** against **multi‑million** TVL denominators, **simulated APR only moved on the order of ~0.3–0.5 bp**. Larger hypothetical deposits (relative to TVL) widen the gap.

## Reproduce

```bash
curl -sS "https://staging-api.aaveapy.com/api/markets" -o /tmp/markets.json
```

Then run a small script that mirrors `computeMeritBaseFromAnchorTvl` and `computeMeritBaseEstimate` in `meritForecast.ts` (same `Date.parse` for campaign boundaries as the app).

## Related

- `docs/rate-calculation.md` — Merit Base anchor rules
- `src/lib/meritForecast.ts` — implementation order (`reserve_tvl` before `last_round`)
- `src/hooks/useRateSimulation.ts` — `getMeritAnchorTvlUsd`
