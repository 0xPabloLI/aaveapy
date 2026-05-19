# AAV-61 Phase 2：Portfolio 接入完整 Rate Simulation — 详细执行计划

## 0. 前置澄清

- **Native 和 Incentive 机制上就是分开的**，不算问题，不再追踪。
- **V4 Hub 聚合不只是校验**：`hubBorrowed/hubSupplied` 被 `simulateNativeRatesAfterActions`（utilization 计算）和 `getMeritAnchorTvlUsd`（anchor TVL）实际消费。`validateHubAggregateConsistency` 才是纯校验（DEV 模式）。
- **Portfolio 模式 = 点 Batch 开关后的模式**（`simulationMode === 'portfolio'`）。
- **ReserveId 与 ReserveKey 等价**：`getReserveKey(r)` 实现就是 `r.reserveId.trim()`（见 `src/lib/reserveKey.ts`），后端保证全局唯一（V4 含 Hub 维度）。Portfolio 用 `reserveId` 直接做 Map key 在语义上正确，但**保持与现有简化路径一致仍用 `getReserveKey`**，避免出现未 trim 的边角问题。
- **Hub mutate 是 deep-copy 上的 mutate**：`useSharedRateSimulations` L1845 先 `{ ...reserve }` 再覆写字段，源 reserve 不受污染。Portfolio 复用同一模式，无需额外 spread。
- **meritMerklNetPosition 复用默认值 `true`**：Single 模式由 ReservesTable 注入，Portfolio 不引入新开关，传 `true`（或不传，让 `buildRateSimulationResult` 走默认）。

---

## 1. 完整任务清单

### ✅ 已完成（Phase 1）

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 1 | Portfolio 类型定义（`PortfolioPosition`/`PortfolioPositionResult`/`PortfolioSummary`/`PortfolioSnapshot`/`PortfolioState`） | `src/types/portfolio.ts` | ✅ |
| 2 | Position CRUD（add/remove/updateAmount/updateInputMode/clearAll） | `src/hooks/usePortfolioSimulation.ts` L79-124 | ✅ |
| 3 | Snapshot 保存/删除 | `src/hooks/usePortfolioSimulation.ts` L126-143 | ✅ |
| 4 | `resolvePositionAmountUsd`（USD/Token 模式换算） | `src/hooks/usePortfolioSimulation.ts` L176-186 | ✅ |
| 5 | `buildPortfolioPositionResult`（position→result 桥接） | `src/hooks/usePortfolioSimulation.ts` L193-219 | ✅ |
| 6 | `computePositionUsdPerDay`（USD/day 计算，supply+/borrow-） | `src/lib/portfolioCalculator.ts` L63-79 | ✅ |
| 7 | `aggregatePortfolioSummary`（多 position 聚合） | `src/lib/portfolioCalculator.ts` L20-54 | ✅ |
| 8 | `usePortfolioToggle`（toggle handler + Phase 3 简化计算） | `src/hooks/reserves-table/usePortfolioToggle.ts` | ✅ 简化版 |
| 9 | PortfolioPanel（搜索、position 列表、summary card、results table、snapshot 对比） | `src/components/dashboard/PortfolioPanel.tsx` | ✅ |
| 10 | PortfolioTokenRow（独立 supply/borrow 输入框 + USD/Token 切换） | `src/components/dashboard/PortfolioTokenRow.tsx` | ✅ |
| 11 | PortfolioResultsTable | `src/components/dashboard/PortfolioResultsTable.tsx` | ✅ |
| 12 | PortfolioSummaryCard | `src/components/dashboard/PortfolioSummaryCard.tsx` | ✅ |
| 13 | PortfolioCompareView（snapshot 对比） | `src/components/dashboard/PortfolioCompareView.tsx` | ✅ |
| 14 | PortfolioModeToggle（Batch 开关） | `src/components/dashboard/PortfolioModeToggle.tsx` | ✅ |
| 15 | PortfolioPositionRow（旧版单行） | `src/components/dashboard/PortfolioPositionRow.tsx` | ✅ |
| 16 | PortfolioPanelSkeleton | `src/components/dashboard/PortfolioPanelSkeleton.tsx` | ✅ |
| 17 | portfolioPrefetch（lazy chunk） | `src/components/dashboard/portfolioPrefetch.ts` | ✅ |
| 18 | portfolioSearch（搜索排名） | `src/lib/portfolioSearch.ts` | ✅ |
| 19 | PopularTokenChip | `src/components/dashboard/PopularTokenChip.tsx` | ✅ |
| 20 | Batch theme tokens | `src/components/dashboard/batchTheme.ts` | ✅ |

### ✅ 已有测试（Phase 1）

| # | 测试文件 | 用例数 | 状态 |
|---|---------|--------|------|
| 1 | `src/lib/portfolioCalculator.test.ts` | 5 | ✅ 数值断言 |
| 2 | `src/lib/portfolioSearch.test.ts` | 6 | ✅ |
| 3 | `src/hooks/reserves-table/usePortfolioToggle.test.ts` | 11 | ✅ 但仅测简化计算 |
| 4 | `src/components/dashboard/PortfolioPanel.test.tsx` | 4 | ✅ |
| 5 | `src/components/dashboard/PortfolioTokenRow.render.test.tsx` | 6 | ✅ |
| 6 | `src/components/dashboard/PortfolioTokenRow.callback.test.tsx` | 5 | ✅ |
| 7 | `src/components/dashboard/PortfolioTokenRow.visual-gap.test.ts` | 7 | ✅ |
| 8 | `src/components/dashboard/PortfolioPanel.layout.test.tsx` | 2 | ✅ |

### ✅ 已完成（Phase 2 — 核心计算引擎）

| # | 任务 | 依赖 | 风险 | 状态 |
|---|------|------|------|------|
| P2-1 | 提取纯函数 `simulatePortfolioPositions` | 无 | 低 | ✅ |
| P2-2 | 扩展 `usePortfolioToggle` 参数接口 | P2-1 | 低 | ✅ |
| P2-3 | 替换简化计算为完整模拟 | P2-1, P2-2 | 中 | ✅ |
| P2-4 | Hub Aggregation 接入 | P2-3 | 低 | ✅ |
| P2-5 | ReservesTable 传参 | P2-2 | 低 | ✅ |
| P2-6 | Fallback 降级逻辑 | P2-3 | 低 | ✅ |
| P2-7 | `portfolioSimulator` 单元测试（8 cases） | P2-1 | 低 | ✅ |
| P2-8 | `usePortfolioToggle` 更新测试 | P2-3 | 低 | ✅ |
| P2-9 | `portfolioCalculator` 补充 v3/v4 测试 | P2-3 | 低 | ✅ |
| P2-10 | 端到端数值验证 | P2-7 | 中 | ✅ |
| P2-11 | Validation gate（lint + test + build + tsc） | 全部 | 低 | ✅ |

---

## 2. 详细实现步骤

### P2-1：提取纯函数 `simulatePortfolioPositions`

**新建**：`src/lib/portfolioSimulator.ts`

从 `usePortfolioToggle` 的 Phase 3 计算逻辑中提取纯函数，使其可独立测试。

```ts
interface SimulatePortfolioPositionsArgs {
  positions: PortfolioPosition[];
  reserves: ReserveWithSpread[];
  hubAggregationMap: Map<HubAssetKey, HubAggregate>;
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  forecastStates: Record<string, MerklForecastWireItem>;
}

interface SimulatePortfolioPositionsResult {
  results: PortfolioPositionResult[];
  summary: PortfolioSummary;
}

export function simulatePortfolioPositions(
  args: SimulatePortfolioPositionsArgs
): SimulatePortfolioPositionsResult
```

**核心逻辑**：

1. **按 reserveKey 分组**：以 `getReserveKey(reserve)` 为 Map key（等同 `reserveId.trim()`），同 key 的 supply + borrow position 合并为一组；同 side 多 position 求和（CRUD 未强约束，防御式去重）。
2. **对每组调用 `buildRateSimulationResult`**（每个 reserve **只调一次**，supply+borrow 联动）：
   - 构造 `reserveRateInput`：`hasRateCalcFields(reserve)` ? `{ ...reserve }` : `null`（**deep-copy 后再 mutate 安全**，与 `useSharedRateSimulations` L1845 一致）
   - v4 Hub：若 `reserve.hubId`，从 `hubAggregationMap` 取 `hubBorrowed/hubSupplied` 覆写到 copy 上
   - `supplyInput` = supply position 的 USD 金额字符串（`inputMode: 'usd'`）；无 supply position 则传 `'0'`
   - `borrowInput` = borrow position 的 USD 金额字符串；无 borrow position 则传 `'0'`
   - `meritMerklNetPosition`: 不传，使用默认 `true`，与 Single 默认行为一致
   - 调用 `buildRateSimulationResult`，得到一份 `RateSimulationComputedResult`
3. **从结果提取 per-position APR**（一份 result 拆给同 reserve 的多个 position）：
   - supply position：`nativeAprPercent = result.supply.afterNative ?? result.supply.currentNative ?? reserve.supplyApy ?? 0`
   - supply position：`incentiveAprPercent = result.supply.afterIncentive ?? result.supply.currentIncentive ?? 0`
   - borrow 同理走 `result.borrow.*`
   - 注意：`afterNative`/`afterIncentive` 为 `null` 时（该 side 无 input 或被 blocked），fallback 到 `current*`
4. **构建 `PortfolioPositionResult[]`**：调用 `buildPortfolioPositionResult`
5. **聚合**：调用 `aggregatePortfolioSummary`

**Fallback 路径**（与 P2-6 合并）：
- 当 `reserveRateInput === null`（无 rate calc 字段）→ 该 reserve 退回当前简化计算（`reserve.supplyApy` + sum `supplyIncentives`）
- 当 `forecastStates` 为空对象 → Merkl forecast 退回 current APR（`buildRateSimulationResult` 内部已处理）

### P2-2：扩展 `usePortfolioToggle` 参数接口

**修改**：`src/hooks/reserves-table/usePortfolioToggle.ts`

把 4 个 Phase 2 参数收成单个**可选** `simulationContext` 对象，避免 `isApy=false`/`tydroPointToUsdRate=0` 等"真值假"被误判为"未传"。`simulationContext === undefined` ⇒ 走 fallback；传入则进完整模拟。

```ts
export interface PortfolioSimulationContext {
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  tydroPointToUsdRate: number;
  forecastStates: Record<string, MerklForecastWireItem>;
}

export interface UsePortfolioToggleArgs {
  isPortfolioMode: boolean;
  reserves: ReserveWithSpread[];
  portfolioPositions?: PortfolioPosition[];
  portfolioActions?: PortfolioSimulationActions;
  /** Phase 2: 传入则启用完整 buildRateSimulationResult；省略则使用现有简化计算 */
  simulationContext?: PortfolioSimulationContext;
}
```

### P2-3：替换简化计算为完整模拟

**修改**：`src/hooks/reserves-table/usePortfolioToggle.ts` L107-137

**之前**（简化）：
```ts
const nativePercent = pos.side === 'supply' ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0);
const incentiveArr = pos.side === 'supply' ? (reserve.supplyIncentives ?? []) : (reserve.borrowIncentives ?? []);
const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
```

**之后**（完整模拟）：
```ts
if (simulationContext) {
  const hubAggregationMap = buildHubAggregationMap(reserves);
  const { results, summary } = simulatePortfolioPositions({
    positions: portfolioPositions,
    reserves,
    hubAggregationMap,
    ...simulationContext,
  });
  return { portfolioResults: results, portfolioSummary: summary };
}

// Fallback: 简化计算（保持当前逻辑不变 — 同时也是 simulator 内部 per-reserve fallback 的兜底）
```

**注**：simulator 内部对单个无 `reserveRateInput` 的 reserve 已有 fallback；这里的外层 `if (!simulationContext)` 是"调用方未提供 context"的全局兜底，二者层级不同、互不冲突。

### P2-4：Hub Aggregation 接入

**位置**：`portfolioSimulator.ts` 内部

逻辑与 `useSharedRateSimulations` L1845-1854 完全一致 — `reserveRateInput` 是 `{ ...reserve }` 浅拷贝，mutate 安全（不污染源 reserve）：

```ts
const reserveRateInput: RateCalcInput | null = hasRateCalcFields(reserve)
  ? { ...reserve }
  : null;
if (reserveRateInput && reserve.hubId) {
  const hubKey = getHubAssetKey(reserve);
  const hubAgg = hubKey ? hubAggregationMap.get(hubKey) : undefined;
  if (hubAgg) {
    reserveRateInput.borrowed = hubAgg.hubBorrowed;
    reserveRateInput.hubBorrowed = hubAgg.hubBorrowed;
    reserveRateInput.hubSupplied = hubAgg.hubSupplied;
  }
}
```

Hub 聚合影响两个计算路径：
1. `simulateNativeRatesAfterActions`：utilization = `borrowed / (liquidity + borrowed)`，`borrowed` 被 Hub 值覆写
2. `getMeritAnchorTvlUsd`：v4 supply side 的 anchor TVL = `nativeToUsd(hubSupplied)`

### P2-5：ReservesTable 传参

**修改**：`src/components/dashboard/ReservesTable.tsx` L1043-1048

当前：
```ts
const { ... } = usePortfolioToggle({
  isPortfolioMode,
  reserves,
  portfolioPositions,
  portfolioActions,
});
```

改为：
```ts
const portfolioSimulationContext = useMemo<PortfolioSimulationContext>(() => ({
  isApy,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  forecastStates,
}), [isApy, whitelistMerklCampaignIds, tydroPointToUsdRate, forecastStates]);

const { ... } = usePortfolioToggle({
  isPortfolioMode,
  reserves,
  portfolioPositions,
  portfolioActions,
  simulationContext: portfolioSimulationContext,
});
```

这 4 个变量已在 `ReservesTable` 中可用（L98-103 props，L120-126 forecastStates）。`useMemo` 包一层防止每渲染都产生新引用触发 `usePortfolioToggle` 内 `useMemo` 失效。

### P2-6：Fallback 降级逻辑

**位置**：`portfolioSimulator.ts` 内部 + `usePortfolioToggle.ts`

| 降级条件 | 行为 |
|----------|------|
| `reserveRateInput === null`（reserve 无 rate calc 字段） | 该 position 用 `reserve.supplyApy/borrowApy` + sum `supplyIncentives` |
| `forecastStates` 为 `{}` | Merkl forecast 退回 current APR（`buildRateSimulationResult` 内部已处理，无需额外代码） |
| `reserve.tokenPrice` 不可用 | `resolvePositionAmountUsd` 返回 0 → position 被跳过（已有逻辑） |
| `simulationContext` 未传入 | `usePortfolioToggle` 不调用 `simulatePortfolioPositions`，走现有简化路径 |
| 同 reserve 同 side 出现多 position | simulator 内部对 USD 金额求和后再单次调用（防御式，正常 CRUD 路径不会出现） |

### P2-7：`portfolioSimulator.test.ts`（8 个测试用例）

**新建**：`src/lib/portfolioSimulator.test.ts`

#### Test 1：v3 利率联动
```
场景：USDC v3 reserve，totalSupply=$50M，totalBorrow=$20M
      supply position $10000 + borrow position $5000
预期：supply afterNative > supply currentNative（borrow 增加 utilization → supply rate 上升）
断言：result.supply.afterNative > reserve.supplyApy
```

#### Test 2：v4 Hub 利率联动
```
场景：USDC v4 reserve（hubId='hub-1'），Hub 聚合 hubBorrowed=30M，hubSupplied=60M
      supply position $10000 + borrow position $5000
预期：utilization.after > utilization.current（Hub 值影响 utilization 基数）
断言：result.utilization.after > result.utilization.current
```

#### Test 3：Incentive forecast — Merit TVL 稀释
```
场景：reserve 有 Merit incentive（apr=5%, anchorTvl=10M USD）
      supply position $10000
预期：after incentive < current incentive（用户 deposit 稀释 TVL）
断言：result.supply.afterIncentive !== null && result.supply.afterIncentive < result.supply.currentIncentive
```

#### Test 4：Incentive forecast — Merkl FIX_REWARD
```
场景：reserve 有 Merkl FIX_REWARD campaign，supply position $10000
      forecastStates 中有该 campaign 的 10-min metrics
预期：after merkl incentive < current merkl incentive（TVL 稀释）
断言：result.supply.sources.merkl.after !== null && result.supply.sources.merkl.after < result.supply.sources.merkl.current
```

#### Test 5：Incentive forecast — Brevis cap
```
场景：reserve 有 Brevis incentive（perUserRewardCapUsd=100, campaignApr=10%）
      supply position $100000（large enough to trigger cap）
预期：capWarning = true
断言：存在 campaign detail row 的 capWarning === true
```

#### Test 6：Fallback — 无 reserveRateInput
```
场景：reserve 缺少 rate calc 字段（无 liquidity/borrowed/deficit 等）
预期：simulatePortfolioPositions 返回的结果中 nativePercent = reserve.supplyApy
      （与当前简化计算一致）
断言：result.results[0].nativePercent === reserve.supplyApy
```

#### Test 7：多 reserve 独立计算
```
场景：USDC supply $10000 + WETH borrow $5000（不同 reserveId）
预期：各自独立调用 buildRateSimulationResult，利率互不影响
断言：usdcResult.nativePercent 仅受 usdc reserve 数据影响
      wethResult.nativePercent 仅受 weth reserve 数据影响
```

#### Test 8：同 reserve 纯 borrow
```
场景：USDC 只 borrow $5000，无 supply position
预期：borrow afterNative > borrow currentNative（utilization 上升 → borrow rate 上升）
断言：result.borrow.afterNative > reserve.borrowApy
```

### P2-8：`usePortfolioToggle.test.ts` 更新

**修改**：`src/hooks/reserves-table/usePortfolioToggle.test.ts`

新增 3 个测试用例：

| 测试 | 说明 |
|------|------|
| 完整模拟 — v3 supply+borrow | 传入 `isApy`/`whitelistMerklCampaignIds`/`tydroPointToUsdRate`/`forecastStates`，验证 `portfolioResults[0].nativePercent ≠ reserve.supplyApy` |
| 完整模拟 — 无参数 fallback | 不传 Phase 2 参数，验证结果与当前简化计算一致 |
| 完整模拟 — 缺 forecastStates | 传 `isApy` 等 but `forecastStates={}`，验证 Merkl 走 current APR fallback |

现有 11 个测试**全部保留**（它们测的是无 Phase 2 参数的 fallback 路径）。

### P2-9：`portfolioCalculator.test.ts` 补充

**修改**：`src/lib/portfolioCalculator.test.ts`

现有 5 个测试是纯聚合层，不需要改。但补充 2 个边界：

| 测试 | 说明 |
|------|------|
| `computePositionUsdPerDay` — borrow 大 incentive | borrow 5% cost + 6% incentive → net positive（rebate > cost） |
| `aggregatePortfolioSummary` — 多 supply 多 borrow | 3 supply + 2 borrow 混合，验证 netUsdPerDay 和 netEffectiveApy |

### P2-10：端到端数值验证

**手动验证步骤**（非自动化，但需记录）：

1. 选一个 v3 Ethereum USDC reserve，**确保金额未触顶 supplyCap/borrowCap**（否则 Single 端会被 `availableBorrowRoomUsd` 截断，Portfolio 同样会，但需明确这是预期）
2. 在 Single 模式 USD inputMode 下输入 supply $10000 + borrow $5000，记录 simulation 结果
3. 切到 Portfolio 模式，同 reserve 创建 supply $10000 + borrow $5000 两个 position
4. 对比两者的 native APR、incentive APR、USD/day
5. **预期**：在未触顶 cap、未触发 supplyBlocked/borrowBlocked、`meritMerklNetPosition=true` 一致的前提下，Portfolio 的 `result.supply.afterNative` 与 Single 完全一致（同一函数同一参数）
6. **追加验证**：v4 reserve（同 hubId 至少 2 个 Spoke）也跑一遍，确认 Hub 聚合一致

### P2-11：Validation Gate

全部完成后跑：
```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

---

## 3. 文件清单（最终）

| 文件 | 操作 | 任务编号 |
|------|------|----------|
| `src/lib/portfolioSimulator.ts` | **新增** | P2-1, P2-4, P2-6 |
| `src/lib/portfolioSimulator.test.ts` | **新增** | P2-7 |
| `src/hooks/reserves-table/usePortfolioToggle.ts` | 修改 | P2-2, P2-3, P2-6 |
| `src/hooks/reserves-table/usePortfolioToggle.test.ts` | 修改 | P2-8 |
| `src/lib/portfolioCalculator.test.ts` | 修改 | P2-9 |
| `src/components/dashboard/ReservesTable.tsx` | 修改 | P2-5 |

**不修改**：
- `src/types/portfolio.ts` — 类型够用，`simulationDetail` 可选字段延后
- `src/lib/portfolioCalculator.ts` — 聚合逻辑不变
- `src/hooks/usePortfolioSimulation.ts` — 状态管理不变
- `src/components/dashboard/Portfolio*.tsx` — UI 不变（数据源头变了但消费接口不变）

---

## 4. 执行顺序与依赖

```
P2-1 (portfolioSimulator 纯函数)
  ├── P2-7 (portfolioSimulator 测试)
  └── P2-2 (usePortfolioToggle 参数扩展)
        └── P2-3 (替换简化计算)
              ├── P2-4 (Hub 聚合，已在 P2-1 内实现)
              ├── P2-6 (Fallback，已在 P2-1 内实现)
              ├── P2-8 (usePortfolioToggle 测试)
              └── P2-5 (ReservesTable 传参)

P2-9 (portfolioCalculator 补充测试，独立)
P2-10 (端到端验证，最后)
P2-11 (validation gate，最后)
```

**建议执行顺序**：P2-1 → P2-7 → P2-2 → P2-3 → P2-8 → P2-5 → P2-9 → P2-10 → P2-11

---

## 5. Mock 数据模板

测试中构造 reserve mock 必须**满足 `hasRateCalcFields`**：

```ts
const makeRateCalcReserve = (overrides: Partial<ReserveWithSpread> = {}): ReserveWithSpread =>
  ({
    reserveId: 'r-usdc-v3',
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenSymbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    aTokenAddress: '0x...',
    decimals: 6,
    tokenPrice: 1,
    supplied: '50000000000000',       // 50M USDC (6 decimals)
    borrowed: '20000000000000',       // 20M USDC
    liquidity: '30000000000000',      // 30M USDC
    deficit: '0',
    // Cap-related (用大数避免 Test 1/2/3/4/7/8 被 cap 截断；Test 5 单独覆写小 cap)
    supplyCap: '100000000000000',     // 100M
    borrowCap: '80000000000000',      // 80M
    suppliable: '50000000000000',     // 50M room
    borrowable: '60000000000000',     // 60M room
    protocolFee: 10,                  // 10%
    slopeBelowOptimal: 4,             // 4%
    slopeAboveOptimal: 75,            // 75%
    baseBorrowRate: 0,                // 0%
    optimalUtilization: 80,           // 80%
    supplyApy: 2.5,
    borrowApy: 4.8,
    utilizationPct: 40,
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklSupplys: [],
    merklBorrows: [],
    brevisSupplys: [],
    brevisBorrows: [],
    ...overrides,
  }) as ReserveWithSpread;
```

**Test 5（Brevis cap）特别说明**：要触发 `capWarning`，应该构造 `brevisSupplys[].perUserRewardCapUsd = 100` 这类小 cap，而不是 reserve 级别的 supplyCap。reserve 级 cap 截断的是 input 金额（影响 native APR），Brevis cap 截断的是 per-user incentive 奖励（影响 incentive APR）。

v4 mock 增加字段：
```ts
hubId: 'hub-usdc',
// Hub 聚合数据在 hubAggregationMap 中单独提供
```

---

## 6. 验收标准

1. ✅ Portfolio 中每个 position 的 native/incentive APR 来自 `buildRateSimulationResult` 的完整模拟
2. ✅ 同 reserveId 的 supply+borrow 联动：borrow 增加 utilization → supply rate 上升
3. ✅ v4 reserve 使用 Hub 聚合的 `hubBorrowed/hubSupplied` 影响 utilization 和 Merit anchor TVL
4. ✅ Merit/Merkl/Brevis incentive 受 forecast 影响（TVL 稀释、cap 约束）
5. ✅ 缺少必要数据时降级到当前简化计算，不报错，行为与改动前完全一致
6. ✅ `portfolioSimulator.test.ts` 8 个测试全部通过，数值断言精确
7. ✅ `usePortfolioToggle.test.ts` 新增 3 个测试 + 保留原有 11 个
8. ✅ `npm run lint && npm test && npm run build && npx tsc --noEmit` 全部通过
9. ✅ Portfolio 模式数值与 Single 模式一致（同参数同结果）
