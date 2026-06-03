# 开发方案：AAV-143 在 market filter 里面，您觉得有必要加一个 "search markets" 吗？

## 1. Issue 概述
为市场筛选（market filter）功能增加一个“搜索市场（search markets）”的输入框，方便用户快速定位和筛选感兴趣的市场。

## 2. 当前状态
已部分实现。  
根据代码分析，FilterBar 组件中已有 searchQuery 相关的输入框和搜索逻辑，支持对市场进行搜索过滤。

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支  
- 主要涉及组件：`src/components/dashboard/FilterBar/` 及相关 hooks

## 4. 实现方案

### 4.1 需求确认
- 确认现有 FilterBar 的搜索输入框是否满足需求（搜索范围、交互体验）
- 如果已有搜索框，确认是否需要增强（如搜索字段扩展、性能优化、UI调整）

### 4.2 代码修改

#### 4.2.1 组件层面
- 文件：`src/components/dashboard/FilterBar/FilterBar.tsx`
  - 确认并完善搜索输入框 UI，确保用户体验友好（placeholder、清空按钮等）
  - 确认搜索输入框的输入事件绑定，触发搜索状态更新

#### 4.2.2 状态管理与过滤逻辑
- 文件：`src/hooks/reserves-table/useReservesTableFilter.ts`（或类似过滤相关 hook）
  - 确认搜索关键词如何影响市场列表过滤
  - 优化搜索逻辑，支持对市场名称、符号等字段的模糊匹配

#### 4.2.3 其他相关
- 文件：`src/components/dashboard/ReservesTable/` 相关文件，确保搜索过滤结果正确渲染

### 4.3 测试
- 编写单元测试覆盖搜索输入框和过滤逻辑（如有测试框架）
- 手动测试搜索功能，验证搜索准确性和性能

## 5. 依赖关系
- 无明显依赖其他未完成 Issue，基于现有 FilterBar 和 ReservesTable 功能即可实现

## 6. 验收标准
- FilterBar 中有明显的“搜索市场”输入框
- 输入关键词后，市场列表实时过滤，显示匹配的市场
- 支持按市场名称、符号等字段搜索
- 搜索体验流畅，无明显性能问题
- 相关单元测试通过

## 7. 复杂度评估
- 复杂度：Low  
- 理由：核心功能已有基础实现，主要是完善和优化搜索输入框及过滤逻辑，涉及前端组件和状态管理，难度较低。

---

# 备注
该 Issue 已部分实现，建议先确认现有实现细节，再根据需求调整完善。