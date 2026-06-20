# PRD: Merit Forecast 按 Distribution Type 重构

## 需求背景

Incentive 系统的 campaign type 已统一为四种（`FIX`/`MAX`/`DUTCH`/`TARGET_TOTAL_APR`），campaign 的字段应该跟 distribution type 走，不是跟 source 走。但 Merit 的 forecast 仍然使用 `MERIT_BASE`/`MERIT_SELF_CAP` 二分法——这个分支条件是 `positionCap` 是否存在，而不是 `campaignType`。

Merit 底层也是 `DUTCH_AUCTION`（variable reward rate），`positionCap` 只是所有 distribution type 的 optional 叠加层。Brevis 已经按这个模式工作：`forecastMerklApr → applyPositionCapToForecastResult`（forecast 和 positionCap 分离）。Merit 应该对齐这个模式。

## 目标与价值

**目标：**
- 移除 `MeritForecastMode`（`MERIT_BASE`/`MERIT_SELF_CAP`），Merit forecast 始终返回 full diluted APR（等同于当前 `MERIT_BASE`）
- positionCap 统一由调用方通过 `applyPositionCapToForecastResult` 处理，与 Brevis 模式对齐
- 每种 distribution type 都可以 optional 地有 positionCap，positionCap 是正交叠加层

**价值：**
- Merit/Merkl/Brevis 三种 source 的 forecast 都遵循 `forecastByDistributionType → applyPositionCap` 两步模式
- 新增 distribution type 或 positionCap 变体时，只需修改一处（`applyPositionCapToForecastResult`）
- coding agent 不需要理解"Merit 有两种特殊模式"，只需要知道"positionCap 是所有 type 的可选叠加层"

## 适用范围

- `src/lib/meritForecast.ts` — 移除 `mode` 参数，合并两条路径
- `src/lib/rateSimulationCalculator.ts` — `buildMeritCampaignDetails` 和 `forecastMeritAprPercent` 中的 positionCap 处理
- `src/lib/meritForecast.test.ts` — 移除 mode 相关测试，新增 positionCap 叠加测试

## 非目标

- 不改变 `forecastMeritApr` 的 TVL 稀释计算逻辑
- 不改变最终 APR 计算结果（行为不变）
- 不统一三个 per-source builder 的骨架（AAV-972 已评估跳过）

## 功能需求

### FR-1: 移除 MeritForecastMode

FR-1.1: 删除 `MeritForecastMode` 类型（`'MERIT_BASE' | 'MERIT_SELF_CAP'`）和 `MeritForecastEstimateKind` 中对它的引用

FR-1.2: `forecastMeritApr` 移除 `mode` 参数，始终走当前 `MERIT_BASE` 的 TVL 稀释逻辑（使用 `anchorTvlUsd` 或 `lastRoundRewardUsd` 推算 implied TVL，加 depositUsd 稀释）

FR-1.3: `forecastMeritApr` 内部移除 `positionCapUsd` 参数和 `eligibleUsd` 计算。返回的 `MeritForecastPreview` 中不再有 `positionCapUsd`/`eligibleUsd` 字段

FR-1.4: `MeritForecastPreview` 移除 `positionCapUsd`/`eligibleUsd` 字段

### FR-2: positionCap 由调用方处理

FR-2.1: `forecastMeritAprPercent` 中移除内部的 `applyPositionCap` 调用。改为：对有 positionCap 的 breakdown，先调用 `forecastMeritApr`（无 mode）得到 after APR，再调 `applyPositionCap` clip

FR-2.2: `buildMeritCampaignDetails` 中 `MERIT_SELF_CAP` 分支简化为：调用 `forecastMeritApr`（无 mode）→ `applyPositionCapToForecastResult`（已有此调用，只是现在是唯一 positionCap 入口）

FR-2.3: 当 `inputUsd <= 0`（无模拟输入）但有 positionCap 时，`forecastMeritAprPercent` 仍需用 `applyPositionCap` clip current APR（保持现有行为）

### FR-3: 保留 estimateKind 用于诊断

FR-3.1: `MeritForecastPreview.estimateKind` 保留，但值从 `MERIT_BASE`/`MERIT_SELF_CAP`/`MERIT_CURRENT_RATE` 改为 `TVL_DILUTION`/`CURRENT_RATE`（去掉 BASE/SELF_CAP 语义，只描述 forecast 方法）

## 风险与依赖

**风险：**
- `eligibleUsd` 字段从 `MeritForecastPreview` 移除，但已确认无外部消费者
- `dailyRewards` 语义从"cap 裁剪后的值"变为"full APR 对应的值"，但已确认无外部消费者
- 移除 `mode` 参数是 breaking change，但 `forecastMeritApr` 只在 `rateSimulationCalculator.ts` 内部调用

**依赖：**
- `applyPositionCapToForecastResult` 已存在于 `incentiveCaps.ts`
- 前次 PR 的 `positionCapUsd` 重命名已完成

## 验收标准

- [x] `MeritForecastMode` 类型已删除
- [x] `forecastMeritApr` 无 `mode` 参数，始终返回 full diluted APR
- [x] `MeritForecastPreview` 无 `positionCapUsd`/`eligibleUsd` 字段
- [x] positionCap 统一由 `applyPositionCapToForecastResult` / `applyPositionCap` 处理
- [x] 最终 APR 计算结果与修改前一致（行为不变）
- [x] `npm run lint && npm test && npm run build && npx tsc --noEmit` 全通过
- [x] 更新 CONTEXT.md 移除 `MERIT_BASE`/`MERIT_SELF_CAP` 术语

## 待确认问题

- `estimateKind` 是否需要保留？如果保留，`TVL_DILUTION`/`CURRENT_RATE` 命名是否合适？→ 已确认保留，命名已采用。
