# Spec: Fix Merkl Eligibility Ratio Double-Counting & Current/After Semantic Mismatch

## Background

Portfolio Simulation 中，当用户只增加 Borrow 金额（Supply delta=0）且该 token 有 Merkl supply incentive + `netPositionConstraint` 时，Supply Incentive Delta 显示 `—`（零），但 Incentive 值实际发生了明显变化。

经代码审计和真实 API 数据验证，发现 **两个独立的逻辑错误**。

## Bug 1: 同 reserve borrow 被双重扣减

### 现象

真实 API 数据中，所有 34 个有 `netPositionConstraint` 的 reserve，其 `offsetReserveIds` **都包含自身 reserveId**。

### 当前代码

`rateSimulationCalculator.ts:1193-1209`:

```typescript
const merklGroupMultiplier = (side) => (group) => {
  const crossReserveRatio = computeCrossReserveEligibilityRatio({
    sourceGrossUsd: grossUsd,          // totalSupplyUsd (含 borrow delta)
    constraint,                         // offsetReserveIds 含自身
    crossReservePositions,              // 含自身的 borrowUsd
  });
  const sameReserveFactor = constraint ? sameReserveRatio : 1;
  return crossReserveRatio * sameReserveFactor;  // ← 相乘
};
```

`sameReserveRatio` = `max(totalSupply - totalBorrow, 0) / totalSupply` — 第一次扣减自身 borrow。

`crossReserveRatio` = `max(totalSupply - sum(offsetBorrows), 0) / totalSupply`，其中 `offsetBorrows` **包含自身 borrow**（因为 `offsetReserveIds` 含自身） — 第二次扣减同一个 borrow。

### 数值验证（USDS Ethereum, supply=$10,000, borrow=$5,000）

| 计算 | 值 |
|------|-----|
| sameReserveRatio | max(10000-5000,0)/10000 = 0.5 |
| crossReserveRatio | max(10000-5000,0)/10000 = 0.5（自身 borrow 再扣一次） |
| finalRatio (当前) | 0.5 × 0.5 = **0.25** |
| finalRatio (正确) | **0.5** |
| incentive (当前) | 3.296% × 0.25 = 0.824% |
| incentive (正确) | 3.296% × 0.5 = 1.648% |

### 修复方案

当 `constraint` 存在时，`crossReserveRatio` 已经包含了同 reserve 的 offset（因为 `offsetReserveIds` 含自身）。`sameReserveFactor` 应改为 1：

```typescript
const sameReserveFactor = constraint ? 1 : sameReserveRatio;
```

对于没有 `constraint` 的 Merkl campaign（没有 `netPositionConstraint`），保持 `sameReserveRatio` 不变。

### 数学等价性验证

即使 `offsetReserveIds` 不含自身（假设 supply=$10,000, 同 reserve borrow=$4,000, 跨 reserve borrow=$3,000）：

| 方法 | 计算 | 结果 |
|------|------|------|
| 当前（相乘） | max(10000-4000,0)/10000 × max(10000-3000,0)/10000 | 0.6 × 0.7 = 0.42 |
| 正确（累计） | max(10000-4000-3000,0)/10000 | 0.30 |

相乘永远高估 eligible ratio。但由于当前所有真实数据 `offsetReserveIds` 都含自身，修复 `sameReserveFactor=1` 即可解决双重扣减问题。真正的累计抵消逻辑已经由 `computeCrossReserveNetEligible` 一次性处理（遍历所有 offsetReserveIds 累加 offset）。

## Bug 2: current 和 after 使用相同的 eligibility ratio

### 现象

`buildIncentiveCurrent` 和 `buildIncentiveAfter` 都传入同一个 `merklGroupMultiplier(side)` 实例。该 multiplier 内部使用 `totalBorrowUsd`（含 borrow delta）计算 ratio。

当 supply delta=0、borrow delta>0 时：
- `current` 应基于纯钱包仓位（borrow=0） → eligibilityRatio=1.0
- `after` 应基于 wallet+delta（borrow=5000） → eligibilityRatio=0.5
- delta = after - current ≠ 0

但当前两者用同一 ratio → delta = 0 → 显示 `—`。

### 修复方案

需要两套 eligibility ratio：
- **walletEligibilityRatio**: 基于纯钱包仓位（`walletSupplyUsd`, `walletBorrowUsd`）
- **simulatedEligibilityRatio**: 基于 wallet+delta（`totalSupplyUsd`, `totalBorrowUsd`，即当前值）

`buildIncentiveCurrent` 使用 `walletEligibilityRatio`，`buildIncentiveAfter` 使用 `simulatedEligibilityRatio`。

同理，`merklGroupMultiplier` 也需要两套：
- `walletMerklGroupMultiplier`: 用 wallet grossUsd 和 wallet positions
- `simulatedMerklGroupMultiplier`: 用 total grossUsd 和 total positions（当前值）

## Scope

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/rateSimulationCalculator.ts` | 修复 `merklGroupMultiplier` 的 `sameReserveFactor`；拆分 wallet/simulated 两套 ratio 和 multiplier |
| `src/lib/rateSimulationCalculator.test.ts` | 更新现有测试假设（offsetReserveIds 含自身的场景）；新增双重扣减回归测试 |
| `src/lib/portfolioSimulator.test.ts` | 新增 Portfolio 端到端测试 |

### 不涉及

- `netLendingCrossReserve.ts` — `computeCrossReserveNetEligible` 逻辑正确，不需修改
- `incentiveAggregation.ts` — per-source sum 函数不需修改
- Brevis — Brevis 不参与 eligibility ratio
- Merit — Merit 的 `eligibilityRatio` 在 `buildIncentiveAfter` 中乘了但在 `buildIncentiveCurrent` 中没乘，但当前 API 无 Merit 数据，暂不修改（记为已知技术债）

### 风险

- **per-source sumCurrent 一致性**: dispatch map 的 `merkl.sumCurrent`（`:1328-1331`）也使用 `ctx.merklGroupMul`，需同步切换到 wallet 版本
- **headlineIncentive**: `supplyHeadlineIncentive`（`:1236-1238`）也用 `merklGroupMultiplier('supply')`，需评估是否切换到 wallet 版本（headline 应表示无 delta 的值，应用 wallet 版本）
- **deltaIncentive 三态分路**: 修复后 `currentIncentive` 和 `afterIncentive` 值会变化，需验证 `deltaIncentive` 三态逻辑仍正确

## 验收标准

1. **双重扣减修复**: supply=$10,000, borrow=$5,000 的 USDS，incentive ≈ 1.648%（而非 0.824%）
2. **delta 正确显示**: supply delta=0, borrow delta>0 时，supply incentive delta 显示负值（而非 `—`）
3. **现有测试通过**: 所有现有测试通过（可能需更新部分测试的预期值）
4. **新增回归测试**: 覆盖 offsetReserveIds 含自身的场景 + current/after ratio 不同场景
5. **CI gate**: `npm run lint && npm test && npm run build && npx tsc --noEmit` 全部通过
6. **Dev server Playwright 验证**: Portfolio 模式下 borrow delta 导致 supply incentive delta 正确显示负值
