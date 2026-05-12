# SegmentedToggle 规范

> 路径：`src/components/ui/segmented-toggle.tsx`
>
> 适用：USD/Token、APR/APY 等二选一或三选一的并列选项；不适用于功能开关（开/关 → 用 `Switch`）。

## 1. 形态总览

| 场景 | orientation | size | 圆角 | 典型用途 |
| --- | --- | --- | --- | --- |
| 桌面工具栏 | `horizontal`（默认）| `default` | `rounded-full`（药丸）| APR/APY、APY 视图切换 |
| 桌面紧凑工具条 | `horizontal` | `chip` | `rounded-full` | 与 `ds-chip` 同行内并列 |
| 移动场景控制条 | `vertical` | `default` | `rounded-2xl` 容器 / `rounded-xl` 段 | ScenarioControls 的 USD/Token，与右侧两个输入框等高对齐 |
| 移动紧凑场景 | `vertical` | `chip` | `rounded-2xl` 容器 / `rounded-xl` 段 | 与 `ds-chip` 等高的纵向二选一 |

## 2. 设计原则

1. **形态语义化**：横向 = 药丸（pill），纵向 = 圆角矩形（squircle）。
   - 横向多个并列时药丸最易扫读；纵向若沿用全圆角，两段椭圆会在长椭圆容器中产生视觉割裂，因此纵向统一收紧到 `rounded-2xl`（容器）+ `rounded-xl`（活动段），与卡片基准圆角一致（设计系统 §4.1）。
2. **指示器与按钮等圆角**：`indicator` 与可点击按钮使用同一圆角值，确保焦点环与悬停态在视觉上完美贴合。
3. **宽度策略**：
   - 横向：每段 `min-w-[56px]`（chip：`42px`），保证短文案下仍易点击且对称。
   - 纵向：`min-w-0`，宽度由父容器决定（通常 `self-stretch` 与同行输入框等高、等宽对齐）。
4. **高度对齐**：纵向场景必须使用 `self-stretch`，让 toggle 自动撑满到与右侧主控件等高（如两个 input 行）。不要用固定 `h-*`。
5. **动效**：仅 `transform` + `opacity`（GPU 加速），缓动 `cubic-bezier(0.4, 0, 0.2, 1)`，时长 200ms，并加 `motion-safe:` 前缀以尊重 `prefers-reduced-motion`。
6. **触控目标**：纵向每段 `min-h-[28px]`（默认）或 `min-h-[var(--ds-chip-h)]`（chip）。当作为整体出现在 ≥44px 高度的容器中时，整组 toggle 满足触控可达性。

## 3. API

```tsx
<SegmentedToggle
  options={[{ value: 'usd', label: 'USD' }, { value: 'token', label: 'Token' }]}
  value={mode}
  onChange={setMode}
  orientation="vertical"        // 默认 horizontal
  size="default"                 // 或 'chip'
  activeTextClassName="text-foreground"  // 默认 text-foreground
  className="self-stretch"       // 纵向必加：与同行控件等高
/>
```

### 必填属性

- `options: { value: string; label: string }[]` — 2–4 项最佳，超过 4 项请改用 `Select`。
- `value`、`onChange` — 受控组件。

### 可选属性

- `orientation: 'horizontal' | 'vertical'` — 默认 `horizontal`。
- `size: 'default' | 'chip'` — `chip` 用于与 `ds-chip` 同高的紧凑工具栏。
- `activeTextClassName` — 选中段文字色，默认 `text-foreground`；如需品牌色强调可传 `ds-text-brand-cyan` 等语义 token。
- `className` — 容器额外类，常见组合：`self-stretch`、`shrink-0`、`w-full`。

## 4. 可访问性

- 容器自带 `role="radiogroup"` 与 `aria-orientation`；每个按钮带 `role="radio"` + `aria-checked`。
- 焦点环：`focus-visible:ring-2 focus-visible:ring-ring`，**禁止移除**。
- 文本对比度遵循 WCAG AA：未选中态用 `text-muted-foreground`，hover 升至 `text-foreground`。
- 不要仅用颜色传达状态——`aria-checked` + 字重（`font-semibold`）+ 背景色三重信号同时存在。

## 5. 禁止事项

- ❌ 不要把 toggle 当主按钮用（行动号召请用 `<Button>`）。
- ❌ 不要在选项数量 > 4 时使用（拥挤、误触）。
- ❌ 纵向场景禁止改回 `rounded-full`（会与卡片圆角体系冲突）。
- ❌ 不要给指示器加阴影动画（已用 `transition-all`，再叠加 `box-shadow` 过渡会丢帧）。
- ❌ 不要用 `bg-primary` 作为活动段背景（与品牌琥珀金语义混淆，活动段统一用 `bg-card`）。

## 6. 与其他控件的关系

| 控件 | 何时使用 | 何时不使用 |
| --- | --- | --- |
| `SegmentedToggle` | 互斥的视图选项（USD/Token、APR/APY） | 开关式 on/off 状态 |
| `Switch` | 单一布尔状态（如 Batch 模式开启/关闭） | 多选项视图切换 |
| `FilterChip` | 多选过滤条件（链、市场、类别） | 互斥单选 |
| `Select` | 选项 > 4 或动态长列表 | 静态 2–3 项 |

## 7. 现有用例索引

- `src/components/dashboard/ScenarioControls.tsx` — 移动端 USD/Token（`vertical` + `self-stretch`）；桌面 APR/APY。
- `src/components/dashboard/PortfolioPanel.tsx` 等位置使用 `horizontal` 默认形态。

## 8. 设计系统 Token 映射

> 定义于 `src/index.css` `:root`，以 `--ds-seg-` 命名空间统一管理。

| Token | 默认值 | 用途 | 原硬编码 |
| --- | --- | --- | --- |
| `--ds-seg-track-h` | `2rem` | 横向 default 容器高度 | `h-8` |
| `--ds-seg-track-pad` | `3px` | default 容器内边距 | `p-[3px]` |
| `--ds-seg-chip-track-pad` | `2px` | chip 容器内边距 | `p-[2px]` |
| `--ds-seg-seg-min-h` | `1.75rem` | 纵向 default 段最小高度 | `min-h-[28px]` |
| `--ds-seg-seg-min-w` | `3.5rem` | 横向 default 段最小宽度 | `min-w-[56px]` |
| `--ds-seg-chip-seg-min-w` | `2.625rem` | 横向 chip 段最小宽度 | `min-w-[42px]` |
| `--ds-seg-seg-pad-x` | `0.75rem` | 横向 default 段水平内边距 | `px-3` |
| `--ds-seg-seg-pad-y-pad-x` | `0.625rem` | 纵向 default 段水平内边距 | `px-2.5` |
| `--ds-seg-chip-seg-pad-x` | `0.5rem` | chip 段水平内边距（横/纵共用） | `px-2` |
| `--ds-seg-gap` | `0.125rem` | 段间间距 | `gap-0.5` |

**复用已有 token**（非 seg 命名空间）：

| Token | 默认值 | 用途 |
| --- | --- | --- |
| `--ds-chip-h` | `1.75rem` | chip 模式容器高度 & 纵向 chip 段最小高度 |
| `--ds-shadow-rgb` | `0 0 0` | 指示器阴影 RGB 通道 |

**修改指引**：调整 toggle 尺寸/间距时只改 token 值，不改组件类名。例如纵向段需要更宽触控区时，增大 `--ds-seg-seg-min-h` 即可全局生效。

## 9. 修改清单

修改本组件前请确认：

- [ ] 所有横向用例（截图对比）未被影响。
- [ ] 纵向用例与右侧输入框依然顶/底对齐（无 1–2px 漂移）。
- [ ] `npm run lint && npm test && npx tsc --noEmit` 全部通过。
- [ ] 暗色模式下 `bg-muted/60` 与 `bg-card` 对比度仍清晰。
