# AAV-113 开发方案：src/lib 精简建议 - 边界纯化 + 机会式重构

---

## 1. Issue 概述

当前 `src/lib` 目录代码量大且职责混杂，尤其是 `formatters.ts` 文件承担了过多业务逻辑和基础格式化混杂的功能，forecast 相关业务逻辑散落，导致维护困难。需通过机会式重构，逐步将业务逻辑从通用工具中剥离，保持 `lib` 目录职责纯粹，提升代码可维护性和清晰度。

---

## 2. 当前状态

- **已实现/部分实现**：无，当前仅有设计分析和方案建议，尚未动手改造。
- `formatters.ts` 仍混杂格式化、业务计算、UI逻辑。
- forecast 相关文件未拆分。
- 业务逻辑与基础 util 未分层。

---

## 3. 影响范围

- **仓库**：前端仓库 `aaveapy`，`lovable` 分支。
- 主要涉及 `src/lib/` 目录及相关引用文件。
- 可能影响调用这些 util 的业务组件和 hooks。

---

## 4. 实现方案

### 总体原则

- 采用机会式重构策略，不做一次性大规模重构。
- 每次改动聚焦 1-2 个热点文件，逐步收敛职责。
- 保证改动兼容，避免破坏现有功能。
- 统一命名和目录结构，明确区分基础 util 和业务 util。

---

### 具体步骤

#### 4.1 `formatters.ts` 职责收缩（优先级最高）

- **目标**：让 `formatters.ts` 只保留基础格式化相关函数。

- **拆分方案**：

  - 保留（迁移后仍在 `formatters.ts`）：

    - 基础数字格式化函数，如 `formatPercent`, `formatUsd`, `formatSpread`, `formatRelativeTime`, `formatReserveSizeUsd`, `formatReserveSizeToken`, `formatSignedUsd` 等。

  - 迁出：

    - APR/APY 数学转换相关函数（如 `convertAprToApy`, `apyToApr`, `annualPercentToDailyFraction`）迁移到新文件 `rateMath.ts` 或合并入已有的 `interestRateCalculator.ts`。

    - Incentive 聚合计算函数（如 `calculateTotalIncentiveApr`, `calculateTotalIncentiveApy`, `sumMeritIncentives`, `sumMerk`）迁移到新目录 `domain/incentives/incentiveTotals.ts`。

    - Merkl whitelist 业务逻辑迁移到 `domain/merkl/` 或相应业务目录。

    - Tooltip 可见性判断等 UI 相关逻辑迁移到 `components` 或 `hooks` 层。

- **文件修改**：

  - 新建或修改：

    - `src/lib/rateMath.ts`（或合并至 `interestRateCalculator.ts`）

    - `src/domain/incentives/incentiveTotals.ts`

    - `src/domain/merkl/` 相关文件

  - 修改 `formatters.ts`，删除迁出代码，调整导出。

- **数据流变更**：

  - 调用方改为从新拆分的模块导入对应函数。

  - 保持函数签名不变，避免破坏调用。

---

#### 4.2 forecast 相关文件分层整理

- **目标**：将 `meritForecast.ts`、`merklForecast.ts`、`brevisForecast.ts` 等 forecast 业务逻辑归入业务域目录。

- **方案**：

  - 新建目录 `src/domain/forecast/`

  - 将上述文件迁移至该目录，保持文件名不变。

  - 逐步拆分 forecast 逻辑中与业务强耦合的部分，抽象公共工具放入 `src/lib/forecastUtils.ts`（如有必要）。

- **文件修改**：

  - 移动文件，调整导入路径。

- **数据流变更**：

  - 业务组件和 hooks 调用路径更新。

---

#### 4.3 业务型 util 与基础 util 分层

- **目标**：明确区分基础通用 util 和业务 util。

- **方案**：

  - 基础 util（格式化、缓存、icon 预加载、基础 schema helper）保留在 `src/lib/`

  - 业务 util（incentive 计算、forecast、merkl whitelist、业务判断等）迁移到 `src/domain/` 下对应业务子目录。

- **文件修改**：

  - 新建 `src/domain/` 目录结构。

  - 迁移相关文件。

- **数据流变更**：

  - 更新所有引用路径。

---

#### 4.4 代码规范与文档更新

- 在迁移过程中，确保所有导出函数均有完整 JSDoc 注释。

- 更新 README 或开发文档，说明 `src/lib` 与 `src/domain` 的职责划分。

- 在 PR 模板或代码评审中强调“机会式重构”原则，避免大规模改动。

---

## 5. 依赖关系

- 无直接依赖其他 Issue，但建议与以下 Issue 协调：

  - AAV-113 机会式重构需配合后续业务功能开发时同步整理。

  - AAV-91（APY 预测）等业务逻辑改动时，可顺带重构 forecast 相关代码。

---

## 6. 验收标准

- `formatters.ts` 文件行数明显减少（预期减少 50%-70% 代码量）。

- 业务逻辑相关函数均迁移至 `src/domain/` 下对应模块。

- 所有相关功能（格式化、incentive 计算、forecast）在本地和 CI 测试均通过。

- 代码调用路径清晰，导入路径无错误。

- 无功能回归，前端 UI 和数据展示正常。

- 代码审查通过，文档更新完毕。

---

## 7. 复杂度评估

- **复杂度**：Medium

- **理由**：

  - 涉及多文件拆分和导入路径调整，需保证调用兼容。

  - 业务逻辑迁移需理解业务含义，避免逻辑断裂。

  - 但改动范围可控，且无底层架构变更，风险较低。

---

# 总结

本方案基于“机会式重构”原则，优先收缩 `formatters.ts` 职责，逐步将业务逻辑迁移至 `src/domain/`，保持 `src/lib/` 目录纯粹为基础通用工具。通过分步实施，降低风险，提升代码质量和维护效率。后续业务开发中持续践行此策略，逐渐完善代码架构。