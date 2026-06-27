# Forecast Unavailable UI 提示 — 展示位置一览

当 `mergeForecastState` 返回 null（缺 campaignId/campaignType）或 `forecastStates` 缺数据时，UI 在以下位置展示提示。

## 示意图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared Scenario                              │
│                    (Reserves Table 展开行)                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Incentive Breakdown                                         │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ Merkl Campaign #1          2.5% → 2.1%                │ │  │
│  │  │   cap: ~42d to end                              [有cap] │ │  │
│  │  ├─────────────────────────────────────────────────────────┤ │  │
│  │  │ Merkl Campaign #2          1.0% → 0.8% *              │ │  │
│  │  │                                        ↑ [A] per-campaign│ │
│  │  ├─────────────────────────────────────────────────────────┤ │  │
│  │  │ Brevis Campaign            0.5% → 0.4% *              │ │  │
│  │  │                                        ↑ [A] per-campaign│ │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  * No forecast data — using current APR.          ← [B] 脚注 │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Portfolio Simulation                           │
│                    (PortfolioResultsTable)                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Token   Amount   Native   Incentive    Total   USD/day      │  │
│  │ USDC    $10,000   3.0%    2.5% *       5.5%    +$1.50     │  │
│  │                                      ↑                        │  │
│  │                               [C] per-row * 标记              │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │ USDC    -$5,000   5.0%    1.0%         6.0%    -$0.80     │  │
│  │         (borrow 侧无 forecast unavailable，不显示 *)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ──────────────────────────────────────────────────────────────── │
│  * No forecast data — using current APR.              ← [D] 脚注  │
└─────────────────────────────────────────────────────────────────────┘
```

## 标注说明

| 标注 | 位置 | 组件 | 触发条件 | 显示内容 | 数据来源 |
|------|------|------|----------|----------|----------|
| [A] | Shared Scenario — per-campaign `*` 标记 | `SimulationSubRow.tsx` | `campaign.forecastUnavailable=true` | APR 值后追加 `*` | `SimulationCampaignDetail.forecastUnavailable` |
| [B] | Shared Scenario — 底部脚注 | `SimulationSubRow.tsx` | `forecastUnavailableCampaignCount > 0 && hasAnyInput` | "* No forecast data — using current APR." | `RateSimulationResult.forecastUnavailableCampaignCount` |
| [C] | Portfolio — per-row `*` 标记 | `PortfolioResultsTable.tsx` (`ResultRow`) | `forecastUnavailableCampaignCount > 0`（per-side） | `*`（hover tooltip: "No forecast data — using current APR."） | `PortfolioPositionResult.forecastUnavailableCampaignCount` |
| [D] | Portfolio — 表底脚注 | `PortfolioResultsTable.tsx` | 任一行 `forecastUnavailableCampaignCount > 0` | "* No forecast data — using current APR." | 同上 |

## 关键行为

1. **DUTCH_AUCTION 不标记** — 只有 `FORECAST_REQUIRING_CAMPAIGN_TYPES`（FIX_REWARD、MAX_REWARD、TARGET_TOTAL_APR）的 campaign 才标记 `forecastUnavailable`
2. **Portfolio per-side count** — supply 行只统计 supply 侧 campaign，borrow 行只统计 borrow 侧（`countSideForecastUnavailable` 从 `lane.sources.merkl.campaigns` + `lane.sources.brevis.campaigns` 统计）
3. **Shared Scenario 脚注统一** — 不再展示具体 campaign ID，统一为 `* No forecast data — using current APR.` 脚注，与 Portfolio 格式一致
4. **`forecastUnavailableCampaignCount` 统计范围** — 从 campaign rows 中统计（覆盖：缺 campaignId 的 Merkl、缺 forecastStates 的 Merkl、缺 forecastStates 的 Brevis）
5. **capNote 与 forecastUnavailable 分离** — capNote 只包含 cap 信息（如 "~42d to end"），不再拼接 forecast unavailable 文案
6. **hasAnyInput UI 守卫** — Shared Scenario 底部脚注仅在 `simulation.supply.hasInput || simulation.borrow.hasInput` 时渲染（数据层始终设置 count，UI 层守卫）
7. **已删除** — `forecastUnavailableCampaignIds` 字段、`formatForecastUnavailableLabel` 函数、`collectActiveCampaignIds` 函数、`FORECAST_UNAVAILABLE_NOTE` 常量

## 数据流

```
mergeForecastState() returns null
    │
    ▼
buildMerklCampaignDetails / buildBrevisCampaignDetails
  → forecastUnavailable: true  (per-campaign 标记)
  → capNote: 只含 cap 信息，不含 forecast unavailable
    │
    ├──► SimulationSubRow (Shared Scenario)
    │      ├─ per-campaign * 标记 [A]  (campaign.forecastUnavailable)
    │      └─ 底部脚注 [B]  (forecastUnavailableCampaignCount > 0 && hasAnyInput)
    │
    └──► countForecastUnavailable() → forecastUnavailableCampaignCount
           │
           ├─ RateSimulationResult (Shared Scenario 用) [B]
           │
           └─ portfolioSimulator → countSideForecastUnavailable(lane)
                → PortfolioPositionResult.forecastUnavailableCampaignCount
                  │
                  └─ PortfolioResultsTable
                       ├─ per-row * [C]
                       └─ 表底脚注 [D]
```
