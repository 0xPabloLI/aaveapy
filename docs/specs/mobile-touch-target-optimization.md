# Spec: Mobile Touch Target Optimization

**来源**: `docs/design/mobile-touch-target-optimization.md` (设计文档)
**日期**: 2026-07-18
**Linear Issue**: AAV-12XX (pending)

---

## Problem Statement

移动端 Portfolio Simulation 有 7 个交互元素触控目标低于 44px（WCAG 2.5.8 / Apple HIG 不达标），4 个元素刚好 44px 但视觉偏大（视觉=触控无分离）。用户难以准确触摸，且紧凑数据面板视觉密度不够。

## Solution

采用"视觉小 + 触控热区大"策略：视觉元素保持 28-36px，触控热区通过三种模式补足到 44px。所有共享组件的改动仅在调用方进行，不改全局常量，避免影响全站。

## User Stories

1. 作为移动端用户，我希望所有可点击元素都 ≥44px 触控热区，以便准确触摸
2. 作为移动端用户，我希望视觉元素紧凑（28-36px），以便同一屏幕看到更多 token
3. 作为移动端用户，我希望输入框视觉更薄（36px），以便数据面板不显得厚重
4. 作为移动端用户，我希望 tab 视觉更矮（36px），以便紧凑面板里占地少
5. 作为无障碍用户，我希望所有交互元素满足 WCAG 2.5.8，以便合规使用

## Implementation Decisions

### ID-1: `touch-target-expand` 全局 CSS 工具类
- 在 `index.css` 添加 `.touch-target-expand::before` 工具类
- `content: ''; position: absolute; inset: -8px; pointer-events: auto;`
- 供 E2 Tab、E12 Chip 等使用模式 C 的元素复用

### ID-2: E3 $/T 切换 — 视觉 36px + 触控 44px（模式 A）
- `h-11 w-11` → `h-9 w-9 min-h-[44px] min-w-[44px] md:h-5 md:w-auto md:min-h-0 md:min-w-0`

### ID-3: E4 Input — 视觉 36px + 外层 py-1 补足（模式 B）
- `h-11` → `h-9`，外层 `<div>` 加 `py-1 md:py-0`
- 行总高不变（44px）

### ID-4: E2 Tab — 视觉 36px + `::before` 扩展（模式 C）
- `min-h-[44px]` → `min-h-[36px] relative touch-target-expand`
- 不在容器加 `pt-2 pb-2`（那会使行更高）
- 行总高 -8px

### ID-5: E7 SegmentedToggle — 调用方外层 py-2（模式 B）
- 在 `ScenarioControls.tsx` 调用处加 `<div className="py-2 md:py-0">`
- 不改 `segmented-toggle.tsx` 组件本身

### ID-6: E8 ScenarioControls Input — 外层 py-1（模式 B）
- `<div className="flex flex-col gap-1 ...">` → `gap-0.5 ... py-1`

### ID-7: E9 SlidersHorizontal — min-h/w-[44px]（模式 A）
- 在按钮 className 加 `min-h-[44px] min-w-[44px]`

### ID-8: E10 Header 图标 — 调用方加 min-h（模式 A）
- 在 `PortfolioPanel.tsx` 每个图标按钮加 `min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0`
- 不改 `headerControlStyles.ts` 全局常量

### ID-9: E11 搜索 Input — 外层 py-1（模式 B）
- 搜索 Input 外层 `<div>` 加 `py-1 md:py-0`
- 不在 input 上加 `min-h`（那会使 input 视觉变 44px）

### ID-10: E12 PopularTokenChip — `::before` 扩展（模式 C）
- chip 加 `relative touch-target-expand`
- chip 高度保持 28px，不用 `min-h`

### ID-11: E13 Switch — 外层容器 min-h（模式 C 变体）
- Switch 外层 `<div>` 加 `min-h-[44px] min-w-[44px] flex items-center justify-center`
- Switch 本身保持原生尺寸

### ID-12: E1/E5/E6 — 无需变更
- 移除按钮、清除按钮、展开按钮已达标且视觉合理

## Testing Decisions

- **Seam**: 组件渲染输出测试（Vitest + React Testing Library）
- 验证 className 包含 `min-h-[44px]` 或 `touch-target-expand`
- 验证视觉尺寸 class（`h-9`、`min-h-[36px]` 等）
- 验证 `::before` 工具类存在于 `index.css`

## Out of Scope

- 桌面端尺寸调整
- `headerControlStyles.ts` 全局常量修改
- `segmented-toggle.tsx` 组件本身修改
- 卡片间距、圆角等布局微调
- Metrics 三列网格（非交互）

## Further Notes

- 所有共享组件改动在调用方进行，不改组件本身
- `touch-target-expand` 放全局 `index.css` 供复用
- `::before` 的 `pointer-events` 和 `z-index` 在实现时验证
