# Frontend Fallback Reference

> 本文档汇总前端所有存在 fallback 链的变量获取逻辑，以及 `simulation` 值的完整数据流。
>
> 最后更新：2026-04-27

---

## 一、Fallback 总结表

| 变量/指标 | 首选来源 | Fallback 来源 | 关键文件 |
|---|---|---|---|
| `totalBorrowedUsd` | 链上 `totalVariableDebt` | `reserveSizeUsd × utilizationPct / 100` | `src/lib/scenarioSize.ts` |
| `poolLiquidityUsd` | 链上 `availableLiquidity` | `reserveSizeUsd − totalBorrowedUsd` | `src/lib/scenarioSize.ts` |
| `tokenPrice` | `simulation.tokenPrice` | `reserve.tokenPrice` | `src/components/dashboard/DesktopReserveRow.tsx` |
| `optimalUtilization` | API `optimalUsageRate` | `simulation.utilization.optimal` | `src/components/dashboard/DesktopReserveRow.tsx` |
| `utilizationPct` | simulation | API `reserve.utilizationPct` | `src/components/dashboard/ReservesTable.tsx` |
| Brevis 字段 | breakdown 级别 | group legacy 级别 | `src/lib/brevis.ts` |
| Merit forecast APR | `lastRoundRewardUsd` | `anchorTvlUsd` → 当前 APR | `src/lib/meritForecast.ts` |
| Merkl forecast APR | currentApr | `forecastWithTVL` at current TVL | `src/lib/merklForecast.ts` |
| Forecast token price | 本地索引 | CoinGecko API（地址 → symbol） | `src/lib/tokenPriceResolver.ts` |
| Simulation 市场指标 | `/markets` reserve 内联字段 (RateCalcInput) | 缺失时返回 `null` | `src/hooks/useRateSimulation.ts` |

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

**Fallback 链**：

1. `simulation?.tokenPrice`（由 `useRateSimulation` 计算或从 API 获取）
2. `reserve.tokenPrice`（`/markets` API 返回）
3. `getValidTokenPrice(...candidates)`（多候选取第一个有效值）

**代码位置**：
- `DesktopReserveRow.tsx:L145`：`const displayTokenPrice = getValidTokenPrice(simulation?.tokenPrice, reserve.tokenPrice);`

---

### 2.4 `optimalUtilization`

**Fallback 链**：

1. API 直接读取：`reserve.optimalUsageRate / RAY_SCALE`
2. Simulation 结果：`simulation?.utilization.optimal`

**注释**：`RAY → display %; API 字段优先直接读取，simulation 作为 fallback。`

**代码位置**：`DesktopReserveRow.tsx:L182-188`、`MobileReserveCard.tsx:L513-519`

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

// MobileReserveCard.tsx
const optimalPct = optimalPctFromReserve ?? simulation.utilization.optimal;
```

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
