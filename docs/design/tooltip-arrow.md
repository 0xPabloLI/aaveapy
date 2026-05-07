# Tooltip 箭头 / Callout Arrow 设计规范

> 适用范围：所有使用 `TooltipCalloutArrow`（Radix Tooltip 衍生）和
> `IncentiveTooltip`（自定义浮层）的提示气泡。
>
> 编写背景：2026-05 修复 size 列 hover tooltip 箭头与边框的"双线/seam"问题，
> 同时统一两类 tooltip 的箭头视觉规范，使两者可互相对照。

---

## 1. 视觉规范（Design Spec）

| 属性 | 值 | 说明 |
|---|---|---|
| 三角形宽度（垂直方向） | **9 px** | side=left/right 的箭头深度 |
| 三角形宽度（水平方向） | **16 px** | side=top/bottom 的箭头底边宽度 |
| 三角形高度（与方向相反的轴） | **16 px / 9 px** | 与 IncentiveTooltip 一致 |
| 填充色 | `hsl(var(--card))` | 与 tooltip body 同 |
| 描边色 | `hsl(var(--border) / 0.6)` | 与 body 边框同 (`border-border/60`) |
| 描边宽度 | **1 px** | 与 body border 一致 |
| 描边覆盖范围 | **仅两条外侧斜边**，**不画底边** | 关键，避免 seam |
| 与 body 重叠量 | **1 px**（箭头底位于 body 内部 1px 处） | 让 body 1px 边框被箭头 fill 完全遮罩 |
| 箭头与 trigger 的间距 | `sideOffset = 4`（默认） + 8px 箭头露出 = 实际 ~12px 视觉距离 | |

---

## 2. 桌面端排版规范（Desktop Placement Rules）

`TooltipContent` 的 `side` prop 控制 tooltip 相对于 trigger 的偏好位置，
箭头由 `TooltipCalloutArrow` 自动跟随 Radix `data-side` 驱动。

| 场景 | `side` 值 | tooltip 位置 | 箭头位置 | 适用范围 |
|---|---|---|---|---|
| **表格列内 tooltip** | `"right"` | trigger 右侧 | 箭头在 **左**（指向 trigger） | CapProgressRing、BorrowCapProgressRing、DeficitLiquidityRing、deficit 详情 |
| **利用率/数值解释 tooltip** | `"top"` | trigger 上方 | 箭头在 **下**（指向 trigger） | UtilizationIndicator、利用率文案（桌面/移动一致） |
| **全局控件 tooltip** | `"bottom"` | trigger 下方 | 箭头在 **上**（指向 trigger） | ThemeToggle 等页面级控件 |

**原则：**

- 表格列内 tooltip 用 `"right"` → 不遮挡下方行内容，符合 LTR 阅读习惯
- 利用率/数值解释 tooltip 用 `"top"` → trigger 上方通常有空余空间，避免遮挡后续内容
- 所有 `TooltipContent` 必须包含 `<TooltipCalloutArrow />`（**不传 `side`**），保证视觉一致性
- **IncentiveTooltip**（自定义浮层）不受此规则约束，它有自己的 top/bottom 自动判断逻辑

### 2.1 调用方速查表

| 文件 | 行号 | `TooltipContent side` | `TooltipCalloutArrow` |
|---|---|---|---|
| CapProgressRing.tsx | 61 | `"right"` | `<TooltipCalloutArrow />` |
| BorrowCapProgressRing.tsx | 67 | `"right"` | `<TooltipCalloutArrow />` |
| DeficitLiquidityRing.tsx | 73 | `"right"` | `<TooltipCalloutArrow />` |
| DesktopReserveRow.tsx (deficit) | 456 | `"right"` | `<TooltipCalloutArrow />` |
| UtilizationIndicator.tsx | 98 | `"top"` | `<TooltipCalloutArrow />` |
| DesktopReserveRow.tsx (util) | 500 | `"top"` | `<TooltipCalloutArrow />` |
| MobileReserveCard.tsx (util) | 677 | `"top"` | `<TooltipCalloutArrow />` |
| ThemeToggle.tsx | 68 | `"bottom"` | 无（全局控件可省略） |

---

## 3. 两类 Tooltip 箭头实现对比

| 维度 | `TooltipCalloutArrow`（Radix 派生） | `IncentiveTooltip` 自定义 SVG |
|---|---|---|
| **绘制方式** | SVG `<path fill>` + `<path stroke>` | SVG `<path fill>` + `<path stroke>` |
| **路径格式** | `M9 0 L0 8 L9 16 Z` (fill) / `M9 0 L0 8 L9 16` (stroke) | `M0 10 L8 0 L16 10 Z` (fill) / 同形 (stroke) |
| **底边** | 不描边（无 seam） ✅ | 不描边（无 seam） ✅ |
| **方向** | 4 方向（top/bottom/left/right），CSS `group-data-[side=...]/tt:` 选中 | 2 方向（top/bottom），React state `tooltipPlacement` 切换 + `rotate-180` |
| **flip 触发** | Radix `avoidCollisions`（默认开启），自动写 `data-side` | 自定义 `spaceBelow / spaceAbove + flipThreshold` 判断 |
| **arrow 沿 body 边的位移** | 固定居中（`top-1/2 -translate-y-1/2`） | 动态：`arrowLeft = triggerCenterX - tooltipLeft - arrowWidth/2`，并 clamp 到 `[12, tooltipWidth - arrowWidth - 12]` |
| **可被关闭** | 无 — 只要 hover 就显示 | `severelyClamped`（被视口边缘 clamp 超过 6px）时 `setShowTooltipArrow(false)` 隐藏 |
| **覆写 sideOffset** | `sideOffset` prop（默认 4） | 直接控制 `top` 偏移 |
| **DOM 数量** | 4 个 SVG（hidden 3 个） | 1 个 SVG |
| **z-index 关系** | 箭头 `z-20` 在 body 之上（mask body 边） | SVG 与 body 是同级，无需 mask（border 直接绘出） |
| **API** | `<TooltipCalloutArrow />`（`side` prop 已废弃，由 data-side 自动驱动） | 内部组件，无对外 API |

### 何时用哪个

- **`TooltipCalloutArrow`**：跟随 trigger、需要 hover/focus 触发、内容较短（≤220px）、
  不需要箭头水平跟随 trigger 中心 → Radix 全自动定位 + flip 已足够。
  典型场景：size 列 cap 进度环、表头 sort 解释、按钮快速 hint。

- **`IncentiveTooltip` 自定义浮层**：内容较长且复杂（含表格、图标、多源数据）、
  需要箭头始终对准 trigger 视觉中心、需要在 viewport 边缘智能 clamp、
  需要点击/悬浮多种交互 → 自定义浮层提供更高的控制粒度。
  典型场景：supply / borrow incentive 详情。

---

## 4. 核心实现要点（Implementation Notes）

### 4.1 SVG 双 path 模式（关键）

```tsx
<svg viewBox="0 0 9 16" width="9" height="16">
  {/* fill path：闭合三角形，提供"白色填充" */}
  <path d="M9 0 L0 8 L9 16 Z" fill="hsl(var(--card))" />
  {/* stroke path：开放折线，仅描两条外侧斜边，**不描底边** */}
  <path d="M9 0 L0 8 L9 16"
        stroke="hsl(var(--border) / 0.6)"
        strokeWidth="1"
        strokeLinejoin="round"
        fill="none" />
</svg>
```

**为什么必须是两个 path**：
- 单 path `<path d="M9 0 L0 8 L9 16 Z" fill stroke />` 会让 `Z` 把底边也描出来，
  与 body 接合处出现一道 1px 的"双线" / seam（即修复前的问题）。
- 拆成 fill 和 stroke 两条 path 后，stroke 那条**不写 `Z`**，底边就只填充不描边。

### 4.2 与 body border 的几何关系

```diagram
              ╭──────── tooltip body ────────╮
              │                              │
   arrow tip  │                              │
   ─◀── 9px ──┤  body content                │
              │                              │
              ╰──────────────────────────────╯
              ▲
              │ body 左边框 1px
              │
       arrow 底边在此 +1px 处（被 body 内部覆盖）
```

- 箭头总宽 9px，绝对定位 `left: -8px` → 箭头底边在 body content 内 +1px 处。
- 这 1px 重叠让 body 的 1px 左边框完全被箭头 fill 遮罩，不会从底边漏出。
- 上下两个顶角恰好落在 body 边框线上，与 body 边框无缝衔接。

### 4.3 自动 flip：Radix `data-side` + Tailwind `group-data` variant

```tsx
// TooltipContent 上加 group/tt
<TooltipPrimitive.Content className="group/tt ..." />

// TooltipCalloutArrow 渲染 4 个 SVG，仅匹配 data-side 的那个 block
<svg className="hidden group-data-[side=right]/tt:block ..." />  {/* 指左 */}
<svg className="hidden group-data-[side=left]/tt:block  ..." />  {/* 指右 */}
<svg className="hidden group-data-[side=bottom]/tt:block ..." /> {/* 指上 */}
<svg className="hidden group-data-[side=top]/tt:block    ..." /> {/* 指下 */}
```

Radix Tooltip 在每次定位时会把实际渲染方向写到 `data-side` 属性。
如果 `<TooltipContent side="right" />` 因为右侧空间不足触发 collision flip
变成 left，`data-side` 会同步变成 `"left"`，对应的左侧箭头自动显示，
原右侧箭头自动隐藏。**调用方无需任何改动。**

### 4.4 `TooltipCalloutArrow` 的 `side` prop 已废弃

```tsx
const TooltipCalloutArrow = (_props: { side?: 'top' | 'bottom' | 'left' | 'right' }) => {
  // side prop 仅作 API 向后兼容 / 文档 hint，运行时被忽略
  ...
};
```

- 历史调用 `<TooltipCalloutArrow side="right" />` 需要清理为 `<TooltipCalloutArrow />`。
- 箭头方向完全由 Radix 的 `data-side` 属性自动驱动，无需传参。

---

## 5. 修复经验回顾（Debugging Lessons）

| 阶段 | 尝试 | 结果 | 教训 |
|---|---|---|---|
| 1 | 旋转 45° div + bg-card mask 线遮罩 body 左边框 | 在 size 列 hover 时出现可见"双线" | mask 线的 11px 长度无法精确匹配旋转后菱形对角线 ~14px |
| 2 | 改为单层旋转 div + z-20 直接覆盖 body 边框（`left:[-3px]`） | 边框依然有微弱可见 seam（顶/底角处） | div + 1px CSS border 在旋转后会有 sub-pixel 渲染 artifact |
| 3 | 旋转 div 中心精确落在 body 外边缘（`left:[-5px]`） | 视觉接近无 seam，但仍有"shoulder"细节 | 接近极限，但 CSS 旋转 border 仍非完美 |
| 4 | **改用 SVG 双 path（fill+stroke 分离，stroke 不画底边）** | **完美无 seam，与 IncentiveTooltip 实现完全统一** | SVG 是矢量、无 sub-pixel 模糊；分离 fill/stroke 是消除 seam 的根本方法 |

**核心结论**：CSS 旋转 div 模拟箭头先天有 sub-pixel + border join 问题，不要再走这条路；
统一使用 SVG 双 path 模式（参考 `IncentiveTooltip`）。

---

## 6. 验收清单（Acceptance Checklist for Future Changes）

修改任意 tooltip 箭头实现时，必须验证：

- [ ] 在 1440×900 desktop 视口下 hover size 列 cap 进度环，箭头与 body 无 seam
- [ ] 在窄视口（≤900px）或将 trigger 推至右边缘时，tooltip flip 到左侧后，
      **箭头自动出现在 body 右侧并指向右**（`data-side="left"` 时 right 箭头 hidden、left 箭头 block）
- [ ] 暗色模式下箭头 fill / stroke 与 body 完全同色（依赖 `hsl(var(--card))` /
      `hsl(var(--border) / 0.6)`，不要硬编码颜色）
- [ ] 所有 `TooltipContent` 调用方 `side` prop 符合 §2 排版规范
- [ ] 所有 `TooltipCalloutArrow` 调用方不传 `side` prop（已废弃）
- [ ] `npm run lint && npm test && npx tsc --noEmit && npm run build` 全过
- [ ] 视觉对照参考：`docs/design/tooltip-arrow-reference.md`（如需要）或
      Magic Patterns 设计 `qfbdm9z2qhfay4lqvzqvrs`

---

## 7. 关联文件

- 实现：[src/components/ui/tooltip.tsx](../../src/components/ui/tooltip.tsx)
- IncentiveTooltip 自定义箭头：[src/components/dashboard/IncentiveTooltip.tsx](../../src/components/dashboard/IncentiveTooltip.tsx)（见 `showTooltipArrow` 渲染块）
- 调用方（表格列内，`side="right"`）：
  - [src/components/dashboard/CapProgressRing.tsx](../../src/components/dashboard/CapProgressRing.tsx)
  - [src/components/dashboard/BorrowCapProgressRing.tsx](../../src/components/dashboard/BorrowCapProgressRing.tsx)
  - [src/components/dashboard/DeficitLiquidityRing.tsx](../../src/components/dashboard/DeficitLiquidityRing.tsx)
  - [src/components/dashboard/DesktopReserveRow.tsx](../../src/components/dashboard/DesktopReserveRow.tsx)（deficit 部分）
- 调用方（利用率/数值解释，`side="top"`）：
  - [src/components/dashboard/UtilizationIndicator.tsx](../../src/components/dashboard/UtilizationIndicator.tsx)
  - [src/components/dashboard/DesktopReserveRow.tsx](../../src/components/dashboard/DesktopReserveRow.tsx)（利用率部分）
  - [src/components/dashboard/MobileReserveCard.tsx](../../src/components/dashboard/MobileReserveCard.tsx)（利用率部分）
- 调用方（全局控件，`side="bottom"`）：
  - [src/components/ThemeToggle.tsx](../../src/components/ThemeToggle.tsx)
- 设计系统总览：[docs/design/DESIGN-SYSTEM-REFERENCE.md](./DESIGN-SYSTEM-REFERENCE.md)
- 前端交互守则：[docs/design/frontend-interaction-guardrails.md](./frontend-interaction-guardrails.md)
