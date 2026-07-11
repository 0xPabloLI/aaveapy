# Bug: Portfolio 模式下 Borrow 增加 → Supply Incentive Delta 不显示

**Status: ✅ Fixed (AAV-1100 + AAV-1101)**

## 现象

在 Portfolio Simulation 中，当用户只增加 Borrow 金额（Supply delta = 0）且该 token 有 Merkl supply incentive + `netPositionConstraint` 时：

- Supply 侧的 Incentive 数值确实发生了明显变化（因 eligibility ratio 改变）
- 但 Incentive Delta 列显示为 `—`
- Total Delta 和 USD/day delta 也受影响

## 根因

### Bug 1 (AAV-1100): 同 reserve borrow 被双重扣减

真实 API 数据中，所有 34 个有 `netPositionConstraint` 的 reserve，`offsetReserveIds` **都包含自身**。

当前代码（修复前）计算 `finalRatio = sameReserveRatio × crossReserveRatio`，两个 ratio 各自独立扣减同一个 borrow：

```
sameReserveRatio = max(supply - borrow, 0) / supply = 0.5  ← 第一次扣
crossReserveRatio = max(supply - borrow, 0) / supply = 0.5  ← 第二次扣（offsets 含自身）
finalRatio = 0.5 × 0.5 = 0.25  ← 应为 0.5
```

### Bug 2 (AAV-1101): current 和 after 使用相同的 eligibility ratio

`buildIncentiveCurrent` 和 `buildIncentiveAfter` 都传入同一个 `merklGroupMultiplier(side)` 实例，该 multiplier 内部使用含 borrow delta 的 `totalBorrowUsd`。

当 supply delta=0、borrow delta>0 时：
- current 应基于纯钱包仓位（borrow=0） → ratio=1.0
- after 应基于 wallet+delta（borrow>0） → ratio<1.0
- delta = after - current ≠ 0

但两者用同一 ratio → delta = 0 → 显示 `—`。

## 修复

### AAV-1100: 避免双重扣减

当 `offsetReserveIds` 包含自身时，`crossReserveRatio` 已包含同 reserve 的 offset，`sameReserveFactor` 设为 1：

```typescript
const includesSelf = constraint?.offsetReserveIds.includes(reserve.reserveId) ?? false;
const sameReserveFactor = constraint && !includesSelf ? sameReserveRatio : 1;
```

### AAV-1101: 拆分 wallet/simulated 两套 ratio

- `walletMerklGroupMultiplier`: 基于纯钱包仓位，传给 `buildIncentiveCurrent` 和 `headlineIncentive`
- `merklGroupMultiplier` (simulated): 基于 wallet+delta，传给 `buildIncentiveAfter`
- dispatch map `sumCurrent` 使用 wallet 版本，`sumAfter` 使用 simulated 版本

## 验证结果（真实 API 数据）

| Token | Chain | 修复前 delta | 修复后 delta |
|-------|-------|------------|------------|
| USDS | Ethereum | 0 (—) | -1.65% |
| USDe | Ethereum | 0 (—) | -1.27% |
| USDtb | Ethereum | 0 (—) | -1.70% |
| RLUSD | Horizon | 0 (—) | -1.26% |
| USD₮ | Celo | -0.80% | -5.24% |

## Spec

详见 `docs/specs/merkl-eligibility-fix.md`
