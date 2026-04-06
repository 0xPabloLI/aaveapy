# 前端冗余与精简审查总结（2026-04-06）

## 1. 目标与范围
- 目标：检查前端代码中的冗余与不合理实现，优先做低风险高收益的精简。
- 范围：
  - `src/components/dashboard/ReservesTable.tsx`
  - `src/components/dashboard/TopOpportunities.tsx`
  - `src/components/dashboard/MobileReserveCard.tsx`
  - `src/components/dashboard/DesktopReserveRow.tsx`
  - `src/lib/formatters.ts`

---

## 2. 要改什么（审查结论与优先级）

### 高优先级（建议立即做）
1. 抽取并统一 `getMarketDisplayName` 逻辑  
2. 合并 `ReservesTable` 中 `handleMobileIncentiveClick` / `handleIncentiveClick` 重复逻辑  
3. 抽取统一 incentive 计算 helper（避免 `ReservesTable` 与 `TopOpportunities` 双份维护）

### 中优先级（按窗口推进）
4. `TopOpportunities` 内部定义组件（`MiniReserveCard` / `ReserveItem`）上提到文件级，减少父组件重渲染时的组件重建
5. 色阶函数保留多函数形式，但可抽取共享阈值常量（避免阈值漂移）
6. `ReservesTable` 文件过大（> 2k 行）分模块拆分：移动排序区/桌面表格区/tooltip 状态逻辑

### 低优先级（可后置）
7. 移动端 sort dropdown 的 JSX 模式复用（抽轻量菜单组件或生成器函数）
8. `MobileReserveCard` 中 sheet content 区块拆分到独立文件（偏代码组织优化，不是功能冗余）

---

## 3. 改了什么（已完成）

### 3.1 新增共享 helper：市场显示名
- 新增 `getReserveMarketDisplayName(...)`
- 文件：`src/lib/formatters.ts`
- 目的：统一 Ethereum 子市场显示名（Core/Prime 等）逻辑，消除多处重复判断

### 3.2 新增共享 helper：incentive 聚合计算
- 新增 `getReserveIncentiveValues(...)`
- 文件：`src/lib/formatters.ts`
- 目的：统一 `APR/APY` incentive 聚合逻辑，避免 `TopOpportunities` 与 `ReservesTable` 逻辑分叉

### 3.3 组件侧接入共享 helper
- `ReservesTable` 改为使用 `getReserveIncentiveValues`
- `TopOpportunities` 改为使用 `getReserveIncentiveValues`
- `TopOpportunities` / `MobileReserveCard` / `DesktopReserveRow` 改为使用 `getReserveMarketDisplayName`

### 3.4 删除重复点击处理函数
- `ReservesTable` 删除 `handleMobileIncentiveClick`，移动端和桌面统一复用 `handleIncentiveClick`

### 3.5 确认 `TopOpportunities` 子组件已上提
- `MiniReserveCard` 与 `ReserveItem` 已是文件级组件，不再定义在 `TopOpportunities` 函数体内部
- 说明：原审查文档中的“未完成项 A”在当前工作树里实际上已经完成，本轮只是补确认并更新记录

### 3.6 完成移动端排序菜单复用
- `ReservesTable` 新增轻量共享菜单渲染器 `MobileSortMenu`
- `Size / Supply / Borrow / Extra` 四组移动端排序菜单改为数据驱动的 `options` 配置
- 新增统一菜单开关逻辑，避免四处重复的 `setShow*SortMenu(...)` 关闭链

### 3.7 结果验证
- 已执行：`npm run lint`
- 结果：通过（`eslint .` 无错误）

### 3.8 当前改动文件（未提交）
- `src/lib/formatters.ts`
- `src/components/dashboard/ReservesTable.tsx`
- `src/components/dashboard/TopOpportunities.tsx`
- `src/components/dashboard/MobileReserveCard.tsx`
- `src/components/dashboard/DesktopReserveRow.tsx`
- `src/components/dashboard/ReservesTableDesktopHeader.tsx`
- `src/components/dashboard/ReservesTableMobileSortBar.tsx`

### 3.9 完成 `TopOpportunities` 内部 helper / `CategoryCard` 外提
- `TopOpportunities` 中剩余的色阶 / accent helper 已移到文件级纯函数
- `CategoryCard` 已移到文件级组件，不再在 `TopOpportunities` 渲染时重建
- 本轮仍未改动排序、tooltip 语义、动画参数和卡片布局

### 3.10 本轮验证
- 已执行：`npm run lint`
- 已执行：`npm run build`
- 已执行：`npx vitest run src/lib/topOpportunitiesMemo.test.ts`
- 已执行：`localhost:8080` 页面加载检查
- 结果：通过；`localhost:8080` 控制台 error 为 staging API 的 CORS 噪音，不是本轮 `TopOpportunities` 抽离导致的运行时异常

---

## 4. 什么还没改（待办）

### 未完成项 A：文件体积继续瘦身
- 现状：
  - `ReservesTable.tsx`: 2111 行
  - `ReservesTableMobileSortBar.tsx`: 186 行
  - `TopOpportunities.tsx`: 1106 行
  - `MobileReserveCard.tsx`: 825 行
- 说明：`ReservesTable` 已因菜单去重小幅瘦身；`TopOpportunities` 因文件级组件上提后显式 props 变多，行数暂时上升，但组件重建问题已消除。
- 补充：移动端排序条已进一步抽到独立组件 `ReservesTableMobileSortBar.tsx`，`ReservesTable` 的移动端分支已明显变短；这一步属于纯展示层拆分，排序状态仍保留在父组件。
- 补充：桌面端 `ReservesTableDesktopHeader.tsx` 的三组 sort menu portal/render 逻辑也已收敛成共享渲染器；当前改动仍未触碰排序算法、sticky 计算和 expanded-row pin 逻辑。
- 补充：`TopOpportunities` 现在只剩体量问题，内部 helper 与 `CategoryCard` 的重建已消除；后续若继续拆，重点应转向视觉配置常量或按卡片类型拆文件，而不是再碰现有交互。
- 建议：按“状态逻辑/视图逻辑/菜单逻辑”三段拆分，分批执行，避免一次性大重构风险。

---

## 5. 风险与注意事项
- 本次改造只做了逻辑抽取和复用，不改业务语义，风险较低。
- 后续上提 `TopOpportunities` 子组件时，需要重点验证：
  - 动画行为（`motion` + `AnimatePresence`）是否与当前一致
  - `onIncentiveClick` 的事件冒泡控制与 tooltip 定位是否一致
  - 移动端/桌面端差异分支是否保持原行为

---

## 6. 下一步建议（执行顺序）
1. 先完成 `TopOpportunities` 子组件上提（中等改动、收益明显）  
2. 再做 `ReservesTable` 移动排序菜单轻量复用（控制在一个 PR）  
3. 最后按模块拆分 `ReservesTable`（较大改动，单独 PR）  

### 6.1 更新后的下一步
1. 保留当前这批低风险精简，完成 lint / build / 桌面交互 e2e 验证  
2. 下一批单独处理 `ReservesTable` 模块拆分（状态逻辑 / 桌面 table body / tooltip 状态协调）  
3. 若继续推进，可顺手评估 `MobileReserveCard` 的 sheet/详情块是否值得拆子模块  
