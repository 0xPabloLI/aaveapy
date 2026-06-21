# Handoff: Incentive Source Upper-Layer Unification

## Goal

将 Incentive 系统上层消费端的 per-source 分支（~102 处）收敛为统一入口，让 Merit/Merkl/Brevis 三种 source 的调用侧代码从"对每个 source 写一遍"变为"循环一次搞定"。

## Completed This Session

### Reward Token Icon 本地匹配 + Opp Header Icon 规则 + APR 对齐

| 改动 | 文件 | 说明 |
|---|---|---|
| `resolveRewardTokenIconSrc(symbol?, fallbackUrl?)` | IncentiveTooltip.tsx:118-126 | 查 TOKEN_ICON_MANIFEST 本地优先，无则 fallback URL |
| `campaignsHaveUniformIcon(campaigns)` | IncentiveTooltip.tsx:128-134 | 所有 campaign resolved icon 一致时返回 true |
| Opp header icon 规则 | IncentiveTooltip.tsx:965-970 | uniform 时显示第一个 campaign 的 resolved icon，不 uniform 时不显示 |
| Per-campaign icon | IncentiveTooltip.tsx:725-737 | 从 `campaign.rewardTokenIconUrl` 改为 `resolveRewardTokenIconSrc(...)` |
| APR 垂直右对齐 | IncentiveTooltip.tsx:972,721 | opp header 和 campaign 行都用 `grid grid-cols-[1fr_auto_auto]` |
| Campaign APR testid | IncentiveTooltip.tsx:725 | `data-testid="campaign-apr"` |
| 测试 | IncentiveTooltip.test.tsx | 6 个新测试 + 2 个更新（local icon, URL fallback, uniform/non-uniform, grid alignment） |

Commit: `dedcb248` — feat(incentive): reward token icon local matching, opp header icon rule, APR vertical alignment

## Current State

### 已统一（底层泛型基础设施）

| 模块 | 统一程度 | 关键函数 |
|---|---|---|
| `campaignGroups.ts` | 完全统一 | `sumActiveCampaignBreakdownValues<TGroup,TBreakdown>` — 泛型+配置对象抽象差异 |
| `incentiveMath.ts` | 完全统一 | `applyPositionCap`, `computePositionCapEligibility` |
| `incentiveCaps.ts` | 高度统一 | `buildPositionCapEffect`, `applyPositionCapToForecastResult`, `capEffectToSimulationFields` |

### 未统一（上层消费端，~102 处 per-source 分支）

#### 1. Side→source accessor（~12 处重复）

```ts
// 重复模式，出现约 12 处
const merits = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
const merkl = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
const brevis = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
```

出现位置：
- `incentiveAggregation.ts` — 6 个 sum 函数 (行 184-186, 220, 232, 242)
- `rateSimulationCalculator.ts` — 行 313-315, 461-462, 937-939, 1196-1200, 1417-1425, 1433-1450, 1468-1485, 1501-1559
- `IncentiveTooltip.tsx` — 行 428, 472, 519
- `recentlyEndedCampaigns.ts` — 行 43, 70, 97
- `SimulationSubRow.tsx` — 行 247-249, 251-253

建议方案：统一 accessor 函数

```ts
type IncentiveSourceKey = 'meritSupplys' | 'meritBorrows' | 'merklSupplys' | 'merklBorrows' | 'brevisSupplys' | 'brevisBorrows';

function getIncentiveGroups<T extends 'merit' | 'merkl' | 'brevis'>(
  reserve: ReserveWithSpread,
  source: T,
  side: 'supply' | 'borrow',
): ...  // return type varies by source
```

风险：**最低**。纯重构，不改变逻辑，只是消除重复。但 return type 因 source 不同（`MeritCampaignGroup[]` vs `MerklOpportunityGroup[]` vs `BrevisIncentive[]`），需要泛型或 overloads。

#### 2. Campaign detail builder（3 个独立函数，大量重复逻辑）

| 函数 | 文件行号 | source |
|---|---|---|
| `buildMeritCampaignDetails()` | rateSimulationCalculator.ts:628-727 | Merit |
| `buildMerklCampaignDetails()` | rateSimulationCalculator.ts:729-825 | Merkl |
| `buildBrevisCampaignDetails()` | rateSimulationCalculator.ts:828-911 | Brevis |

共同模式：
1. 遍历 groups → 遍历 breakdowns → 过滤 active → 计算当前 APR → 计算 after APR (forecast) → 计算 delta → push row
2. 每行生成 `SimulationCampaignDetail`：`{ id, label, current, after, delta, capNote, capWarning, capMetrics, href }`

差异点：
- **Forecast 入口不同**：Merit 用 `forecastMeritApr`，Merkl 用 `forecastWithTVL`/`forecastMerklApr`，Brevis 复用 Merkl + `applyPositionCapToForecastResult`
- **Cap 类型不同**：Merit 有 selfPositionCap，Merkl 有 aprCap/fixReward/maxReward，Brevis 有 positionCap + sharedCap
- **Label 生成不同**：Merit 从 message 提取 action label，Merkl 用 `applyStableCampaignLabels`，Brevis 用 display label
- **额外信息不同**：Merkl 有 whitelist/points/rewardTokenIcon，Brevis 有 sharedDeposit

建议方案：提取共享框架函数，差异通过配置对象/回调注入

```ts
interface CampaignBuildConfig<TGroup, TBreakdown> {
  getGroups: (reserve, side) => TGroup[];
  getBreakdowns: (group) => TBreakdown[];
  isActive: (breakdown) => boolean;
  getCurrentApr: (breakdown, isApy) => number;
  getAfterApr: (breakdown, input, params) => number | null;
  getLabel: (group, breakdown, index) => string;
  getHref: (group) => string | null;
  getCapEffect: (breakdown, afterApr, input) => CapResult | undefined;
  buildId: (groupIdx, bdIdx) => string;
}

function buildCampaignDetails<TGroup, TBreakdown>(
  config: CampaignBuildConfig<TGroup, TBreakdown>,
  groups: TGroup[],
  isApy: boolean,
  ...params
): SimulationCampaignDetail[];
```

风险：**中等**。3 个 builder 逻辑差异不小，强行统一可能引入不直观的分支。需要 TDD 验证每条路径不回归。

#### 3. Forecast 入口统一（最复杂）

| 函数 | 模块 | 机制 |
|---|---|---|
| `forecastMeritApr` | meritForecast.ts | TVL 稀释：BASE 模式(anchorTvl) / SELF_CAP 模式(eligibleUsd + positionCap) |
| `forecastWithTVL` / `forecastMerklApr` | merklForecast.ts | 按 campaignType 分流：DUTCH 固定日发 / FIX 预算天数 / MAX APR 封顶 / TARGET_TOTAL_APR |
| Brevis | 复用 Merkl + applyPositionCapToForecastResult | 额外加 positionCap 稀释和 sharedCap |

3 个引擎的参数集完全不同：
- Merit: `{ mode, depositUsd, forecastAprPercent, selfPositionCapUsd, anchorTvlUsd, totalPositionUsd, baseAprPercent, startDate, endDate }`
- Merkl: `{ breakdown, depositUsd, forecastStates, pointToUsdRate }`
- Brevis: Merkl params + `{ positionCap, sharedDepositUsd, sharedBorrowUsd }`

建议方案：统一调度入口 + per-source 策略模式

```ts
type ForecastStrategy = 'merit' | 'merkl' | 'brevis';

function forecastIncentiveApr(
  strategy: ForecastStrategy,
  params: ForecastParams,  // union type with discriminated union on strategy
): number | null;
```

风险：**高**。3 个引擎机制本质不同，统一入口只是把 per-source 分支从调用侧移到调度函数内部，代码量不减。收益主要是调用侧简洁性（一行代替三行），但增加了间接层。

#### 4. Link 提取（3 个独立函数）

| 函数 | 位置 |
|---|---|
| `getFirstActiveMeritLink` | SimulationSubRow.tsx |
| `getFirstActiveMerklLink` | SimulationSubRow.tsx |
| `getFirstActiveBrevisLink` | SimulationSubRow.tsx |

建议方案：统一 `getFirstActiveIncentiveLink(reserve, side, source)`

风险：**最低**。3 个函数逻辑几乎相同（取 groups → filter active → 取 link），最容易统一。

## Recommended Priority

1. **side→source accessor + link 提取**（风险最低，收益明确，约 15 处重复消除）
2. **campaign detail builder**（风险中等，需要仔细设计泛型接口，TDD 验证）
3. **forecast 入口**（风险高，建议暂缓，等 1 和 2 完成后再评估是否值得统一）

## Relevant Files

- `src/lib/campaignGroups.ts` — 已统一的泛型基础设施
- `src/lib/incentiveMath.ts` — 已统一的数学层
- `src/lib/incentiveCaps.ts` — 已统一的 cap 效果层
- `src/lib/incentiveAggregation.ts` — 半统一（底层 6 个 per-source sum，顶层 3 个统一入口）
- `src/lib/rateSimulationCalculator.ts` — 最密集的 per-source 分支（~26 处）
- `src/components/dashboard/IncentiveTooltip.tsx` — 半统一（数据收集 per-source，渲染框架统一）
- `src/components/dashboard/SimulationSubRow.tsx` — link 提取 per-source
- `src/lib/meritForecast.ts` — Merit forecast
- `src/lib/merklForecast.ts` — Merkl forecast
- `src/lib/brevis.ts` — Brevis 解析

## Constraints

- 3 种 source 的类型差异（`MeritCampaignGroup` vs `MerklOpportunityGroup` vs `BrevisIncentive`）是根本障碍，无法消除
- `sumActiveCampaignBreakdownValues` 的泛型 TGroup/TBreakdown + 配置对象模式是已验证的成功抽象，新统一应遵循相同模式
- 用户偏好：语义化通用命名（不按 source 命名函数）、删旧而非渐进保留、TDD 流程
- Architecture guard test (`src/test/architecture-guard.test.ts`) 会拦截违规的 import 依赖

## Suggested Skills

- `brainstorming` — 设计统一接口前先探索方案
- `writing-plans` — 写实现计划
- `tdd` — TDD 驱动实现
- `refactor` — 重构执行
