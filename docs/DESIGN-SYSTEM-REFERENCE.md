# 设计系统与交互规范（可复用参考）

本文档汇总设计习惯与通用 UI/交互规范，**适用于本仓库，也可复制到其他前端项目**作为设计参考。项目特定内容见附录。

---

## 1. 视觉与主题

- **浅色**：温暖雾白基底 + 主色 + 品牌点缀；避免冷白。
- **暗色**：深炭黑背景 + 高对比，保持与浅色相同的圆角与层级体系。
- **间距基准**：4px 基准（0.5rem = 8px, 1rem = 16px），使用设计 token（如 `--ds-space-*`）保证一致。

### 语义色（通用）

| 用途   | Light 示例     | Dark 示例      |
|--------|----------------|---------------|
| 背景   | 雾白/暖灰      | 深炭黑        |
| 正文   | 深灰/黑        | 浅灰/白       |
| 卡片   | 略浅于背景     | 略浅于背景    |
| 边框   | 中性灰         | 深灰          |

### 品牌色与数据色（可按项目替换）

- 主色 / 强调色：用于 CTA、选中态。
- 数据/状态色：成功（绿）、警告（琥珀）、错误（红）、信息（蓝）— 仅用于对应语义，不用于普通数据展示。

---

## 2. 色彩语义原则（告警色专用）

**语义色仅用于其对应含义**，避免用语义色做装饰。

| 颜色     | 用途           | 示例                     |
|----------|----------------|--------------------------|
| 琥珀/橙  | 仅警告         | 超限、风险提示、过高利用率 |
| 红       | 仅错误/危险    | 失败、不可用             |
| 绿/翠绿  | 正常/成功/正向 | 安全区间、成功操作       |

**普通数据展示**用中性色：`text-foreground`、`text-muted-foreground`。数值、市场大小等非状态信息不用琥珀/红/绿，以便用户一眼识别“出现琥珀 = 警告”。

**辅助元素与文字同色**：进度环、状态图标等紧挨数值时，用 `currentColor` 或与相邻文字一致；仅在有明确语义（警告/错误/成功）时改用语义色。

---

## 3. 排版与间距

- **字体**：Sans 用于正文与 UI，Mono 用于代码/数值；可选用同一字族的不同 weight。
- **字号尺度**：统一使用设计 token（如 `ds-text-11` ~ `ds-text-24`），避免随意 `text-sm`/`text-base` 混用。
- **数值**：一律 `tabular-nums` 保证对齐。
- **文字与边框**：**强制** — 所有带边框的容器（卡片、表格单元格、警告条、按钮）内，文字与边框之间至少保留 8px（`--ds-space-2`）内边距，不得贴边。

---

## 4. 布局原则

- **移动优先**，触控目标 ≥ 44×44px。
- **多列面板**（如 Supply / Spread / Borrow）：等宽列、统一压缩，不单独给某一列固定或更大宽度。
- **表格**：表头与占位符（如 `-`）使用相同列宽与对齐，避免表头与内容错位；空间紧张时优先换行而非省略号。
- **对称**：成对出现的区块（如 Supply / Borrow）在布局与视觉权重上保持对称。

---

## 5. 开关与选择控件（Toggle / Segmented / Chips）

### 5.1 分段控制器（Segmented Control）

用于 2–3 个互斥选项（如 APR/APY、USD/Token）。

| 区域     | Tailwind 示例 |
|----------|----------------|
| 容器     | `flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40` |
| 选中项   | `px-3 py-1 rounded-md font-semibold bg-card text-foreground shadow-sm border border-border/60` |
| 未选中   | `px-3 py-1 rounded-md font-semibold text-muted-foreground hover:text-foreground hover:bg-card/50` |

### 5.2 筛选芯片（单选）

用于单选的分类筛选（如 All / Stables / ETH）。

| 状态     | 说明 |
|----------|------|
| 选中     | `bg-card text-foreground shadow-sm border border-border/60`，不用品牌色 |
| 未选中   | `bg-card/50 text-muted-foreground border border-border/40 hover:bg-card/80` |

### 5.3 多选芯片

多选时可用品牌色边框区分“已选”：`border-[brand]` + 品牌文字色，保持视觉重量适中。

### 5.4 图标切换按钮（如主题）

圆形、仅图标：`rounded-full`，用 tooltip 说明状态；hover 使用 `bg-muted/60` → `bg-muted/80`。

### 5.5 选中态必须明显

切换/选中状态要有**明确视觉区分**（边框色、背景、描边等），不能只靠轻微透明度或背景变化。

---

## 6. 光标与 Tooltip 交互

### 6.1 两种 Tooltip 类型

| 类型           | 触发方式     | 光标        | 延迟   | 悬停反馈     |
|----------------|--------------|-------------|--------|--------------|
| 自动展示       | 悬停         | `cursor-auto` | 约 200ms | 轻微（scale/opacity/bg） |
| 点击展示       | 点击/触摸    | `cursor-pointer` | 无   | 明显（ring + 更深背景）   |

- **自动展示**：用 `cursor-auto`，加轻微悬停反馈（如 `hover:opacity-80`、`hover:scale-[1.12]`、`hover:bg-muted/70`），让用户知道可悬停查看。
- **点击展示**：用 `cursor-pointer`，悬停反馈更强（如 `hover:ring-2`、`hover:bg-accent/20`）。
- **禁止**：自动展示的 tooltip 不要用 `cursor-pointer`（会误导为需点击）；不要用 `cursor-help`（不在设计体系内）。

### 6.2 混合模式（移动端点击、桌面端悬停）

```tsx
className="cursor-pointer md:cursor-auto"
// 移动端 onClick 打开；桌面端 onMouseEnter/Leave 控制
```

### 6.3 Tooltip 内容

只展示**补充信息**，不重复父级已展示的内容。

### 6.4 Tooltip 定位与视口

- 限制在视口内：使用 `max-h` + 内部 `overflow-y-auto`，避免溢出视口底部。
- 优先使用 flip（空间不足时在上方显示），再考虑裁剪。
- 固定定位的浮层不依赖页面滚动才能使用。

### 6.5 光标速查

| 场景               | 光标 |
|--------------------|------|
| 自动展示 tooltip   | `cursor-auto` |
| 按钮、链接、点击展示 | `cursor-pointer` |
| 禁用且无交互       | `cursor-not-allowed` |
| 禁用但有说明 tooltip | `cursor-auto`（tooltip 仍可用） |
| 可编辑文本         | `cursor-text` |
| 可拖拽             | `cursor-grab` / `cursor-grabbing` |

---

## 7. 悬停与动效

### 7.1 强度层级

| 强度   | 效果示例 | 适用场景           |
|--------|----------|--------------------|
| 轻微   | `hover:opacity-90`, `hover:scale-[1.02]` | 文字链接、被动指示 |
| 轻     | `hover:bg-muted/40`, `hover:scale-105`   | 自动展示 tooltip 触发 |
| 中     | `hover:bg-muted/60`, `hover:scale-110`   | 图标按钮、小控件 |
| 强     | `hover:ring-2`, `hover:bg-accent/25`, `active:scale-95` | 主按钮、点击展示触发 |

### 7.2 时长

| 时长           | 用途           |
|----------------|----------------|
| `duration-100` | 微交互（active） |
| `duration-150` | 悬停、小元素   |
| `duration-200` | 常规交互       |
| `duration-300` | 较大动效、弹层 |

缓动建议：`[0.25, 0.1, 0.25, 1]`。列表入场可 stagger：`delay: 0.2 + i * 0.08`。

### 7.3 尊重减少动效

```tsx
className="transition-all motion-reduce:transition-none"
```

---

## 8. 禁用与加载状态

### 8.1 禁用

- 仅视觉禁用且需说明：`text-muted-foreground cursor-auto` + tooltip。
- 完全不可点击：`opacity-50 cursor-not-allowed pointer-events-none`。

### 8.2 加载

- 骨架屏：`animate-pulse bg-muted rounded`，与最终布局一致。
- 进度：不确定用 spinner，确定进度用 progress bar/ring；紧凑处用 progress ring。

---

## 9. 移动端与触控

- **触控目标**：最小 44×44px（包括可点击的“Simulation ⌄”等）。
- **浮层**：移动端详情类内容用**底部抽屉（bottom sheet）**：全宽、`rounded-t-2xl`、固定标题+关闭、内容区 `max-h-[80vh] overflow-y-auto`，背景 `fixed inset-0 z-30 bg-background/20` 点击关闭。不在移动端用小浮层 popover 锚定在触发点上。
- **轮播**：移动端轮播需包含：分页点、左右箭头（在可滚动时显示）、peek（如 `basis-[85%]`）、`align: "center"` + `containScroll: "trimSnaps"`。
- **避免**：仅在 hover 上做交互，移动端需提供 tap/click 等价操作。

### 9.1 Slider + 数值 Tooltip（移动端）

当 Slider 的 thumb 在拖动时会放大（如 `scale-[1.4]`）且上方有**数值 Tooltip** 时：

- **避免重叠**：Tooltip 与放大后的 thumb 之间必须留出明显空隙。按状态区分 Tooltip 的垂直偏移：
  - **拖动中**：使用更大上偏移（如 `-top-10` / 40px），确保与 thumb 的 ring/shadow 不贴。
  - **非拖动**：略小上偏移（如 `-top-8` / 32px），既不贴 thumb 也不离得过远。
- **层级**：Tooltip 使用更高 z-index（如 `z-20`），避免被 thumb 的 ring 或阴影盖住，造成“像重叠”的观感。
- **实现**：用同一 class 根据 `isDragging` 切换 `-top-10` / `-top-8`，并加 `transition-[top] duration-150` 使切换自然。

### 9.2 Slider 与下方区块间距

Slider 与紧挨其下的区块（如「Reference FDVs」、说明文字）可适当收紧间距，使视觉更紧凑：

- 在**不缩小触控热区、不损害可点击性**的前提下，将下方区块的 `margin-top` 从 4px 减至 2px（如 `--ds-space-1` → `--ds-space-0-5`），必要时可设为 0。
- 验收：间距更小但不显拥挤，下方区块仍易点、可访问性不受影响。

---

## 10. 无障碍与键盘

- 所有可交互元素有**可见焦点**：`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`。
- 状态不只用颜色表达，配合图标、文字或图案。
- 触控目标 ≥ 44px；悬停态有对应的焦点态以便键盘用户感知。
- Tooltip 可通过键盘焦点触发。

---

## 11. 暗色模式

- 所有悬停/边框在浅色和暗色下都需测试。
- 禁用态对比度足够。
- 必要时按主题调整透明度：`hover:bg-muted/60 dark:hover:bg-muted/40`。

---

## 12. 设计习惯速查

- **Tooltip**：不重复父级已有信息；自动展示用 `cursor-auto` + 轻微悬停反馈，点击展示用 `cursor-pointer` + 强反馈。
- **Toggle/选中态**：变化要明显，用边框色或明确背景，不只靠透明度。
- **语义色**：琥珀=警告、红=错误、绿=成功/正常，不用于普通数据。
- **多列**：等宽、统一内边距；表格留足 padding，文字不贴边。
- **对称**：成对区块（如 Supply / Borrow）在位置与权重上对称。
- **几何**：若需求给出具体尺寸/间距，按给定实现（如用 `getBoundingClientRect()` 计算），不随意近似。

---

## 附录 A：本仓库项目特定规范（AaveAPY）

以下为与本仓库业务强相关的规范，复用到其他项目时可忽略或按需裁剪。

- **前端交互守则**：`docs/frontend-interaction-guardrails.md`（API 新鲜度、Forecast UI、Reserves 表列宽与 breakdown 布局、Borrow 可用性公式等）。
- **数据加载**：`docs/frontend-data-loading-matrix.md`（prefetch、staleTime、缓存分层）。
- **DESIGN.md**：本项目视觉主题、品牌色、组件类名（如 `ds-input-surface`、`glass-card`）的具体约定。

---

## 附录 B：移动端卡片排版示意（ASCII）

适用于“区块分隔 + 金额区字重突出”的移动卡片布局参考。

```
┌─────────────────────────────────────────────────────────┐
│  (图标)  标题 ↗                      [ 可选标签 ]         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐ │
│  │            SUPPLY         |         BORROW           │ │
│  │          $23.61M ○                 $16.66M ○        │ │  ← ds-text-12 略加粗
│  └─────────────────────────────────────────────────────┘ │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  ← border-t border-border/40
│  ┌─────────────────────────────────────────────────────┐ │
│  │  SUPPLY           SPREAD           BORROW           │ │  ← 三列居中或 tabular-nums
│  │  11.87%          +8.43%            3.44%            │ │
│  │  (弱化分解行 ds-text-9)                              │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Simulation  ⌄     (min-h-[44px])       │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

图例：`○` 圆环等可选指示；`⌄` 展开/收起；细分隔线用 `border-border/40`。

---

## 文档来源与维护

本参考由以下文档合并而成，便于在其他项目中复用：

- `DESIGN.md` — 视觉主题、色彩、排版、组件
- `docs/toggle-switch-specification.md` — 开关与芯片规范
- `docs/ui-interaction-patterns.md` — 光标、Tooltip、悬停、禁用、无障碍
- `docs/frontend-interaction-guardrails.md` — Tooltip/颜色/布局/移动端守则
- `docs/mobile-reserve-card-ascii-layout.md` — 移动卡片排版示意
- `AGENTS.md` — Frontend Design & UX、Learned User Preferences 中与设计相关的条目

**约定**：一次性设计方案（如某次 Lovable/PR 的 UI 方案）**可以删除原文档**，将其内容总结进本文档与设计规范，把可复用部分抽象成习惯写进对应章节即可。后续新增设计习惯请更新本文档（通用部分）或附录 A（项目特定）。
