# Frontend Fallback Reference

> 本文档汇总前端所有存在 fallback 链的变量获取逻辑，以及 `simulation` 值的完整数据流。
>
> 最后更新：2026-04-27

---

## 一、Fallback 总结表

### 1.1 数据缺失时的 Fallback（链上 → 推导，V3/V4 不同）

当链上原始字段缺失时，前端**仅在 V3 市场**使用推导公式作为 fallback；**V4 市场不做推导 fallback，直接返回 `null`**（UI 显示 `—`），避免 V4 Hub & Spoke 数据切片导致的数量级错误：

| 变量/指标 | 首选来源（链上） | V3 Fallback（推导） | V4 行为 | 关键文件 |
|---|---|---|---|---|
| `totalBorrowedUsd` | `totalVariableDebt` | `reserveSizeUsd × utilizationPct / 100` | `null` | `src/lib/scenarioSize.ts`（`getDisplayTotalBorrowedUsd`） |
| `availableLiquidityUsd` | `availableLiquidity` | `reserveSizeUsd − totalBorrowedUsd` | `null` | `src/lib/scenarioSize.ts`（`getDisplayAvailableLiquidityUsd`） |
| `reserveSizeUsd`（展示） | `reserveSizeUsd` | — | 当 `0` 或 `null` 时返回 `null`（不显示 `0`） | `src/lib/scenarioSize.ts`（`getDisplayReserveSizeUsd`） |

### 1.2 数据结构 Fallback（新字段 → 旧字段）

| 变量/指标 | 首选来源 | Fallback 来源 | 关键文件 |
|---|---|---|---|
| Brevis 字段 | `breakdown` 级别 | group `legacy` 级别 | `src/lib/brevis.ts` |

### 1.3 Simulation 对 Base 值的覆盖（用户输入后）

当用户输入了 simulation 场景金额时，UI **用 simulation 值覆盖 base 值**；无输入时显示 base 值。这不是传统意义上的"fallback"，而是"场景覆盖"：

| 变量/指标 | Base 值（无输入时） | Simulation 覆盖值（有输入时） | 关键文件 |
|---|---|---|---|
| `utilizationPct` | `reserve.utilizationPct` | `simulation.utilization.after`（或 `current`） | `src/components/dashboard/ReservesTable.tsx` |
| `totalBorrowedUsd` | `baseTotalBorrowedUsd`（V3：链上或推导；V4：仅链上，否则 `null`） | `simulation.marketMetrics.totalBorrowedUsdAfter` | `src/components/dashboard/DesktopReserveRow.tsx` |
| `availableLiquidityUsd` | `baseAvailableLiquidityUsd`（V3：链上或推导；V4：仅链上，否则 `null`） | `simulation.marketMetrics.availableLiquidityUsdAfter` | `src/components/dashboard/DesktopReserveRow.tsx` |
| Supply APR/APY | `reserve.supplyApy` / `getNativeSupplyApy()` | `simulation.supply.afterNative` | `src/components/dashboard/ReservesTable.tsx` |
| Supply Total APR/APY | `getTotalSupplyApy()` | `simulation.supply.afterTotal` | `src/components/dashboard/ReservesTable.tsx` |
| Borrow APR/APY | `reserve.borrowApy` / `getNativeBorrowApy()` | `simulation.borrow.afterNative` | `src/components/dashboard/ReservesTable.tsx` |
| Borrow Total APR/APY | `getTotalBorrowApy()` | `simulation.borrow.afterTotal` | `src/components/dashboard/ReservesTable.tsx` |
| Spread | `getSpread()` | `simulation.spread.after` | `src/components/dashboard/ReservesTable.tsx` |
| Supply Incentive | `getIncentiveValues(...).apy/apr` | `simulation.supply.afterIncentive` | `src/components/dashboard/ReservesTable.tsx` |
| Borrow Incentive | `getIncentiveValues(...).apy/apr` | `simulation.borrow.afterIncentive` | `src/components/dashboard/ReservesTable.tsx` |

> **注意**：以下变量 **没有** simulation fallback：
> - `tokenPrice`：UI 直接读取 `reserve.tokenPrice`，不经过 simulation
> - `optimalUtilization`：直接读取 `reserve.optimalUsageRate`。曾经写过的 `?? simulation?.utilization.optimal` 已于 2026-04-27 清理（见 §2.4）
> - 利率模型参数（`variableRateSlope1/2`、`baseVariableBorrowRate`、`reserveFactor`、`optimalUsageRate`）：simulation 直接读取 `reserve` 的 `RateCalcInput` 字段，缺失时返回 `null`，不做推算 fallback

---

## 二、核心市场数据 Fallback 详解

### 2.1 `totalBorrowedUsd`

**首选**：链上 `totalVariableDebt` 直接换算

```
totalBorrowedUsd = (Number(totalVariableDebt) / 10^decimals) × tokenPrice
```

- 这是 Aave Pool / Spoke 合约的原始数据，与 app.aave.com / pro.aave.com 一致。
- 适用于 V3 和 V4。

**Fallback**：仅 V3 走推导，V4 不 fallback

```
// V3 only:
totalBorrowedUsd = reserveSizeUsd × (utilizationPct / 100)
// V4: 直接返回 null，UI 显示 “—”
```

- 当链上 `totalVariableDebt` 缺失时：
  - **V3** → 用 `reserveSizeUsd × utilizationPct / 100` 推导（V3 的 `reserveSizeUsd` 是 Pool 级别聚合值，可信）。
  - **V4** → 不推导，返回 `null`。原因：V4 的 `reserveSizeUsd` 可能为 `0` 或仅是 Hub & Spoke 中某 Spoke 的供应切片，与 `totalVariableDebt`（Hub 级别债务）不在同一量纲（如 AaveV4Bluechip USDT 的 `reserveSizeUsd=0`，但实际 borrowed ≈ $1.037B），推导会严重偏低。

**代码位置**：
- 入口（V4-aware）：`src/lib/scenarioSize.ts` 中的 `getDisplayTotalBorrowedUsd(reserve, protocolVersion)`
- 内部：`getReserveTotalBorrowedUsd()`（链上换算）+ `getTotalBorrowedUsd()`（V3 推导）
- 使用：`DesktopReserveRow.tsx`、`ReservesTable.tsx`、`MobileReserveCard.tsx`

---

### 2.2 `availableLiquidityUsd`

**首选**：链上 `availableLiquidity` 直接换算

```
availableLiquidityUsd = (Number(availableLiquidity) / 10^decimals) × tokenPrice
```

**Fallback**：仅 V3 走推导，V4 不 fallback

```
// V3 only:
availableLiquidityUsd = reserveSizeUsd − totalBorrowedUsd
// V4: 直接返回 null，UI 显示 “—”
```

- 当链上 `availableLiquidity` 缺失时：
  - **V3** → 用 `reserveSizeUsd − (reserveSizeUsd × utilizationPct / 100)` 推导。
  - **V4** → 不推导，返回 `null`。原因：V4 的 `reserveSizeUsd` 是 per-Spoke 供应切片，而 `availableLiquidity` 是 Hub 级别共享流动性，混用得到的只是 Hub 流动性的一个 Spoke 比例，可能数量级偏差（如 AaveV4Forex USDT 推导 ≈ $5.7k，链上 ≈ $76.6k）。

**代码位置**：
- 入口（V4-aware）：`src/lib/scenarioSize.ts` 中的 `getDisplayAvailableLiquidityUsd(reserve, protocolVersion)`
- 内部：`getReserveAvailableLiquidityUsd()`（链上换算）+ `getDerivedAvailableLiquidityUsd()`（V3 推导）

---

### 2.3 `tokenPrice`

**无 fallback 链**，直接读取：

```typescript
const displayTokenPrice =
  reserve.tokenPrice != null && Number.isFinite(reserve.tokenPrice) && reserve.tokenPrice > 0
    ? reserve.tokenPrice
    : null;
```

- UI 层直接使用 `reserve.tokenPrice`，不经过 simulation。
- `simulation.tokenPrice` 只在 hook 内部计算 marketMetrics 时使用。

**代码位置**：`DesktopReserveRow.tsx:L147`

---

### 2.4 `optimalUtilization`

**无 fallback**，直接读取：

```typescript
const RAY_TO_PERCENT_DIVISOR = 1e25;
const optimalPct =
  reserve.optimalUsageRate != null && Number(reserve.optimalUsageRate) > 0
    ? Number(reserve.optimalUsageRate) / RAY_TO_PERCENT_DIVISOR
    : null;
```

- `reserve.optimalUsageRate` 是唯一来源；当缺失或 `<= 0` 时 `optimalPct = null`，UI 显示 `—`。
- **历史**：曾写过 `?? simulation?.utilization.optimal` 作为兜底，但 `simulation.utilization.optimal` 同样从 `reserveRateInput.optimalUsageRate` 计算（见 [`useRateSimulation.ts` L1538-1539](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useRateSimulation.ts#L1538-L1539)），与 `reserve.optimalUsageRate` 实际是同一字段；该兜底永不触发，已于 2026-04-27 清理。

**代码位置**：[`DesktopReserveRow.tsx`](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/DesktopReserveRow.tsx)、[`MobileReserveCard.tsx`](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/MobileReserveCard.tsx)

---

## 三、Simulation 数据流详解

### 3.1 Simulation 是什么

`simulation` 是 `useRateSimulation` hook 返回的对象，包含：

- **Native 利率模拟**：基于 Aave 利率模型，计算用户 supply/borrow 后的新利率
- **Incentive 激励预测**：基于用户输入金额，预测 Merit/Merkl/Brevis 激励 APR 的变化
- **市场指标变化**：如 `totalBorrowedUsdAfter`、`availableLiquidityUsdAfter` 等

### 3.2 输入数据来源

`useRateSimulation` 的输入来自多个 API 和数据源：

| 数据 | 来源 API | 说明 |
|---|---|---|
| `reserve` | `GET /markets` | 基础储备数据（APY、cap、激励等，包含 rate calc 字段） |
| `reserveRateInput` | `/markets` reserve 的 RateCalcInput 子集（`hasRateCalcFields` 类型守卫提取） | 链上原始数据（liquidity、debt、利率参数等） |
| `tokenPrices` | `GET /meta/side-data` 或内部索引 | 代币价格 |
| `forecastStates` | `GET /api/campaigns/forecast-states` | Merkl 活动预测数据 |
| `supplyInput` / `borrowInput` | 用户输入 | 模拟场景金额 |

**代码位置**：`src/hooks/useRateSimulation.ts`

---

### 3.3 Native 利率模拟计算

由 `src/lib/interestRateCalculator.ts` 中的 `simulateNativeRatesAfterActions()` 执行：

```
1. 解析用户输入（supplyAmount / borrowAmount）为 bigint
2. 计算新的 totalVariableDebt = baseTotalVariableDebt + addedBorrow
3. 计算 borrowUsageRate = totalVariableDebt / (availableLiquidity + totalVariableDebt + addedLiquidity)
4. 计算 supplyUsageRate = totalVariableDebt / (availableLiquidity + totalVariableDebt + deficit + addedLiquidity)
5. 根据利用率计算 variableBorrowRate（分段线性模型）
6. 计算 liquidityRate = borrowRate × supplyUsageRate × (1 − reserveFactor)
7. APR → APY 转换（按秒复利）
```

**输出**：`NativeRateSimulation` 对象，包含 `supplyAprPercent`、`borrowAprPercent`、`utilizationRatePercent` 等。

---

### 3.4 Incentive 激励预测计算

在 `useRateSimulation.ts` 中，对每种激励类型分别计算：

#### Merit
- 有 `lastRoundRewardUsd` → 基于最新轮次奖励推算
- 无 → 基于 `anchorTvlUsd`（reserve size 或 borrowed）推算
- 仍无 → **fallback 到当前 APR**（`usesCurrentRateFallback: true`）

#### Merkl
- `inputUsd <= 0` 且 `currentApr > 0` → 返回当前 APR
- `inputUsd <= 0` 且 `currentApr === 0` → `forecastWithTVL` 基于当前 TVL 计算
- `inputUsd > 0` → `forecastWithTVL` 基于假设 TVL（current + input）计算

#### Brevis
- 基于 breakdown 级别数据计算
- 支持 supply + borrow 共享 cap 的合并计算

---

### 3.5 MarketMetrics 计算

在 `useRateSimulation.ts` 的 `computeMarketMetrics()` 中：

```typescript
// 当前值（来自 /markets reserve 的 RateCalcInput 字段）
const availableLiquidityUsd = (Number(reserveRateInput.availableLiquidity) / scale) * tokenPrice;
const totalBorrowedUsd = (Number(reserveRateInput.totalVariableDebt) / scale) * tokenPrice;

// 模拟后的值
const availableLiquidityUsdAfter = hasAnyInput
  ? availableLiquidityUsd + supplyInputUsd - borrowInputUsd
  : null;
const totalBorrowedUsdAfter = hasAnyInput
  ? totalBorrowedUsd + borrowInputUsd
  : null;
```

**注意**：如果 `reserveRateInput` 或 `tokenPrice` 缺失，所有 marketMetrics 返回 `null`。

---

### 3.6 Simulation 值的使用方式

在 UI 组件中，simulation 值通常以 `??` fallback 到 base 值：

```typescript
// DesktopReserveRow.tsx
const totalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsdAfter ?? baseTotalBorrowedUsd;
const availableLiquidityUsd = simulation?.marketMetrics.availableLiquidityUsdAfter ?? baseAvailableLiquidityUsd;
```

在 `ReservesTable.tsx` 中，`pickScenarioValue` 决定显示 `current` 还是 `after`：

```typescript
const pickScenarioValue = (current: number | null, after: number | null): number | null =>
  hasSharedScenario ? after ?? current : current;
```

- 无共享输入时 → 显示 `current`（即当前值）
- 有共享输入时 → 显示 `after`（即模拟后的值）

---

## 四、Brevis 激励数据 Fallback

Brevis 数据结构支持 legacy 字段 fallback：

| 字段 | 解析规则 |
|---|---|
| `campaignApr` | `breakdown?.campaignApr ?? brevis.campaignApr ?? 0` |
| `campaignStartedAt` | `breakdown?.campaignStartedAt ?? brevis.campaignStartedAt` |
| `campaignEndedAt` | `breakdown?.campaignEndedAt ?? brevis.campaignEndedAt` |
| `latestTvl` | `breakdown?.latestTvl ?? brevis.latestTvl` |
| `totalBudget` | `breakdown?.totalBudget ?? brevis.totalBudget` |
| `perUserRewardCapUsd` | `breakdown?.perUserRewardCapUsd ?? brevis.perUserRewardCapUsd` |
| `campaignId` | `breakdown?.campaignId ?? brevis.campaignId` |

**Synthetic breakdown**：当 `breakdowns` 数组为空但存在 legacy 字段时，自动构造一个 breakdown。

**代码位置**：`src/lib/brevis.ts`

---

## 五、Forecast Token Price Fallback

用于 Merkl/Merit 激励的 USD 计算：

| 优先级 | 来源 |
|---|---|
| 1 | 本地 `tokenPrices` 索引（按地址匹配） |
| 2 | CoinGecko API（按合约地址） |
| 3 | CoinGecko API（按 symbol 推断，如 `aCelUSDT` → `USDT`） |

**代码位置**：`src/lib/tokenPriceResolver.ts`

---

## 六、相关文档索引

- [rate-calculation.md](rate-calculation.md) — 利率计算详细说明
- [DESIGN-SYSTEM-REFERENCE.md](DESIGN-SYSTEM-REFERENCE.md) — 设计系统参考
- [frontend-interaction-guardrails.md](frontend-interaction-guardrails.md) — 前端交互规范
