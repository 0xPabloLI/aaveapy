# Frontend Fallback Reference

> 本文档汇总前端所有存在 fallback 链的变量获取逻辑。
>
> 最后更新：2026-06-06

---

## 一、Fallback 总结表

### 1.1 Simulation MarketMetrics 统一 Fallback（V3/V4）

`simulation.marketMetrics` 现在包含 V3/V4 fallback 逻辑，UI 层优先从 simulation 读取 base 值：

| 变量 | 链上首选 | V3 Fallback（推导） | V4 行为 | 统一位置 |
|---|---|---|---|---|
| `totalBorrowedUsd` | `totalVariableDebt` 换算 | `reserveSizeUsd × utilizationPct / 100` | `null` | `useRateSimulation.ts`（`computeMarketMetrics`） |
| `availableLiquidityUsd` | `availableLiquidity` 换算 | `reserveSizeUsd − totalBorrowedUsd` | `null` | `useRateSimulation.ts`（`computeMarketMetrics`） |

UI 层读取模式：
```typescript
const baseTotalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsd ?? getDisplayTotalBorrowedUsd(reserve, protocolVersion);
const totalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsdAfter ?? baseTotalBorrowedUsd;
```

> `scenarioSize.ts` 中的 `getDisplayTotalBorrowedUsd` / `getDisplayAvailableLiquidityUsd` 仍保留，作为 simulation 不可用时的最终 fallback。

### 1.2 Simulation 互补参数 Fallback

**核心原则**：只有当 simulation 用**互补参数重新计算**（而非简单同源转换）时，才具有 fallback 价值。

| 变量 | API 首选来源 | Simulation Base 计算 | 关键文件 |
|---|---|---|---|
| `utilizationPct` | `reserve.utilizationPct` | `simulation.utilization.current` | `ReservesTable.tsx`、`MobileReserveCard.tsx` |

- `simulation.utilization.current` 通过互补的链上参数重新计算：`totalVariableDebt / (availableLiquidity + totalVariableDebt)`
- 其他 simulation 值要么是同源转换（如 `supplyApy` → `toDisplayNative`），不构成互补参数 fallback

### 1.3 数据结构 Fallback

经 normalize 之后，所有 Brevis 字段已扁平化到顶层，不再有 breakdown→legacy 的区别。详见 `src/lib/apiSchemas.ts:normalizeBrevisIncentives`。

---

## 二、核心 Fallback 详解

### 2.1 `totalBorrowedUsd` / `availableLiquidityUsd`

V3/V4 fallback 逻辑已统一到 `useRateSimulation.ts` 的 `computeMarketMetrics()` 中：

- **链上数据可用** → 直接用 `totalVariableDebt` / `availableLiquidity` 换算
- **链上数据缺失 + V3** → 推导：`reserveSizeUsd × utilizationPct / 100` / `reserveSizeUsd − totalBorrowedUsd`
- **链上数据缺失 + V4** → 返回 `null`（V4 的 `reserveSizeUsd` 可能是 Spoke 切片，推导会数量级偏差）

**代码位置**：`src/hooks/useRateSimulation.ts`（`deriveTotalBorrowedUsd`、`deriveAvailableLiquidityUsd`）

---

### 2.2 `utilizationPct`

**首选**：`reserve.utilizationPct`（API 直接返回）

**Fallback**：`simulation.utilization.current`（链上数据重新计算）

```typescript
const baseUtilization = reserve.utilizationPct ?? simulation.utilization.current ?? null;
```

- 这是**唯一**一个 simulation 用互补参数重新计算、可作为 API 缺失时真正 fallback 的变量

**代码位置**：`ReservesTable.tsx`（`getDisplayUtilization`）、`MobileReserveCard.tsx`

---

## 三、Simulation 场景覆盖（非 Fallback）

当用户输入了 simulation 场景金额时，UI **用 simulation 值覆盖 base 值**；无输入时显示 base 值。这是"场景覆盖"而非 fallback：

| 变量 | Base 值（无输入时） | Simulation 覆盖值（有输入时） |
|---|---|---|
| `utilizationPct` | `reserve.utilizationPct` ?? `simulation.utilization.current` | `simulation.utilization.after` |
| `totalBorrowedUsd` | `simulation.marketMetrics.totalBorrowedUsd` ?? `getDisplayTotalBorrowedUsd(...)` | `simulation.marketMetrics.totalBorrowedUsdAfter` |
| `availableLiquidityUsd` | `simulation.marketMetrics.availableLiquidityUsd` ?? `getDisplayAvailableLiquidityUsd(...)` | `simulation.marketMetrics.availableLiquidityUsdAfter` |
| Supply APR/APY | `reserve.supplyApy` / `getNativeSupplyApy()` | `simulation.supply.afterNative` |
| Borrow APR/APY | `reserve.borrowApy` / `getNativeBorrowApy()` | `simulation.borrow.afterNative` |
| Spread | `getSpread()` | `simulation.spread.after` |
| Supply/Borrow Incentive | `getIncentiveValues(...).apy/apr` | `simulation.supply/afterIncentive` |

> **注意**：以下变量 **没有** simulation fallback：
> - `tokenPrice`：UI 直接读取 `reserve.tokenPrice`
> - `optimalUtilization`：直接读取 `reserve.optimalUsageRate`
> - 利率模型参数（`variableRateSlope1/2`、`baseVariableBorrowRate`、`reserveFactor`）：缺失时返回 `null`

---

## 四、Wallet Position 三路 Fallback

### 4.1 概述

用户链上仓位通过三路数据获取，按优先级合并去重：

| 路径 | 触发条件 | 查询范围 | 数据源标记 | 关键文件 |
|---|---|---|---|---|
| SDK | 始终尝试 | SDK 覆盖的链 | `'sdk'` | `useV3UserSupplies` / `useV4UserSupplies` 等 |
| Onchain Fallback | SDK 失败（`isInfrastructureFailure`） | 全部链 | `'onchain-v3'` / `'onchain-v4'` | `useUserPositionsSdk.ts` → `fetchV3Fallback` / `fetchV4Fallback` |
| Gap Fallback | SDK 成功且差集非空 | 仅差集链 | `'gap-v3'` / `'gap-v4'` | `useGapFallbackQuery.ts` → `fetchGapPositions` |

### 4.2 Onchain Fallback vs Gap Fallback

| 维度 | Onchain Fallback | Gap Fallback |
|---|---|---|
| 触发条件 | SDK 整体失败 | SDK 成功但覆盖不全 |
| 查询范围 | 全部链（V3/V4 各自全量） | 仅差集链（`gapChainIds.v3Gap` / `v4Gap`） |
| V3 构建差异 | 完整 `v3AssetsByMarket` | 从中筛选仅含 gap 链的条目 |
| V4 构建差异 | `Object.keys(V4_SPOKE_ADDRESSES)` | 仅 `gapChainIds.v4Gap` |
| RPC 消耗 | 全链查询（较多） | 仅差集链查询（较少） |
| 互斥性 | 与 gap fallback 互斥 | 与 onchain fallback 互斥 |

### 4.3 合并去重

`mergeAndDedupPositions(sdkPositions, fallbackPositions, gapPositions)`:
- 三路 concat 后按 `reserveId::side` 去重
- 去重时 SDK 优先级最高（SDK 数据最权威）
- 失败源独立收集: `mergeFailedSources(sdkFailed, fallbackFailed, gapFailed)`

### 4.4 Gap Chain ID 计算

`computeGapChainIds(reserves, sdkCoverage)`:
- 输入: 后端 reserves（含所有链）+ SDK 覆盖的链集合
- 输出: `{ v3Gap: number[], v4Gap: number[] }` — V3/V4 独立差集
- 差集 = address-book 中存在的链 - SDK 覆盖的链

### 4.5 相关文档

- [ADR-0003](adr/0003-onchain-fallback-reactive-architecture.md) — Onchain Fallback Reactive Architecture
- [ADR-0004](adr/0004-sdk-failure-classification-rpc-rotation-timeout.md) — SDK Failure Classification
- [ADR-0006](adr/0006-gap-fallback-design.md) — Gap Fallback Design（Q1-Q6 决策）

---

## 五、相关文档

- [rate-calculation.md](rate-calculation.md) — 利率计算详细说明
