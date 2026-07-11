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

### 新发现的潜在问题

| # | 类型 | 严重度 | 描述 |
|---|------|--------|------|
| 1 | 原则 2 | 低 | Brevis `sumCurrent` 不应用 wallet position cap dilution。如果 wallet > positionCap，current 应被稀释但未稀释。Merit 的 `sumCurrent` 有 dilution，Brevis 没有。 |
| 2 | 原则 2 | 低 | Merit `buildDetails` 中 per-campaign `current` 使用 `ctx.eligibilityRatio`（simulated），应使用 wallet ratio。仅影响 tooltip 中的 per-campaign 行，不影响 aggregate 值。 |
| 3 | 原则 2 | 低 | Merkl `buildDetails` 中 per-campaign `current` 使用 `ctx.merklGroupMul`（simulated），应使用 wallet multiplier。仅影响 tooltip 中的 per-campaign 行，不影响 aggregate 值。 |

### 对潜在问题的评估

**问题 1（Brevis current 无 dilution）**：
- Brevis 只有 MetaMask Card campaign，positionCapUsd = $5000
- 用户钱包仓位 > $5000 的场景较少
- Brevis position cap 语义可能不同于 Merit（pool budget vs per-user cap）
- 建议：暂不修复，记为已知技术债，待 Brevis campaign 增多时评估

**问题 2+3（per-campaign detail current 使用 simulated ratio）**：
- 仅影响 IncentiveTooltip 中展开的 per-campaign 行
- aggregate `sources.merkl.current` / `sources.merit.current` 已正确使用 wallet ratio
- 修复需要给 `buildMerklCampaignDetails` / `buildMeritCampaignDetails` 增加钱包版本参数，改动较大
- 建议：暂不修复，记为已知技术债，优先级低

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
