# Incentive Reward Cap Reference

This module groups cap / ceiling semantics for Merit, Merkl, and Brevis.

## Naming layers

| Layer | Role | Examples |
|-------|------|----------|
| API | Backend field names stay stable | `perUserRewardCapUsd` |
| Domain | Prefer `ceiling` vocabulary | `depositCeilingUsd`, `rewardCeilingUsd` |
| UI | Stable row diagnostics | `capNote`, `capWarning` |

## Field mapping

| Source | Domain meaning | Notes |
|--------|----------------|-------|
| Brevis `perUserRewardCapUsd` | Per-user reward ceiling | Keep API name |
| Merit `selfCapUsd` | Deposit ceiling | Eligible deposit only |
| Simulation UI | Same diagnostics | Keep `cap*` props stable |

## Unified simulation `capNote` strings

| Incentive / branch | When shown | `capNote` pattern |
|--------------------|------------|-------------------|
| Merkl FIX | Scenario input exists and rewardable days resolved | `~Nd earn` |
| Merkl MAX | APR capped for low TVL | `APR capped for low TVL` |
| Brevis | Per-user cap exists | `Reward capped at $X/user` |
| Brevis no cap | No per-user cap, time remaining exists | `~Nd to end` |
| Merit Self | Deposit ceiling applies | `Eligible supply capped at $Z` |
| Merit Base | Net note only | `Net eligible $X of $Y` |
| Merkl DUTCH_AUCTION | Net note only | `Net eligible $X of $Y` |

## Cap taxonomy

| Cap type | Scope | Mechanism | Source file |
|----------|-------|-----------|-------------|
| Pool budget | Pool-wide | `dailyRewards = min(aprBasedDaily, remainingBudget)` | `merklForecast.ts` |
| Deposit ceiling | Per-user | `eligibleDeposit = min(deposit, selfCapUsd)` | `meritForecast.ts` |
| Per-user reward ceiling | Per-user | cap by reward / remaining horizon | `brevisForecast.ts` |

## Brevis per-user reward cap

- `perUserRewardCapUsd` is a cumulative USD reward ceiling.
- Missing `endDate` degrades gracefully to nominal APR.
- Missing `distributedSoFar` means budget exhaustion timing is uncertain.
- Shared cap across supply/borrow requires the same `campaignId` and matching metadata.

## Merkl FIX reward cap

- `fixRewardableDays` and `fixRewardableUntilTs` come from remaining budget divided by daily rewards.
- This is a pool-level cap shared by all users.

## Merit Base / Merit Self

- Merit Base anchors to reserve TVL when available.
- Merit Self uses `selfCapUsd` as an eligible deposit ceiling.
- Merit Base intentionally emits no per-row `capNote`.

## UI surfaces

- `IncentiveTooltip` keeps static context only.
- `SimulationSubRow` uses `capNote` / `capWarning` for per-campaign diagnostics.

## Related Files

- `src/lib/incentiveCeilings.ts`
- `src/lib/merklForecast.ts`
- `src/lib/meritForecast.ts`
- `src/lib/brevisForecast.ts`
- `src/hooks/useRateSimulation.ts`
