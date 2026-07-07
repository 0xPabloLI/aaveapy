# PRD: SimulationLane.sources Dispatch Map + Supply/Borrow Symmetry Elimination

## Metadata

- **Issue**: (to be created in Linear, project: Incentive Source Upper-Layer Unification)
- **Priority**: Medium
- **Depends on**: AAV-968/969/970/971/974 (Phase 1, completed)

## Problem

`buildRateSimulationResult` (L1267-1618, ~350 行) 中存在两类代码重复：

### 1. Supply/Borrow 对称复制

`supplyLane` 和 `borrowLane` 的计算逻辑完全相同（同样的 sum/build 函数、同样的 dispatch 逻辑），只是输入参数不同。当前代码手写两遍，导致：

- current sources (L1378-1391): supply + borrow 完全对称，14 行 × 2
- after sources IIFE (L1396-1465): supply + borrow 完全对称，35 行 × 2
- builder 调用 (L1467-1532): supply + borrow 完全对称，33 行 × 2
- sources 组装 (L1560-1574, L1603-1617): supply + borrow 完全对称，15 行 × 2

### 2. Per-Source 三路硬编码

Merit/Merkl/Brevis 三个 source 的 current sum → after sum → buildDetails 流程相同，但各 source 的函数签名和参数不同。当前三路硬编码导致新增第 4 个 source 需要在 ~48 处 / 7 文件中修改。

## Solution

### 2.1 Supply/Borrow 遍历消除对称

用 `for (const side of ['supply', 'borrow'] as const)` 遍历，按 side 从参数包取正确的变量值。遍历内同时调用 `buildIncentiveAfter × 2`（APY+APR，用于聚合 `afterIncentive`/`afterIncentiveApr`）和 dispatch map（用于 per-source `sources.*.after`），两者独立计算不互相派生。

### 2.2 Dispatch Map 遍历 Per-Source

定义 `SideSourceContext` 参数包 + `sourceDispatch` dispatch map，闭包预绑定所有 source-specific 参数。遍历 `['merit', 'merkl', 'brevis']` 三路，Protocol 作为退化 case 单独处理。

**Protocol 不走 dispatch**：它不计算 after、不生产 campaign details、不做 Math.min 钳位，强行统一会使类型设计复杂化。

## Design

### Types

```typescript
type SourceKey = 'merit' | 'merkl' | 'brevis';

interface SideSourceContext {
  isApy: boolean;
  hasAnyInput: boolean;
  // Merit/Merkl 共享
  meritMerklInputUsd: number;
  grossInputUsd: number;
  eligibilityRatio: number;
  totalPositionUsd: number | undefined;
  // Merit-specific
  anchorTvlUsd: number | undefined;
  // Merkl-specific
  forecastStates: Record<string, MerklForecastWireItem> | undefined;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  merklGroupMul: ((group: MerklOpportunityGroup) => number) | undefined;
  merklCrossNote: ((group: MerklOpportunityGroup) => string | null) | undefined;
  campaignAccessStatuses: Record<string, 'allowed' | 'whitelist-blocked' | 'blacklisted'> | undefined;
  nativeApyPercent: number | undefined;
  // Brevis-specific
  brevisSharedDeposits: ReadonlyMap<string, number> | undefined;
}
```

### Dispatch Map

```typescript
const sourceDispatch: Record<SourceKey, {
  sumCurrent: (data: IncentiveSources[SourceKey], ctx: SideSourceContext) => number;
  sumAfter: (data: IncentiveSources[SourceKey], ctx: SideSourceContext) => number;
  buildDetails: (data: IncentiveSources[SourceKey], ctx: SideSourceContext) => SimulationCampaignDetail[];
}> = {
  merit: {
    sumCurrent: (data, ctx) => sumMeritIncentiveApr(data, ctx.isApy),
    sumAfter: (data, ctx) =>
      sumForecastMeritIncentiveApr(data, ctx.isApy, ctx.meritMerklInputUsd, ctx.anchorTvlUsd, ctx.totalPositionUsd)
      * ctx.eligibilityRatio,
    buildDetails: (data, ctx) =>
      buildMeritCampaignDetails(data, ctx.isApy, ctx.meritMerklInputUsd, ctx.hasAnyInput, ctx.anchorTvlUsd, ctx.eligibilityRatio, ctx.grossInputUsd, ctx.totalPositionUsd),
  },
  merkl: {
    sumCurrent: (data, ctx) =>
      sumMerklIncentiveApr(data, ctx.isApy, ctx.tydroPointToUsdRate, ctx.whitelistMerklCampaignIds, ctx.forecastStates, ctx.merklGroupMul, ctx.campaignAccessStatuses),
    sumAfter: (data, ctx) => {
      const forecasted = buildForecastMerklOpportunities({
        opportunities: data, inputUsd: ctx.meritMerklInputUsd,
        forecastStates: ctx.forecastStates, whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds,
        tydroPointToUsdRate: ctx.tydroPointToUsdRate,
      });
      return sumMerklIncentiveApr(forecasted, ctx.isApy, ctx.tydroPointToUsdRate, ctx.whitelistMerklCampaignIds, undefined, ctx.merklGroupMul, ctx.campaignAccessStatuses);
    },
    buildDetails: (data, ctx) =>
      buildMerklCampaignDetails(data, ctx.isApy, ctx.meritMerklInputUsd, ctx.forecastStates!, ctx.whitelistMerklCampaignIds, ctx.tydroPointToUsdRate, ctx.hasAnyInput, ctx.eligibilityRatio, ctx.grossInputUsd, ctx.merklGroupMul, ctx.merklCrossNote, ctx.campaignAccessStatuses, ctx.nativeApyPercent),
  },
  brevis: {
    sumCurrent: (data, ctx) => sumBrevisIncentiveApr(data, ctx.isApy),
    sumAfter: (data, ctx) =>
      sumForecastBrevisIncentiveApr(data, ctx.isApy, ctx.grossInputUsd, ctx.brevisSharedDeposits, ctx.forecastStates),
    buildDetails: (data, ctx) =>
      buildBrevisCampaignDetails(data, ctx.isApy, ctx.grossInputUsd, ctx.brevisSharedDeposits, ctx.hasAnyInput, ctx.forecastStates),
  },
};
```

### Main Loop (替换 L1267-1618)

```typescript
const lanes: Partial<Record<RateSide, SimulationLane>> = {};

for (const side of ['supply', 'borrow'] as const) {
  const isSupply = side === 'supply';
  const blocked = isSupply ? supplyBlocked : borrowBlocked;
  const sideHasInput = isSupply ? hasSupplyInput : hasBorrowInput;

  const currentData = getIncentiveSources(reserve, side);

  const ctx: SideSourceContext = {
    isApy,
    hasAnyInput,
    meritMerklInputUsd: isSupply ? supplyMeritMerklInputUsd : borrowMeritMerklInputUsd,
    grossInputUsd: isSupply ? supplyInputUsd : borrowInputUsd,
    eligibilityRatio: isSupply ? supplyMeritMerklEligibilityRatio : borrowMeritMerklEligibilityRatio,
    totalPositionUsd: isSupply ? totalSupplyUsd : totalBorrowUsd,
    anchorTvlUsd: getMeritAnchorTvlUsd(reserve, side, getProtocolVersion(reserve.marketName), hubSupplied ?? reserveRateInput?.hubSupplied, hubBorrowed ?? reserveRateInput?.hubBorrowed),
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    merklGroupMul: merklGroupMultiplier(side),
    merklCrossNote: merklCrossReserveNote(side),
    campaignAccessStatuses,
    nativeApyPercent: isSupply ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0),
    brevisSharedDeposits: brevisSharedDepositsByCampaignId,
  };

  // Aggregate afterIncentive (independent from dispatch map)
  const afterIncentiveRaw = hasAnyInput
    ? buildIncentiveAfter(reserve, side, isApy, ctx.meritMerklInputUsd, ctx.grossInputUsd, ctx.eligibilityRatio, forecastStates, tydroPointToUsdRate, whitelistMerklCampaignIds, brevisSharedDepositsByCampaignId, hubSupplied ?? reserveRateInput?.hubSupplied, hubBorrowed ?? reserveRateInput?.hubBorrowed, merklGroupMultiplier(side), campaignAccessStatuses, totalSupplyUsd, totalBorrowUsd)
    : null;
  const afterIncentiveAprRaw = hasAnyInput
    ? buildIncentiveAfter(reserve, side, false, ctx.meritMerklInputUsd, ctx.grossInputUsd, ctx.eligibilityRatio, forecastStates, tydroPointToUsdRate, whitelistMerklCampaignIds, brevisSharedDepositsByCampaignId, hubSupplied ?? reserveRateInput?.hubSupplied, hubBorrowed ?? reserveRateInput?.hubBorrowed, merklGroupMultiplier(side), campaignAccessStatuses, totalSupplyUsd, totalBorrowUsd)
    : null;
  const currentIncentive = isSupply ? supplyCurrentIncentive : borrowCurrentIncentive;
  const currentIncentiveApr = isSupply ? supplyCurrentIncentiveApr : borrowCurrentIncentiveApr;
  const afterIncentive = sideHasInput && afterIncentiveRaw !== null ? Math.min(afterIncentiveRaw, currentIncentive) : null;
  const afterIncentiveApr = sideHasInput && afterIncentiveAprRaw !== null ? Math.min(afterIncentiveAprRaw, currentIncentiveApr) : null;

  // Protocol (退化 case)
  const protocolCurrent = sumNumberArray(currentData.protocol, isApy);
  const protocolDetail = attachCampaigns(buildMetric(protocolCurrent, protocolCurrent), []);

  // Merit/Merkl/Brevis (dispatch map)
  const sr: Record<SourceKey, { current: number; after: number | null; campaigns: SimulationCampaignDetail[] }> = {} as any;
  for (const key of Object.keys(sourceDispatch) as SourceKey[]) {
    const current = sourceDispatch[key].sumCurrent(currentData[key], ctx);
    const afterRaw = hasAnyInput ? sourceDispatch[key].sumAfter(currentData[key], ctx) : null;
    const after = afterRaw !== null ? Math.min(afterRaw, current) : null;
    const campaigns = sourceDispatch[key].buildDetails(currentData[key], ctx);
    sr[key] = { current, after, campaigns };
  }

  // Per-side fields (非 sources 部分)
  const currentNative = isSupply ? supplyCurrentNative : borrowCurrentNative;
  const headlineIncentive = isSupply ? supplyHeadlineIncentive : borrowHeadlineIncentive;
  const currentTotal = isSupply ? supplyCurrentTotal : borrowCurrentTotal;
  const afterNative = blocked ? null : (isSupply ? supplyAfterNative : borrowAfterNative);
  const afterTotal = blocked ? null : (isSupply ? supplyAfterTotal : borrowAfterTotal);
  const walletUsd = isSupply ? walletSupplyUsd : walletBorrowUsd;

  lanes[side] = {
    hasInput: blocked ? false : sideHasInput,
    inputAmount: blocked ? 0 : (isSupply ? supplyAmount : borrowAmount),
    inputUsd: blocked ? 0 : (isSupply ? supplyInputUsd : borrowInputUsd),
    currentNative,
    currentIncentive,
    headlineIncentive,
    currentTotal,
    afterNative,
    afterIncentive,
    afterTotal,
    deltaNative: blocked || !sideHasInput ? null : (afterNative !== null && currentNative !== null ? afterNative - currentNative : null),
    deltaIncentive: blocked ? null : (sideHasInput ? (afterIncentive !== null && currentIncentive !== null ? afterIncentive - currentIncentive : null) : (walletUsd != null ? currentIncentive - headlineIncentive : null)),
    deltaTotal: blocked || !sideHasInput ? null : (afterTotal !== null && currentTotal !== null ? afterTotal - currentTotal : null),
    sources: {
      protocol: protocolDetail,
      merit: attachCampaigns(buildMetric(sr.merit.current, sr.merit.after), sr.merit.campaigns),
      merkl: attachCampaigns(buildMetric(sr.merkl.current, sr.merkl.after), sr.merkl.campaigns),
      brevis: attachCampaigns(buildMetric(sr.brevis.current, sr.brevis.after), sr.brevis.campaigns),
    },
  };
}

const supplyLane = lanes.supply!;
const borrowLane = lanes.borrow!;
```

## Scope

### In Scope

- `rateSimulationCalculator.ts` L1267-1618（~350 行）的重构
- `SideSourceContext` 和 `sourceDispatch` 定义
- Supply/borrow 遍历消除对称
- `for(side)` 遍历内同时调 `buildIncentiveAfter × 2`（APY+APR）和 dispatch map，两者独立计算

### Out of Scope

- `SimulationLane.sources` 类型（保持 `{ protocol, merit, merkl, brevis }` 不变）
- `buildIncentiveAfter` 签名修改（保持 `totalSupplyUsd + totalBorrowUsd` 两个参数，遍历内冗余传参）
- 消除 `buildIncentiveAfter` 与 dispatch map 的重复计算（两者语义不同：aggregate Math.min vs per-source Math.min）
- `incentiveAggregation.ts` 的 `calculateTotalIncentiveApr/Apy`（Phase 1 已改完）
- sum 函数签名统一（ROI 为负，handoff 已确认）
- builder 骨架统一（AAV-972 已 cancel）
- 消费端文件（SimulationSubRow / portfolioSimulator / portfolioCapWarnings / recentlyEndedCampaigns / IncentiveTooltip）
- `buildMeritCampaignDetails` / `buildMerklCampaignDetails` / `buildBrevisCampaignDetails` 内部实现

## Acceptance Criteria

1. **行为变更已知**: dispatch map 传 `anchorTvlUsd`（真实值），per-source `merit.after` 从 CURRENT_RATE 模式变为 TVL_DILUTION 模式（与 `buildIncentiveAfter` 语义对齐）。现有测试不会失败（`sources.merit.after` 断言仅 `> 0` 或 `not.toBeNull`），但生产环境有 supplied 的 V3 reserve 的 per-source merit.after 值会变化
2. **聚合值不变**: `afterIncentive` / `afterIncentiveApr` / `afterTotal` 保持 `buildIncentiveAfter` 独立计算，aggregate `Math.min(sum, currentIncentive)` 语义不变
3. **行数减少**: L1378-1618 从 ~240 行 source 分发代码降至 ~100 行
4. **新增第 4 个 source 的成本**: 只需在 `sourceDispatch` 注册 + `SimulationLane.sources` 类型加一个字段（2 处），`rateSimulationCalculator.ts` 内无需修改 IIFE/builder 调用
5. **4 项 gate 全通过**: `npm run lint && npm test && npm run build && npx tsc --noEmit`

## Per-Source Behavioral Notes (验证要点)

| 差异点 | Merit | Merkl | Brevis | Protocol |
|---|---|---|---|---|
| 输入 USD | 净仓位 (`meritMerklInputUsd`) | 净仓位 (`meritMerklInputUsd`) | 毛输入 (`grossInputUsd`) | N/A |
| eligibilityRatio 应用 | sumAfter 结果外部乘法 | 通过 merklGroupMul 回调内部乘 | 不使用 | N/A |
| After 预处理 | 无 | `buildForecastMerklOpportunities` 替换 campaignApr | 无 | N/A |
| anchorTvlUsd | dispatch map 传真实值（**行为修正**：原 IIFE 传 undefined） | N/A | N/A | N/A |
| Math.min 钳位 | ✅ `Math.min(afterRaw, current)` per-source | ✅ `Math.min(afterRaw, current)` per-source | ✅ `Math.min(afterRaw, current)` per-source | 无（直接复用 current） |
| Cap 效果 | position cap | FIX/MAX/TARGET_TOTAL_APR 三种 | position cap + combine cap + budget-aware | 无 |
| aggregate vs per-source | aggregate `Math.min(sum, currentIncentive)` ≠ `sum(Math.min(per_source))` | 同左 | 同左 | N/A |

## Risks

1. **`buildIncentiveAfter` 与 dispatch map 的 Math.min 语义不等价**: `afterIncentive = Math.min(sum(all_sources_afterRaw), currentIncentive)` 是 aggregate 截断；`sources.merit.after = Math.min(meritAfterRaw, meritCurrent)` 是 per-source 截断。数学上 `sum(min) <= min(sum)`，两者不能互相派生。决策：保留独立计算，dispatch map 管 per-source，`buildIncentiveAfter` 管聚合
2. **IIFE `anchorTvlUsd=undefined` 修复为真实值**: 现有 IIFE (L1399) 对 Merit `sumForecastMeritIncentiveApr` 传 `anchorTvlUsd=undefined`，而 `buildIncentiveAfter` (L918) 传真实值。dispatch map 按设计传 `ctx.anchorTvlUsd`（真实值），与 `buildIncentiveAfter` 对齐。这是有意的行为修正：per-source merit.after 从 CURRENT_RATE 模式变为 TVL_DILUTION 模式。现有测试不会失败（只断言 `> 0` / `not.toBeNull`），但生产环境 UI 值会变。需在 PR review 中确认
3. ~~`merklGroupMultiplier(side)` 闭包稳定性~~: **已验证无风险**。闭包捕获的变量（`supplyInputUsd`/`borrowInputUsd`、`supplyMeritMerklEligibilityRatio`/`borrowMeritMerklEligibilityRatio`、`crossReservePositions`）均为 `const`，不会被后续代码修改
4. **`afterIncentiveApr`（`isApy=false`）不可省略**: USD accrual 计算需要 APR 度量的 incentive rate（单利），而 UI 展示需要用户选择的 APY/APR 度量。`convertAprToApy` 是非线性变换，两者数值不同。遍历内每侧仍需 2 次 `buildIncentiveAfter`（APY+APR），不能减为 1 次
5. **`nativeApyPercent` 仅 Merkl 使用**: `reserve.supplyApy` / `reserve.borrowApy` 只有 `buildMerklCampaignDetails` 消费，放入 `SideSourceContext` 对其他 source 无害但不语义自明

## Test Strategy

- 全量现有测试必须通过
- 新增一条精确数值断言：对有 `supplied` 字段的 V3 reserve，验证 `sources.merit.after` 在 dispatch map 重构后走 TVL_DILUTION 路径（而非 CURRENT_RATE）
- 如需验证，可用现有测试的 snapshot 值对比重构前后输出
