# ADR-001: Rate Simulation Internal Phasing

## Status

Superseded by ADR-002

## Context

`rateSimulationCalculator.ts`（1772 行）的 `computeMarketMetrics` 将所有计算混在一个函数中：当前利率（A 类，不随模拟输入变）和预测利率（B 类，随模拟输入变）交织在一起。

问题：
1. **代码组织**：A/B 类字段混杂，职责不清
2. **性能**：纯浏览场景（无模拟输入）仍执行 rate model 计算
3. **消费侧**：几乎所有组件都用 `pickScenarioValue(current, after)` 模式，需要 A+B 同在一个对象

## Decision

**内部分阶段，外同接口**：

```ts
// Phase 1: 从 reserve/API 数据组装当前利率（A 类）
const ctx = buildCurrentRates(reserve, tokenPrice, reserveRateInput, ...);

// Phase 2: 基于用户输入执行 rate model 预测（B 类）
const prediction = calcPredictedRates(ctx, userInput, reserveRateInput, ...);

return { ...ctx, ...prediction }; // 同一个 RateSimulationComputedResult
```

- `buildCurrentRates` 返回 `RateSnapshotContext`（A 类字段 + Phase 2 需要的中间变量，平铺）
- `calcPredictedRates` 接收 `RateSnapshotContext`，返回 B 类字段
- 无输入时 `calcPredictedRates` 返回 `nullPrediction`（After/Delta 全 null）
- 外部 `RateSimulationComputedResult` 类型不变，零消费侧改动

## Consequences

### 正面
- 代码组织：两个命名函数，A/B 分类显式化
- 性能：纯浏览场景跳过 Phase 2（不调用 `simulateNativeRatesAfterActions`）
- 零消费侧改动
- 字段归属有据可查

### 负面
- `RateSnapshotContext` 包含中间变量，类型略胖（~10 字段）
- Phase 1 和 Phase 2 间有隐式数据依赖（`RateSnapshotContext` 接口约束）
- 回退成本高：字段归属、中间变量结构体、Phase 间数据流都已固化

## Alternatives Considered

### 拆两个接口（RateSnapshot + RatePrediction）
否决。消费侧从收 1 对象变 2 对象 + 缝合逻辑散布各处，过度设计。真正收益是跳过 B 类计算，不是拆接口。
