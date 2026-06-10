# Design Principles

> 每次修改前对照。具体规则由架构守卫测试（`src/test/architecture-guard.test.ts`）强制执行；本文档提供推导逻辑。

## 1. 最小公共面 > 最大配置面

新增 prop / API surface 前，先验证调用方组合能否替代。

- ✅ 调用方包裹 `<Tooltip>` → 组件只渲染内容
- ❌ 组件内置 `<Tooltip>` + `disableTooltip` prop 绕开

推导：Ring / Indicator 组件只渲染 SVG / 数据，交互（tooltip、排序）由调用方按需组合。

## 2. 提取先于重复

同类样式字符串出现 ≥ 3 次时，必须提取为常量或组件默认值。

- ✅ `FORMULA_BLOCK_CLASS` 常量 + `FormulaBlock` 默认 className
- ❌ 5 处调用方重复传入 `className="rounded-lg border ..."`

## 3. 职责单一

一个组件只做一件事。渲染 vs 交互 vs 数据获取应分离。

- ✅ `UtilizationIndicator` 只画 SVG bar；`UtilizationContent` 只展示数据
- ❌ 同一组件既画 SVG 又包 Tooltip 又管排序回调

## 4. 结构决定组件，内容决定 props

不同视觉结构（内联公式 vs CSS 分数排版）是不同组件，不应用一个组件 + mode prop 切换。

- ✅ `FormulaBlock`（`<code>` 内联）和 `UtilizationFormula`（flex-col 分数）各自独立
- ❌ `FormulaBlock mode="fraction"` 瑞士军刀

## 5. 不引入补丁 prop

如果某个 prop 的唯一用途是"关掉组件内置的某个行为"，说明该行为不该内置。

- `disableTooltip` → 移除内置 tooltip，调用方按需包裹
- `disableSort` → 移除内置排序，调用方按需传入排序 UI

## 6. Desktop / Mobile 行为一致

同一数据在不同视口的表现应语义一致。如需差异，在文档中明确说明。

## 7. Supply-Borrow 不可分性（Supply-Borrow Inseparability）

一个 token 进出 portfolio 时，supply 和 borrow 两个 side **必须同时存在**。不可出现只有单 side 的 position。

**规则：**

- 添加 token 到 portfolio → 同时创建 supply + borrow 两个 position（空 amount 的 side 也必须存在）
- 从 portfolio 移除 token → 同时删除/隐藏同 reserveId 的所有 position
- `addPosition` 是底层 API，**不保证一体化**；所有添加 token 的调用方必须自行补全另一侧，或通过高层 API（`handleAddToken`、`importPositions`）操作

**根因教训（c788618f）：** `usePortfolioToggle.handlePortfolioToggle(reserveId, reserve, side?)` 的 `side` 分支曾只添加单 side，导致 `PortfolioTokenRow` 中该 token 只渲染一个 side，与"一体化"设计矛盾。修复：在添加指定 side 时检查并补全另一侧。

**长期方向：** 将"添加 token"提升为一等公民 API（如 `addReserve`），内部保证双 side，避免每个调用方各自实现补全逻辑。`addPosition` 降级为内部实现细节，不对外暴露。

## 8. 入口与语义统一（Entry Point & Semantic Unification）

同一业务操作存在多个触发入口（UI 入口、代码路径、事件来源）时，所有入口必须共享**同一条语义路径**——同一个函数、同一个状态机、同一个用户反馈（toast/动画/状态变化）。禁止多条路径各自实现相同操作。

**规则：**

- **语义层统一**：操作的核心逻辑（add/remove/hide/restore + toast）集中在一个 hook/函数中，调用方只传参不重复实现
- **反馈层统一**：同一操作从任何入口触发，用户看到的 toast、状态变化、视觉动画必须一致
- **视觉层统一**：同一状态的视觉标识（图标、颜色、标签）在所有入口中保持一致（如 hidden 条目在表格和面板中都显示 EyeOff 图标）
- **新增入口时**：先找到已有的语义路径，在其上叠加而非新建；如果找不到，说明该操作尚不存在，应先实现语义路径再添加入口

**反例（违反此原则 → A 路径正确、B 路径错误）：**

- ReservesTable ✓ 按钮直接 `removeReserve` 无 toast，PortfolioPanel Minus 按钮 `removeReserve` + Undo toast——同一操作两条路径，用户感受不一致
- Portfolio Delta Input 中 `handleClearDelta`（X 按钮）和 `handleDeltaCommit`（键盘删除）曾各自实现清空语义，键盘删除走了 early return 丢掉了"归零"语义——`handleDeltaCommit` 对空值未委托给 `handleClearDelta`

**正例（符合此原则）：**

- Refresh 操作三条触发路径（F5 / Refresh 按钮 / Watch Mode reentry）共享同一个 `refetchEvent` emitter（ADR-0015）
- `usePortfolioToggle.handlePortfolioToggle` 统一 add/hide/remove 逻辑，ReservesTable 和 PortfolioPanel 都通过它操作

**根因教训（AAV-752）：** ReservesTable checkbox 和 PortfolioPanel Minus 按钮各自独立实现 toggle 交互——checkbox 缺少 Undo toast、缺少 hidden 状态处理、图标不反映 hidden 状态。修复：将 toast + hidden 处理下沉到共享的 `usePortfolioToggle`，两边组件只传参不重复实现。
