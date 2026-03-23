# Design System: Aave APY

> **可复用设计习惯与完整交互规范**见 **[DESIGN-SYSTEM-REFERENCE.md](DESIGN-SYSTEM-REFERENCE.md)**（同目录，Tooltip/光标/开关/色彩语义/移动端/无障碍等）。其他项目可直接复制该文档作为设计参考。下面为本项目视觉与组件概要。

## 1. 视觉主题
- 浅色：温暖雾白基底 + 金色主调 + 品牌渐变（洋红→青绿）
- 暗色：深炭黑背景 + 高对比金色，保持相同圆角与层级

## 2. 色彩体系

### 语义色
| 用途 | Light | Dark |
|------|-------|------|
| 背景 | #f3f3f2 | #111317 |
| 正文 | #1c1917 | #f5f5f4 |
| 卡片 | #f8f8f7 | #1b1d22 |
| 边框 | #d3d1cf | #32363e |

### 品牌色
- 主色：琥珀金 `--primary`
- 品牌渐变：`--ds-brand-magenta-rgb` → `--ds-brand-cyan-rgb`

### 数据色
- Supply：`ds-text-emerald-600`、`ds-bg-emerald-500-10`
- Borrow：`ds-text-brand-cyan`、`ds-bg-brand-cyan-10`
- Spread：`ds-text-purple-600`
- 警告：amber 系

## 3. 排版
- Sans：Source Sans Pro | Mono：Source Code Pro
- 尺度：`ds-text-11` ~ `ds-text-24`
- 数值：`tabular-nums`

## 4. 组件规范

### 4.1 输入框
**CSS 类：`ds-input-surface`**
```css
@apply rounded-md border border-border/50 bg-card/50;
@apply focus:border-[rgb(var(--ds-brand-magenta-rgb))];
```
- 高度：移动端 `h-[2.75rem]`，桌面 `h-8` 或 `h-7`
- 字号：移动端 `ds-text-11`，桌面 `ds-text-12`

### 4.2 按钮

#### 次级按钮 `ds-btn-secondary`
适用：Clear 等非主要操作
```css
@apply rounded-md border border-border/50 bg-card/50;
@apply text-muted-foreground hover:text-foreground;
@apply hover:bg-accent/60 disabled:opacity-40;
```

#### 警告按钮 `ds-btn-warning`
适用：Adjust to max 等纠正操作
```css
@apply rounded-md border border-amber-500/50;
@apply bg-amber-100 dark:bg-amber-900/50;
@apply text-amber-800 dark:text-amber-200;
```

#### 分段控制器（Segmented Control）
适用：USD/Token、APR/APY 切换
- 容器：`bg-muted/60 rounded-lg p-0.5 border border-border/40`
- 选中：`bg-card shadow-sm border border-border/60 font-semibold`
- 未选中：`text-muted-foreground hover:bg-card/50`

#### 筛选芯片 `ds-chip`
适用：Token 类别、Markets 筛选
- 选中：`border-[rgb(var(--ds-brand-magenta-rgb))] ds-text-brand-magenta`
- 未选中：`border-border text-foreground/80`

### 4.3 卡片
- 玻璃卡：`glass-card`（blur + 半透明）
- 圆角：`rounded-xl`
- 内边距：`ds-card-pad`（桌面）、`ds-card-pad-sm`（移动）

### 4.4 Tooltip
- 通用提示：`@/components/ui/tooltip`，中性底色
- 激励详情：`DesktopTooltip`/`MobileTooltip`，品牌底色

### 4.5 信息图标间距
- 类：`ds-info-inline`
- 间距：移动端 4px，`sm+` 为 6px

### 4.6 移动端储备卡片（`MobileReserveCard`）内容栏

与 **Supply / Borrow** 分段控件对齐，避免「价格/规模一行比按钮区更宽」的错位感：

| 区域 | 规则 |
|------|------|
| **分段控件** | 全宽，容器 `bg-muted/40 rounded-lg p-0.5`；内层按钮相对轨道再缩进 2px。 |
| **价格 + 规模、Hero APY、Spread** | 包在同一列 `flex flex-col gap-2`，并加 **`px-0.5`**（与轨道 `p-0.5` 一致），使文字左缘与 **选中 segment 内容**左缘对齐。 |
| **Spread 展开条** | `w-full`、`rounded-lg`、`min-h-[44px]`（触控目标）、水平 `px-[var(--ds-space-3)]`；文案与数值均 `ds-text-12`、`tabular-nums`；展开态 `border-2`，收起态 `border`。 |
| **展开模拟区** | 在 `ds-card-pad-sm` 内再包一层 **`px-0.5`**（与上栏同一常量），使输入区与价格行左右对齐。 |

**不要**给分段控件再套一层额外水平 `px`（会与上述内栏重复缩进）。Token 标题行保持全宽，不缩进。

## 5. 布局原则
- **文字与边框须有间距（强制）**：所有带边框的容器内，文字与边框之间必须保留至少 `--ds-space-2`（8px）的内边距，不得贴边。卡片、表格单元格、警告条、按钮等均需遵守。
- 移动优先，触控目标 ≥ 44px
- 间距变量：`ds-space-*`（4px 基准）
- 容器：`container`，最大宽 1400px

## 6. 交互规范
- 动画：0.2–0.4s，缓动 `[0.25, 0.1, 0.25, 1]`
- 列表 stagger：`delay: 0.2 + i * 0.08`
- 加载态：skeleton + shimmer
- 焦点：`focus-visible:ring-2`
