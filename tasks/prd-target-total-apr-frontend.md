# PRD: TARGET_TOTAL_APR 前端适配

## 需求背景

Merkl 有一种 "Target Total APR" 分发模式：Merkl 只支付 `targetAPR - nativeAPR` 的差额，不是全额。后端已完成全部适配——campaign type 识别（Level 3 fallback）、breakdown/forecast 字段路由、API 输出 `campaignType: "TARGET_TOTAL_APR"` + `budgetBoundMode` + 转换后的 `campaignApr`。

前端 `merklForecast.ts` 已有一个**部分实现**：`TARGET_TOTAL_APR` 被硬编码归入 `isFixAprCampaign`（行 58），但这忽略了 `budgetBoundMode` 维度。当前 3 个活跃 TARGET_TOTAL_APR campaign 全部是 `MAX_APR`，正在走错误的 FIX 路径。此外 `budgetBoundMode` 字段未在类型/Schema 中声明，`useRateSimulation.ts` 的 cap note 逻辑也不覆盖 `TARGET_TOTAL_APR`。

## 目标与价值

**目标：**
- `TARGET_TOTAL_APR` 根据 `budgetBoundMode` 动态归入 MAX 或 FIX forecast 路径
- `budgetBoundMode` 缺失时不做 forecast（`mergeForecastState` 返回 null）
- `budgetBoundMode` 字段在 TypeScript 类型和 Zod schema 中声明
- `useRateSimulation.ts` cap note 覆盖 `TARGET_TOTAL_APR`

**价值：**
- 修复 3 个活跃 campaign 的 forecast 模拟结果不准确问题
- 前端与后端 API 语义对齐，支持未来 FIX_APR 类型 campaign
- 用户在 simulation 中能看到正确的 cap note 提示

## 名词解释

- **TARGET_TOTAL_APR**：Merkl campaign type，Merkl 只补足 `targetAPR - nativeAPR` 差额
- **budgetBoundMode**：TARGET_TOTAL_APR 独有的正交维度，`MAX_APR`（dilutive）或 `FIX_APR`（early-end）
- **aprCap**：MAX/FIX 时为 Merkl 实付 APR 上限；TARGET_TOTAL_APR 时为总 APR 目标（targetAPR，含 native）
- **campaignApr**：所有类型统一为 Merkl 实付 APR（后端已转换）

## 适用范围

- 适用：`src/lib/merklForecast.ts`、`src/hooks/useRateSimulation.ts`、`src/types/aave.ts`、`src/lib/apiSchemas.ts`
- 适用：3 个活跃 TARGET_TOTAL_APR campaign（均为 MAX_APR）
- 适用：未来 FIX_APR 类型 campaign

## 非目标

- 不包含 ERC4626 子类型支持（需 vaultAPR 数据源，当前不可用）
- 不包含 `distributionMethod` / `rawDistributionMethod` 前端处理（后端已移除 Level 1，前端从未读取）
- 不修改 `campaignApr` 计算逻辑（后端已做 APR↔APY 转换 + nativeAPY 减法）
- 不修改后端代码

## 功能需求

- FR-1: `MerklCampaignBreakdown` 接口新增 `budgetBoundMode?: string` 字段
- FR-2: `apiSchemas.ts` 的 `MerklCampaignBreakdownSchema` 新增 `budgetBoundMode: z.string().optional()`
- FR-3: `MerklForecastState` 接口新增 `budgetBoundMode?: string` 字段
- FR-4: `merklForecast.ts` 移除 `isFixAprCampaign` 中 `TARGET_TOTAL_APR` 的硬编码，改为按 `budgetBoundMode` 路由：`MAX_APR` → `isMaxAprCampaign`，`FIX_APR` → `isFixAprCampaign`
- FR-5: `mergeForecastState` 透传 `budgetBoundMode`，当 `campaignType === 'TARGET_TOTAL_APR' && !budgetBoundMode` 时返回 `null`
- FR-6: `useRateSimulation.ts` cap note 逻辑覆盖 `TARGET_TOTAL_APR`：`budgetBoundMode=MAX_APR` 走 MAX cap note（`APR_CAPPED` regime），`budgetBoundMode=FIX_APR` 走 FIX cap note（`fixRewardableDays`）
- FR-7: 更新 `merklForecast.test.ts` 中 `TARGET_TOTAL_APR` 测试：替换单一 FIX 等价测试为 MAX_APR 走 MAX 路径、FIX_APR 走 FIX 路径、无 budgetBoundMode 返回 null 三个测试

## 关键流程/交互说明

**Forecast 路径路由流程：**

1. `mergeForecastState(breakdown, forecastStates, pointRateMap)` 被调用
2. 检查 `breakdown.campaignType === 'TARGET_TOTAL_APR' && !breakdown.budgetBoundMode` → 返回 `null`，不做 forecast
3. 构建 `MerklForecastState`，包含 `budgetBoundMode`
4. `forecastWithTVL(forecastState, tvl)` 中：
   - `TARGET_TOTAL_APR + MAX_APR` → `isMaxAprCampaign = true` → 走 MAX 路径（dilutive, `requiredDaily`, `APR_CAPPED` regime）
   - `TARGET_TOTAL_APR + FIX_APR` → `isFixAprCampaign = true` → 走 FIX 路径（early-end, `fixRewardableDays`）

**Cap note 路由流程：**

1. `useRateSimulation.ts` 构建 Merkl campaign detail rows
2. `mergeForecastState` 返回 merged state
3. 判断 `merklType` 和 `budgetBoundMode`：
   - `TARGET_TOTAL_APR + MAX_APR` + `regime === 'APR_CAPPED'` → `buildMerklAprCeilingEffect()`
   - `TARGET_TOTAL_APR + FIX_APR` + `fixRewardableDays` 存在 → `buildMerklFixPoolBudgetEffect()`

**aprCap 语义：**

- `aprCap` 在 `mergeForecastState` 中通过 `merklAprCapPercentToForecastDecimal(breakdown.aprCap)` 转为 decimal
- TARGET_TOTAL_APR 的 `aprCap = targetAPR × 100`（API percent points），代表总 APR 目标
- 在 forecast 计算中 `aprBasedDaily = tvl × aprCap / 365`，对于 MAX_APR 模式始终大于 `requiredDaily`（incentive 口径），不构成实际约束；仅在极端低 TVL 边界可能触发，但实际场景不出现

## 风险与依赖

**风险：**
- `budgetBoundMode` 缺失时返回 null 可能导致用户看不到 forecast 模拟——但这是正确行为，因为路径不可确定
- 当前代码 `merklForecast.ts:58` 已有硬编码实现，移除后需确保无其他代码依赖 `TARGET_TOTAL_APR` 归入 FIX 路径

**依赖：**
- 后端 API 已输出 `budgetBoundMode` 字段（已确认）
- 后端 API 已对 `campaignApr` 做 APR↔APY 转换 + nativeAPY 减法（已确认）
- 后端对 `MAX_APR` 输出 `plannedDaily` + `requiredDaily`，对 `FIX_APR` 省略 `plannedDaily`、不输出 `requiredDaily`（已确认）

## 验收标准

- [ ] `MerklCampaignBreakdown` 和 `MerklForecastState` 包含 `budgetBoundMode?: string` 字段
- [ ] Zod schema 包含 `budgetBoundMode: z.string().optional()`
- [ ] `merklForecast.ts` 中 `TARGET_TOTAL_APR` 不再硬编码到 `isFixAprCampaign`
- [ ] `TARGET_TOTAL_APR + MAX_APR` 走 MAX 路径（`APR_CAPPED`/`CATCHING_UP`/`PLANNED`）
- [ ] `TARGET_TOTAL_APR + FIX_APR` 走 FIX 路径（`PLANNED` + `fixRewardableDays`）
- [ ] `TARGET_TOTAL_APR` 无 `budgetBoundMode` 时 `mergeForecastState` 返回 null
- [ ] `useRateSimulation.ts` cap note 覆盖 `TARGET_TOTAL_APR`（MAX_APR → APR ceiling，FIX_APR → fix budget）
- [ ] `merklForecast.test.ts` 包含三个新测试（MAX_APR 路径、FIX_APR 路径、无 budgetBoundMode）
- [ ] `useRateSimulation.test.ts` 包含 TARGET_TOTAL_APR cap note 测试
- [ ] `npm run lint` 和 `npm run build` 通过

## 待确认问题

- 无（Grill session 已全部确认）
