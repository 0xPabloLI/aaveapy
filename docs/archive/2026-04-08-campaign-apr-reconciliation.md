# Campaign APR Reconciliation Snapshot (2026-04-08)

This note records a one-off reconciliation between API `campaignApr` and APR implied by `plannedDaily + latestTvl`.

## 结论摘要

- 不能把所有 Merkl 行都按 `plannedDaily * 365 / latestTvl * 100` 直接当作 `campaignApr`。
- `DUTCH_AUCTION`（及其他非 MAX/FIX）通常可按 plain 口径核对；`campaignApr=0` 且 `pointsPerThousandUsd>0` 属 points 模式，不按常规 APR 判错。
- `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` / `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 必须走 capped 分支逻辑，不能仅用 `plannedDaily` 反推下结论。
- 在本次快照中，非零 `campaignApr` 的明显偏差主要集中在 MAX 分支；DUTCH 的非零偏差基本是浮点噪声级别。

## Scope

- API source: `GET /markets` from `https://staging-api.aaveapy.com/api`
- Supplemental source: `GET /meta/side-data` from `https://staging-api.aaveapy.com/api`
- Rows analyzed: Merkl breakdown rows where all fields are present and finite:
  - `campaignApr`
  - `plannedDaily`
  - `latestTvl > 0`

## Normalized comparison formula

Use percentage points for both sides:

```text
impliedAprPercent = plannedDaily * 365 / latestTvl * 100
```

This is a quick sanity check only. For MAX/FIX campaign types, use branch logic in `forecastWithTVL`.

## Headline result

- Total valid rows: `29`
- Exact match (`|diff| <= 1e-9`): `14 / 29`
- Within `0.01pp`: `16 / 29`
- Within `0.1pp`: `17 / 29`
- Within `1.0pp`: `19 / 29`

For non-zero `campaignApr` rows only:

- Non-zero rows: `21`
- Exact match (`|diff| <= 1e-9`): `14 / 21`
- Not exact: `7 / 21`

## Classification view

Following `docs/rate-calculation.md` categories:

- `plain-match`: mostly non-MAX/FIX rows where implied APR aligns (or only float noise)
- `capped-required`: MAX/FIX rows where `plannedDaily` alone is insufficient (must use branch logic)
- `needs-data-check`: not triggered in this snapshot (rows missing required fields were excluded)

Also observed:

- `campaignApr = 0` with `pointsPerThousandUsd > 0`: `8` rows
- These are points-mode rows and should not be treated as plain APR mismatch.

## Non-zero `campaignApr` rows that are not exact

Values below compare `campaignApr` vs `impliedAprPercent` from `plannedDaily`.

| campaignId | Chain | Token | Side | campaignType | campaignApr | impliedApr | diff (pp) |
|---|---|---|---|---|---:|---:|---:|
| `251525480113095550` | Ethereum | USDC | borrow | `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 1.750000000% | 12.768535792% | +11.018535792 |
| `1541246139455677822` | Mantle | wrsETH | supply | `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 0.150000000% | 2.412110992% | +2.262110992 |
| `1216866542342484437` | Ethereum | USDtb | supply | `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 3.400000000% | 4.674823557% | +1.274823557 |
| `13694886148811361820` | Mantle | USDe | supply | `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 3.500000000% | 4.200953543% | +0.700953543 |
| `17406661278241767291` | Plasma | USDe | supply | `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 3.500000000% | 3.551898128% | +0.051898128 |
| `11663300815217914195` | Plasma | GHO | supply | `DUTCH_AUCTION` | 1.053594381% | 1.053594360% | -0.000000021 |
| `16843817847819856705` | Plasma | GHO | borrow | `DUTCH_AUCTION` | 0.666325624% | 0.666325611% | -0.000000013 |

Interpretation:

- The first five are all MAX rows and are expected to require capped branch evaluation (`requiredDaily`/`aprCap`) rather than plain `plannedDaily` inversion.
- The last two are effectively float-noise level differences.

## Practical rule for future checks

1. Compute `impliedAprPercent` from `plannedDaily` only as a quick screen.
2. If `campaignType` is MAX/FIX, do not conclude mismatch from step 1.
3. Recompute with branch logic (`requiredDaily`, `aprCap`, and FIX `remainingBudget`).
4. If `campaignApr == 0` and `pointsPerThousandUsd > 0`, treat as points-mode and compare through points pathway, not plain APR inversion.

## Automation

Use script `scripts/reconcile-campaign-apr.mjs` to regenerate summary and mismatch table:

```bash
npm run check:campaign-apr-reconcile
node scripts/reconcile-campaign-apr.mjs --output docs/archive/2026-04-08-campaign-apr-reconciliation-script.md
```

Env options:

- `APR_RECON_API_BASE` (default staging)
- `APR_RECON_TOLERANCE_PP` (default `0.0001`)
- `APR_RECON_OUTPUT` (optional markdown output path)
