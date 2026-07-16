# Spec: Mobile Portfolio Simulation 审计修复

**来源**: `docs/design/mobile-portfolio-audit-2026-07.md` (impeccable audit, 11/20)
**决策日期**: 2026-07-16
**Linear Issue**: [AAV-1182](https://linear.app/aaveapy/issue/AAV-1182/mobile-portfolio-simulation-审计修复p0-p3)

---

## Problem Statement

移动端 Portfolio Simulation 卡片存在多个设计系统违规和可访问性缺陷，导致：
1. Token symbol 被尾部截断，丢失关键信息
2. 4/6 交互元素触控目标 < 44px，移动端难以准确点击
3. 多个元素使用 `hover:` 无移动端 guard，触摸设备无视觉反馈
4. framer-motion 动画无 reduced-motion 支持，违反无障碍承诺
5. Pill tabs 缺 ARIA tablist 语义，屏幕阅读器无法识别
6. Incentive 值使用渐变文字，与桌面端不一致且违反 impeccable 绝对禁令
7. Summary 缺少 Supply/Borrow 的 $/day 分项，与桌面端信息不对等

## Solution

对 MobilePortfolioCard 和共享的 PortfolioTablePrimitives 进行审计修复，所有改动通过 `md:` guard 确保桌面端行为不变。修复分为 P0（阻断性）、P1（重大）、P2（次要）、P3（打磨）四级。

**影响范围**：仅 Portfolio Simulation 移动端。共享文件（PortfolioTablePrimitives）的改动通过 `md:` 前缀保证桌面端不受影响。不涉及 ReservesTable、MobileReserveCard、SimulationSubRow 等其他组件。

## User Stories

1. 作为移动端用户，我希望 token symbol 完整显示不被截断，以便准确识别资产
2. 作为移动端用户，我希望所有可点击元素 ≥44px，以便准确触摸操作
3. 作为移动端用户，我希望按钮有 `active:` 视觉反馈，以便确认触摸成功
4. 作为开启了 reduced-motion 的用户，我希望展开/折叠动画被禁用或瞬时完成，以减少前庭不适
5. 作为屏幕阅读器用户，我希望 Pill tabs 有正确的 tablist 语义，以便了解当前选中的 side
6. 作为移动端用户，我希望 Incentive 值使用与桌面端一致的语义色，以便跨设备理解一致
7. 作为移动端用户，我希望 Summary 显示 Supply/Borrow 各自的 $/day，以便理解 net 的构成
8. 作为移动端用户，我希望卡片间有足够的间距，以便在快速滚动时区分卡片边界
9. 作为移动端用户，我希望展开按钮图标足够大，以便发现展开功能
10. 作为移动端用户，我希望 metrics strip 没有双重边框，以减少视觉噪音
11. 作为移动端用户，我希望 metrics strip 中的值不依赖 hover tooltip，以便在触摸屏上获取信息

## Implementation Decisions

### ID-1: Token symbol "never truncate" 修复（P0）
- 移除 token symbol span 上的 `truncate` class
- 改用 `break-words min-w-0`，遵循"优先单行、放不下时换行"规则
- 来源：DESIGN-SYSTEM-REFERENCE.md §3 强制规则
- 桌面端同列也有 `truncate`，本次只修移动端，桌面端后续单独处理

### ID-2: 触控目标 ≥44px 统一修复（P0）
- 4 个不达标元素统一使用 `min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0` + 负 margin 补偿
- 模式与 WarningMarker 已有实现一致（`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 -my-2 md:my-0`）
- 受影响元素：移除按钮、清除按钮（Eraser）、Pill tab、展开按钮
- 来源：PRODUCT.md "touch targets meet 44px minimum"；DESIGN-SYSTEM-REFERENCE.md §4

### ID-3: 渐变文字 → 实色（P1）
- Incentive 值从 `bg-clip-text text-transparent bg-gradient-to-r ...` 改为 `activeColor`（emerald/cyan 语义色）
- 与桌面端 PortfolioUnifiedTable 同列一致
- 来源：impeccable SKILL.md "Absolute bans"；DESIGN.md §8 跨端一致性

### ID-4: `hover:` → `active:` + `md:hover:` guard（P1）
- 3 个共享文件元素：$/T 切换、清除按钮、移除按钮（via PORTFOLIO_THEME）
- 模式：`active:bg-muted active:text-foreground md:hover:bg-muted md:hover:text-foreground`
- 移除按钮：不改 portfolioTheme.ts token，在 MobilePortfolioCard 内用 `active:` + `md:hover:` 覆盖
- 来源：AGENTS.md "移动端禁止 hover:"

### ID-5: Summary 加 $/day 分项（P1）
- 在 Summary 的 Supply/Borrow 区块下各加一行 `$/day`
- 数据源：PortfolioSummary.supplyUsdPerDay / borrowUsdPerDay（已确认存在）
- 与桌面端 tfoot 对齐

### ID-6: framer-motion reduced-motion 支持（P1）
- 用 `<MotionConfig reducedMotion="user">` 包裹 AnimatePresence
- framer-motion 自动检测 prefers-reduced-motion 并对所有子 motion 组件生效
- 仅扩展 import（`{ AnimatePresence, motion, MotionConfig }`），加 1 行 JSX 包裹
- 来源：PRODUCT.md "Reduced motion support for all animations"

### ID-7: Pill tabs ARIA tablist 语义（P1）
- 容器加 `role="tablist"`
- 每个 button 加 `role="tab"` + `aria-selected={activeTab === 'supply'/'borrow'}`
- 内容区域加 `role="tabpanel"` + `aria-labelledby`
- 来源：PRODUCT.md "Screen reader optimization with proper ARIA labels"；WCAG 4.1.2

### ID-8: MetricValue 移动端跳过 tooltip（P2）
- 给 MetricValue 加 `skipTooltip?: boolean` prop（默认 false）
- MobilePortfolioCard 传入 `skipTooltip={true}`
- 当 skipTooltip=true 时，MetricValue 渲染纯 span（无 Tooltip wrapper、无虚线下划线）
- 展开区域 DeltaRow 已完整覆盖 delta 信息，tooltip 在移动端冗余
- WarningMarker 保留 tooltip，需浏览器验证 tap 行为

### ID-9: Metrics strip ring → border/30（P2）
- 去掉 strip 的 `ring-1 ring-border/50`，改为 `border border-border/30`（降一级视觉权重）
- 或完全移除 ring 依赖 `divide-x` + 背景色区分

### ID-10: 卡片间距 space-y-3（P2）
- `space-y-2` (8px) → `space-y-3` (12px)

### ID-11: ListCollapse 图标 h-3.5 w-3.5（P3）
- `h-3 w-3` (12px) → `h-3.5 w-3.5` (14px)

### ID-12: 非标准透明度统一（P3）
- `text-foreground/75` → `text-foreground/70`

## Testing Decisions

### 测试 seam
最高 seam 是**组件渲染输出测试**——用 Vitest + React Testing Library 验证渲染出的 HTML 包含正确的 class/ARIA 属性。不测内部实现，测公共输出。

### 测试模块
1. **MobilePortfolioCard 新测试文件**（无现有测试，需新建）
   - ARIA tablist 属性存在性（role="tablist", role="tab", aria-selected, role="tabpanel"）
   - Token symbol span 不含 `truncate` class
   - `min-h-[44px]` 存在于触控元素
   - MotionConfig 包裹存在
   - 卡片间距 class 为 `space-y-3`
   - 渐变文字 class 不存在

2. **MetricValue skipTooltip prop 测试**（在 PortfolioTablePrimitives 测试中）
   - `skipTooltip=true` 时渲染纯 span（无 Tooltip 组件包裹、无虚线下划线）
   - `skipTooltip=false`（默认）时渲染 Tooltip 包裹（现有行为不变）

### 测试原则
- 只测外部行为，不 mock 内部协作者
- 期望值来自 spec / 已知好的字面量，不用与实现相同的方式重算
- 先写失败测试（red），再写最小实现使其通过（green）

### Prior art
- `PortfolioTablePrimitives` 无现有测试文件
- `SimulationSubRow.compact.test.tsx` 有 `role="table"` 测试先例
- `scrollExpandedSimulationIntoView.ts` 有 `prefers-reduced-motion` 检测先例

## Out of Scope

- 桌面端 PortfolioUnifiedTable 的 `truncate` 修复（同一规则违反，后续单独处理）
- Pill tabs 的 arrow key 键盘导航（先保证 ARIA 语义正确，键盘导航后续补）
- Pill tab 切换 fade-through 动画（功能正常，纯视觉打磨）
- Token header chain 标签在 320px 下的截断测试（风险低，后续验证）
- WarningMarker tap 行为验证（需浏览器测试，可与实现并行）
- framer-motion height:auto → transform:scaleY 性能优化（当前场景影响可控）

## Further Notes

- 所有共享文件（PortfolioTablePrimitives）的改动使用 `md:` guard 模式，桌面端行为 100% 不变
- portfolioTheme.ts 不改动——移除按钮的 `active:` 在 MobilePortfolioCard 内覆盖
- 原始设计文档 `mobile-portfolio-simulation.md` 中的触控目标计算有数学错误（`p-2 size-4` ≠ 44px），本 spec 使用 `min-h-[44px]` 显式保证
- 审计文档 `docs/design/mobile-portfolio-audit-2026-07.md` 是本 spec 的来源依据
