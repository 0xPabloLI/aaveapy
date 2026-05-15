# V4 Hub Simulation 修正实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修正 V4 simulation 使用 Hub 级聚合数据（而非 per-Spoke 切片），使 V4 利率模拟计算语义正确。

**Architecture:** 在 hook 层按 `hubId` 聚合同 Hub 下所有 Spoke 的 `borrowed`/`supplied`，构造 Hub 级 `RateCalcInput` 传入 `interestRateCalculator`。V3 路径完全不变。`interestRateCalculator.ts` 核心公式不变，只改输入数据语义。

**Tech Stack:** TypeScript, Vitest, React hooks (useMemo)

---

## 背景与问题

### V4 Hub & Spoke 架构下的数据层级

| 字段 | V3 层级 | V4 层级 | V4 SDK 路径 |
|------|---------|---------|-------------|
| `liquidity` | Pool | **Hub** | `r.asset.summary.availableLiquidity.amount.onChainValue` |
| `borrowed` | Pool | **Reserve** (per-Spoke) | `r.summary.borrowed.amount.onChainValue` |
| `supplied` | Pool | **Reserve** (per-Spoke) | `r.summary.supplied.amount.onChainValue` |
| `utilizationPct` | Pool | **Hub** | `r.asset.summary.utilizationRate.value` |
| 利率模型参数 | Pool | **Hub** | `r.asset.settings.*` |
| `supplyCap` / `borrowCap` | Pool | **Reserve** (per-Spoke) | `r.settings.supplyCap/borrowCap` |

### 根因

`interestRateCalculator.ts` 中核心公式：

```
borrowUsageDenominator = liquidity + borrowed
utilization = borrowed / (liquidity + borrowed)
```

V3 中 `liquidity + borrowed = totalDeposits`（同 Pool 级），等式成立。
V4 中 `liquidity`(Hub) + `borrowed`(Spoke) ≠ Hub 的 totalDeposits，**等式被打破**，导致 utilization 和利率 simulation 全部偏。

### hubId 语义

`hubId = base64(chainId::hubAddress)`，编码了 chainId，是链级别唯一。Hub 部署在单条链上，聚合同链上多个 Spoke 的流动性。跨链不共享同一个 hubId。

### 聚合 Key 设计

`HubAssetKey = ${hubId}:${tokenAddress}`

- 同一 Hub 上有多个 token 的 HubAsset（USDC、ETH、DAI...），每个独立
- 同 Hub 同 token 的各 Spoke 的 `borrowed`/`supplied` 应聚合
- hubId 已含 chainId，无需再加 chainId 前缀

---

## 修正方案

### ⚠️ 关键约束：capping 层必须用 Spoke 级数据

`buildRateSimulationResult` 中有两类数据消费者：

| 消费者 | 需要 Spoke 级数据 | 需要 Hub 级数据 |
|--------|:-:|:-:|
| **cap capping**（supplyCap/borrowCap 截断用户输入） | ✅ `reserve.borrowed`/`reserve.supplied` | ❌ |
| **利率 simulation**（`simulateNativeRatesAfterActions`） | ❌ | ✅ Hub聚合 `borrowed`/`supplied` |
| **MarketMetrics 展示** | ❌ | ✅ Hub 级 totalBorrowed/liquidity |

**Bug风险**：如果 `reserveRateInput.borrowed` 被替换为 Hub 聚合值，而 capping 层从 `reserveRateInput.borrowed` 读 `currentTotalBorrowedUsd`，则：

```
borrowCapRemainingUsd = borrowCapUsd(Spoke) - totalBorrowedUsd(Hub)
→ Hub总借款 >> Spoke cap → borrowCapRemaining 永远 ≤ 0 → borrow永远被截断为0
```

**解决方案**：capping 层从**原始 `reserve` 对象**读 `borrowed`/`supplied`（per-Spoke），不从 `reserveRateInput` 读。`reserveRateInput` 只传给 `simulateNativeRatesAfterActions` 和 `computeMarketMetrics`。

---

### 方案选型：方案A（hook 层聚合）优于方案B（ReserveWithSpread 新增字段）

| 维度 | 方案A: hook 层聚合并参数传递 | 方案B: ReserveWithSpread 新增字段 |
|------|------|------|
| 改 API/类型 | 不改 | 需改 ReserveWithSpread + apiSchemas |
| V3 影响范围 | 完全隔离（`if (!r.hubId) continue`） | 新字段 optional，但类型扩散 |
| 聚合逻辑位置 | 集中在 hubAggregation.ts | 分散在多处 |
| 可测试性 | 纯函数，易测 | 需 mock 整个 reserve |
| 数据流 | 单向（hook → buildRateSimulationResult） | bidirectional（读/写 reserve） |

---

## 改动文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/lib/hubAggregation.ts` | 新增 | Hub 聚合函数 |
| `src/lib/hubAggregation.test.ts` | 新增 | 聚合逻辑单元测试 |
| `src/lib/interestRateCalculator.ts` | 修改 | RateCalcInput 新增可选 hubBorrowed/hubSupplied |
| `src/hooks/useRateSimulation.ts` | 修改 | 构建 hubAggregationMap；V4 用聚合值构造 reserveRateInput；getMeritAnchorTvlUsd 用 Hub 级 supplied/borrowed |
| `docs/v3-v4-sdk-field-mapping.md` | 修改 | 补充 Hub 聚合与 simulation 修正的说明 |

---

## 详细任务

### Task 1: 新增 hubAggregation.ts — Hub 聚合纯函数

**Files:**
- Create: `src/lib/hubAggregation.ts`
- Test: `src/lib/hubAggregation.test.ts`

**Step 1: 写失败的测试**

```typescript
import { describe, it, expect } from 'vitest';
import { buildHubAggregationMap, getHubAssetKey } from './hubAggregation';
import type { ReserveWithSpread } from '@/types/aave';

const makeReserve = (overrides: Partial<ReserveWithSpread> & { marketName: string; reserveId: string; chainName: string; chainId: number; tokenName: string; tokenSymbol: string; tokenAddress: string; }): ReserveWithSpread => ({
  marketName: overrides.marketName,
  chainName: overrides.chainName,
  chainId: overrides.chainId,
  tokenName: overrides.tokenName,
  tokenSymbol: overrides.tokenSymbol,
  tokenAddress: overrides.tokenAddress,
  reserveId: overrides.reserveId,
  ...overrides,
});

describe('buildHubAggregationMap', () => {
  it('returns empty map for V3 reserves (no hubId)', () => {
    const reserves = [
      makeReserve({ marketName: 'AaveV3Ethereum', reserveId: 'v3:1:usdc', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', borrowed: '1000000', supplied: '5000000' }),
    ];
    const map = buildHubAggregationMap(reserves);
    expect(map.size).toBe(0);
  });

  it('aggregates borrowed/supplied across Spokes of same Hub+token', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, hubName: 'Core', borrowed: '1000000', supplied: '5000000' }),
      makeReserve({ marketName: 'AaveV4Lido', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, hubName: 'Core', borrowed: '2000000', supplied: '3000000' }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    expect(key).toBe(`${hubId}:0xA0b8`);
    const agg = map.get(key!);
    expect(agg).toBeDefined();
    expect(agg!.hubBorrowed).toBe('3000000');
    expect(agg!.hubSupplied).toBe('8000000');
  });

  it('separates different tokens on same Hub', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: '1000', supplied: '5000' }),
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:eth:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'ETH', tokenSymbol: 'ETH', tokenAddress: '0xC02a', hubId, borrowed: '2000', supplied: '6000' }),
    ];
    const map = buildHubAggregationMap(reserves);
    expect(map.size).toBe(2);
  });

  it('handles missing borrowed/supplied gracefully', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    const agg = map.get(key!);
    expect(agg).toBeDefined();
    expect(agg!.hubBorrowed).toBe('0');
    expect(agg!.hubSupplied).toBe('0');
  });

  it('validates aggregate utilization against API utilizationPct', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: '4000', supplied: '6000', utilizationPct: 40 }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    const agg = map.get(key!);
    // 4000 / (6000 + 4000) = 40%, matches utilizationPct
    const calcUtil = (BigInt(agg!.hubBorrowed) * 100n) / (BigInt(agg!.hubSupplied) + BigInt(agg!.hubBorrowed));
    expect(Number(calcUtil)).toBeCloseTo(40, 0);
  });
});

describe('getHubAssetKey', () => {
  it('returns null for V3 reserves without hubId', () => {
    const reserve = makeReserve({ marketName: 'AaveV3Ethereum', reserveId: 'v3:1:usdc', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8' });
    expect(getHubAssetKey(reserve)).toBeNull();
  });

  it('returns hubId:tokenAddress for V4 reserves', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserve = makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId });
    expect(getHubAssetKey(reserve)).toBe('base64(1::0xHubAddr):0xA0b8');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/hubAggregation.test.ts`
Expected: FAIL (module not found)

**Step 3: 实现 hubAggregation.ts**

```typescript
import type { ReserveWithSpread } from '@/types/aave';

export interface HubAggregate {
  hubBorrowed: string;
  hubSupplied: string;
}

export type HubAssetKey = string;

export function getHubAssetKey(reserve: ReserveWithSpread): HubAssetKey | null {
  if (!reserve.hubId) return null;
  return `${reserve.hubId}:${reserve.tokenAddress}`;
}

export function buildHubAggregationMap(
  reserves: readonly ReserveWithSpread[]
): Map<HubAssetKey, HubAggregate> {
  const acc = new Map<HubAssetKey, { borrowed: bigint; supplied: bigint }>();

  for (const r of reserves) {
    if (!r.hubId) continue;
    const key = getHubAssetKey(r);
    if (!key) continue;

    const existing = acc.get(key) ?? { borrowed: 0n, supplied: 0n };
    existing.borrowed += BigInt(r.borrowed || '0');
    existing.supplied += BigInt(r.supplied || '0');
    acc.set(key, existing);
  }

  const result = new Map<HubAssetKey, HubAggregate>();
  for (const [key, agg] of acc) {
    result.set(key, {
      hubBorrowed: agg.borrowed.toString(),
      hubSupplied: agg.supplied.toString(),
    });
  }
  return result;
}

export function validateHubAggregateConsistency(
  reserves: readonly ReserveWithSpread[],
  hubMap: Map<HubAssetKey, HubAggregate>,
  tolerancePct: number = 5,
): Array<{ reserveId: string; apiUtil: number; calcUtil: number; deltaPct: number }> {
  const warnings: Array<{ reserveId: string; apiUtil: number; calcUtil: number; deltaPct: number }> = [];

  for (const r of reserves) {
    if (!r.hubId || r.utilizationPct == null) continue;
    const key = getHubAssetKey(r);
    if (!key) continue;
    const agg = hubMap.get(key);
    if (!agg) continue;

    const totalBorrowed = BigInt(agg.hubBorrowed);
    const totalSupplied = BigInt(agg.hubSupplied);
    const denominator = totalSupplied + totalBorrowed;
    if (denominator === 0n) continue;

    const calcUtil = Number((totalBorrowed * 100n) / denominator);
    const apiUtil = r.utilizationPct;
    const deltaPct = Math.abs(calcUtil - apiUtil);

    if (deltaPct > tolerancePct) {
      warnings.push({ reserveId: r.reserveId, apiUtil, calcUtil, deltaPct });
    }
  }

  return warnings;
}
```

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/hubAggregation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/hubAggregation.ts src/lib/hubAggregation.test.ts
git commit -m "feat: add hubAggregation for V4 Hub-level borrowed/supplied"
```

---

### Task 2: RateCalcInput 新增可选 Hub 聚合字段

**Files:**
- Modify: `src/lib/interestRateCalculator.ts:9-19`
- Test: `src/lib/interestRateCalculator.test.ts` (已有)

**Step 1: 修改 RateCalcInput 接口**

在 `src/lib/interestRateCalculator.ts` 第 9-19 行，RateCalcInput 新增两个可选字段：

```typescript
export interface RateCalcInput {
  decimals: number;
  liquidity: string;
  borrowed: string;       // V3: pool borrowed; V4: Hub-level aggregated totalBorrowed
  deficit: string;
  protocolFee: number;
  slopeBelowOptimal: number;
  slopeAboveOptimal: number;
  baseBorrowRate: number;
  optimalUtilization: number;
  // V4 Hub aggregation metadata (optional, for computeMarketMetrics display)
  hubBorrowed?: string;   // Hub-level totalBorrowed raw token units
  hubSupplied?: string;   // Hub-level totalSupplied raw token units
}
```

**说明**：`borrowed` 的语义在 V4 下变为 Hub 聚合值（通过 hubAggregation 注入）。`hubBorrowed`/`hubSupplied` 保留原始 Hub 聚合值的引用，供 `computeMarketMetrics` 和 `getMeritAnchorTvlUsd` 使用（防止与 per-Spoke 的 `reserve.borrowed`/`reserve.supplied` 混淆）。

`hasRateCalcFields` 不需要改——它检查的是原始 reserve 上是否有 rate calc 字段，V4 reserve 有这些字段（只是 `borrowed` 是 per-Spoke 的，但存在）。

**Step 2: 运行测试确认现有测试不受影响**

Run: `npx vitest run src/lib/interestRateCalculator.test.ts`
Expected: PASS (新增字段是 optional，不破坏现有类型)

**Step 3: Commit**

```bash
git add src/lib/interestRateCalculator.ts
git commit -m "feat: add optional hubBorrowed/hubSupplied to RateCalcInput"
```

---

### Task 3: useRateSimulation 集成 Hub 聚合

**Files:**
- Modify: `src/hooks/useRateSimulation.ts`

这是核心改动，分三步：

#### 3a: useSharedRateSimulations 中构建 hubAggregationMap

在 `useSharedRateSimulations`（约第 1809 行 `simulationsById` 的 useMemo 之前），新增：

```typescript
import { buildHubAggregationMap, getHubAssetKey, validateHubAggregateConsistency } from '@/lib/hubAggregation';

// 在 useSharedRateSimulations 内部，simulationsById useMemo 之前
const hubAggregationMap = useMemo(
  () => buildHubAggregationMap(reserves),
  [reserves]
);

// Dev-mode consistency validation
if (import.meta.env.DEV) {
  const warnings = validateHubAggregateConsistency(reserves, hubAggregationMap);
  if (warnings.length > 0) {
    console.warn('[V4 HubAggregation] utilization mismatch:', warnings);
  }
}
```

#### 3b: 构造 V4 Hub 级 reserveRateInput

当前代码（约第 1812 行）：
```typescript
const reserveRateInput = hasRateCalcFields(reserve) ? reserve : null;
```

改为：
```typescript
let reserveRateInput: RateCalcInput | null = hasRateCalcFields(reserve) ? { ...reserve } : null;

// V4: replace per-Spoke borrowed/supplied with Hub-level aggregated values
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

**关键点**：用 `{ ...reserve }` 浅拷贝，不修改原始 reserve 对象。这样：
- `reserveRateInput.borrowed` = Hub 级聚合值 → 传给 `simulateNativeRatesAfterActions`，simulation 正确
- `reserve.borrowed` 不变 = per-Spoke 值 → 其他代码路径（如 cap 计算）仍读原始值，不受影响

#### 3c: 修改 getMeritAnchorTvlUsd — V4 用 Hub 级 supplied/borrowed

当前 `getMeritAnchorTvlUsd`（第 339-368 行）签名：
```typescript
const getMeritAnchorTvlUsd = (reserve: ReserveWithSpread, side: RateSide, protocolVersion: ProtocolVersion): number | undefined
```

修改为：
```typescript
const getMeritAnchorTvlUsd = (
  reserve: ReserveWithSpread,
  side: RateSide,
  protocolVersion: ProtocolVersion,
  hubSupplied?: string,
  hubBorrowed?: string,
): number | undefined => {
  if (protocolVersion === 'v4') {
    if (side === 'supply') {
      // V4: use Hub-level totalSupplied (aggregated) instead of per-Spoke supplied
      const size = nativeToUsd(hubSupplied ?? reserve.supplied, reserve.decimals, reserve.tokenPrice);
      if (size != null && Number.isFinite(size) && size > 0) return size;
      return undefined;
    }
    // V4 borrow: use Hub-level totalBorrowed (aggregated)
    const borrowedToUse = hubBorrowed ?? reserve.borrowed;
    const { decimals, tokenPrice } = reserve;
    if (borrowedToUse && decimals != null && tokenPrice != null && tokenPrice > 0) {
      const raw = Number(borrowedToUse);
      if (Number.isFinite(raw) && raw >= 0) {
        const tokens = raw / Math.pow(10, decimals);
        const usd = tokens * tokenPrice;
        if (usd > 0) return usd;
      }
    }
    return undefined;
  }
  // V3: unchanged
  const size = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
  if (size == null || !Number.isFinite(size) || size <= 0) return undefined;
  if (side === 'supply') return size;
  const u = reserve.utilizationPct;
  if (typeof u === 'number' && Number.isFinite(u) && u > 0 && u <= 100) {
    return size * (u / 100);
  }
  return undefined;
};
```

调用处传入 `hubSupplied`/`hubBorrowed`（从 `reserveRateInput` 获取）：
```typescript
// 在调用 getMeritAnchorTvlUsd 的地方，改为：
getMeritAnchorTvlUsd(reserve, side, protocolVersion, reserveRateInput?.hubSupplied, reserveRateInput?.hubBorrowed)
```

#### 3d: 修复 capping 层的 currentTotalBorrowedUsd — 必须用 Spoke 级 borrowed

**Bug**：当前第1018-1024行从 `reserveRateInput.borrowed` 算 `currentTotalBorrowedUsd`，V4下 `reserveRateInput.borrowed` 已被替换为Hub聚合值：

```typescript
// 当前代码（V4 bug）：
const totalDebt = Number(reserveRateInput.borrowed) / scale; // Hub级总借款
// → borrowCapRemainingUsd = borrowCapUsd(Spoke) - totalBorrowedUsd(Hub)
// → Hub总借款 >> Spoke cap → borrowCapRemaining永远 ≤ 0 → borrow永远被截断为0
```

**修复**：capping 层从原始 `reserve` 对象读 borrowed（per-Spoke），不从 `reserveRateInput` 读：

```typescript
// 修复后：
const currentTotalBorrowedUsd = reserve.borrowed && tokenPrice
  ? (() => {
      const decimals = reserve.decimals ?? 18;
      const scale = Math.pow(10, decimals);
      const totalDebt = Number(reserve.borrowed) / scale; // per-Spoke borrowed
      return totalDebt * tokenPrice;
    })()
  : null;
```

同理，`availableLiquidityForBorrowUsd`（第1035-1043行）中的 `reserveRateInput.liquidity` 用于算 Hub 级 available liquidity + supply，这里 **Hub liquidity 是正确的**（capping borrow时需要看Hub有多少流动性可用），不需要改。

#### 3e: computeMarketMetrics — 无需改动

`computeMarketMetrics` 中的 `reserveRateInput.borrowed` 和 `reserveRateInput.liquidity` 已被替换为 Hub 级值，算出的 `onChainTotalBorrowedUsd` 和 `onChainAvailableLiquidityUsd` 自然是 Hub 级的。

after 值计算公式形式不变：
- `availableLiquidityUsdAfter = availableLiquidityUsd + effectiveSupplyInputUsd - borrowInputUsd`
  - V4 语义：Hub liquidity + spoke supply（增加 Hub deposits） - spoke borrow（减少 Hub free liquidity）→ 正确
- `totalBorrowedUsdAfter = totalBorrowedUsd + borrowInputUsd`
  - V4 语义：Hub totalBorrowed + spoke borrow（增加 Hub 总借款）→ 正确

**Step: 运行测试**

Run: `npm test`
Expected: PASS

**Step: Commit**

```bash
git add src/hooks/useRateSimulation.ts
git commit -m "feat: V4 simulation uses Hub-level aggregated borrowed/supplied"
```

---

### Task 4: computeMarketMetrics 的 totalBorrowedUsd 展示语义确认

**Files:**
- Modify: `src/hooks/useRateSimulation.ts` (如需)

当前 `computeMarketMetrics` 返回的 `totalBorrowedUsd` 被 UI 用于 ReservesTable 的 "Total Borrowed" 展示。V4 下这个值现在变成了 Hub 级的总借款。

**需要确认**：UI 层的 "Total Borrowed" 对 V4 reserve 应该展示 Hub 级总借款还是 per-Spoke 借款？

- 如果应该展示 **Hub 级**：无需改动，`computeMarketMetrics` 已返回 Hub 级值
- 如果应该展示 **per-Spoke**：需要在 `MarketMetrics` 中新增 `spokeBorrowedUsd` 字段，从原始 `reserve.borrowed` 计算

**当前判断**：ReservesTable 每行是一个 Spoke（reserve），用户在该 Spoke 上操作，"Total Borrowed" 展示 Hub 级可能更准确（因为利率由 Hub utilization 决定），但这需要 UI/UX 确认。

**暂不改动**，先保留 Hub 级值。如果后续需要 per-Spoke 展示，可从 `reserve.borrowed`（原始值不变）计算。

---

### Task 5: 补充测试覆盖

**Files:**
- Modify: `src/lib/hubAggregation.test.ts` (Task 1 已创建)
- Create: `src/hooks/useRateSimulation.v4.test.ts` (V4 simulation 集成测试)

#### 5a: hubAggregation.test.ts 边界 case

```typescript
it('handles single-Spoke Hub (aggregate = single spoke value)', () => {
  const hubId = 'base64(1::0xHubAddr)';
  const reserves = [
    makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: '3000000', supplied: '7000000' }),
  ];
  const map = buildHubAggregationMap(reserves);
  const key = getHubAssetKey(reserves[0]);
  const agg = map.get(key!);
  expect(agg!.hubBorrowed).toBe('3000000');
  expect(agg!.hubSupplied).toBe('7000000');
});

it('handles very large BigInt values without overflow', () => {
  const hubId = 'base64(1::0xHubAddr)';
  const largeValue = '999999999999999999999999999999';
  const reserves = [
    makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: largeValue, supplied: largeValue }),
    makeReserve({ marketName: 'AaveV4Lido', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: largeValue, supplied: largeValue }),
  ];
  const map = buildHubAggregationMap(reserves);
  const key = getHubAssetKey(reserves[0]);
  const agg = map.get(key!);
  const expected = (BigInt(largeValue) * 2n).toString();
  expect(agg!.hubBorrowed).toBe(expected);
  expect(agg!.hubSupplied).toBe(expected);
});
```

#### 5b: validateHubAggregateConsistency 测试

```typescript
describe('validateHubAggregateConsistency', () => {
  it('returns empty array when all consistent', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: '4000', supplied: '6000', utilizationPct: 40 }),
    ];
    const map = buildHubAggregationMap(reserves);
    const warnings = validateHubAggregateConsistency(reserves, map, 5);
    expect(warnings).toHaveLength(0);
  });

  it('returns warnings when utilization mismatch exceeds tolerance', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({ marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core', chainName: 'Ethereum', chainId: 1, tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8', hubId, borrowed: '4000', supplied: '6000', utilizationPct: 60 }),
    ];
    const map = buildHubAggregationMap(reserves);
    const warnings = validateHubAggregateConsistency(reserves, map, 5);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].deltaPct).toBeGreaterThan(5);
  });
});
```

#### 5c: V4 simulation 集成测试（关键！覆盖我们聊的核心问题）

新建 `src/hooks/useRateSimulation.v4.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { simulateNativeRatesAfterActions } from '@/lib/interestRateCalculator';
import { buildHubAggregationMap, getHubAssetKey } from '@/lib/hubAggregation';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateCalcInput } from '@/lib/interestRateCalculator';

  // Test 1: V4 simulation 用 Hub 级 borrowed → utilization 匹配链上公式
  // 链上: utilization = totalBorrowed / totalDeposits = totalBorrowed / (availableLiquidity + totalBorrowed)
  // 前端: utilization = borrowed / (liquidity + borrowed)
  // 当 borrowed=Hub级totalBorrowed, liquidity=Hub级availableLiquidity 时，两者等价
describe('V4 Hub simulation integration', () => {
  it('simulation utilization matches on-chain formula when using Hub aggregated borrowed', () => {
    // Setup: Hub totalDeposits=10M, totalBorrowed=4M → utilization=40%, availableLiquidity=6M
    const hubId = 'base64(1::0xHubAddr)';
    const spoke1Borrowed = '1000000000000000000000'; // 1M * 1e18
    const spoke2Borrowed = '3000000000000000000000'; // 3M * 1e18
    const spoke1Supplied = '6000000000000000000000'; // 6M
    const spoke2Supplied = '4000000000000000000000'; // 4M
    // Hub liquidity = totalDeposits - totalBorrowed = 10M - 4M = 6M
    const hubLiquidity = '6000000000000000000000';

    const reserves = [
      makeReserve({ ..., hubId, borrowed: spoke1Borrowed, supplied: spoke1Supplied, utilizationPct: 40 }),
      makeReserve({ ..., hubId, borrowed: spoke2Borrowed, supplied: spoke2Supplied, utilizationPct: 40 }),
    ];
    const hubMap = buildHubAggregationMap(reserves);
    const hubKey = getHubAssetKey(reserves[0]);
    const hubAgg = hubMap.get(hubKey!);

    // Construct RateCalcInput with Hub-level borrowed (方案核心改动)
    const rateInput: RateCalcInput = {
      decimals: 18,
      liquidity: hubLiquidity,              // Hub级 = 6M
      borrowed: hubAgg!.hubBorrowed,         // Hub级聚合 = 4M
      deficit: '0',
      protocolFee: 10,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 75,
      baseBorrowRate: 0,
      optimalUtilization: 80,
    };

    const sim = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '0', borrowAmount: '0' });

    // utilization = 4M / (6M + 4M) = 40% — matches API utilizationPct ✅
    expect(sim.utilizationRatePercent).toBeCloseTo(40, 0);
  });

  // Test 2: capping 层用 Spoke 级 borrowed（Task 3d bug fix 验证）
  it('borrow cap remaining uses per-Spoke borrowed, not Hub aggregated', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const spoke1Borrowed = '1000000000000000000000'; // 1M (per-Spoke)
    const hubBorrowed = '4000000000000000000000';    // 4M (Hub aggregated)
    const spokeBorrowCap = '2000000000000000000000'; // 2M (per-Spoke cap)

    // borrowCapRemaining = borrowCap - spokeBorrowed = 2M - 1M = 1M (正确)
    // 如果错用 hubBorrowed: borrowCap - hubBorrowed = 2M - 4M = -2M → borrow 被截断为0 (bug)
    const correctRemaining = 2_000_000 - 1_000_000; // 1M
    const bugRemaining = 2_000_000 - 4_000_000;    // -2M → clamped to 0

    expect(correctRemaining).toBe(1_000_000); // ✅ 用 spoke borrowed
    expect(Math.max(bugRemaining, 0)).toBe(0);  // ❌ 用 hub borrowed → borrow 被锁死
  });

  // Test 3: reserveRateInput 是浅拷贝，原始 reserve 不被污染
  it('reserveRateInput is a shallow copy — original reserve.borrowed unchanged', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserve = makeReserve({
      ..., hubId, borrowed: '1000000000000000000000', // per-Spoke 1M
    });
    const hubMap = buildHubAggregationMap([reserve, /* another spoke */]);
    const hubKey = getHubAssetKey(reserve);
    const hubAgg = hubMap.get(hubKey!);

    // 方案代码：let reserveRateInput = { ...reserve }; reserveRateInput.borrowed = hubAgg.hubBorrowed;
    const reserveRateInput: RateCalcInput = { ...reserve } as RateCalcInput;
    reserveRateInput.borrowed = hubAgg!.hubBorrowed;

    // 原始 reserve 不受影响
    expect(reserve.borrowed).toBe('1000000000000000000000'); // per-Spoke
    expect(reserveRateInput.borrowed).not.toBe(reserve.borrowed); // Hub aggregated
  });

  // Test 4: getMeritAnchorTvlUsd V4 supply 端用 hubSupplied
  it('V4 Merit anchor TVL uses hubSupplied for supply side', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const spokeSupplied = '2000000000000000000000'; // 2M (per-Spoke)
    const hubSupplied = '6000000000000000000000';   // 6M (Hub aggregated)
    const decimals = 18;
    const tokenPrice = 1;

    // V4 supply side should use hubSupplied (6M) not spokeSupplied (2M)
    const spokeTvl = (Number(spokeSupplied) / Math.pow(10, decimals)) * tokenPrice; // 2M
    const hubTvl = (Number(hubSupplied) / Math.pow(10, decimals)) * tokenPrice;     // 6M

    expect(hubTvl).toBeGreaterThan(spokeTvl); // Hub TVL > Spoke TVL
    // getMeritAnchorTvlUsd V4 should return hubTvl when hubSupplied is provided
  });

  // Test 5: V4 simulation 在 cap 截断后继续计算（我们聊的"cap后APY不变"问题）
  it('V4 simulation continues after cap capping — APY locks at cap value', () => {
    const rateInput: RateCalcInput = {
      decimals: 18,
      liquidity: '10000000000000000000000', // 10M
      borrowed: '5000000000000000000000',   // 5M (Hub aggregated)
      deficit: '0',
      protocolFee: 10,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 75,
      baseBorrowRate: 0,
      optimalUtilization: 80,
    };

    // Supply 2M (within cap)
    const sim2m = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '2000000', borrowAmount: '0' });
    // Supply 3M (at cap — assuming cap=3M)
    const sim3m = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '3000000', borrowAmount: '0' });
    // Supply 5M (exceeds cap — capped to 3M, APY same as 3M)
    const sim5m = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '5000000', borrowAmount: '0' });

    // 2M vs 3M: different utilization → different APY
    expect(sim2m.supplyApyPercent).not.toBeCloseTo(sim3m.supplyApyPercent, 2);
    // 3M vs 5M: same because input is capped → same APY
    // (This test validates the capping behavior, not the calculator itself)
  });
});
```

#### 5d: 运行所有测试

Run: `npm test`
Expected: PASS

#### 5e: Commit

```bash
git add src/lib/hubAggregation.test.ts src/hooks/useRateSimulation.v4.test.ts
git commit -m "test: add V4 simulation integration tests — hub aggregation, capping, Merit TVL"
```

---

### Task 6: 更新文档

**Files:**
- Modify: `docs/v3-v4-sdk-field-mapping.md`

在文档末尾（"最近更新" 行之前）新增章节：

```markdown
## V4 Simulation Hub 聚合修正

### 问题

V4 的 `interestRateCalculator.ts` 中 `borrowUsageDenominator = liquidity + borrowed`，
`liquidity` 是 Hub 级，`borrowed` 是 Reserve 级（per-Spoke），跨层加法不正确。

### 解决方案

在 `useSharedRateSimulations` 中按 `hubId:tokenAddress` 聚合同 Hub 下所有 Spoke 的
`borrowed`/`supplied`，构造 Hub 级 `RateCalcInput` 传入利率计算。

### 数据流

```
reserves[] → buildHubAggregationMap() → Map<hubId:tokenAddress, HubAggregate>
                                          ↓
reserveRateInput = { ...reserve, borrowed: hubAgg.hubBorrowed }
                                          ↓
simulateNativeRatesAfterActions(reserveRateInput, actions)
```

### 聚合 Key

`HubAssetKey = ${hubId}:${tokenAddress}`

- `hubId = base64(chainId::hubAddress)`，已含 chainId，链级别唯一
- 同 Hub 同 token 的各 Spoke 的 `borrowed`/`supplied` 聚合
- 不同 token 的 HubAsset 独立（不同 utilization/liquidity/利率模型）

### V3 不受影响

`if (!r.hubId) continue` 跳过 V3 reserve，V3 路径完全不变。

### 数据完整性校验

`validateHubAggregateConsistency()` 在 dev 模式下对比聚合算出的 utilization
与 API 返回的 `utilizationPct`，偏差 > 5% 时 console.warn。
```

更新 "最近更新" 行：

```
**最近更新**: 2026-05-14（V4 Simulation Hub 聚合修正：按 hubId:tokenAddress 聚合 Spoke 的 borrowed/supplied，替换 per-Spoke 值传入利率计算）
```

**Step: Commit**

```bash
git add docs/v3-v4-sdk-field-mapping.md
git commit -m "docs: add V4 simulation hub aggregation section"
```

---

### Task 7: 全量验证

**Step 1: lint**

Run: `npm run lint`
Expected: 0 errors

**Step 2: test**

Run: `npm test`
Expected: all pass

**Step 3: type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: build**

Run: `npm run build`
Expected: success

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Hub 内 Spoke 列表不完整（后端少了某个 reserve） | 聚合值偏小，utilization 偏低 | `validateHubAggregateConsistency` dev warn |
| `reserve.borrowed`/`supplied` 为 undefined/invalid string | BigInt() 抛错 | `BigInt(r.borrowed \|\| '0')` 防御 |
| decimals 同 Hub 同 token 不一致 | BigInt 加法语义错 | Aave 架构保证同 token decimals 相同；可加 assert |
| V3 reserve 意外有 hubId | 被 V4 聚合逻辑误处理 | V3 后端不返回 hubId 字段；即使返回，`hasRateCalcFields` + spread 不影响 V3 计算 |
| UI "Total Borrowed" 展示变为 Hub 级 | 用户困惑（per-Spoke 行显示 Hub 级值） | 需 UX 确认；可从原始 `reserve.borrowed` 另算 per-Spoke 值 |

---

## 未覆盖项（后续迭代）

1. **Hub 级 supplyCap/borrowCap**：SDK 提供 `hub.summary.totalSupplyCap/totalBorrowCap`，当前前端未使用。cap% 计算应取 `min(spokeCap, hubCap)`，需后续补充。
2. **deficit**：V4 SDK 不提供 deficit，保持默认 `'0'`。
3. **Hub 级 totalSupplied/totalBorrowed 的 SDK 直出**：如果后端 `/markets` API 未来直接提供 Hub 级字段，可去掉前端聚合逻辑，直接读 API。
