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

### 3.8 这一轮涉及的主要文件
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

### 3.11 完成 `MobileReserveCard` 展示层块外提
- `MobileReserveCard` 中的 `renderAmountRow` 与 `renderHeroApy` 已上提为文件级展示组件
- 本轮只移动展示层结构，不改 `activeTab`、`capSheet`、`isSimulationExpanded`、`SimulationSubRow` 等交互状态路径
- 目的：继续缩小主组件函数体，降低每次阅读和后续拆分的复杂度

### 3.12 本轮验证补充
- 已执行：`npm run lint`
- 已执行：`npm run build`
- 已执行：`npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium`
- 已执行：`localhost:8080` 页面加载检查
- 结果：
  - `lint` / `build` 通过
  - `reserves-table-interactions`：`4 passed`
  - `localhost:8080` 无新的 runtime error；现有控制台 error 仍为 staging API 的 CORS 噪音

### 3.13 完成 `ReservesTable` 移动端网格块外提
- 新增 `src/components/dashboard/ReservesTableMobileGrid.tsx`
- 将 `ReservesTable` 中移动端 2x2 卡片网格、expanded shell 拼装、skeleton 布局从主组件中移出
- 父组件继续保留排序、scenario、tooltip、expanded state 和 pin-scroll 逻辑；本轮不触碰 desktop sticky header / expanded main row / sort 算法

### 3.14 本轮验证补充
- 已执行：`npm run lint`
- 已执行：`npm run build`
- 已执行：`npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium`
- 结果：
  - `lint` / `build` 通过
  - `reserves-table-interactions`：`4 passed`

### 3.15 按 commit 分批次回溯

| Commit | 批次主题 | 主要改动 | 验证 |
| --- | --- | --- | --- |
| `b53d355` | reserve redundancy helpers | 新增共享 helper：`getReserveMarketDisplayName(...)`、`getReserveIncentiveValues(...)`；`ReservesTable` / `TopOpportunities` / `MobileReserveCard` / `DesktopReserveRow` 接入共享逻辑；删除 `ReservesTable` 重复 incentive click 处理 | 提交时通过本地 hook 自动执行的 `npm run ci:remote` |
| `363d4a1` | mobile reserves sort bar | 抽出 `ReservesTableMobileSortBar.tsx`；将移动端 `Size / Supply / Borrow / Extra` 排序菜单改成配置驱动；统一菜单开关逻辑 | 提交时通过本地 hook 自动执行的 `npm run ci:remote` |
| `4fcee47` | desktop sort menu rendering | `ReservesTableDesktopHeader.tsx` 三组桌面 sort menu portal/render 逻辑去重，收敛到共享渲染器；不改排序算法、sticky 计算、expanded-row pin | `npm run lint`；`npm run build`；`src/components/dashboard/ReservesTableDesktopHeader.test.tsx`；`npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium`（`4 passed`）；提交时通过 `ci:remote` |
| `d8ded08` | top opportunities helpers | `TopOpportunities` 中色阶 / accent helper 提到文件级；`CategoryCard` 外提为文件级组件，避免随父组件重建 | `npm run lint`；`npm run build`；`npx vitest run src/lib/topOpportunitiesMemo.test.ts`；`localhost:8080` 页面加载检查；提交时通过 `ci:remote` |
| `2840be9` | mobile reserve display blocks | `MobileReserveCard` 中 `renderAmountRow` 与 `renderHeroApy` 上提为文件级展示组件；保留 `activeTab`、`capSheet`、`isSimulationExpanded`、`SimulationSubRow` 的原交互路径 | `npm run lint`；`npm run build`；`npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium`（`4 passed`）；`localhost:8080` 页面加载检查；提交时通过 `ci:remote` |
| `87d9343` | mobile reserves grid layout | 新增 `ReservesTableMobileGrid.tsx`；将移动端 2x2 卡片网格、expanded shell 拼装、skeleton 布局从 `ReservesTable` 主组件中移出；父组件保留排序、scenario、tooltip、expanded state 与 pin-scroll 逻辑 | `npm run lint`；`npm run build`；`npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium`（`4 passed`）；提交时通过 `ci:remote` |

### 3.16 回溯说明
- 上表只记录这轮“前端冗余与精简”主线程里的独立批次 commit，便于后续按批次回退或 bisect。
- 其中 `b53d355` 与 `363d4a1` 属于最早两批低风险公共逻辑/移动排序精简；后续批次开始逐步转向组件体积瘦身。
- `localhost:8080` 的页面检查结果需要结合当前本地 API/CORS 环境解读；若控制台仍出现 staging API 的 CORS 噪音，不应直接视为本轮重构回归。

### 3.17 Harness 补强（2026-04-07）
- 修复 `e2e/reserves-table-mobile-interactions.spec.ts` 中过期 selector：mobile 卡片 expand/collapse 按钮文案已切换为 `Expand details panel` / `Collapse details panel`
- mobile e2e 现已可在 `mobile-chromium` 项目下真实执行，不再因为旧 aria-label 导致全量假失败
- 新增 `src/components/dashboard/MobileReserveCard.test.tsx`
- 新组件测试当前固定两条 contract：
  - collapsed 状态渲染 `aria-label="Expand details panel"`
  - expanded 状态渲染 `aria-label="Collapse details panel"`

### 3.19 桌面骨架 / 分页 / 浮动按钮外提（2026-04-07）
- 新增 `src/components/dashboard/ReservesTableDesktopSkeleton.tsx`：将桌面端 10 行 skeleton loading rows 从 `ReservesTable` 主组件中移出；修复了原 `ReservesTable` 中 `Skeleton` 未 import 的隐患
- 新增 `src/components/dashboard/ReservesTablePagination.tsx`：将 Show More/Show Less 按钮和浮动 scroll-to-top/bottom 按钮合并为共享组件（`ReservesTableShowMore` + `ReservesTableFloatingScroll`），移动端和桌面端共用，通过 `variant` prop 区分样式差异
- `ReservesTable.tsx` 从 1592 行瘦身至 ~1497 行（-95 行）
- 不触碰：sticky scenario / sticky `thead` / expanded main row sticky `td` / scenario pin scroll / filter pin scroll
- 清除了 `ReservesTable.tsx` 中不再使用的 `memo`、`TableCell`、`TableRow`、`ArrowUp`、`ArrowDown`、`ChevronDown`、`ChevronUp` import

### 3.20 本轮验证
- 已执行：`npm run lint` — 通过
- 已执行：`npm run build` — 通过
- 已执行：`npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium` — `4 passed`
- 已执行：`npx vitest run src/components/dashboard/MobileReserveCard.test.tsx src/components/dashboard/TopOpportunities.test.tsx` — `4 passed`

### 3.22 tooltip 容器 / mobile sheet / color helpers 外提（2026-04-07）
- 新增 `src/components/dashboard/ReservesTableTooltipOverlay.tsx`（48 行）：将 `ReservesTable` 中移动端和桌面端重复的 `IncentiveTooltip` 渲染合并为共享组件；导出 `TooltipState` 类型
- 新增 `src/components/dashboard/MobileReserveSheetContent.tsx`（177 行）：将 `MobileReserveCard` 中四个 bottom sheet 内容组件（`SupplyCapSheetContent` / `BorrowCapSheetContent` / `UtilizationSheetContent` / `DeficitSheetContent`）移出
- 新增 `src/components/dashboard/topOpportunitiesColors.ts`（102 行）：将 `TopOpportunities` 中 7 个纯色阶/accent helper 函数移出
- 文件行数变化：
  - `ReservesTable.tsx`: 1497 → ~1458（-39 行）
  - `MobileReserveCard.tsx`: 926 → ~764（-162 行）
  - `TopOpportunities.tsx`: 1124 → ~1030（-94 行）
- 不触碰：sticky scenario / sticky `thead` / expanded main row sticky `td` / scenario pin scroll / filter pin scroll / simulation 展开状态链

### 3.23 本轮验证
- 已执行：`npm run lint` — 通过
- 已执行：`npm run build` — 通过
- 已执行：`npx vitest run src/components/dashboard/MobileReserveCard.test.tsx src/components/dashboard/TopOpportunities.test.tsx` — `4 passed`
- E2E（`reserves-table-interactions` / `reserves-table-mobile-interactions`）：因本地 API 服务 (localhost:3001) 未运行导致全量超时失败，不是本轮代码回归；之前同一代码通过 e2e 的前提是 API 在线

### 3.24 当前推荐 Harness 命令
- 组件级最小回归：
  - `npx vitest run src/components/dashboard/MobileReserveCard.test.tsx src/components/dashboard/TopOpportunities.test.tsx`
- reserves 桌面/移动主交互：
  - `npx playwright test e2e/reserves-table-mobile-interactions.spec.ts e2e/reserves-table-interactions.spec.ts`
- 单独跑移动端：
  - `npx playwright test e2e/reserves-table-mobile-interactions.spec.ts --project=mobile-chromium`
- 单独跑桌面端：
  - `npx playwright test e2e/reserves-table-interactions.spec.ts --project=chromium`

---

## 4. 什么还没改（待办）

### 未完成项 A：文件体积继续瘦身
- 现状：
  - `ReservesTable.tsx`: ~1458 行
  - `ReservesTableDesktopSkeleton.tsx`: 46 行
  - `ReservesTablePagination.tsx`: 93 行
  - `ReservesTableTooltipOverlay.tsx`: 48 行
  - `ReservesTableMobileGrid.tsx`: 189 行
  - `ReservesTableMobileSortBar.tsx`: 186 行
  - `TopOpportunities.tsx`: ~1030 行
  - `topOpportunitiesColors.ts`: 102 行
  - `MobileReserveCard.tsx`: ~764 行
  - `MobileReserveSheetContent.tsx`: 177 行
- 说明：`ReservesTable` 已因菜单去重小幅瘦身；`TopOpportunities` 因文件级组件上提后显式 props 变多，行数暂时上升，但组件重建问题已消除。
- 补充：移动端排序条已进一步抽到独立组件 `ReservesTableMobileSortBar.tsx`，`ReservesTable` 的移动端分支已明显变短；这一步属于纯展示层拆分，排序状态仍保留在父组件。
- 补充：桌面端 `ReservesTableDesktopHeader.tsx` 的三组 sort menu portal/render 逻辑也已收敛成共享渲染器；当前改动仍未触碰排序算法、sticky 计算和 expanded-row pin 逻辑。
- 补充：`TopOpportunities` 现在只剩体量问题，内部 helper 与 `CategoryCard` 的重建已消除；后续若继续拆，重点应转向视觉配置常量或按卡片类型拆文件，而不是再碰现有交互。
- 补充：`MobileReserveCard` 已先完成两块最独立的展示层抽离；后续若再拆，建议优先考虑 token header / mobile sheet 容器等纯视图块，继续避免碰 simulation 展开链路。
- 补充：`ReservesTable` 的移动端网格编排已经独立成组件；主文件后续若继续瘦身，应优先看桌面骨架、show-more 区块或 tooltip 容器，而不是回头重拆移动卡片拼装。
- 建议：按“状态逻辑/视图逻辑/菜单逻辑”三段拆分，分批执行，避免一次性大重构风险。

---

## 5. 风险与注意事项
- 本次改造只做了逻辑抽取和复用，不改业务语义，风险较低。
- 当前最值得信的 UI 护栏是 reserves harness，而不是 `localhost:8080` 的裸页面检查；后者仍可能被 staging API 的 CORS 噪音干扰。
- 后续上提 `TopOpportunities` 子组件时，需要重点验证：
  - 动画行为（`motion` + `AnimatePresence`）是否与当前一致
  - `onIncentiveClick` 的事件冒泡控制与 tooltip 定位是否一致
  - 移动端/桌面端差异分支是否保持原行为
- 后续若继续拆 `ReservesTable`，优先保持以下 harness 为绿：
  - `e2e/reserves-table-interactions.spec.ts`
  - `e2e/reserves-table-mobile-interactions.spec.ts`
  - `src/components/dashboard/MobileReserveCard.test.tsx`

---

## 6. 下一步建议（执行顺序）
1. 先完成 `TopOpportunities` 子组件上提（中等改动、收益明显）  
2. 再做 `ReservesTable` 移动排序菜单轻量复用（控制在一个 PR）  
3. 最后按模块拆分 `ReservesTable`（较大改动，单独 PR）  

### 6.1 更新后的下一步
1. 保留当前这批低风险精简，完成 lint / build / 桌面交互 e2e 验证  
2. 下一批单独处理 `ReservesTable` 桌面骨架拆分（desktop body / desktop shell / tooltip 容器三选一，继续避开 sticky 计算）  
3. `MobileReserveCard` 若继续推进，优先拆 token header 或 bottom sheet 容器，暂不触碰 simulation 展开/折叠状态链  

### 6.2 新 Session 接手建议
1. 先读本文件第 3.15–3.18 节，确认最近批次、当前 harness、推荐命令
2. 新 session 第一轮不要继续拆移动端；移动端网格和卡片的低风险块已经拆到位
3. 若继续精简，优先从 `ReservesTable` 桌面骨架下手，候选顺序：
   - desktop body/skeleton 区
   - desktop tooltip 容器区
   - desktop show-more / floating scroll button 区
4. 明确禁止本轮同时触碰：
   - sticky scenario / sticky `thead`
   - expanded main row sticky `td`
   - scenario pin scroll / filter pin scroll
5. 每一批继续保持：
   - 单独 commit
   - 先跑相关 harness，再跑 `ci:remote`
   - 同步更新本文件
