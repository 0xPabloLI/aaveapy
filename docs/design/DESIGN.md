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
- Supply：`ds-text-emerald-500`（桌面端 Reserves 表 **Supply APY 主值** 与 **Supply Size** 同色）、`ds-bg-emerald-500-10`
- Borrow：`ds-text-brand-cyan`、`ds-bg-brand-cyan-10`
- 桌面 Reserves **Size** 列 Supply/Borrow 金额：`font-medium tabular-nums`，与 cap 环 Tooltip 内数字权重一致
- Spread：`ds-text-purple-600`
- 警告：amber 系
- **层级**：主 APY 粗体 + 语义色；**Size** 与主色满饱和 + `font-medium`；Native/Incentive 为 `ds-text-11` + `*-70`（**与 Size 不同层级**）；**Spread** 桌面 `font-bold`；Util 圆点略大、**不默认描边**（见 `frontend-interaction-guardrails.md`）
- **移动/桌面一致**：储备卡 Size、tab、cap sheet 与桌面同一 `emerald-500` / `brand-cyan` token

## 3. 排版
- Sans：Source Sans Pro | Mono：Source Code Pro
- 尺度：`ds-text-11` ~ `ds-text-24`
- 数值：`tabular-nums`
- APY：主值 `font-bold`；次级 native 可用 `font-medium`；不堆叠过多同色透明度档位

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
- Markets 选项来源 `buildMarketsList`：按 **`marketName`** 字母序（`localeCompare`，`sensitivity: 'base'`）；`FilterBar` 仍先渲染 Ethereum 再其他链，各段内保持该顺序。
- 桌面 **Reserves 表**「Market」列表头可点击排序：按 **`marketName`** 字母序，同市场内再按 **`tokenSymbol`**；默认升序，再次点击切换降序（与 Token 列交互一致）。

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
| **分段控件** | 轨道容器 `mx-3` + `bg-muted/40 rounded-lg p-0.5`；内层 segment 文字相对卡片左缘 ≈ **12px（边距）+ 2px（轨道内边距）= 14px**。 |
| **价格 + 规模** | 整行 **`px-3.5`（14px）**，使 **价格数字左缘**与 **segment 标签文字左缘**同列；不要用 `px-3`（12px），否则价格会比「Supply/Borrow」文字偏左约 2px，看起来像「突出」。 |
| **规模 + cap 圆环** | 带 cap 的按钮用 **`pl-1 pr-0`**：去掉右侧 `px-1`，否则圆环相对行右内边距会「缩进」一格；行本身已有 `px-3.5` 保证与卡片右缘间距。 |
| **Hero APY** | 居中，不强制与 14px 文字列对齐。 |
| **Spread 展开条** | 外层与价格行同宽：`px-3.5`；条内 `rounded-lg`、`py-1.5`，水平 `px-3` 仅在按钮内侧；展开态 `border-2`，收起态 `border`。 |
| **展开模拟区** | 与价格行同一水平常量：**`px-3.5`**，与 `SimulationSubRow` 表格列对齐。 |

**不要**给分段控件再套一层与 `mx-3` 重复的水平边距。Token 标题行仍为 **`px-3`**（图标与名称；可与 segment 左缘差 2px，属预期）。

### 4.7 Merkl 白名单激励（按 campaign）

- 仅 **Merkl 且 `whitelistOnly`** 的活动需用户自行选择是否计入全站激励汇总。
- **默认**：不勾选任何项（白名单 APR **不计入**表格、Top Opportunities、模拟等）。
- **勾选**：按 **`campaignId`** 逐项勾选；无 `campaignId` 的白名单条目共用同一 opt-in（在 `whitelistMerklCampaignIds` 内用内部 sentinel，与真实 id 并列）。激励详情 Tooltip 与（若启用）Merkl Forecast 面板对可勾选项统一使用 **「Include as WL user」**，表示用户确认自己是白名单参与者并要把该活动计入汇总。
- 完整规则与实现位置见 **[frontend-interaction-guardrails.md](frontend-interaction-guardrails.md)** § *Merkl whitelist-only campaigns*。

### 4.8 Tydro 与 Merkl「点数」术语

- **Tydro**：仅 **Merkl** 的 API 字段 **`pointsPerThousandUsd`**（按千刀点数）在 `tydro.ts` 中按 Tydro 曲线换算 APR；顶栏 **`tydroPointToUsdRate`** 调节该曲线。详见 **[rate-calculation-formulas.md](../rate-calculation-formulas.md)** § *Terminology: Tydro points vs other “points”*。
- **不是**所有界面上的「points」都指 Tydro（例如 Ink FDV 滑块上的参考点、CSS `pointer-events` 等与激励无关）。
- **ACI / Brevis / 协议激励**不含 `pointsPerThousandUsd`，不称 Tydro points。
- **文案**：表格与 Tooltip 常汇总为 **Merkl** / **Merkl Incentive**；不必每条都写「Tydro points」，仅在说明点数曲线或全局点数换算时再用 Tydro。

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
