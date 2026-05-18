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
