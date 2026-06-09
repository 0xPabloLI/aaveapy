# Handoff: Portfolio forceSync position-only + Clear all 按钮改造 — COMPLETED

> 完成日期: 2026-06-09

## 概要

两项改动 + 一个后续 issue：

1. **forceSync 只覆盖 position 字段** — `forceSide` 不再整体替换 side，改为只更新 `walletValue`/`source`/`deltaSign`（含 `??` guard），保留用户的 `amount`/`inputMode`
2. **Clear all 按钮改造** — 去掉 ConfirmPopover 确认弹窗，改为 Trash2 图标 + Tooltip 显示 "Clear all" + 蓝色 hover
3. **AAV-734** — 红色 hover 统一抽象（Cycle 2，本次不开）

## Commit

| Commit | 说明 |
|--------|------|
| `dbd795bb` | fix(portfolio): forceSync only overwrites position fields, clear-all removes confirm popover |

改动文件（4 个）：
- `src/hooks/usePortfolioSimulation.ts` — `forceSide` 逻辑
- `src/hooks/usePortfolioSimulation.entry.test.ts` — forceSyncReserves 测试
- `src/components/dashboard/PortfolioPanel.tsx` — Clear all 按钮
- `src/components/ui/confirm-popover.tsx` — 删除

## Linear Issue

| Issue | 状态 | 内容 |
|-------|------|------|
| **AAV-717** | ✅ Done | Portfolio Eraser 按钮效果不一致（关闭，附说明） |
| **AAV-734** | 📋 Backlog | 红色 hover 统一抽象（Cycle 2） |

## 改动详情

### 1. forceSync position-only

**旧逻辑**：`forceSide` 对有 `walletValue` 的 side 执行 `{ ...incomingSide }` 完整替换（覆盖用户 amount/inputMode）

**新逻辑**：`forceSide` 只更新 3 个 position 来源字段：

```ts
walletValue: incomingSide.walletValue,
source: incomingSide.source ?? existing.source,
deltaSign: incomingSide.deltaSign ?? existing.deltaSign,
// amount / inputMode 保留 existing
```

`source` 和 `deltaSign` 加了 `??` guard：这两个是 optional 字段，incoming 侧可能为 `undefined`，不应覆盖 existing 的有效值。

**测试**：existing 设为 `inputMode: 'token'`（与 incoming 的 `'usd'` 不同），断言保留 `'token'`；增加 `source`/`deltaSign` 断言。

### 2. Clear all 按钮

**迭代过程**：
1. 原始：ConfirmPopover 包裹 button（蓝色 hover）
2. 第一次理解错误：去掉 ConfirmPopover + 加文字标签 + 红色 hover
3. 用户纠正 → 最终：Trash2 图标 + Tooltip "Clear all" + 蓝色 hover（`PORTFOLIO_THEME.trashHoverBg/Text`）

ConfirmPopover 确认只有 PortfolioPanel 一处使用，已删除。

### 3. 红色 hover 散落现状（AAV-734 追踪）

- `PortfolioPanel.tsx:174` — `hover:text-destructive hover:bg-destructive/10`
- `PortfolioTokenRow.tsx:227` — `text-red-500 hover:bg-red-500/10`

需统一抽象为共享 token，放到 Cycle 2。

## 未纳入本次的改动

以下改动在工作区但**不属于本次 scope**（用户明确排除或属于其他 commit）：

- `src/types/portfolio.ts` — `restrictedStatus` 字段
- `src/components/dashboard/PortfolioTokenRow.tsx` — disabled state tooltip 重构
- `src/hooks/reserves-table/usePortfolioToggle.test.ts` — restrictedStatus
- `src/lib/portfolioRestricted.ts` / `portfolioRestricted.test.ts` — untracked 新文件

这些属于 `0174046b`（feat(portfolio): restricted reserve UX）。

## Validation Gate

lint ✅ / test ✅（22/22） / tsc ✅ / build ✅

## 关键设计决策

1. **forceSync field-level merge**：只覆盖 wallet 来源字段，不碰用户输入字段 — 避免 wallet sync "吃掉"用户手动输入
2. **`??` guard for optional fields**：`source`/`deltaSign` 可能为 undefined，nullish coalescing 防止覆盖有效值
3. **Clear all = 图标 + Tooltip**：去掉确认弹窗减少交互步骤；Tooltip 提供 affordance
4. **蓝色 hover 不变**：红色 hover 统一抽象是更大范围的设计系统工作，新开 issue 追踪

---

## 追加修复：import position eye-off 无法解除（commit `611cc583`）

### 根因

`walletPositionToPortfolio.ts` 创建 entry 对象时漏设 `restrictedStatus` → 运行时为 `undefined`（非 `null`）→ `=== null` 严格比较误判 → `applyRestrictedHidden` 错误设置 `hidden: true` + `canUnhide` 返回 `false` → 用户无法 unhide

### 修复

| 文件 | 改动 |
|------|------|
| `src/lib/walletPositionToPortfolio.ts` | 补 `restrictedStatus: null`（根因） |
| `src/lib/portfolioRestricted.ts` | `=== null` → `== null`，`!== null` → `!= null`（防御性） |
| `src/lib/portfolioRestricted.test.ts` | 新增 2 个 `undefined` 防御性测试 |
| `src/lib/walletPositionToPortfolio.test.ts` | expected 对象补 `restrictedStatus: null` |

### 设计决策

- **`== null` 防御**：`undefined` 和 `null` 在 "无值" 语义上等价，宽松比较统一处理两者
- **类型定义不改**：`restrictedStatus` 在 `portfolio.ts` 中是 required 字段（无 `?`），运行时 `undefined` 属于构造遗漏，不是合法状态
