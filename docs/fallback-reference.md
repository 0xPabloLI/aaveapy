# Frontend Fallback Reference

> 本文档汇总前端所有存在 fallback 链的变量获取逻辑，以及 `simulation` 值的完整数据流。
>
> 最后更新：2026-04-27

---

## 一、Fallback 总结表

### 1.1 数据缺失时的 Fallback（链上 → 推导）

当链上原始字段缺失时，前端使用推导公式作为 fallback：

| 变量/指标 | 首选来源（链上） | Fallback 来源（推导） | 关键文件 |
|---|---|---|---|
| `totalBorrowedUsd` | `totalVariableDebt` | `reserveSizeUsd × utilizationPct / 100` | `src/lib/scenarioSize.ts` |
| `poolLiquidityUsd` | `availableLiquidity` | `reserveSizeUsd − totalBorrowedUsd` | `src/lib/scenarioSize.ts` |

### 1.2 数据结构 Fallback（新字段 → 旧字段）

| 变量/指标 | 首选来源 | Fallback 来源 | 关键文件 |
|---|---|---|---|
| Brevis 字段 | `breakdown` 级别 | group `legacy` 级别 | `src/lib/brevis.ts` |

### 1.3 Simulation 对 Base 值的覆盖（用户输入后）

当用户输入了 simulation 场景金额时，UI **用 simulation 值覆盖 base 值**；无输入时显示 base 值。这不是传统意义上的"fallback"，而是"场景覆盖"：

| 变量/指标 | Base 值（无输入时） | Simulation 覆盖值（有输入时） | 关键文件 |
|---|---|---|---|
| `utilizationPct` | `reserve.utilizationPct` | `simulation.utilization.after`（或 `current`） | `src/components/dashboard/ReservesTable.tsx` |
| `totalBorrowedUsd` | `baseTotalBorrowedUsd`（链上或推导） | `simulation.marketMetrics.totalBorrowedUsdAfter` | `src/components/dashboard/DesktopReserveRow.tsx` |
| `poolLiquidityUsd` | `basePoolLiquidity`（链上或推导） | `simulation.marketMetrics.availableLiquidityUsdAfter` | `src/components/dashboard/DesktopReserveRow.tsx` |
| Supply APR/APY | `reserve.supplyApy` / `getNativeSupplyApy()` | `simulation.supply.afterNative` | `src/components/dashboard/ReservesTable.tsx` |
| Supply Total APR/APY | `getTotalSupplyApy()` | `simulation.supply.afterTotal` | `src/components/dashboard/ReservesTable.tsx` |
| Borrow APR/APY | `reserve.borrowApy` / `getNativeBorrowApy()` | `simulation.borrow.afterNative` | `src/components/dashboard/ReservesTable.tsx` |
| Borrow Total APR/APY | `getTotalBorrowApy()` | `simulation.borrow.afterTotal` | `src/components/dashboard/ReservesTable.tsx` |
| Spread | `getSpread()` | `simulation.spread.after` | `src/components/dashboard/ReservesTable.tsx` |
| Supply Incentive | `getIncentiveValues(...).apy/apr` | `simulation.supply.afterIncentive` | `src/components/dashboard/ReservesTable.tsx` |
| Borrow Incentive | `getIncentiveValues(...).apy/apr` | `simulation.borrow.afterIncentive` | `src/components/dashboard/ReservesTable.tsx` |

> **注意**：`tokenPrice` 和 `optimalUtilization` **没有** simulation fallback。`tokenPrice` 直接读取 `reserve.tokenPrice`；`optimalUtilization` 直接读取 `reserve.optimalUsageRate`，代码中虽然写了 `?? simulation?.utilization.optimal`，但 simulation 的 `optimal` 也是从同一个 `reserve.optimalUsageRate` 算出来的，所以这条 fallback 实际上永远不会触发。

---

## 二、核心市场数据 Fallback 详解

### 2.1 `totalBorrowedUsd`

**首选**：链上 `totalVariableDebt` 直接换算

```
totalBorrowedUsd = (Number(totalVariableDebt) / 10^decimals) × tokenPrice
```

- 这是 Aave Pool / Spoke 合约的原始数据，与 app.aave.com / pro.aave.com 一致。
- 适用于 V3 和 V4。

**Fallback**：由 `reserveSizeUsd` 和 `utilizationPct` 推导

```
totalBorrowedUsd = reserveSizeUsd × (utilizationPct / 100)
```

- 当链上 `totalVariableDebt` 缺失时使用。
- **V4 特别注意**：`reserveSizeUsd` 可能只是 Spoke 级别的切片，导致推导值严重偏低（如 AaveV4Bluechip USDT 的 `reserveSizeUsd=0`，但实际 borrowed ≈ $1.037B）。

**代码位置**：
- 计算：`src/lib/scenarioSize.ts` 中的 `getReserveTotalBorrowedUsd()` 和 `getTotalBorrowedUsd()`
- 使用：`DesktopReserveRow.tsx`、`ReservesTable.tsx`、`MobileReserveCard.tsx`

---

### 2.2 `poolLiquidityUsd`

**首选**：链上 `availableLiquidity` 直接换算

```
poolLiquidityUsd = (Number(availableLiquidity) / 10^decimals) × tokenPrice
```

**Fallback**：由 `reserveSizeUsd` 减去 `totalBorrowedUsd` 推导

```
poolLiquidityUsd = reserveSizeUsd − totalBorrowedUsd
```

- V4 的 `reserveSizeUsd` 是 per-Spoke 供应切片，而 `availableLiquidity` 是 Hub 级别共享流动性，混用会导致数量级错误。

**代码位置**：
- 计算：`src/lib/scenarioSize.ts` 中的 `getReserveAvailableLiquidityUsd()` 和 `getPoolLiquidityUsd()`

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

**无实际 fallback 链**，直接读取：

```typescript
const optimalPctFromReserve =
  reserve.optimalUsageRate != null && Number(reserve.optimalUsageRate) > 0
    ? Number(reserve.optimalUsageRate) / RAY_TO_PERCENT_DIVISOR
    : null;
const optimalPct = optimalPctFromReserve ?? simulation?.utilization.optimal;
```

- `simulation.utilization.optimal` 也是从 `reserve.optimalUsageRate` 算出来的（见 `interestRateCalculator.ts`），所以 `?? simulation?.utilization.optimal` 这条 fallback **永远不会触发**。
- 保留这段代码是历史遗留，实际上 `optimalPctFromReserve` 永远有值（只要 API 返回了 `optimalUsageRate`）。

**代码位置**：`DesktopReserveRow.tsx:L171-175`、`MobileReserveCard.tsx:L502-506`

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
const poolLiquidity = simulation?.marketMetrics.availableLiquidityUsdAfter ?? basePoolLiquidity;
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
