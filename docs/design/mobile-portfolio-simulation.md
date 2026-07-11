# Mobile Portfolio Simulation 设计方案

> 状态：Draft · 审视修订 v4
> 范围：Portfolio Simulation 移动端布局

## 1. 现状问题

当前 Portfolio 模式在移动端（<768px）直接复用 `PortfolioUnifiedTable`——12 列 `table-layout:auto` 表格，最外层只有 `overflow-x-auto` 水平滚动。总宽度 ~800px+，远超手机屏幕。

对比 Single mode 有完全独立的 `MobileReserveCard`（卡片式 + Supply/Borrow pill tabs + Hero APY + Bottom Sheet），Portfolio mode 没有等价的移动端适配。

### 当前移动端渲染结构

```
isMobile 分支 (ReservesTable L925-1018):
  ├─ scenarioControls
  │   ├─ Single mode: ScenarioControls + PortfolioModeToggle
  │   └─ Portfolio mode: PortfolioPanel（含搜索 + PortfolioUnifiedTable + Summary）
  ├─ ReservesTableMobileSortBar
  ├─ ReservesTableMobileGrid（2×2 卡片，MobileReserveCard）
  ├─ ReservesTableShowMore
  ├─ ReservesTableTooltipOverlay
  └─ ReservesTableFloatingScroll
```

注意：Portfolio mode 下 `PortfolioPanel`（含横向滚动表格）和 `MobileGrid`（2×2 reserve 卡片）**同时渲染**。改动只涉及 PortfolioPanel 内部的表格部分。

## 2. 设计原则

来源：AGENTS.md + PRODUCT.md + impeccable product register

| 原则 | 依据 |
|---|---|
| Mobile as First-Class Citizen | AGENTS.md — 禁止 `hover:`，改用 `active:`；浮层用 bottom sheet；触控目标 ≥44px |
| Dense but Breathable | AGENTS.md — 高信息密度保证可读性，4 层响应式压缩 |
| Progressive Disclosure | AGENTS.md + PRODUCT.md — 核心数据一眼可见，细节按需展开 |
| Consistent Affordances | impeccable product register — 同一视觉词汇跨屏幕一致，不要重新发明 |
| Structural Responsiveness | impeccable product register — 响应式是结构性切换，不是流式排版 |
| State-Only Elevation | DESIGN.md — 平面默认，阴影仅用于状态反馈 |

## 3. 方案概述

新建 `MobilePortfolioCard` 组件，在 `PortfolioPanel` 移动端替代 `PortfolioUnifiedTable`。同时增强 PortfolioUnifiedTable 内部的私有子组件（CompactInput、MetricValue、WarningMarker）的移动端适配。

**改动范围**：

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `MobilePortfolioCard.tsx` | 新建 | 卡片式移动端布局 |
| `PortfolioUnifiedTable.tsx` | 修改 | CompactInput 44px 触控、MetricValue tap 触发、WarningMarker 44px 触控 |
| `PortfolioPanel.tsx` | 修改 | 移动端用 MobilePortfolioCard 替代 PortfolioUnifiedTable |

**不影响 PortfolioPanel 以外的移动端**：
- `ReservesTable.tsx` 移动端分支逻辑不变
- `MobileReserveCard`、`ReservesTableMobileGrid` 不变
- `MobileSortBar`、`ShowMore`、`TooltipOverlay`、`FloatingScroll` 不变
- CompactInput / MetricValue / WarningMarker 是 PortfolioUnifiedTable 的私有组件，不会泄露到外部

**不改动**：
- 数据模型、hooks、计算逻辑
- 桌面端 `PortfolioUnifiedTable` 的渲染路径（CompactInput 等改动通过 CSS 响应式，桌面端行为不变）

## 4. 组件层级

```
PortfolioPanel (移动端)
 ├─ Header（标题 + wallet sync + 搜索 + 清空 + mode toggle）
 ├─ Wallet sync 状态提示
 ├─ MobilePortfolioCard × N     ← 新组件
 ├─ Summary div（内联）
 ├─ SearchPanel / PopularTokens
 └─ Snapshots / Compare

PortfolioPanel (桌面端，不变)
 ├─ PortfolioUnifiedTable
 │   ├─ CompactInput（加 CSS 响应式 44px 触控，桌面端不变）
 │   ├─ MetricValue（加 active: tap 触发，桌面端 hover 不变）
 │   └─ WarningMarker（加 44px 触控区域，桌面端不变）
 └─ ...
```

## 5. MobilePortfolioCard 布局

### 5.1 折叠态（默认）

```
┌─────────────────────────────────┐
│ [−] 🔵 USDC  Ethereum · v3     │  ← Token header
├─────────────────────────────────┤
│  Supply │ Borrow  (pill tabs)   │  ← Pill tabs
├─────────────────────────────────┤
│                                 │
│  $1,042 → [  1,500  ] [$/T] [×]│  ← CompactInput（复用，44px 触控）
│                                 │  钱包值+箭头在输入框左侧内联
│  5.23%    3.10% + 2.13%💡      │  ← 等权信息条（非 hero-metric）
│  Total    Native  Incentive     │     font-weight 区分，非 font-size
│                                 │
│  ▸ Details                      │  ← 展开按钮（44px 触控区域）
└─────────────────────────────────┘
```

### 5.2 展开态（Detail inline expand）

```
┌─────────────────────────────────┐
│ ... (折叠态内容不变) ...        │
│ ▾ Hide details                  │
├─────────────────────────────────┤
│  Native    3.10% → 3.15% +0.05 │  ← border-t 分割线 + 缩进 pl-3
│  Incentive 2.13% → 2.08% -0.05 │     无独立卡片边框
│  Total     5.23% → 5.23%  —    │
│  $/day        —    +$0.21      │
│  ⚠ Incentive limited to $1,000 │  ← Cap warning 在 detail 内
└─────────────────────────────────┘
```

### 5.3 关键设计决策

#### 5.3.1 等权信息条（非 hero-metric）

桌面端表格所有列等宽，Total/Native/Incentive 并列无层级差异。移动端应保持同样哲学：

- Total 用 `font-semibold`，Native/Incentive 用 `font-normal`
- 三者同一字号（`ds-text-13` 或 `ds-text-14`），同水平排列
- 不使用居中大字（22px hero），避免 hero-metric SaaS cliché

```
  5.23%    3.10% + 2.13%💡
  Total    Native  Incentive
  ↑semi    ↑normal ↑badge
```

#### 5.3.2 CompactInput 布局与桌面端一致

钱包值 + 箭头在输入框左侧内联，不做"钱包值上移到独立一行"——同一个组件在桌面和移动端应该保持一致的 affordance。

直接增强现有 CompactInput 的移动端触控目标，通过 CSS 响应式实现（`md:` 前缀），不引入 `isMobile` prop 分支。桌面端行为完全不变。

#### 5.3.3 Net $/day 不在 per-card 显示

桌面端有独立列放 Net $/day，移动端空间有限。Net 是跨侧聚合值，不属于 Supply 或 Borrow 任何一侧，放在 tab 切换的卡片内会引起归属困惑。

Net $/day 只在 Summary div 中显示。

#### 5.3.4 Detail 用 inline expand + 分割线

| 属性 | 定义 |
|---|---|
| 展开/收起 | 点击 "Details" 按钮 toggle（与 MobileReserveCard 的 simulation toggle 同一 affordance） |
| 自动收起 | 否——滚动时保持展开 |
| 动画 | `AnimatePresence` + `motion.div`，200ms ease-out |
| 降级 | `prefers-reduced-motion` → crossfade（0ms 位移，150ms opacity） |
| 分隔 | `border-t border-border/40`，与卡片主体之间 |
| 缩进 | `pl-3`（12px） |
| 背景 | 无独立背景，不使用嵌套卡片视觉 |
| Cap warning | 在 detail 区域内完整显示 |

为什么不用 bottom sheet：用户需要同时看到输入值和模拟结果来验证"输入了这个数字，得到那个利率"，bottom sheet 会遮挡输入区域。

为什么不用 3px 语义左边框：桌面端 detail 信息靠列分组 + band tint 区分侧别，没有左边框。侧别信息已由 pill tab 的 emerald/cyan 颜色传达，不需要在 detail 区域重复。

#### 5.3.5 用色与桌面端一致

| 元素 | 用色 | 依据 |
|---|---|---|
| Supply 数据 | emerald 系列 | 语义色规则 |
| Borrow 数据 | cyan 系列 | 语义色规则 |
| Cap warning（binding） | amber | 桌面端 `text-amber-600`，移动端一致 |
| Cap warning（informational） | muted-foreground | 桌面端一致 |
| Delta 负值 | red-500 | 语义=方向（减少），不是错误 |
| 箭头（effective < wallet） | red-500 | 语义=减仓方向，不是错误 |
| 中性数据 | text-foreground / text-muted-foreground | 禁止 text-gray-* |

## 6. Summary div（内联）

替代桌面端 tfoot 行。不建独立组件文件，在卡片列表底部内联渲染。视觉处理与桌面端一致——分割线 + 微调背景色。

```
── ── ── ── ── ── ── ── ── ── ──   ← border-t-2 border-border/60
│ bg-muted/30                       │
│  Supply              Borrow       │
│  $12,500             $3,200       │
│  4.2% wAPY           5.1% wAPY   │
│                                    │
│  Net $/day: +$1.23                │
│  Net effective: 3.8%              │
│                                    │
── ── ── ── ── ── ── ── ── ── ──
```

- 与桌面端 tfoot 视觉处理一致：`border-t-2 border-border/60 bg-muted/30`
- Supply/Borrow 两列用 `grid grid-cols-2`
- Net 跨列显示，中性色（`text-foreground`，非 emerald 非 cyan）
- Delta metric（`summary.totalSupplyUsdMetric` 等）通过虚线下划线 + tap tooltip 展示变化
- 不用独立卡片边框

## 7. PortfolioUnifiedTable 内部子组件移动端增强

CompactInput、MetricValue、WarningMarker 是 PortfolioUnifiedTable.tsx 的私有组件（不导出）。增强它们不影响 PortfolioPanel 以外的任何移动端组件。

### 7.1 CompactInput — 44px 触控目标

通过 CSS 响应式实现，桌面端行为完全不变：

| 元素 | 桌面端 | 移动端（<768px） |
|---|---|---|
| $/T 切换按钮 | `h-5 px-0.5`（~20×20px） | `h-11 w-11`（44×44px） |
| 清除按钮（Eraser） | `p-0.5 size-2.5`（~10×10px） | `p-2 size-4`（44×44px 触控区域） |
| 输入框 | `h-5`（20px） | `h-11`（44px） |
| 整体布局 | `gap-0.5 items-center` | `gap-1 items-center`（间距稍大，适应 44px 按钮） |

实现方式：Tailwind `md:` 前缀控制尺寸差异。例如：
```
className="h-5 md:h-5 h-11"  → 桌面端 h-5，移动端 h-11
```

### 7.2 MetricValue — tap 触发 tooltip

桌面端用 `hover` 显示 tooltip，移动端无 hover。

方案：TooltipTrigger 同时响应 hover 和 tap。Radix Tooltip 默认支持 pointer 交互，只需确保 `disableHoverableContent` 不被设置。移动端用户 tap 虚线下划线的值即可触发 tooltip。

Tooltip 方向改为 `side="top"` 避免被手指遮挡。

### 7.3 WarningMarker — 44px 触控区域

圆点视觉不变（6px），但外层 `span` 的点击区域扩展到 44×44px。

实现方式：`inline-flex items-center justify-center min-w-[44px] min-h-[44px] -my-2`，负 margin 对齐使其不占用额外布局空间。触发方式从 hover 改为与 MetricValue 一致的 pointer 交互。

### 7.4 其他触控目标

MobilePortfolioCard 内的元素：

| 元素 | 尺寸 |
|---|---|
| Minus/EyeOff 移除按钮 | 44×44px 触控区域（`p-2` 补足） |
| Pill tab 区域 | 100%×36px（`py-2`） |
| Details 展开按钮 | 全宽 + 44px 高 |

## 8. 状态完整性

| 状态 | MobilePortfolioCard | Summary div |
|---|---|---|
| **Default** | 正常数据显示 | 正常数据显示 |
| **Loading** | 骨架屏（复用 PortfolioPanelSkeleton） | 不显示（等数据加载完） |
| **Empty** | PortfolioPanel 的 empty state 组件 | 不显示 |
| **Error / Orphan** | `opacity-60` + 灰色 token symbol（与桌面端一致） | 不显示 |
| **Disabled input** | `opacity-40` + tooltip 说明（与桌面端一致） | 不显示 |
| **Hidden entry** | `opacity-40` + EyeOff 图标（与桌面端一致） | 不显示 |

## 9. 实现路径

| 步骤 | 内容 | 文件 |
|---|---|---|
| 1 | `MobilePortfolioCard`（卡片主体 + detail expand + 等权信息条） | 新文件 `src/components/dashboard/MobilePortfolioCard.tsx` |
| 2 | CompactInput 移动端触控增强（CSS 响应式 44px） | 修改 `PortfolioUnifiedTable.tsx` |
| 3 | MetricValue 移动端 tap 触发 | 修改 `PortfolioUnifiedTable.tsx` |
| 4 | WarningMarker 44px 触控区域 | 修改 `PortfolioUnifiedTable.tsx` |
| 5 | `PortfolioPanel.tsx` 移动端集成 | 修改：移动端用 MobilePortfolioCard 替代 PortfolioUnifiedTable |

步骤 2-4 可以与步骤 1 并行开发（互不依赖），步骤 5 是最终集成。

## 10. 风险评估

| 风险 | 级别 | 缓解 |
|---|---|---|
| CompactInput CSS 响应式影响桌面端视觉 | 低 | `md:` 前缀精确控制，桌面端尺寸不变。改动后需在桌面端浏览器验证 |
| MetricValue tap 触发与桌面端 hover 行为冲突 | 低 | Radix Tooltip 原生支持 pointer + hover 共存，桌面端 hover 行为不受影响 |
| MobilePortfolioCard 视觉与 MobileReserveCard 不一致 | 中 | 参考 MobileReserveCard 的视觉模式（pill tabs、header 布局、expand 按钮），实现后对比验证 |
| PortfolioPanel 移动端改动影响桌面端 | 低 | 改动仅在 `isMobile` 条件内，桌面端不受影响 |
| PortfolioPanel 以外的移动端受影响 | 无 | CompactInput / MetricValue / WarningMarker 是 PortfolioUnifiedTable 私有组件，不泄露到外部；ReservesTable 移动端分支、MobileReserveCard 不动 |

## 11. 与桌面端的对应关系

| 桌面端 | 移动端 | 一致性 |
|---|---|---|
| 12 列 PortfolioUnifiedTable | MobilePortfolioCard 卡片 | 结构性切换（合理） |
| Supply/Borrow 并排列 | Pill tab 切换 | 结构性切换（与 MobileReserveCard 一致） |
| tfoot 行（`border-t-2 bg-muted/30`） | Summary div（`border-t-2 bg-muted/30`） | ✅ 视觉一致 |
| CompactInput 钱包值左侧内联 | CompactInput 钱包值左侧内联 | ✅ 布局一致 |
| CompactInput ~20px 按钮 | CompactInput 44px 按钮 | 尺寸差异（触控要求） |
| WarningMarker 小圆点 + hover tooltip | WarningMarker 小圆点 + tap tooltip | 触发方式不同，输出一致 |
| MetricValue 虚线下划线 + hover tooltip | MetricValue 虚线下划线 + tap tooltip | 触发方式不同，输出一致 |
| Cap warning amber | Cap warning amber | ✅ 用色一致 |
| Delta 负值 red | Delta 负值 red | ✅ 用色一致 |
| 语义色 emerald/cyan | 语义色 emerald/cyan | ✅ 用色一致 |

## 附录：已否决的设计

| 方案 | 否决原因 |
|---|---|
| 共享子组件抽取（MobilePillTabs / MobileTokenHeader / MobileHeroApy） | MobileReserveCard 931 行已稳定，强行抽取增加回归风险。两个卡片数据源差异大，视觉相似不代表代码可共享。后续如果出现第三个消费者再抽 |
| MobilePortfolioSummary 独立组件文件 | 就一个 div + 两个 grid row，内联即可 |
| 搜索全屏 overlay | 现有可用，后续优化 |
| 3px 语义左边框 | 桌面端无此词汇，pill tab 已传达侧别信息，不需重复 |
| "浏览全部市场"按钮 | reserve grid 在下方自然滚动可达 |
| PortfolioInput 独立组件 | CompactInput 是私有组件，直接改它比维护两套输入逻辑更好。CSS 响应式区分桌面/移动端触控尺寸 |
