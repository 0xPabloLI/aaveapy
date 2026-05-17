# 开发方案：AAV-172 Audit and clean up unused data layer fields (SimulationTableRow.href, spokeName, etc.)

---

## 1. Issue 概述

对代码中定义但未被UI消费的多个数据层字段进行审计和清理，重点包括：

- SimulationTableRow.href 字段虽然有赋值但未渲染，导致模拟表格行不可点击，属于回归问题，需要恢复点击跳转功能。
- V4 Hub/Spoke架构中的 spokeName 和 spokeAddress 字段未被使用，需确认是否保留或移除，或新增UI支持。

---

## 2. 当前状态

- SimulationTableRow.href 字段赋值和传递已实现，但渲染逻辑中被遗漏，导致功能回退（回归）。
- spokeName 和 spokeAddress 字段仅存在类型定义中，未被任何代码引用或渲染。
- 该 Issue 处于 Backlog，尚未开始开发。

---

## 3. 影响范围

- 前端仓库：`aaveapy`（lovable 分支）
- 主要涉及文件：
  - `src/lib/simulationIncentiveTableRows.ts`
  - `src/components/dashboard/SimulationSubRow.tsx`
  - `src/types/aave.ts`
  - 可能新增或修改展示 spoke 信息的组件文件（待决策）

---

## 4. 实现方案

### 4.1 修复 SimulationTableRow.href 的点击跳转功能（高优先级）

#### 4.1.1 目标

恢复 SimulationSubRow 中表格行的超链接渲染，使用户可点击跳转到对应的 Aave/Merit/Merkl/Brevis URL。

#### 4.1.2 具体步骤

1. **审查 `SimulationSubRow.tsx` 中的 `renderRow()` 函数（line 459 附近）**
   - 找出原先渲染 `<a>` 标签的逻辑分支，确认被删除或注释的代码。
2. **修改 `renderRow()` 使其支持根据 `row.href` 字段渲染可点击的 `<a>` 标签**
   - 如果 `row.href` 存在，则将对应行或单元格包裹在 `<a href={row.href} target="_blank" rel="noopener noreferrer">` 中。
   - 保留外部链接图标（如之前实现的图标）。
3. **测试点击行为**
   - 确保点击行时打开正确的外部链接，且无页面跳转错误。
4. **代码清理**
   - 移除任何与旧渲染逻辑冲突的代码，保持代码简洁。

#### 4.1.3 相关文件

- `src/components/dashboard/SimulationSubRow.tsx`
- `src/lib/simulationIncentiveTableRows.ts`（确认 href 字段定义和传递）

---

### 4.2 处理 V4 Spoke 字段（中优先级）

#### 4.2.1 目标

明确 spokeName 和 spokeAddress 字段的处理方案：

- 方案A：确认为未来预留，保留字段但注释说明，暂不渲染。
- 方案B：确认无用，移除类型定义及后端接口中对应字段。
- 方案C：新增前端UI支持，展示 spoke 信息。

#### 4.2.2 具体步骤

1. **与产品/架构团队沟通确认 spoke 字段的未来规划**
   - 是否计划展示 spoke 信息？
   - 是否会在后端持续提供？
2. **根据确认结果执行对应方案**

- **方案A（保留）**
  - 在 `src/types/aave.ts` 中对 spokeName 和 spokeAddress 添加注释说明。
  - 在文档中记录字段状态。
- **方案B（移除）**
  - 从 `src/types/aave.ts` 删除 spokeName 和 spokeAddress 字段。
  - 通知后端同步移除，避免接口不一致。
- **方案C（新增UI）**
  - 设计并实现展示 spoke 信息的组件（可参考 hubName/hubAddress 的展示方式）。
  - 修改 `DesktopReserveRow.tsx` 和 `MobileReserveCard.tsx`，添加 spoke 信息展示。
  - 处理对应的样式和响应式设计。

3. **代码审查和测试**
   - 确保无类型错误，UI显示正确。
   - 兼容无 spoke 信息的市场。

#### 4.2.3 相关文件

- `src/types/aave.ts`
- 可能新增或修改：
  - `src/components/dashboard/DesktopReserveRow.tsx`
  - `src/components/dashboard/MobileReserveCard.tsx`

---

## 5. 依赖关系

- 需确认 V4 Hub/Spoke 架构的产品规划（与 AAV-189 V4 Hub 数据展示相关）
- 无其他直接依赖

---

## 6. 验收标准

### 6.1 SimulationTableRow.href 修复

- 模拟表格中所有带 href 的行均可点击，点击后打开对应外部链接（新标签页）
- UI 显示外部链接图标
- 无控制台错误或警告

### 6.2 Spoke 字段处理

- 根据最终方案，类型定义中 spoke 字段状态明确（保留/移除/展示）
- 若展示，UI 正确显示 spokeName 和 spokeAddress 信息
- 无影响现有 hubName/hubAddress 功能

---

## 7. 复杂度评估

- SimulationTableRow.href 修复：**Medium**
  - 需要理解旧逻辑，恢复渲染分支，涉及 UI 交互，风险中等。
- Spoke 字段处理：**Low 到 Medium**
  - 若仅注释或移除，复杂度低。
  - 若新增 UI 展示，涉及设计和多组件修改，复杂度中等。

---

# 附录

- 相关 Commit：`cac7eef`（导致 href 渲染丢失）
- 相关文档：无，建议补充字段说明文档
- 相关 Issue：AAV-189（V4 Hub 数据展示）可能影响 spoke 字段处理决策

---

# 总结

本方案旨在清理技术债务，恢复用户体验（href 点击），并明确 V4 spoke 字段的未来处理路径，提升代码质量和产品一致性。建议优先修复 href 回归问题，随后根据产品规划处理 spoke 字段。