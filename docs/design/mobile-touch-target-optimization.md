# Mobile Touch Target Optimization — Portfolio Simulation

> **Status**: Draft — 待审核
> **Date**: 2026-07-18
> **Scope**: 移动端 Portfolio Simulation 所有交互元素的触控目标与视觉尺寸优化
> **Motivation**: 当前部分元素刚好 44px 但视觉偏大（视觉=触控无分离），部分元素远低于 44px（不达标）。需要统一方案：视觉缩小 + 触控热区保持 44px。

---

## 1. 现状分析

### 1.1 达标元素（44px，但视觉=触控无分离）

| # | 元素 | 文件:行 | 当前尺寸 | 视觉感受 |
|---|------|---------|----------|----------|
| 1 | Minus/EyeOff 移除按钮 | `MobilePortfolioCard.tsx:214` | `min-h-[44px] min-w-[44px]` + `p-1.5` + icon `size-3.5`(14px) | OK — 图标小，视觉不显大 |
| 2 | Supply/Borrow Tab | `MobilePortfolioCard.tsx:248` | `min-h-[44px]` + `flex-1` | 偏大 — 44px 高度的文字 tab 在紧凑面板里占地 |
| 3 | $/T 切换按钮 | `PortfolioTablePrimitives.tsx:352` | `h-11 w-11` (44×44) | 偏大 — 方形按钮视觉冲击强 |
| 4 | Input 输入框 | `PortfolioTablePrimitives.tsx:387` | `h-11` (44px) | 偏大 — 输入框 44px 高在密集数据面板里偏厚 |
| 5 | 清除按钮 (Eraser) | `PortfolioTablePrimitives.tsx:397` | `min-h-[44px] min-w-[44px]` + `p-2` + icon `size-4`(16px) | OK — 图标小 |
| 6 | Daily Earnings 展开按钮 | `MobilePortfolioCard.tsx:335` | `min-h-[44px]` + `w-full` | OK — 全宽按钮视觉合理 |

### 1.2 不达标元素（<44px）

| # | 元素 | 文件:行 | 当前尺寸 | 差距 |
|---|------|---------|----------|------|
| 7 | SegmentedToggle 垂直模式 segment | `segmented-toggle.tsx:154` | 28px 高 (`min-h-[var(--ds-seg-seg-min-h)]`) | **-16px** |
| 8 | ScenarioControls 移动端 Input | `ScenarioControls.tsx:273` | 36px 高 (`h-[var(--ds-button-sm-h)]`) | **-8px** |
| 9 | SlidersHorizontal 按钮 | `ScenarioControls.tsx:304` | 32×32 (`h-[var(--ds-control-h)] w-[var(--ds-control-h)]`) | **-12px** |
| 10 | PortfolioPanel Header 图标按钮 | `PortfolioPanel.tsx` (via `headerControlStyles.ts:56`) | 32×32 (`w-[var(--ds-control-h)] h-[var(--ds-control-h)]`) | **-12px** |
| 11 | 搜索 Input | `PortfolioPanel.tsx` | 32px 高 (`h-[var(--ds-control-h)]`) | **-12px** |
| 12 | PopularTokenChip | `PortfolioPanel.tsx` | 28px 高 (`h-[var(--ds-chip-h)]`) | **-16px** |
| 13 | PortfolioModeToggle Switch | `PortfolioPanel.tsx` | 20×36px (`h-5 w-9`) | **-24px** |

---

## 2. 核心策略：视觉小 + 触控热区大

### 2.1 原则

触控目标 44px 是 Apple HIG / WCAG 2.5.8 推荐下限，交互元素**不能低于此**。但 **视觉尺寸 ≠ 触控尺寸**：

- 视觉元素（图标、文字、输入框边框）可以更小（28-36px）
- 触控热区通过 `min-h/w-[44px]`、`p-2` padding、或 `::before` 伪元素补足到 44px
- 用户看不到触控热区，只感受到"点得准"

### 2.2 实现模式

**模式 A — `min-h/w-[44px]` + 透明 padding**

适用于：图标按钮等视觉元素明显小于 44px 的场景。按钮本身透明 padding 撑到 44px，图标居中。

```tsx
// 32px 视觉按钮，44px 触控热区
<button className="min-h-[44px] min-w-[44px] p-2 ...">
  <Icon className="size-4" />
</button>
```

**模式 B — 外层容器补足**

适用于：输入框、tab 行等视觉高度需要降低，但触控高度通过父容器 padding 补足。视觉元素高度不变，外层容器补 padding 使总高度达到 44px。

```tsx
// 36px 视觉输入框，外层 4px padding 补足到 44px
<div className="py-1"> {/* 4px×2 = 8px 补足 */}
  <input className="h-9 ..." /> {/* 36px */}
</div>
// 总行高 = 36 + 8 = 44px
```

**模式 C — `::before` 伪元素扩展**

适用于：视觉尺寸固定且不能用 `min-h` 改变的元素（如 chip、switch）。`min-h-[44px]` 会改变元素视觉高度，因此用伪元素向外扩展触控热区，不改变元素本身尺寸。

```tsx
// 28px 视觉 chip，44px 触控热区（不改变 chip 高度）
<button className="relative h-[var(--ds-chip-h)] touch-target-expand ...">
  ...
</button>
```
```css
.touch-target-expand::before {
  content: '';
  position: absolute;
  inset: -8px; /* 向四周扩展 */
  z-index: -1; /* 不遮挡相邻元素 */
}
```

---

## 3. 逐元素方案

### 3.1 达标元素优化（降视觉尺寸，保留触控热区）

#### E3: $/T 切换按钮（模式 A）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉高度 | `h-11` (44px) | `h-9` (36px) |
| 视觉宽度 | `w-11` (44px) | `w-9` (36px) |
| 触控高度 | 44px | `min-h-[44px]` (44px) |
| 触控宽度 | 44px | `min-w-[44px]` (44px) |
| 图标/文字 | `ds-text-9` | 不变 |
| 桌面端 | `md:h-5 md:w-auto` | 不变 |

代码变更：
```diff
- 'h-11 w-11 px-1 md:h-5 md:w-auto md:px-1',
+ 'h-9 w-9 px-1 min-h-[44px] min-w-[44px] md:h-5 md:w-auto md:px-1 md:min-h-0 md:min-w-0',
```

#### E4: Input 输入框（模式 B）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉高度 | `h-11` (44px) | `h-9` (36px) |
| 触控高度 | 44px | 通过外层 `py-1`(4px×2) 补足 → 44px |
| 行总高 | 44px | 44px（**不变**） |
| 桌面端 | `md:h-5` | 不变 |

代码变更（在 CompactInput 的外层容器）：
```diff
  // PortfolioTablePrimitives.tsx — CompactInput return
- <div className="flex items-center gap-1 md:gap-0.5">
+ <div className="flex items-center gap-1 md:gap-0.5 py-1 md:py-0">
    ...
-   'h-11 md:h-5 w-full ...',
+   'h-9 md:h-5 w-full ...',
```

#### E2: Supply/Borrow Tab（模式 C）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉高度 | `min-h-[44px]` | `min-h-[36px]` |
| 触控高度 | 44px (button) | 通过按钮 `::before` 伪元素扩展（不改容器 padding） |
| 字号 | `ds-text-12` | 不变 |
| 行总高 | ~48px (44+2+2) | ~40px (36+2+2) — **行 -8px** |

代码变更：
```diff
  // MobilePortfolioCard.tsx — tab button (not container)
- '... min-h-[44px]',
+ '... min-h-[36px] relative touch-target-expand',
```
```css
/* 在 tab button 上用 ::before 上下扩展触控热区 */
.touch-target-expand::before {
  content: '';
  position: absolute;
  inset: -4px -2px; /* 上下扩展 4px → 36+4+4=44px */
  z-index: -1;
}
```

> **注意**：不用在 tablist 容器上加 `pt-2 pb-2`。那会使行总高从 48px 增到 52px（反而更高）。用 `::before` 扩展触控热区不改变布局高度。

#### E5: 清除按钮 (Eraser)（无需变更）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉 | `min-h/w-[44px]` + `p-2` + icon 16px | 不变 — 图标已足够小 |
| 触控 | 44px | 不变 |

#### E1: Minus/EyeOff 按钮（无需变更）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉 | `min-h/w-[44px]` + `p-1.5` + icon 14px | 不变 — 图标已足够小 |
| 触控 | 44px | 不变 |

#### E6: Daily Earnings 展开按钮（无需变更）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉 | `min-h-[44px]` + `w-full` | 不变 — 全宽按钮视觉合理 |
| 触控 | 44px | 不变 |

---

### 3.2 不达标元素修复（补触控热区）

#### E7: SegmentedToggle 垂直模式（模式 B — 调用方补足）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| Segment 视觉高度 | 28px (`min-h-[var(--ds-seg-seg-min-h)]`) | 不变 |
| Track padding | `p-[var(--ds-seg-track-pad)]` = 3px | 不变 |
| 整体触控高度 | ~34px (28+3+3) | 通过调用方外层容器补足 |

代码变更（在 `ScenarioControls.tsx` 的调用处，不改 `segmented-toggle.tsx` 组件本身）：
```diff
  // ScenarioControls.tsx — SegmentedToggle 外层
- <SegmentedToggle ... className="shrink-0 self-stretch" />
+ <div className="py-2 md:py-0"> {/* 8px×2 补足到 ~50px */}
+   <SegmentedToggle ... className="shrink-0 self-stretch" />
+ </div>
```

> **范围注意**：不改 `segmented-toggle.tsx` 组件本身，避免影响其他使用方（如 Header 等）。仅在 ScenarioControls 调用处加外层 padding。

#### E8: ScenarioControls 移动端 Input（模式 B）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉高度 | 36px (`h-[var(--ds-button-sm-h)]`) | 不变 |
| 触控高度 | 36px | 通过外层容器 `py-1`(4px×2) 补足 → 44px |

代码变更（`ScenarioControls.tsx`）：
```diff
  // 两个 ScenarioInputField 的外层 flex-col
- <div className="flex flex-col gap-1 flex-1 min-w-0">
+ <div className="flex flex-col gap-0.5 flex-1 min-w-0 py-1">
```
注意：gap 从 1(4px) 缩到 0.5(2px) 以补偿 py-1 增加的总高度。

#### E9: SlidersHorizontal 按钮（模式 A）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉 | 32×32 + icon `size-3.5`(14px) | 不变 |
| 触控 | 32×32 | `min-h-[44px] min-w-[44px]` + 居中 |

代码变更（`ScenarioControls.tsx:304`）：
```diff
- 'shrink-0 inline-flex h-[var(--ds-control-h)] w-[var(--ds-control-h)] items-center justify-center ...',
+ 'shrink-0 inline-flex h-[var(--ds-control-h)] w-[var(--ds-control-h)] min-h-[44px] min-w-[44px] items-center justify-center ...',
```

#### E10: PortfolioPanel Header 图标按钮（模式 A — 调用方补足）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉 | 32×32 | 不变 |
| 触控 | 32×32 | 在 PortfolioPanel 调用处加 `min-h-[44px] min-w-[44px]` |

代码变更（在 `PortfolioPanel.tsx` 的按钮 className 上，不改 `headerControlStyles.ts` 全局常量）：
```diff
  // PortfolioPanel.tsx — 每个图标按钮
  className={cn(
    HEADER_CONTROL_ICON_BUTTON_CLASS,
+   'min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0',
    ...
  )}
```

> **范围注意**：不改 `headerControlStyles.ts`，避免影响 `Header.tsx`、`WatchAddressInput.tsx`、`WalletButton.tsx` 等全站组件。仅在 PortfolioPanel 的调用处加。

#### E11: 搜索 Input（模式 B — 外层容器补足）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉高度 | 32px (`h-[var(--ds-control-h)]`) | 不变 |
| 触控高度 | 32px | 通过外层容器 `py-1`(4px×2) 补足 → 44px |

代码变更（在搜索 Input 外层加 padding，不在 input 上加 `min-h`）：
```diff
  // PortfolioPanel.tsx — 搜索 input 外层
- <div className="...">
+ <div className="... py-1 md:py-0">
    ...
    className="h-[var(--ds-control-h)] w-full ..."
    // 不加 min-h-[44px] — 那会使 input 视觉变 44px
```

> **修正说明**：原方案在 input 上加 `min-h-[44px]` 会使 input 视觉高度变成 44px，违背"视觉小"策略。改用模式 B。

#### E12: PopularTokenChip（模式 C — `::before` 伪元素扩展）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉高度 | 28px (`h-[var(--ds-chip-h)]`) | 不变 |
| 触控高度 | 28px | 通过 `::before` 伪元素上下扩展 8px → 44px |

代码变更：
```diff
- className="inline-flex h-[var(--ds-chip-h)] ..."
+ className="inline-flex h-[var(--ds-chip-h)] relative touch-target-expand ..."
```

> **修正说明**：原方案用 `min-h-[44px]` 会使 chip 视觉变 44px，违背"视觉小"策略。改用模式 C（`::before`），chip 高度保持 28px，触控热区扩展到 44px。

#### E13: PortfolioModeToggle Switch（模式 C — 外层容器）

| 属性 | 当前 | 优化后 |
|------|------|--------|
| 视觉 | 20×36px (原生 Switch) | 不变 |
| 触控 | 20×36px | 外层容器 `min-h-[44px] min-w-[44px]` + 居中 |

代码变更：
```diff
  // Switch 外层容器
- <div className="...">
+ <div className="... min-h-[44px] min-w-[44px] flex items-center justify-center">
```

**Switch 特例说明**：原生 Switch 控件在各平台都是 20-36px 高度，用户已形成肌肉记忆。强行把 Switch 本身撑到 44px 反而违和。正确做法是保持 Switch 原生尺寸，扩大可点击容器。

---

## 4. 预期效果

### 4.1 视觉紧凑度

| 区域 | 当前行高 | 优化后行高 | 变化 |
|------|----------|-----------|------|
| Tab 行 | ~48px (44+2+2) | ~40px (36+2+2) | **行 -8px** |
| CompactInput 行 | 44px | 44px (36+4+4) | **行不变**（视觉 -8px） |
| 单个 card 估算 | ~250px | ~242px | **-8px** |

> **修正说明**：原方案声称 Tab 行和 Input 行各节省 8px、card 共节省 20px。实际：Tab 行 -8px（`::before` 不占布局高度），Input 行不变（padding 补偿了视觉缩小），card 共 -8px。

### 4.2 触控可达性

- 所有 13 个交互元素均达到 44px 触控目标
- 视觉尺寸降低后卡片更紧凑，同一屏幕可容纳更多 token
- 无障碍合规（WCAG 2.5.8 / Apple HIG）

---

## 5. 待确认事项

以下问题需要审核者拍板：

1. **Input 高度**：从 44px 降到 36px（`h-9`），11px 字号在 36px 输入框内是否舒适？备选：`h-10`(40px) 折中。
2. **Tab 高度**：从 44px 降到 36px，12px 字号在 36px tab 内是否太扁？备选：38px（`h-[38px]`）。
3. **PopularTokenChip**：28px 视觉 + `::before` 扩展，相邻 chip 之间的 `::before` 会不会重叠？是否需要给 chip container 加 gap？
4. **Switch 特例**：是否认可"保持原生尺寸 + 扩大容器"方案，还是希望 Switch 本身也要 44px？
5. **`touch-target-expand` CSS class**：是放在全局 `index.css` 还是组件级？建议全局，供多处复用。

---

## 6. 不在本方案范围内

- 桌面端尺寸调整（桌面端不需要 44px 触控目标）
- 展开区域（Detail section）内的非交互展示元素
- Metrics 三列网格（非交互，不受 44px 限制）
- 卡片间距、圆角等布局微调（属于 `layout` 命令范畴）
- `headerControlStyles.ts` 全局常量修改（仅改 PortfolioPanel 调用处）
- `segmented-toggle.tsx` 组件本身修改（仅改 ScenarioControls 调用处）

---

## 7. 参考依据

- Apple Human Interface Guidelines: 44×44pt minimum touch target
- WCAG 2.5.8 (Target Size Minimum): 24px minimum (AA), 44px recommended (AAA)
- Material Design: 48×48dp touch target
- Impeccable skill `reference/layout.md`: "Touch targets must be 44×44px minimum even when the visual element is smaller. Expand the hit area with padding or a pseudo-element."
- 项目 `DESIGN-SYSTEM-REFERENCE.md` §172/719/792: 触控目标 ≥44px
- 项目 `docs/design/mobile-portfolio-audit-2026-07.md`: 审计发现 4/6 元素不达标
- 项目 `docs/design/mobile-portfolio-simulation.md`: 原始移动端设计文档