# 开发方案：AAV-173 SimulationSubRow 链接数据冗余与死代码清理

## 1. Issue 概述
`SimulationSubRow.tsx` 中存在死数据（`row.href` 设置但未渲染）和重复链接数据（链接已在 `IncentiveTooltip` 中渲染），且链接筛选逻辑多处重复。需清理冗余代码，统一链接筛选逻辑，提升代码维护性和用户体验。

## 2. 当前状态
- **死数据**：`row.href` 字段生成但未渲染，跳转功能缺失。
- **重复链接**：`IncentiveTooltip` 已正确渲染激励链接，`SimulationSubRow` 中的链接数据冗余。
- **重复逻辑**：`getFirstMeritLink`、`getFirstMerklLink` 等函数在多个文件重复实现。
- **状态**：未开始。

## 3. 影响范围
- 前端仓库：`aaveapy`，`lovable` 分支
- 主要涉及文件：
  - `src/components/dashboard/SimulationSubRow.tsx`
  - `src/lib/simulationIncentiveTableRows.ts`
  - `src/components/dashboard/IncentiveTooltip.tsx`
  - 新增/修改公共库文件：`src/lib/merit.ts`、`src/lib/merkl.ts`

## 4. 实现方案

### 总体方案选择
建议采用 **方案 A（删除死代码）**，理由：
- `IncentiveTooltip` 已完整且正确渲染激励链接，用户体验无缺失。
- 删除冗余代码降低维护成本，避免重复逻辑带来的潜在错误。
- 方案 B 需恢复跳转渲染，增加复杂度且存在功能重复。

### 具体步骤

#### 4.1 链接筛选逻辑提取（必须做）
- **目标**：将 `getFirstMeritLink` 和 `getFirstMerklLink` 从 `SimulationSubRow.tsx` 中提取，统一放入公共库。
- **操作**：
  - 在 `src/lib/merit.ts` 新增/完善 `getFirstActiveMeritLink()`，实现与原 `getFirstMeritLink` 同等功能。
  - 在 `src/lib/merkl.ts` 新增/完善 `getFirstActiveMerklLink()`，实现与原 `getFirstMerklLink` 同等功能。
  - 修改 `SimulationSubRow.tsx` 和 `IncentiveTooltip.tsx`，调用公共库函数替代内联实现。
- **注意**：`getFirstBrevisLink` 已调用 `lib/brevis.ts`，保持不变。

#### 4.2 删除死代码和冗余链接数据
- **文件修改**：
  - `src/lib/simulationIncentiveTableRows.ts`
    - 删除所有关于 `href` 字段的生成逻辑。
  - `src/components/dashboard/SimulationSubRow.tsx`
    - 删除 `getFirstMeritLink`、`getFirstMerklLink` 内联函数。
    - 删除所有对 `row.href` 的赋值。
    - 确认 `renderRow()` 中不再使用 `row.href`。
- **效果**：
  - 彻底移除无用链接数据链。
  - 保持现有激励链接跳转功能由 `IncentiveTooltip` 负责。

#### 4.3 代码清理与注释更新
- 清理相关注释，标明链接筛选逻辑已统一至公共库。
- 确保代码风格一致，符合项目规范。

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议同步关注：
  - AAV-144（V3/V4 incentive matching），可能影响激励数据结构。
  - 代码重构相关 Issue（如 AAV-113 src/lib refactor），避免冲突。

## 6. 验收标准
- `SimulationSubRow.tsx` 不再生成或使用 `row.href` 字段。
- `simulationIncentiveTableRows.ts` 不再生成 `href` 字段。
- `getFirstMeritLink` 和 `getFirstMerklLink` 函数移至公共库，且 `SimulationSubRow` 和 `IncentiveTooltip` 均调用公共库函数。
- 页面中激励链接跳转功能正常，且仅由 `IncentiveTooltip` 负责渲染。
- 代码无冗余死链数据，相关代码行数减少。
- 通过现有单元测试和集成测试，无功能回归。
- 代码审查确认无重复逻辑。

## 7. 复杂度评估
- **复杂度**：Medium
- **理由**：
  - 需要跨多个文件修改，涉及公共库函数提取和调用调整。
  - 需保证功能不丢失且无回归。
  - 代码清理需谨慎，避免误删有效代码。

---

# 附录

## 相关文件路径
- `src/components/dashboard/SimulationSubRow.tsx`
- `src/lib/simulationIncentiveTableRows.ts`
- `src/components/dashboard/IncentiveTooltip.tsx`
- `src/lib/merit.ts`
- `src/lib/merkl.ts`

## 参考 Commit
- `cac7eef` (Merge dev into main #112, 2026-04-01) - 可能引入死代码，需重点关注。

---

# 备注
若后续业务需求需要恢复 `SimulationSubRow` 中行内跳转功能，可基于方案 B 进行扩展，但当前优先清理冗余，提升代码质量。