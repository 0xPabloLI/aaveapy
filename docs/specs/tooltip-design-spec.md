# Tooltip 设计规范

## 概述

项目中有两种 Tooltip 实现，各自适用于不同的场景。本规范总结它们的使用场景、技术特性、API 约定及测试要求。

---

## 1. Radix Tooltip（轻量信息提示）

**实现位置**: `src/components/ui/tooltip.tsx`  
**依赖**: `@radix-ui/react-tooltip`

### 适用场景
- 简短文字说明（帮助提示、术语解释）
- 单一信息点展示
- 跟随触发元素的小提示
- 最大内容量：不超过 3 行文字

### 技术特性

| 特性 | 说明 |
|------|------|
| **移动端** | 自动切换到底部显示（`side="bottom"`） |
| **桌面端** | 支持四方向智能定位（top/bottom/left/right），带碰撞检测 |
| **最大宽度** | `max-w-[18rem]`（288px） |
| **动画** | 桌面端：`fade-in-0 zoom-in-95`；移动端：`fade-in-0 slide-in-from-bottom-4` |
| **样式** | `border-border/60 bg-card ds-text-14 shadow-sm` |
| **圆角** | `rounded-md` |

### 核心组件

```typescript
TooltipProvider      // 包裹整个应用（必须在 App 顶层）
Tooltip              // Root 容器，控制显隐状态
TooltipTrigger       // 触发元素（按钮、图标等）
TooltipContent       // 内容区，自动处理定位和动画
TooltipArrow         // 基础 Radix 箭头
TooltipCalloutArrow  // 增强箭头，跟随碰撞检测自动翻转
```

### 使用示例

```tsx
<Tooltip>
  <TooltipTrigger>
    <HelpIcon className="w-4 h-4" />
  </TooltipTrigger>
  <TooltipContent side="top">
    简短说明文字
    <TooltipCalloutArrow side="top" />
  </TooltipContent>
</Tooltip>
```

### Props 约定

```typescript
interface TooltipContentProps {
  sideOffset?: number;          // 默认 4px
  side?: 'top' | 'bottom' | 'left' | 'right'; // 桌面端建议方向
  className?: string;           // 自定义样式（覆盖基础样式）
}
```

### 注意事项
1. 必须在应用顶层包裹 `TooltipProvider`
2. 移动端不需要手动处理定位，组件自动适配
3. 内容不宜过长，超过 3 行应使用其他组件（如 BottomSheet）

---

## 2. Incentive Tooltip（详细信息浮层）

**实现位置**: `src/components/dashboard/IncentiveTooltip.tsx`  
**封装层**: `src/components/dashboard/ReservesTableTooltipOverlay.tsx`

### 适用场景
- 复杂的激励明细展示（Protocol/ACI/Merkl/Brevis）
- 多数据源分组聚合
- 需要交互操作（Whitelist 开关、外部链接）
- 需要滚动查看的长内容

### 技术特性

| 特性 | 移动端 | 桌面端 |
|------|--------|--------|
| **渲染方式** | `BottomSheet` 底部弹出 | `fixed` 定位浮层 |
| **最大宽度** | 全屏宽度 | `max-w-[520px]` |
| **最小宽度** | - | `min-w-[320px]` |
| **定位计算** | 无需定位 | 基于 `position` + `triggerCenterX` + 滚动偏移 |
| **碰撞处理** | 无需处理 | 自动翻转（top/bottom），严重裁剪时隐藏箭头 |
| **Portal** | 可选 `usePortal` | 可选 `usePortal` |
| **动画** | BottomSheet 自带 | `fade-in-0 zoom-in-95` + 滑动 |

### 核心数据结构

```typescript
interface TooltipState {
  reserve: ReserveWithSpread;           // 储备资产数据
  type: 'supply' | 'borrow';            // 类型（决定配色和边框）
  position: { x: number; y: number };   // 触发元素位置
  triggerCenterX: number;               // 触发元素中心 X 坐标
  triggerHeight: number;                // 触发元素高度
  triggerRect: {                        // 触发元素完整边界
    top, bottom, left, right, width, height
  };
}
```

### Props 约定

```typescript
interface IncentiveTooltipProps {
  reserve: ReserveWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  triggerHeight?: number;
  triggerRect?: { top, bottom, left, right, width, height };
  onClose: () => void;
  isApy?: boolean;                      // 默认 true
  usePortal?: boolean;                  // 默认 false
  accentBorderClass?: string;           // 左侧强调色边框
  accentTextClass?: string;             // 强调色文字
  accentBgClass?: string;               // 强调色背景
  tydroPointToUsdRate: number;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
  forecastStates?: Record<string, MerklForecastWireItem>;
}
```

### 使用方式

```tsx
// 通过 Overlay 封装层使用
<ReservesTableTooltipOverlay
  tooltipState={selectedTooltip}
  onClose={() => setSelectedTooltip(null)}
  isApy={true}
  tydroPointToUsdRate={rate}
  whitelistMerklCampaignIds={whitelistIds}
  onToggleWhitelistMerklCampaign={handleToggle}
  forecastStates={forecastStates}
/>
```

### 注意事项
1. 需要配合 `tooltipPosition.ts` 处理滚动偏移
2. 桌面端需要点击背景遮罩关闭
3. 移动端使用 BottomSheet，支持手势下滑关闭
4. 内容按激励源分组展示（Protocol → ACI → Brevis → Merkl）

---

## 3. 箭头规范

### 概述

箭头有两种实现方式，需要分别遵循不同的规范。

### 3.1 Radix `TooltipCalloutArrow`

**实现位置**: `src/components/ui/tooltip.tsx` (L96-L151)

#### 技术特性

| 特性 | 说明 |
|------|------|
| **实现方式** | 4 个 SVG 方向箭头 + `group-data-[side=...]` 自动切换显隐 |
| **尺寸** | 16x9（水平方向）或 9x16（垂直方向） |
| **定位** | `absolute` + 负偏移（如 `left-[-8px]`） |
| **碰撞处理** | 自动跟随 Radix 碰撞检测翻转 |
| **填充色** | `fill="hsl(var(--card))"` |
| **描边** | `stroke="hsl(var(--border) / 0.6)"`，`strokeWidth="1"` |

#### 使用规则

```tsx
// ✅ 正确用法：配合 group/tt 上下文使用
<TooltipContent>
  内容
  <TooltipCalloutArrow side="top" />
</TooltipContent>

// ❌ 错误用法：脱离 Radix 上下文，箭头不会显示
<div>
  <TooltipCalloutArrow side="top" />
</div>
```

#### 四方向实现

```tsx
// 右侧 → 箭头指向左侧（在浮层左边）
className="hidden group-data-[side=right]/tt:block absolute left-[-8px]"

// 左侧 → 箭头指向右侧（在浮层右边）
className="hidden group-data-[side=left]/tt:block absolute right-[-8px]"

// 下方 → 箭头指向上方（在浮层顶部）
className="hidden group-data-[side=bottom]/tt:block absolute top-[-8px]"

// 上方 → 箭头指向下方（在浮层底部）
className="hidden group-data-[side=top]/tt:block absolute bottom-[-8px]"
```

### 3.2 Incentive Tooltip Arrow

**实现位置**: `src/components/dashboard/IncentiveTooltip.tsx` (L813-L825)

#### 技术特性

| 特性 | 说明 |
|------|------|
| **实现方式** | 单个 SVG + `tooltipPlacement` 状态控制 |
| **尺寸** | 16x10 固定 |
| **定位** | `absolute` + `arrowLeft` 动态计算（基于 `triggerCenterX`） |
| **碰撞处理** | 严重裁剪时（`clampedTop - desiredTop > 6px`）自动隐藏 |
| **填充色** | `CalloutArrowSvg` 组件复用 |
| **可见性控制** | `showTooltipArrow` 状态 |

#### 使用规则

```tsx
// 箭头自动根据 tooltipPlacement 调整方向
{showTooltipArrow && (
  <svg
    className={`absolute pointer-events-none ${
      tooltipPlacement === 'top' ? '-bottom-[10px] rotate-180' : '-top-[10px]'
    }`}
    style={{ left: `${arrowLeft}px`, width: '16px', height: '10px' }}
  >
    <CalloutArrowSvg fill="hsl(var(--card))" stroke="hsl(var(--border) / 0.6)" />
  </svg>
)}
```

### 箭头设计原则（通用）

1. **主题适配**: 始终使用 `hsl(var(--card))` 填充和 `hsl(var(--border) / 0.6)` 描边
2. **无障碍**: 必须设置 `aria-hidden` 和 `pointer-events-none`
3. **碰撞安全**: 当浮层被视口严重裁剪时，应隐藏箭头避免错位
4. **层级安全**: 箭头 `z-index` 必须高于浮层背景（通常 `z-20`）

---

## 4. 测试规范

### 4.1 Radix Tooltip 测试要点

- ✅ 渲染基本结构（Provider/Root/Trigger/Content）
- ✅ 移动端侧显示（`side="bottom"`）
- ✅ 桌面端四方向定位
- ✅ 动画类名正确应用
- ✅ 箭头组件跟随碰撞翻转
- ✅ 最大宽度限制

### 4.2 Incentive Tooltip 测试要点

- ✅ 移动端渲染 BottomSheet
- ✅ 桌面端渲染固定定位浮层
- ✅ 位置计算正确（含滚动偏移）
- ✅ 碰撞翻转逻辑（top/bottom）
- ✅ 箭头显示/隐藏条件
- ✅ 激励源分组和排序
- ✅ 背景遮罩点击关闭
- ✅ Portal 渲染

### 4.3 箭头测试要点

- ✅ SVG 路径正确生成
- ✅ 填充色和描边正确
- ✅ 四方向切换（group-data）
- ✅ 严重裁剪时隐藏
- ✅ 无障碍属性（aria-hidden, pointer-events-none）

---

## 5. AssetActionMenu Popover（Token 列操作菜单）

**实现位置**: `src/components/dashboard/AssetActionMenu.tsx`  
**依赖**: `@radix-ui/react-popover`（与 Market 列 Popover 一致）

### 适用场景
- Token 列点击 `↗` 图标触发的操作菜单
- 包含 Open on Aave（trailing Aave logo）/ Open on Tydro（trailing Tydro/Ink logo）/ View token on explorer / View pool on explorer / Copy address 等操作

### 技术特性

| 特性 | 移动端 | 桌面端 |
|------|--------|--------|
| **渲染方式** | `BottomSheet` 底部弹出 | Radix `Popover`（声明式定位） |
| **定位方式** | 无需定位 | `align="start"`, `sideOffset={6}`（与 Market 列一致） |
| **碰撞处理** | 无需处理 | Radix Floating UI 自动碰撞检测和翻转 |
| **宽度** | 全宽 | `w-[220px]` |
| **Portal** | 手动 `createPortal(document.body)` | Radix `PopoverPrimitive.Portal` |
| **动画** | BottomSheet 自带 | `fade-in-0 zoom-in-95` + 方向滑动 |

### 定位一致性

Token 列 `AssetActionMenu` 和 Market 列的外链 Popover 使用**相同的 Radix Popover 定位方式**：
- `align="start"`：以 trigger 左边缘为水平锚点
- `sideOffset={6}`：trigger 下方 6px 间距
- 碰撞检测由 Radix Floating UI 自动处理

### 菜单项布局一致性

两个 Popover 的菜单项布局保持一致：
- `justify-between` + `gap-3`：左侧图标+文字，右侧 trailing 元素
- Aave 链接项 trailing Aave logo（`/icons/tokens/aave.svg`）
- Tydro 链接项 trailing Tydro logo（`/icons/partners/tydro-logo.png`）
- Explorer 链接项 trailing chain icon（`getChainIconSrc`）
- Copy address 项 trailing 截断地址

---

## 6. 文件索引

| 文件 | 用途 |
|------|------|
| `src/components/ui/tooltip.tsx` | Radix Tooltip 组件及 CalloutArrow |
| `src/components/dashboard/IncentiveTooltip.tsx` | 激励详情浮层 |
| `src/components/dashboard/ReservesTableTooltipOverlay.tsx` | 表格浮层封装 |
| `src/lib/tooltipPosition.ts` | 滚动偏移计算 |
| `src/lib/tooltipPosition.test.ts` | 位置计算测试 |
| `src/components/ui/tooltip.test.tsx` | Radix Tooltip 测试 |
| `src/components/dashboard/IncentiveTooltip.test.tsx` | 激励浮层测试 |
| `src/components/ui/tooltip-arrow.test.tsx` | 箭头组件测试 |
| `src/components/dashboard/AssetActionMenu.tsx` | Token 列操作菜单（Radix Popover） |
| `src/components/dashboard/AssetActionMenu.test.tsx` | Token 列操作菜单测试 |
| `src/components/ui/popover.tsx` | Radix Popover 组件 |
