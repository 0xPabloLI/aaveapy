# PRD: Incentive Source Upper-Layer Unification

## 需求背景

Incentive 系统有三种 source（Merit / Merkl / Brevis），上层消费端存在大量 per-source 分支代码（约 28 处 side→source accessor + 3 个独立 campaign detail builder + 3 个独立 link 提取函数）。新增 source 或修改通用逻辑时，coding agent 需要在 28+ 处重复位置逐一修改，极易遗漏。底层泛型基础设施（`sumActiveCampaignBreakdownValues`、`applyPositionCap`、`buildPositionCapEffect`）已统一，但上层消费端尚未跟进。

用户核心诉求：**减少代码阅读心智、保持 context 一致、让新 coding agent 改时只改一处**。

## 目标与价值

**目标：**
- 消除 28 处 side→source accessor 重复，统一为 `getIncentiveSources()` 函数
- 消除 campaign detail builder 中的共享骨架重复（`appendNetNote`、forecast availability check、row 收集逻辑），统一为骨架函数 + 可插拔 forecastFn
- 类型层统一：`BrevisCampaignBreakdown` 继承 `ForecastableBreakdown`，消除重复字段声明
- 命名统一：Merit 的 `selfPositionCapUsd` 在 forecast 调用签名中对齐 `positionCapUsd`（底层已共享 `applyPositionCap`，仅入口参数名不一致）

**价值：**
- 新增第 4 种 source 时，accessor 改 1 处而非 28 处
- builder 骨架修改（如 `SimulationCampaignDetail` 结构变更）改 1 处而非 3 处
- 类型声明减少重复，`ForecastableBreakdown` 成为 Merkl+Brevis 的共享基类
- 编码 agent 可通过统一入口快速理解数据流，无需在每个消费端逐行追踪 per-source 分支

## 名词解释

- **side→source accessor**：`const merit = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows` 模式，28 处重复
- **Campaign Detail Builder**：`buildMeritCampaignDetails` / `buildMerklCampaignDetails` / `buildBrevisCampaignDetails`，遍历 groups → 计算 current/after/delta → 返回 `SimulationCampaignDetail[]`
- **forecastFn**：可插拔的 forecast 策略函数，输入 breakdown + simulation params，输出 `ForecastResult { afterApr, capEffect }`
- **ForecastableBreakdown**：`MerklCampaignBreakdown` 的基类，含 `campaignType` / `aprCap` / `latestTvl` / `totalBudget` 等 forecast 相关字段

## 适用范围

- **适用文件**：`incentiveAggregation.ts`、`rateSimulationCalculator.ts`、`IncentiveTooltip.tsx`、`SimulationSubRow.tsx`、`recentlyEndedCampaigns.ts`、`brevis.ts`（类型）、`aave.ts`（类型）
- **适用模式**：所有使用 `ReserveWithSpread` + `side` 组合访问 incentive 数据的代码路径

## 非目标

- **不统一 forecast 计算逻辑**：`forecastMeritApr` / `forecastMerklApr` / Brevis 复用 Merkl 的计算模型差异是根本性的（TVL 稀释 vs campaign type 分流 vs positionCap + sharedCap），强行合并会制造 300+ 行巨型函数
- **不统一 link 提取函数**：调用方仅 `SimulationSubRow.tsx` 一处 6 行，收益/成本比不足以支撑。Brevis 的 active 判断逻辑（`hasActiveBrevisBreakdown`）与 Merit/Merkl 的 `isCampaignActive` 有实质性差异
- **不统一 forecast 入口**：`sumActiveCampaignBreakdownValues` 已提供正确的统一粒度，差异在 config 的 `mapValue` 中体现

## 功能需求

### FR-1: 统一 side→source accessor

FR-1.1: 在 `incentiveAggregation.ts` 新增 `IncentiveSources` 接口和 `getIncentiveSources(reserve, side)` 函数，返回 `{ protocol, merit, merkl, brevis }` 结构

FR-1.2: 将以下 28 处 `side === 'supply' ? reserve.xxxSupplys : reserve.xxxBorrows` 模式替换为 `const { merit, merkl, brevis, protocol } = getIncentiveSources(reserve, side)`：
- `incentiveAggregation.ts`：行 183-186, 215, 220, 232, 242（8 处）
- `rateSimulationCalculator.ts`：行 313-316, 937-940, 1419-1430, 1434-1467, 1469-1502, 1504-1569（约 8 处）
- `recentlyEndedCampaigns.ts`：行 43, 70, 97（3 处）
- `IncentiveTooltip.tsx`：行 428, 467, 514（3 处）
- `SimulationSubRow.tsx`：行 247-253（6 处，link 函数调用侧）

### FR-2: 类型层统一

FR-2.1: 将 `BrevisCampaignBreakdown`（`aave.ts:60-68`）改为继承 `ForecastableBreakdown`（`aave.ts:27-38`），消除与 `MerklCampaignBreakdown` 重复的 `campaignType` / `aprCap` / `latestTvl` / `totalBudget` 字段声明

FR-2.2: Brevis 特有字段（`positionCap`、`sharedCap` 相关）保留为 `BrevisCampaignBreakdown` 的扩展字段

FR-2.3: 验证 `architecture-guard.test.ts` 通过（import 依赖约束）

### FR-3: 辅助函数提取

FR-3.1: 将 `appendNetNote`（当前在 `rateSimulationCalculator.ts` 中 Merit 行 642-648 和 Merkl 行 747-753 各定义一次）提取为顶层共享函数，放在 `incentiveCaps.ts`

FR-3.2: 将 `isForecastRequiring` + `forecastUnavailable` 检查逻辑（当前在 Merkl 行 772 和 Brevis 行 856 各写一次）提取为 `checkForecastAvailability(breakdown, forecastStates): { isRequiring: boolean, isUnavailable: boolean }` 共享函数，放在 `campaignGroups.ts` 或 `merklForecast.ts`

FR-3.3: 将 campaign row 收集逻辑（`current`/`after`/`delta` 计算 + `collected.push(...)`）提取为 `buildCampaignRow(config): SimulationCampaignDetail` 工厂函数

### FR-4: Campaign Detail Builder 骨架统一

FR-4.1: 定义 `ForecastResult` 接口：
```ts
interface ForecastResult {
  afterApr: number | null;
  capEffect?: CapEffect;
}
```

FR-4.2: 定义 `ForecastStrategy` 类型（可插拔 forecast 函数签名）：
```ts
type ForecastStrategy = (breakdown: BaseCampaignBreakdown, params: ForecastParams) => ForecastResult;
```

FR-4.3: 实现 `buildCampaignDetails(groups, side, forecastStrategy, ...sharedParams): SimulationCampaignDetail[]` 骨架函数，统一：
- 遍历 groups → 遍历 breakdowns → 过滤 active → 调 forecastStrategy → 计算 current/after/delta → 生成 row
- 共享 `appendNetNote`、`checkForecastAvailability`、`buildCampaignRow`

FR-4.4: 将 `buildMeritCampaignDetails` / `buildMerklCampaignDetails` / `buildBrevisCampaignDetails` 重构为各自的 `ForecastStrategy` 实现 + 调用 `buildCampaignDetails`

FR-4.5: 保持 per-source 的 forecast 计算逻辑不变：
- Merit：`forecastMeritApr`（MERIT_BASE / MERIT_SELF_CAP 两种模式）
- Merkl：`forecastMerklApr` + `forecastWithTVL`（FIX / MAX / DUTCH / TARGET_TOTAL_APR 四种 campaignType）
- Brevis：复用 Merkl forecast + `applyPositionCapToForecastResult` + sharedCap

### FR-5: 命名统一

FR-5.1: Merit forecast 调用签名中 `selfPositionCapUsd` 参数名统一为 `positionCapUsd`（语义上 Merit self-cap 就是 Merit 特有的 position cap，底层已共享 `applyPositionCap`）

FR-5.2: 更新 `meritForecast.ts` 中 `ForecastMeritCampaignInput.selfPositionCapUsd` → `positionCapUsd`

FR-5.3: 更新 `MeritForecastPreview.selfPositionCapUsd` → `positionCapUsd`

FR-5.4: 更新所有调用方（`rateSimulationCalculator.ts` 中 Merit 相关路径）

FR-5.5: 更新 CONTEXT.md 中相关术语：保持"Eligible Deposit Cap (Merit Self Position Cap)"领域术语不变，但代码参数名统一为 `positionCapUsd`

## 关键流程/交互说明

### 重构执行顺序

1. **FR-1**（accessor 统一）— 纯提取重构，零逻辑变更，风险最低
2. **FR-5**（命名统一）— 纯重命名，零逻辑变更
3. **FR-2**（类型层统一）— 类型继承变更，需验证所有消费端兼容
4. **FR-3**（辅助函数提取）— 提取共享逻辑，需 TDD 验证
5. **FR-4**（builder 骨架统一）— 最复杂，需先完成 FR-1/2/3 降低 diff 大小

### 每步的验证流程

每完成一个 FR 后：
1. `npm run lint && npm test && npm run build && npx tsc --noEmit` 全部通过
2. 相关单测覆盖新函数
3. `architecture-guard.test.ts` 通过

## 风险与依赖

**风险：**
- FR-2 类型继承变更可能影响 Brevis 消费端的类型推断（`BrevisCampaignBreakdown` 从 `BaseCampaignBreakdown` 改为 `ForecastableBreakdown` 会新增 `plannedDaily`/`budgetBoundMode`/`pointsPerThousandUsd`/`whitelistOnly` 等字段）
- FR-4 builder 骨架统一是最复杂的改动，三个 builder 的差异需要通过 forecastStrategy 精确映射，不能遗漏 source-specific 逻辑
- 行号偏移：handoff 中部分行号与当前代码有 +2~+10 偏移，需以实际代码为准

**依赖：**
- 依赖 `sumActiveCampaignBreakdownValues` 已有的泛型基础设施
- 依赖 `incentiveMath.ts` / `incentiveCaps.ts` 已统一的数学层
- 依赖 `architecture-guard.test.ts` 的 import 约束

## 验收标准

- [ ] FR-1: `getIncentiveSources(reserve, side)` 函数存在，28 处 accessor 全部替换
- [ ] FR-2: `BrevisCampaignBreakdown` 继承 `ForecastableBreakdown`，无重复字段声明
- [ ] FR-3: `appendNetNote` / `checkForecastAvailability` / `buildCampaignRow` 为共享顶层函数
- [ ] FR-4: `buildCampaignDetails` 骨架函数存在，三个 per-source builder 调用它
- [ ] FR-5: `selfPositionCapUsd` 在 forecast 签名中统一为 `positionCapUsd`
- [ ] 全部 4 项验证通过：`npm run lint && npm test && npm run build && npx tsc --noEmit`
- [ ] `architecture-guard.test.ts` 通过
- [ ] 新增函数有 co-located 单测
- [ ] CONTEXT.md 和相关 ADR 已更新

## 待确认问题

- FR-2: `BrevisCampaignBreakdown` 继承 `ForecastableBreakdown` 后新增的字段（`plannedDaily`/`budgetBoundMode`/`pointsPerThousandUsd`/`whitelistOnly`）在 Brevis 上下文中是否语义正确？Brevis 不使用这些字段，但类型层面它们会变成可选字段
- FR-4: `ForecastResult` 接口是否需要 `afterDailyRewards` 等额外字段？当前 Merit 的 `MeritForecastPreview` 包含 `hypotheticalTvl`/`dailyRewards`/`estimateKind` 等，这些是否需要纳入统一接口
- FR-5: CONTEXT.md 中"Eligible Deposit Cap (Merit Self Position Cap)"领域术语是否需要随代码参数名统一而调整？建议保持领域术语不变，仅代码参数名统一
