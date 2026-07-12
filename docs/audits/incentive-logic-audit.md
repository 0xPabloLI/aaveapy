# 方法论：Incentive 计算逻辑审计

## 背景

AAV-1100 和 AAV-1101 暴露了两类系统性逻辑错误：**双重扣减**（同一数量在乘法组合中被扣两次）和 **current/after 语义不一致**（两者使用同一个含 delta 的参数导致 delta=0）。本文档总结审计方法论，用于系统性检查所有 incentive 计算路径。

## 审计方法论

### 原则 1: 乘法组合中的重复扣减

**模式**：`finalRatio = ratioA × ratioB`，其中 A 和 B 各自独立扣减了同一个数量 Q。

**检测方法**：
1. 找到所有 `ratioA × ratioB` 形式的乘法组合
2. 检查 A 和 B 的计算公式中是否引用了同一个数据源
3. 如果是，验证该数据源是否在两者中都被扣减

**已知案例**：
- AAV-1100: `sameReserveRatio × crossReserveRatio`，两者都扣减了同 reserve 的 borrow（因 `offsetReserveIds` 含自身）
- AAV-761: `totalPositionUsd = principal + netInput`，principal 已含 delta 但又加了 netInput

### 原则 2: current/after 参数一致性

**模式**：`current` 和 `after` 共用同一个参数实例，该参数包含 delta。

**检测方法**：
1. 找到所有同时计算 current 和 after 的代码路径
2. 检查 current 使用的参数是否包含 delta（应该不包含）
3. 检查 after 使用的参数是否包含 delta（应该包含）
4. 如果 current 的参数包含 delta → delta = after - current ≈ 0（bug）

**已知案例**：
- AAV-1101: `merklGroupMultiplier` 在 `buildIncentiveCurrent` 和 `buildIncentiveAfter` 中使用同一实例，内部用 `totalBorrowUsd`（含 delta）
- AAV-1060: `supplyHeadlineIncentive` 使用 `merklGroupMultiplier`（含 delta），但 headline 应表示无 delta 的值

### 原则 3: per-source sum 与 aggregate 一致性

**模式**：per-source `sumCurrent` 使用 scaling factor 版本 X，aggregate `buildIncentiveCurrent` 使用版本 Y，X ≠ Y → 分项之和 ≠ 总值。

**检测方法**：
1. 列出 dispatch map 中每个 source 的 `sumCurrent` 使用的参数
2. 列出 `buildIncentiveCurrent` 使用的参数
3. 逐参数对比是否一致
4. 对 `sumAfter` 和 `buildIncentiveAfter` 重复

**已知案例**：
- AAV-978: `sumBrevisIncentiveApr` 在 calculator 和 aggregation 中有两个版本，口径不同
- AAV-1060: aggregate current 缺少 `merklGroupMultiplier`，per-source 有
- AAV-1060: headline 缺少 `merklGroupMultiplier`，current 有

### 原则 4: 数据源语义统一性

**模式**：同一变量名在不同模式下承载不同语义，导致公式在某模式下 double-count。

**检测方法**：
1. 对每个变量，标注其语义（wallet-only / delta-only / wallet+delta）
2. 检查公式中 `A + B` 时 A 和 B 是否可能来自同一数据源
3. 特别关注 `X + Y` 当 `X === Y` 时的边界（single simulation 中两者都来自 input）

**已知案例**：
- AAV-761: `totalSupplyUsd` 在 single simulation 中 = inputUsd，公式 `total = principal + netInput` 变成 `input + input = 2×input`
- AAV-1086: `crossReservePositions` 在 two paths 中用了不同数据源

### 原则 5: delta 语义三态

**模式**：`delta = after - current`，但 `after` 和 `current` 的 null 语义不一致。

**检测方法**：
1. 对每个 delta 字段，确认 `after=null` 和 `after=0` 的语义区别
2. `??` 运算符: `0 ?? fallback` → `0`（不 fallback），`null ?? fallback` → `fallback`
3. 确认 `hasInput` 分支在所有层级一致

**已知案例**：
- AAV-761: `after=0` vs `after=null` 语义不同，`??` 运算符下行为迥异

## 审计结果

### 已修复（本次 session）

| Issue | 类型 | 描述 |
|-------|------|------|
| AAV-1100 | 原则 1 | `sameReserveRatio × crossReserveRatio` 双重扣减同 reserve borrow |
| AAV-1101 | 原则 2 | `merklGroupMultiplier` 在 current/after 中共用，含 delta |

### 已修复（历史）

| Issue | 类型 | 描述 |
|-------|------|------|
| AAV-761 | 原则 1+4 | `totalPositionUsd = principal + netInput` double-count |
| AAV-978 | 原则 3 | per-source sum 与 aggregate 使用不同版本的同一函数 |
| AAV-1060 | 原则 2+3 | headline/current/after 的 `merklGroupMultiplier` 不一致 |
| AAV-1060 | 原则 4 | `grossUsd` 用 delta-only 而非 total-based |
| AAV-1086 | 原则 4 | `crossReservePositions` 在 two paths 中数据源不同 |

### 已修复的潜在问题 (AAV-1102)

| # | 类型 | 严重度 | 描述 | 修复 |
|---|------|--------|------|------|
| 1 | 原则 2+3 | 低 | Brevis `sumCurrent` 不应用 wallet position cap dilution。改用 `sumForecastBrevisIncentiveApr` + `walletPositionUsd`。 | ✅ `cf30b61c` |
| 2 | 原则 2+3 | 低 | Merit `buildDetails` per-campaign `current` 未乘 `walletEligibilityRatio`。新增参数并应用。同时修复 `buildIncentiveCurrent` Merit 未乘 ratio 的遗留问题。 | ✅ `cf30b61c` |
| 3 | 原则 2+3 | 低 | Merkl `buildDetails` per-campaign `current` 未乘 `walletEligibilityRatio` 和 `walletMerklGroupMultiplier`。新增两个参数并应用。 | ✅ `cf30b61c` |

### 修复详情

**问题 1（Brevis current 无 dilution）**：
- `sumCurrent` 从 `sumBrevisIncentiveApr/Apy`（headline）改为 `sumForecastBrevisIncentiveApr` + `walletPositionUsd`
- `buildBrevisCampaignDetails` 新增 `walletPositionUsd` 参数，current 应用 `applyPositionCap` dilution

**问题 2（Merit per-campaign current 无 eligibility ratio）**：
- `buildMeritCampaignDetails` 新增 `walletEligibilityRatio` 参数，`baseCurrent` 乘以该 ratio
- `buildIncentiveCurrent` 新增 `walletEligibilityRatio` 参数，Merit APR 乘以该 ratio（修复了 aggregate 层面的遗留不一致）

**问题 3（Merkl per-campaign current 无 multiplier）**：
- `buildMerklCampaignDetails` 新增 `walletEligibilityRatio` 和 `walletMerklGroupMultiplier` 参数
- `current` 乘以 `walletEligibilityRatio * walletGroupMul`

**测试**：8 个新测试覆盖 per-campaign vs aggregate 一致性，包括 Merit eligibility scaling、Merkl constraint scaling、Brevis position cap dilution、all-sources aggregate consistency。

## 审计清单

对每个 incentive 计算路径，按以下清单检查：

```
□ 乘法组合中的每个因子是否独立扣减了同一数量？（原则 1）
□ current 使用的参数是否不含 delta？（原则 2）
□ after 使用的参数是否含 delta？（原则 2）
□ per-source sumCurrent 与 aggregate current 使用同一版本参数？（原则 3）
□ per-source sumAfter 与 aggregate after 使用同一版本参数？（原则 3）
□ headline 使用的参数是否不含 delta？（原则 2）
□ A + B 公式中 A 和 B 是否可能来自同一数据源？（原则 4）
□ after=null vs after=0 的语义在所有层级一致？（原则 5）
```

## 涉及文件

- `src/lib/rateSimulationCalculator.ts` — 核心计算
- `src/lib/incentiveAggregation.ts` — per-source sum 函数
- `src/lib/incentiveCaps.ts` — position cap 逻辑
- `src/lib/netLendingCrossReserve.ts` — cross-reserve eligibility
- `src/lib/portfolioSimulator.ts` — portfolio simulation 入口
- `src/lib/meritForecast.ts` — Merit forecast
- `src/lib/merklForecast.ts` — Merkl forecast
- `src/lib/brevisForecast.ts` — Brevis forecast（如有）
