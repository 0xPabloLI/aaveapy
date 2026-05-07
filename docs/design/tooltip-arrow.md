# Tooltip 箭头 / 提示浮层设计规范

> 适用范围：项目中全部三套提示浮层系统。
>
> 编写背景：2026-05 修复 size 列 hover tooltip 箭头与边框的"双线/seam"问题，
> 同时统一所有 tooltip 的视觉规范与排版规则。

---

## 1. 系统全景（Three Systems at a Glance）

| # | 组件 | 定义位置 | 触发方式 | 最大宽度 | 有箭头？ | 典型场景 |
|---|---|---|---|---|---|---|
| ① | **Radix Tooltip + TooltipCalloutArrow** | `src/components/ui/tooltip.tsx` | hover（桌）/ click（移） | 220px | ✅ | 表格列内 cap 进度环、利用率解释、deficit 详情 |
| ② | **IncentiveTooltip** | `src/components/dashboard/IncentiveTooltip.tsx` | click（桌）/ click（移） | 520px | ✅ | supply / borrow 激励详情面板 |
| ③ | **DesktopTooltip / MobileTooltip** | `src/components/dashboard/AprApyToggle.tsx` | hover（桌）/ click（移） | ~360px | ❌ 无箭头 | Ink APR 计算器公式、FDV 解释、APY 切换器 |

### 1.1 选择决策树

```
需要展示提示内容？
├─ 内容 ≤ 1-3 行纯文字，无交互元素
│   └─ 用 ① Radix Tooltip + TooltipCalloutArrow
│       （参见 §2 排版规范选 side 值）
│
├─ 内容复杂（表格/图标/多源数据），含交互元素（链接/复选框）
│   └─ 用 ② IncentiveTooltip
│
└─ 内容含标题栏 + 结构化正文，需要 variant 颜色系统
    └─ 用 ③ DesktopTooltip / MobileTooltip
```

---

## 2. 箭头视觉规范（Visual Spec）

> 仅适用于系统 ① 和 ②。

| 属性 | 值 | 说明 |
|---|---|---|
| 三角形宽度（垂直方向） | **9 px** | side=left/right 的箭头深度 |
| 三角形宽度（水平方向） | **16 px** | side=top/bottom 的箭头底边宽度 |
| 填充色 | `hsl(var(--card))` | 与 tooltip body 同 |
| 描边色 | `hsl(var(--border) / 0.6)` | 与 body 边框同 (`border-border/60`) |
| 描边宽度 | **1 px** | 与 body border 一致 |
| 描边覆盖范围 | **仅两条外侧斜边**，**不画底边** | 关键，避免 seam |
| 与 body 重叠量 | **1 px**（箭头底位于 body 内部 1px 处） | 让 body 1px 边框被箭头 fill 完全遮罩 |
| 箭头与 trigger 间距 | 系统① `sideOffset = 4` + 8px 露出 = ~12px；系统② `gap = 8` px | |

---

## 3. 系统① Radix Tooltip 桌面端排版规范

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
- 所有系统①的 `TooltipContent` 必须包含 `<TooltipCalloutArrow />`（**不传 `side`**）
- **移动端**：系统①在移动端会自动 override 为 `side="bottom"`（见 [tooltip.tsx:L30](file:///Users/pabloli/Documents/code/aaveapy/src/components/ui/tooltip.tsx#L30)）

### 3.1 调用方速查表

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

## 4. 系统② IncentiveTooltip 规范

### 4.1 定位逻辑

自定义浮层，不走 Radix 体系。通过 `useLayoutEffect` 实时计算位置：

- **水平**：`triggerCenterX` 映射到 tooltip 的 `left` 值，clamp 到 `[16, innerWidth - tooltipWidth - 16]`
- **垂直**：检测 `spaceBelow` vs `spaceAbove`，自动选择 `tooltipPlacement = 'top' | 'bottom'`
- **箭头水平跟随**：`arrowLeft = triggerCenterX - tooltipLeft - arrowWidth/2`，clamp 到 `[12, tooltipWidth - arrowWidth - 12]`
- **视口边缘保护**：当 tooltip 被 viewport 边缘 clamp 超过 6px 时，隐藏箭头 (`setShowTooltipArrow(false)`)

### 4.2 交互规则

- **桌面**：点击 badge 打开 → 点击遮罩关闭
- **移动**：点击 badge 打开 → 底部抽屉（bottom sheet）样式，使用共享组件 [BottomSheet.tsx](../../src/components/dashboard/BottomSheet.tsx)（`surfaceStyle`=渐变纹理，`overlayOpacity`="20"），顶部 sticky header + X 按钮关闭
- **不改为 hover**：内容含交互元素（whitelist 勾选框、外部链接），hover 会导致鼠标移入时 tooltip 消失

---

## 5. 系统③ DesktopTooltip / MobileTooltip 规范

### 5.1 特征

- 独立定位系统，通过 `calculateTooltipPosition(triggerRect, alignLeft, tooltipWidth)` 手动计算
- **无箭头**
- 支持 `variant` 颜色系统：`'default'`（emerald）、`'neutral'`、`'purple'`
- 带标题栏（`title` prop），可选 `hideTitle`

### 5.2 交互规则

| 端 | 触发 | 关闭 |
|---|---|---|
| **桌面** | `DesktopTooltip`：hover trigger | `onMouseLeave` |
| **移动** | `MobileTooltip`：点击 trigger | 点击遮罩 / X 按钮 |

### 5.3 Cursor 规则

系统③的 trigger 在桌面端是 hover 触发，移动端是 click 触发，遵循与系统①相同的规则：

```tsx
// trigger 按钮上统一使用
className="... cursor-pointer md:cursor-auto"
```

- **移动端**（`cursor-pointer`）：手型，暗示可点击
- **桌面端**（`cursor-auto`）：浏览器默认箭头，表示 hover 即显示

FDV 按钮、InfoIconButton 均遵循此规则。参见 [frontend-interaction-guardrails.md](file:///Users/pabloli/Documents/code/aaveapy/docs/design/frontend-interaction-guardrails.md#L12-L13) §A「Auto-show tooltip 用 cursor-auto，Click-to-show 用 cursor-pointer」。

### 5.4 调用方速查表

| 文件 | 行号 | 组件 | 用途 |
|---|---|---|---|
| AprApyToggle.tsx | — | DesktopTooltip / MobileTooltip | APY vs APR 定义解释 |
| InkAprCalculator.tsx | 456 | DesktopTooltip / MobileTooltip | Incentive APR formula |
| InkAprCalculator.tsx | 542 | DesktopTooltip / MobileTooltip | FDV (Fully Diluted Valuation) 定义 |

---

## 6. 箭头实现对比（系统① vs 系统②）

| 维度 | 系统① TooltipCalloutArrow | 系统② IncentiveTooltip |
|---|---|---|
| **绘制方式** | SVG `<path fill>` + `<path stroke>` | SVG `<path fill>` + `<path stroke>` |
| **路径格式** | `M9 0 L0 8 L9 16 Z` (fill) / `M9 0 L0 8 L9 16` (stroke) | `M0 10 L8 0 L16 10 Z` (fill) / 同形 (stroke) |
| **底边** | 不描边（无 seam） ✅ | 不描边（无 seam） ✅ |
| **方向** | 4 方向，CSS `group-data-[side=...]/tt:` 选中 | 2 方向，React state + `rotate-180` |
| **flip 触发** | Radix `avoidCollisions`，自动写 `data-side` | 自定义 `spaceBelow/spaceAbove + flipThreshold` |
| **箭头沿 body 边位移** | 固定居中 | 动态跟随 trigger 中心，clamp 到有效范围 |
| **可被关闭** | 无 — hover 即显示 | 视口 clamp > 6px 时隐藏 |
| **DOM 数量** | 4 个 SVG（3 个 hidden） | 1 个 SVG |
| **z-index** | 箭头 `z-20` 在 body 之上 | 同级，无 mask 需求 |
| **API** | `<TooltipCalloutArrow />`（`side` prop 已废弃） | 内部组件，无对外 API |

---

## 7. 核心实现要点

### 7.1 SVG 双 path 模式（关键）

```tsx
<svg viewBox="0 0 9 16" width="9" height="16">
  {/* fill path：闭合三角形的填充 */}
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
  与 body 接合处出现一道 1px 的"双线" / seam。
- 拆成 fill 和 stroke 两条 path 后，stroke 那条**不写 `Z`**，底边就只填充不描边。

### 7.2 自动 flip：Radix `data-side` + Tailwind `group-data` variant

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
变成 left，`data-side` 会同步变成 `"left"`，对应的左侧箭头自动显示。
**调用方无需任何改动。**

### 7.3 `TooltipCalloutArrow` 的 `side` prop 已废弃

```tsx
const TooltipCalloutArrow = (_props: { side?: 'top' | 'bottom' | 'left' | 'right' }) => {
  // side prop 仅作 API 向后兼容，运行时被忽略
};
```

- 历史调用 `<TooltipCalloutArrow side="right" />` 已清理为 `<TooltipCalloutArrow />`。
- 箭头方向完全由 Radix 的 `data-side` 属性自动驱动。

---

## 10. 排序下拉菜单宽度规范（Sort Dropdown Width）

> 适用范围：桌面端 `DesktopSortMenuPortal` + 移动端 `MobileSortMenu`。
> 编写背景：2026-05 统一两端排序下拉框的宽度策略，去掉多余的 `minWidth` 约束。

### 规范

| 属性 | 桌面端 | 移动端 |
|---|---|---|
| **宽度模式** | `w-max`（内容驱动） | `w-max`（内容驱动） |
| **最大宽度** | `max-w-[min(18rem,calc(100vw-2rem))]` | `max-w-[min(18rem,calc(100vw-1.5rem))]` |
| **定位方式** | `fixed` + `createPortal` 到 body | `absolute` 相对 trigger |
| **禁止项** | ~~`minWidth` 固定值~~ | ~~`minWidthClassName` 最小宽度类~~ |

### 设计原则

- **内容驱动宽度**：菜单宽度由最宽选项的 label 决定，不用 `minWidth` 兜底。
  排序选项文字天然较短（「Total APY」「Incentive APY」等），不会出现过于窄小的菜单。
- **视口安全上限**：`max-w` 保证菜单在窄视口/极端场景下不溢出。
- **两端策略一致**：桌面和移动使用相同的 `w-max` + `max-w` 模式，差异仅在于定位方式。

### 实现

| 文件 | 组件 | 关键样式 |
|---|---|---|
| [ReservesTableDesktopHeader.tsx](../../src/components/dashboard/ReservesTableDesktopHeader.tsx) | `DesktopSortMenuPortal` | `w-max max-w-[min(18rem,calc(100vw-2rem))]` |
| [ReservesTableMobileSortBar.tsx](../../src/components/dashboard/ReservesTableMobileSortBar.tsx) | `MobileSortMenu` | `w-max max-w-[min(18rem,calc(100vw-1.5rem))]` |

---

## 11. 修复经验回顾（Debugging Lessons）

| 阶段 | 尝试 | 结果 | 教训 |
|---|---|---|---|
| 1 | 旋转 45° div + bg-card mask 线遮罩 body 左边框 | 在 size 列 hover 时出现可见"双线" | mask 线的 11px 长度无法精确匹配旋转后菱形对角线 ~14px |
| 2 | 改为单层旋转 div + z-20 直接覆盖 body 边框 | 边框依然有微弱可见 seam | div + 1px CSS border 在旋转后会有 sub-pixel 渲染 artifact |
| 3 | 旋转 div 中心精确落在 body 外边缘 | 视觉接近无 seam，但仍有"shoulder"细节 | CSS 旋转 border 仍非完美 |
| 4 | **改用 SVG 双 path（fill+stroke 分离，stroke 不画底边）** | **完美无 seam，与 IncentiveTooltip 实现完全统一** | SVG 矢量无 sub-pixel 模糊；分离 fill/stroke 是消除 seam 的根本方法 |
| 5 | Tailwind JIT 模板字符串 `bg-background/${opacity}` | IncentiveTooltip 移动端遮罩不可见（`bg-background/20` 未在别处静态引用） | **Tailwind JIT 只能识别完整静态类名字符串**。动态构造 opacity modifier 必须改用 inline style：`style={{ backgroundColor: 'hsl(var(--background) / opacityValue)' }}` |

**核心结论**：CSS 旋转 div 模拟箭头先天有 sub-pixel + border join 问题，不要再走这条路；
统一使用 SVG 双 path 模式。

---

## 12. 验收清单（Acceptance Checklist for Changes）

修改任意 tooltip 实现时，必须验证：

- [ ] 在 1440×900 desktop 视口下 hover size 列 cap 进度环，箭头与 body 无 seam
- [ ] 在窄视口（≤900px）或将 trigger 推至右边缘时，tooltip flip 到左侧后，
      **箭头自动出现在 body 右侧并指向右**
- [ ] 暗色模式下箭头 fill / stroke 与 body 完全同色（依赖 `hsl(var(--card))`，
      不要硬编码颜色）
- [ ] 系统①：所有 `TooltipContent` 的 `side` prop 符合 §3 排版规范
- [ ] 系统①：所有 `TooltipCalloutArrow` 不传 `side` prop
- [ ] 系统②：激励 badge 点击能打开，遮罩点击能关闭，移动端为 bottom sheet
- [ ] 系统③：`DesktopTooltip` hover 正常出现/消失，`MobileTooltip` 点击正常
- [ ] 排序下拉框：两端均使用 `w-max` 内容驱动宽度，无 `minWidth` 残留
- [ ] 排序下拉框：桌面端 `max-w-[min(18rem,calc(100vw-2rem))]`，移动端 `max-w-[min(18rem,calc(100vw-1.5rem))]`
- [ ] `npm run lint && npm test && npx tsc --noEmit && npm run build` 全过
- [ ] Tailwind JIT：所有动态构造的类名（如 `bg-${color}/${opacity}`）已改用 inline style

---

## 13. 关联文件

- 系统① 实现：[src/components/ui/tooltip.tsx](../../src/components/ui/tooltip.tsx)
- 系统② 实现：[src/components/dashboard/IncentiveTooltip.tsx](../../src/components/dashboard/IncentiveTooltip.tsx)
- 移动端底部抽屉共享组件：[src/components/dashboard/BottomSheet.tsx](../../src/components/dashboard/BottomSheet.tsx)
- 系统③ 实现：[src/components/dashboard/AprApyToggle.tsx](../../src/components/dashboard/AprApyToggle.tsx)（`DesktopTooltip` / `MobileTooltip`）
- 排序下拉框 桌面端：[src/components/dashboard/ReservesTableDesktopHeader.tsx](../../src/components/dashboard/ReservesTableDesktopHeader.tsx)（`DesktopSortMenuPortal`）
- 排序下拉框 移动端：[src/components/dashboard/ReservesTableMobileSortBar.tsx](../../src/components/dashboard/ReservesTableMobileSortBar.tsx)（`MobileSortMenu`）
- 系统① 调用方（`side="right"`）：
  - [src/components/dashboard/CapProgressRing.tsx](../../src/components/dashboard/CapProgressRing.tsx)
  - [src/components/dashboard/BorrowCapProgressRing.tsx](../../src/components/dashboard/BorrowCapProgressRing.tsx)
  - [src/components/dashboard/DeficitLiquidityRing.tsx](../../src/components/dashboard/DeficitLiquidityRing.tsx)
  - [src/components/dashboard/DesktopReserveRow.tsx](../../src/components/dashboard/DesktopReserveRow.tsx)（deficit 部分）
- 系统① 调用方（`side="top"`）：
  - [src/components/dashboard/UtilizationIndicator.tsx](../../src/components/dashboard/UtilizationIndicator.tsx)
  - [src/components/dashboard/DesktopReserveRow.tsx](../../src/components/dashboard/DesktopReserveRow.tsx)（利用率部分）
  - [src/components/dashboard/MobileReserveCard.tsx](../../src/components/dashboard/MobileReserveCard.tsx)（利用率部分）
- 系统① 调用方（`side="bottom"`）：
  - [src/components/ThemeToggle.tsx](../../src/components/ThemeToggle.tsx)
- 系统③ 调用方：
  - [src/components/dashboard/InkAprCalculator.tsx](../../src/components/dashboard/InkAprCalculator.tsx)
- 设计系统总览：[docs/design/DESIGN-SYSTEM-REFERENCE.md](./DESIGN-SYSTEM-REFERENCE.md)
- 前端交互守则：[docs/design/frontend-interaction-guardrails.md](./frontend-interaction-guardrails.md)
- Frozen/Paused 语义规范：[docs/conventions/frozen-paused-semantics.md](../conventions/frozen-paused-semantics.md)
