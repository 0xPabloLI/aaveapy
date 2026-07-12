# ADR-002: Rate Simulation A/B 类字段分类 — 轻量注释方案

## Status

Accepted

## Context

`rateSimulationCalculator.ts`（1772 行）的 `computeMarketMetrics` 混合计算两类语义不同的字段：

- **A 类（Current Snapshot）**：当前快照值，不随用户 simulation input 变化。有 fallback 到 API 原值。
- **B 类（Simulated Prediction）**：模拟预测值，随用户 simulation input 变化。无模拟时为 null。

两者在代码中交织但缺乏显式分类标记，导致新贡献者难以判断字段归属、难以验证 fallback 逻辑正确性。

ADR-001 提出的"内部分阶段，外同接口"方案已被废弃（性能收益被现有 `hasAnyInput` 短路覆盖，两阶段拆分复杂度不匹配）。

## Decision

**轻量注释方案**：不拆接口、不调整代码顺序、不改变运行时行为。仅在 `computeMarketMetrics` 及相关函数内部添加分段注释块，显式标记 A/B 类字段的语义边界。

注释格式：
```ts
// ─── A 类字段: Current Snapshot ───
// ... A 类字段计算 ...

// ─── B 类字段: Simulated Prediction ───
// ... B 类字段计算 ...
```

### 分类标准

**语义依赖**："用户改了 simulation input，这个值会变吗？"

非实现依赖——`availableBorrowRoomUsd` 实现上依赖 B 类中间变量，但语义上不随用户输入变化 → 归入 A 类。

### A 类字段清单（Current Snapshot）

`totalBorrowedUsd`, `availableLiquidityUsd`, `utilization.current`, `optimalUtilization`, `supplyCapUsd`, `borrowCapUsd`, `protocolFee`, `tokenPrice`, `atSupplyCap`/`nearSupplyCap`/`atBorrowCap`/`nearBorrowCap`, `availableSupplyRoomUsd`, `availableBorrowRoomUsd`, `supply.current*`, `borrow.current*`, `spread.current`

### B 类字段清单（Simulated Prediction）

所有 `*After`/`*Delta`, `supply.after*`/`supply.delta*`, `borrow.after*`/`borrow.delta*`, `spread.after`/`spread.delta`, `utilization.after`/`utilization.delta`, `borrowLimitedByLiquidity`, `scenarioUsdAccrual`

### fallback 行为

- A 类：有模拟用模拟，无模拟 fallback 到 API 原值 → "当前值永远显示"
- B 类：无模拟 = null，无 fallback → "没模拟就没模拟值"

### nullPrediction 实现

保持现有 `?.` nullish coalescing，不引入额外常量。

## Consequences

### 正面
- 零风险：不改变任何运行时行为
- A/B 分类显式化，降低新贡献者理解成本
- fallback 行为差异在代码中有注释说明
- 与 ADR-001 完全兼容（ADR-001 的 Phase 1/2 概念映射到 A/B 类）

### 负面
- 注释可能随代码演进而过时（需人工维护）
- 不提供类型级保障（不像拆接口那样编译器强制分类）

## Supersedes

ADR-001 — 废弃原因：原方案的性能收益已被现有 `hasAnyInput` 短路实现覆盖；`effectiveSupplyInputUsd`/`borrowInputUsd`/`availableLiquidityForBorrowUsd` 横跨两阶段，拆分复杂度不匹配收益。

## Alternatives Considered

### 拆两个接口（RateSnapshot + RatePrediction）
否决。消费侧改动散布各处，过度设计。收益是跳过 B 类计算，但 `hasAnyInput` 短路已覆盖。

### 类型别名（CurrentSnapshotFields = Pick<MarketMetrics, ...>）
否决。增加间接层但无编译器强制分类收益，纯形式化。

### 架构守卫测试穷举检查
否决。字段归属是语义分类，非结构不变量。穷举测试维护成本高于收益。
