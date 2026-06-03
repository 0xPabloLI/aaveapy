# 开发方案：AAV-124 增加sort by supply%，sort by borrow%

## 1. Issue 概述
为 ReservesTable 组件增加按 supplyCapPct（供应占比%）和 borrowCapPct（借贷占比%）字段排序的功能，提升用户对市场容量利用率的洞察能力。

## 2. 当前状态
已部分实现。  
- 代码中已有 supplyCapPct 和 borrowCapPct 的排序模式支持（sorters.ts、useReservesTableSort hook中存在相关逻辑）。  
- ReservesTable 组件和 FilterBar 搜索功能已支持多种排序，但尚未确认 UI 端是否暴露了这两个排序选项。

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支  
- 主要涉及目录：  
  - `src/components/dashboard/ReservesTable/`  
  - `src/hooks/reserves-table/useReservesTableSort.ts`  
  - `src/lib/sorters.ts`  

## 4. 实现方案

### 4.1 确认排序逻辑
- 检查 `src/lib/sorters.ts` 中是否已实现 supplyCapPct 和 borrowCapPct 的排序函数，确保逻辑正确（数值大小排序，支持升序/降序）。
- 检查 `src/hooks/reserves-table/useReservesTableSort.ts` 是否已注册这两个排序字段。

### 4.2 UI 层支持
- 在 `ReservesTable` 组件的表头中增加对应列（若尚未存在），显示“Supply %”和“Borrow %”列标题。
- 在排序交互中（点击表头或排序下拉菜单），增加对应的排序选项，确保用户可选择按 supplyCapPct 和 borrowCapPct 排序。
- 更新 `FilterBar` 或相关排序控制组件，加入这两个排序字段的选项。

### 4.3 数据字段确认
- 确认后端 API `/api/markets` 返回的数据中包含 `supplyCapPct` 和 `borrowCapPct` 字段，且数据格式正确。
- 前端数据类型定义（`src/types/aave.ts`）中包含这两个字段。

### 4.4 测试
- 编写单元测试覆盖排序逻辑，确保排序结果正确。
- 在开发环境手动验证排序功能，测试升序和降序切换。
- 验证 UI 显示无误，且排序交互流畅。

## 5. 依赖关系
- 无明显依赖其他未完成 Issue，基于现有数据和代码实现即可完成。

## 6. 验收标准
- ReservesTable 表格中新增“Supply %”和“Borrow %”列，显示对应数据。
- 用户可通过点击表头或排序控件，按这两个字段升序或降序排序。
- 排序结果正确，符合数值大小排序逻辑。
- 相关单元测试通过，且无 UI 显示异常。
- 代码符合项目编码规范，无明显性能问题。

## 7. 复杂度评估
Medium  
- 主要工作为前端 UI 增加排序选项和列展示，排序逻辑已有基础。  
- 需确认数据字段完整且类型正确。  
- 需保证交互体验良好，测试覆盖充分。

---

# 备注
该 Issue 已有部分实现，重点在于完善 UI 展示和交互，确保功能完整且用户体验良好。