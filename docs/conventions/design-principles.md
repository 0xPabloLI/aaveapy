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
