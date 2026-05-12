# 硬编码样式值 Token 化迁移方案

> 目标：将组件中散落的硬编码尺寸/间距/字号替换为设计系统 token，消除"改一处漏全局"的维护风险。

## 现状分析

### A. 字号：已有 token 但组件未使用

| 硬编码 | 对应 token | 出现次数 | 涉及文件 |
| --- | --- | --- | --- |
| `text-[11px]` | `--ds-text-11` → 工具类 `ds-text-11` | 8 | `segmented-toggle.tsx`(2)、`InkAprCalculator.tsx`(6，全部 `!text-[11px]`，桌面端 3 + 移动端 3) |
| `text-[12px]` | `--ds-text-12` → `ds-text-12` | 2 | `segmented-toggle.tsx`(2) |
| `text-[13px]` | `--ds-text-13` → `ds-text-13` | 5 | `FaqSection.tsx`(5) |
| `text-[10px]` | `--ds-text-10` → `ds-text-10` | 1 | `PopularTokenChip.tsx`(1) |
| `text-[9px]` | `--ds-text-9` → `ds-text-9` | 3 | `PopularTokenChip.tsx`(1)、`FilterBar.tsx`(1)、`marketLabels.ts`(1) |

**问题**：大部分组件已用 `ds-text-11` / `ds-text-13` 等工具类，但少量位置仍用 `text-[Npx]` 任意值覆盖，导致字号不跟随 token 变更。

**⚠️ 关键风险：`ds-text-N` 工具类同时设置了 `font-size` 和 `line-height`**

```css
.ds-text-11 {
  font-size: var(--ds-text-11);           /* 11px */
  line-height: calc(11px * 1.25);         /* 13.75px */
}
```

而当前硬编码 `text-[Npx]` 仅设 font-size，line-height 由其他类（如 `leading-none` = 1）控制。替换为 `ds-text-N` 会**同时改变 line-height**：

| 硬编码 | 是否伴有 `leading-none` | 替换风险 |
| --- | --- | --- |
| `text-[11px]` (segmented-toggle) | 否，inline-flex + h-full 容器约束 | 低 — line-height 差异被容器吸收 |
| `!text-[11px]` (InkAprCalculator, 4 处 span) | **是** — 全部有 `leading-none` | 低 — 替换为 `ds-text-11 !leading-none`，`!leading-none` 用 `!important` 覆盖 line-height |
| `!text-[11px]` (InkAprCalculator, 2 处 Input) | **是** — 分别有 `leading-4`/`leading-7` | **高** — 需用 `![font-size:var(--ds-text-11)]`，不能用 `!ds-text-11`（line-height !important 冲突） |
| `text-[12px]` (segmented-toggle) | 否 | 低 |
| `text-[13px]` (FaqSection) | 否，font-mono 代码块 | 低 — 13px × 1.25 = 16.25px 接近默认行高 |
| `text-[10px]` (PopularTokenChip) | 否 | 低 |
| `text-[9px]` (全部 3 处) | **是** — 全部有 `leading-none` | 低 — 替换为 `ds-text-9 !leading-none`，`!leading-none` 覆盖 line-height |

**行动**：
- `text-[11px]`（segmented-toggle）、`text-[12px]`、`text-[13px]`、`text-[10px]`：直接替换为 `ds-text-N`，低风险
- `text-[9px] leading-none`（3 处）：替换为 `ds-text-9 !leading-none` — `!leading-none` 用 `!important` 覆盖 `ds-text-9` 的 line-height，无 CSS 顺序不确定性
- `!text-[11px] leading-none`（InkAprCalculator 的 4 处 `$`/`B` span）：替换为 `ds-text-11 !leading-none` — 同上，不需要 `!important` 在 font-size 上（span 无组件级 font-size 冲突）
- `!text-[11px]`（InkAprCalculator 的 2 处 `<Input>`，伴 `leading-4`/`leading-7`）：**唯一需要任意属性语法的场景** — 替换为 `![font-size:var(--ds-text-11)]`，因为必须用 `!important` 覆盖 shadcn `<Input>` 组件的 `ds-text-16`，但必须避免 `!ds-text-11` 引出的 line-height `!important` 冲突

---

### B. 控件高度：跨组件重复但缺统一 token（高收益）

| 硬编码 | 值 | 出现次数 | 语义 |
| --- | --- | --- | --- |
| `h-8` | 2rem (32px) | ~26 | 小输入框 / icon button / skeleton 行高 / toast 按钮 / carousel 箭头 |
| `h-9` | 2.25rem (36px) | ~9 | sm 按钮 / table header / pagination icon / compact input / ThemeToggle |
| `h-10` | 2.5rem (40px) | 3 | 默认 input / default button |
| `h-11` | 2.75rem (44px) | 3 | lg button / pull-to-refresh icon / InkAprCalculator slider handle |
| `h-7` | 1.75rem (28px) | ~34 (跨 15+ 文件) | chip 行高 / chip input / inline badge / skeleton icon / sort icon |

**已有 token**：`--ds-button-h: 2.5rem`（对应 h-10）、`--ds-chip-h: 1.75rem`（对应 h-7）、`--ds-icon-button: 1.75rem`（= h-7，但形状是 rounded-full）、`--ds-seg-track-h: 2rem`（对应 h-8，但语义仅限 segmented toggle 轨道）。

**补充发现**：CSS 变量层已有 `--ds-space-8: 2rem`、`--ds-space-9: 2.25rem`、`--ds-space-10: 2.5rem`、`--ds-space-11: 2.75rem`，数值与上述控件高度完全相同。但 `--ds-space-*` 是**间距语义**（margin/padding），不应复用于控件高度 — 否则改间距时意外改变按钮高度。因此仍需新增语义独立的 token。

**缺口**：h-8 和 h-9 无语义匹配的 token。其中 h-8 使用最广（26 处），是风险最高的硬编码。

**方案**：

| 新 token | 值 | 映射 |
| --- | --- | --- |
| `--ds-control-h` | `2rem` | 统一 h-8（小控件行高：icon button、compact input、skeleton、toast 按钮、carousel 箭头） |
| `--ds-button-sm-h` | `2.25rem` | 统一 h-9（shadcn sm button、table header、compact ScenarioControls input） |

h-10 已有 `--ds-button-h`，h-11 可映射 `--ds-button-lg-h: 2.75rem`（新增）。
h-7 已有 `--ds-chip-h`，但需甄别：chip 语义用 `--ds-chip-h`，icon-size 语义保留 h-7 或映射 `--ds-icon-button`（注意 `.ds-icon-button` 是 rounded-full 圆形，部分 icon 元素可能期望方角）。

---

### C. 最大宽度：Ring 组件共享（中等收益）

| 硬编码 | 出现次数 | 涉及文件 |
| --- | --- | --- |
| `max-w-[220px]` | 3 | `UtilizationIndicator.tsx`、`BorrowCapProgressRing.tsx`、`CapProgressRing.tsx` |

**方案**：新增 `--ds-ring-tooltip-max-w: 220px`。三个 Ring 组件的 tooltip 宽度业务含义相同（指标环图说明浮层），统一 token 后调宽只需改一处。

---

### D. 微间距 gap（低收益，暂不动）

| 硬编码 | 出现次数 |
| --- | --- |
| `gap-[1px]` | 1（MobileReserveCard） |
| `gap-[2px]` | 3（InkAprCalculator） |
| `gap-[3px]` | 1（FrozenStatusBadge） |

**判断**：微间距装饰性强、值稳定、不跨组件共享语义，token 化收益 < 维护成本。**暂不迁移**。

---

### E. InkAprCalculator 内部尺寸（低收益，暂不动）

`h-[0.875rem]`、`min-h-[3.5rem]`、`pt-[0.6875rem]`、`-mt-[3.5625rem]` 等共 ~15 处，全部在 InkAprCalculator 单组件内。

**判断**：单组件内聚尺寸不跨组件传播，可在组件内部用局部 CSS 变量统一，但不需升为全局 ds token。**暂不迁移**。

---

### F. 不动项

- `w-[7px] h-[7px]`、`gap-[1px]` — 装饰性微尺寸
- `-left-[2rem]` 等偏移量 — 布局定位值，随容器变化
- `max-w-[320px]` tooltip — 已有 `--ds-tooltip-*` 体系，该值是单次使用
- `min-w-[Nrem]` 输入框宽度 — 业务逻辑决定，token 化后改值仍需逐个验证

---

## 风险与收益综合评估

### 安全性

**无安全风险**。本次迁移是纯 CSS 样式层的 token 化替换，不涉及：
- 用户输入处理、认证授权、数据暴露
- API 调用、数据库操作、文件系统访问
- 第三方依赖引入、构建流程变更

唯一的安全考量是**运行时可靠性**：`h-8` 由 Tailwind 编译为静态 `height: 2rem`，替换为 `h-[var(--ds-control-h)]` 后变为 `height: var(--ds-control-h)`，依赖 CSS 变量在运行时存在。若 token 定义被误删，所有 26 处 h-8 元素会塌缩为高度 0。缓解措施：
- Token 定义在 [index.css `@layer base :root`](file:///Users/pabloli/Documents/code/aaveapy/src/index.css#L8-L128) 中，不会被 Tree-shaking 移除
- 建议在 PR 描述中注明新增 token 的「不可删除」约束

### 收益分级

| 收益维度 | Phase 1 | Phase 2 | Phase 3 |
| --- | --- | --- | --- |
| 消除硬编码处 | 19 | ~40 | 3 |
| 新增 token | 0 | 3 | 1 |
| **维护性收益** | 中 | **高** | 低 |
| **可调性收益** | 低（字号极少调整） | **高**（控件高度可能因设计迭代统一调整） | 中 |
| 跨组件共享 | — | h-8: 10+ 组件, h-9: 6 组件 | 3 组件（同语义） |
| 改动复杂度 | 低-中 | 高 | 低 |

**Phase 2 是核心收益所在**：一次 token 值变更（如 `--ds-control-h: 2rem` → `2.25rem`）即可同步 10+ 个组件的控件高度，消除「改一处漏全局」的维护噩梦。

### 风险分级

| 风险 | 影响范围 | 严重度 | 缓解措施 |
| --- | --- | --- | --- |
| `!ds-text-11` line-height !important 与 `leading-4`/`leading-7` 冲突 | InkAprCalculator 2 处 `<Input>` | **高** | 使用 `![font-size:var(--ds-text-11)]` — 只生成 font-size !important，不产生 line-height |
| `ds-text-N` 其他字号 line-height 变化 | 受影响组件行高微调 | **低** | `!leading-none` 用 !important 覆盖 line-height（text-[9px] 场景）；inline-flex/h-full 容器吸收差异（其他场景） |
| CSS 变量被误删导致高度塌缩 | 所有 26 处 h-8 元素 | **低** | Token 在 `:root` 中定义，不会被 Tree-shaking |
| InkAprCalculator Phases 1+2 多变更叠加 | FDV 输入框区域 | **低** | 4/6 处替换为低风险的 `ds-text-11 !leading-none`；严格执行 Phase 1 → Phase 2 顺序 |
| `marketLabels.ts` 改动波及多个消费者 | 所有 Hub chip 组件 | **低** | `getHubChipClass()` 返回值纯视觉样式，回归测试即可 |

### 不做项的合理性确认

| 项 | 原理由 | Review 确认 |
| --- | --- | --- |
| gap-[1px/2px/3px] | 装饰性微间距，不跨组件共享语义 | ✅ 合理 — 值稳定且无跨组件协调需求 |
| InkAprCalculator 内部尺寸 | 单组件内聚，不需全局 token | ✅ 合理 — 但注意 Phase 1/2 会触碰 InkAprCalculator 的 FDV 输入区域，需单独验证 |
| min-w-[Nrem] 输入框宽度 | 业务逻辑驱动，token 化后改值仍需逐个验证 | ✅ 合理 |
| 布局偏移量 | 随容器变化 | ✅ 合理 |

---

## 执行计划

### Phase 1：字号统一（低风险为主，最优先）

**改动**：

| 优先级 | 文件 | 替换 | 风险 | 说明 |
| --- | --- | --- | --- | --- |
| P1 | `segmented-toggle.tsx` | `text-[11px]` → `ds-text-11`（2 处） | 低 | inline-flex + h-full 容器吸收 line-height 差异 |
| P1 | `segmented-toggle.tsx` | `text-[12px]` → `ds-text-12`（2 处） | 低 | 同上 |
| P1 | `FaqSection.tsx` | `text-[13px]` → `ds-text-13`（5 处） | 低 | font-mono 代码块，line-height 变化不明显 |
| P2 | `PopularTokenChip.tsx` | `text-[10px]` → `ds-text-10`（1 处） | 低 | 无 leading-none，line-height 差异可忽略 |
| **P2** | `PopularTokenChip.tsx` | `text-[9px] leading-none` → `ds-text-9 !leading-none`（1 处） | **低** | `!leading-none` 用 `!important` 覆盖 line-height，无 CSS 顺序问题 |
| **P2** | `FilterBar.tsx` | `text-[9px] leading-none` → `ds-text-9 !leading-none`（1 处） | **低** | 同上 |
| **P2** | `marketLabels.ts` | `text-[9px] leading-none` → `ds-text-9 !leading-none`（1 处） | **低** | `getHubChipClass()` 返回值，需回归所有 Hub chip 消费者 |
| **P1** | `InkAprCalculator.tsx` | `!text-[11px] leading-none` → `ds-text-11 !leading-none`（4 处 span：L478/499/735/756） | **低** | `$`/`B` 前后缀 span，无需 `!important` 在 font-size 上（父容器已有 `[font-size:11px]`） |
| **P0（关键）** | `InkAprCalculator.tsx` | `!text-[11px]` → `![font-size:var(--ds-text-11)]`（2 处 Input：L496/753） | **高** | `<Input>` 组件内部默认 `ds-text-16`，必须用 `!important` 覆盖 font-size，但不能用 `!ds-text-11`（其 line-height !important 会与 `leading-4`/`leading-7` 冲突）。**任意属性语法是唯一安全方案** |

**⚠️ 为什么只有 2 处 Input 需要用任意属性语法：**

shadcn `<Input>` 组件内部应用了 `ds-text-16`（[input.tsx:L21](file:///Users/pabloli/Documents/code/aaveapy/src/components/ui/input.tsx#L21)）。要缩小到 11px，必须用 `!important` 覆盖。但 `!ds-text-11` 会把 line-height 也标为 `!important`，导致：

```
!ds-text-11 → line-height: 13.75px !important   ← 与 leading-4 冲突
!leading-4  → line-height: 1rem !important       ← 两者都是 !important，CSS 顺序决定 → 不可预测
```

`![font-size:var(--ds-text-11)]` 只生成 `font-size: var(--ds-text-11) !important`，不产生 line-height — 这才是唯一安全方案。

**InkAprCalculator 的 6 处详细位置**（镜像重复的桌面/移动布局）：

```tsx
// 桌面端 FDV 输入框 (L470-502)
<span className="... !text-[11px] leading-none ...">$</span>        // L478 → ds-text-11 !leading-none
<Input className="... !text-[11px] ... leading-4 ..." />              // L496 → ![font-size:var(--ds-text-11)]
<span className="... !text-[11px] leading-none ...">B</span>        // L499 → ds-text-11 !leading-none

// 移动端 FDV 输入框 (L727-757) 
<span className="... !text-[11px] leading-none ...">$</span>        // L735 → ds-text-11 !leading-none
<Input className="... !text-[11px] ... leading-7 ..." />              // L753 → ![font-size:var(--ds-text-11)]
<span className="... !text-[11px] leading-none ...">B</span>        // L756 → ds-text-11 !leading-none
```

**验证**：lint + test + build + tsc。视觉回归重点：
- InkAprCalculator 桌面/移动 FDV 输入框（`$` / `B` 前后缀 + 输入框内文字是否变形）
- FaqSection 代码块字号
- PopularTokenChip 标签字号
- FilterBar market badge 字号
- 各 Hub chip（marketLabels.ts 消费者）字号

---

### Phase 2：控件高度统一（高收益）

**新增 token**（`index.css` `:root`）：

```css
--ds-control-h: 2rem;       /* h-8：小控件行高 */
--ds-button-sm-h: 2.25rem;  /* h-9：sm button / compact input */
--ds-button-lg-h: 2.75rem;  /* h-11：lg button */
```

> **注意**：`--ds-seg-track-h: 2rem` 已存在（等于 h-8），但语义限定为 segmented toggle 轨道高度，不可复用于通用控件。`--ds-control-h` 是其语义对应的通用版。同理 `--ds-space-8/9/10/11` 值相同但语义为间距，不可复用。

**替换映射**：

| 原值 | 新值 | 涉及文件 |
| --- | --- | --- |
| `h-8` | `h-[var(--ds-control-h)]` | PortfolioPanel、ScenarioControls、InkAprCalculator、LoadingState(×10)、Header(×2)、toast、carousel(×2)、ReservesTableMobileGrid、PortfolioPanelSkeleton、Index(×2) |
| `h-9` | `h-[var(--ds-button-sm-h)]` | ScenarioControls、ReservesTablePagination、LoadingState(×3)、ThemeToggle(×2)、button.tsx(sm)、table.tsx |
| `h-11` | `h-[var(--ds-button-lg-h)]` | button.tsx(lg)、InkAprCalculator(slider handle)、PullToRefresh |

**h-7 甄别**：共 34 处，分三类处理——

| 类别 | 数量 | 处理方式 | 示例 |
| --- | --- | --- | --- |
| Chip 行高 / chip input | ~5 | `h-[var(--ds-chip-h)]` | PortfolioPanel chip input(L426)、PortfolioTokenRow input(L79)、FilterBar input(L310/331)、PopularTokenChip chip(L37) |
| Skeleton / loading icon | ~10 | 保留 `h-7` | LoadingState skeleton 占位元素 |
| 排序/链接 icon / 其他 | ~19 | 保留 `h-7` 或评估 `ds-icon-button` | ReservesTable 排序图标、IncentiveTooltip 链接图标、FilterBar toggle chips |

> 建议先只改「明确是 chip」的 ~5 处，其余暂保留 h-7。

**⚠️ InkAprCalculator 中的 h-7/h-8 风险**：

InkAprCalculator 的桌面/移动 FDV 输入区域同时涉及 Phase 1 和 Phase 2 的替换。其中 4 处 `$`/`B` span 的 Phase 1 替换是低风险的（`ds-text-11 !leading-none`），2 处 `<Input>` 的替换需要 `![font-size:var(--ds-text-11)]`。替换顺序建议：**先完成 Phase 1 并验证通过，再做 Phase 2 的 h-7/h-8 替换**，避免多变更叠加后难以定位回归。

**验证**：lint + test + build + tsc + 视觉回归（ScenarioControls 高度对齐、button 三档高度、LoadingState skeleton 高度、InkAprCalculator 桌面/移动 FDV 输入框高度）。

---

### Phase 3：Ring tooltip 最大宽度（中等收益）

**新增 token**：

```css
--ds-ring-tooltip-max-w: 220px;
```

**替换**：`max-w-[220px]` → `max-w-[var(--ds-ring-tooltip-max-w)]`，3 个文件。

---

### Phase 4：文档更新

更新 `docs/design/DESIGN-SYSTEM-REFERENCE.md` §5 或对应章节，补充：
- `--ds-control-h`、`--ds-button-sm-h`、`--ds-button-lg-h`、`--ds-ring-tooltip-max-w` 的语义与默认值
- 字号统一规则：禁止使用 `text-[Npx]` 任意值，必须使用 `ds-text-N` 工具类
- **特殊场景指南**：当元素已有显式 `leading-none` 且不希望被 `ds-text-N` 的 line-height 覆盖时，使用 `[font-size:var(--ds-text-N)]` 任意属性语法代替 `ds-text-N`

---

## 验证测试用例（风险完全排除）

### 为什么风险能被完全排除

风险根源是 `ds-text-N` 工具类同时生成 `font-size` + `line-height`。但有两种方式规避：

| 场景 | 替换方式 | 生成的 CSS | 与 `leading-*` 冲突？ |
| --- | --- | --- | --- |
| span/badge（无需 !important） | `ds-text-11 !leading-none` | `font-size: 11px` + `line-height: 1 !important` | ❌ `!leading-none` 的 !important 覆盖一切 |
| `<Input>`（需 !important） | `![font-size:var(--ds-text-11)]` | `font-size: 11px !important`（仅此而已） | ❌ 根本没有 line-height |
| ❌ 错误做法 | `!ds-text-11` | `font-size: 11px !important` + `line-height: 13.75px !important` | ✅ 冲突 — line-height !important 无法被覆盖 |

**关键洞察**：`!leading-none`（`!` + 专用工具类）和 `![font-size:var(--ds-text-11)]`（`!` + 任意属性）都是 Tailwind 标准语法，都是最佳实践 — 只是在不同的约束下选择了不同的工具：

### 第 1 层：className 断言回归守卫（Vitest 组件测试）

**目的**：防止后续维护中有人将 `[font-size:var(--ds-text-N)]` 改回 `ds-text-N` 或 `text-[Npx]`。

**文件**：`src/components/dashboard/InkAprCalculator.token-regression.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

describe('InkAprCalculator font-size token regression guard', () => {
  it('$ / B prefix/suffix spans use ds-text-11 !leading-none', () => {
    const html = document.body.innerHTML;
    // span 不应再有 !text-[11px]
    expect(html).not.toMatch(/!text-\[11px\]/);
    // span 不应有 !ds-text-11（会引入 line-height 冲突）
    expect(html).not.toMatch(/!ds-text-11/);
  });

  it('FDV Input uses !font-size arbitrary property not !ds-text-11', () => {
    const html = document.body.innerHTML;
    // Input 必须用任意属性语法（唯一安全方案）
    expect(html).toMatch(/\[font-size:var\(--ds-text-11\)\]/);
    // 但绝不能是 !ds-text-11（line-height !important 冲突）
    expect(html).not.toMatch(/!ds-text-11/);
  });
});

describe('Badge font-size token regression guard', () => {
  it('uses ds-text-9 !leading-none not text-[9px]', () => {
    const html = document.body.innerHTML;
    // 不应再有 text-[9px]
    expect(html).not.toMatch(/text-\[9px\]/);
    // 不应裸用 ds-text-9（line-height 未覆盖）
    expect(html).not.toMatch(/\bds-text-9\b(?!\s*!leading-none)/);
  });
});
```

**项目路径**：`src/components/dashboard/FilterBar.token-regression.test.tsx`、`src/components/dashboard/PopularTokenChip.token-regression.test.tsx` 同理覆盖。

### 第 2 层：Token 定义存在性验证（Vitest `getComputedStyle`）

**目的**：验证新增 CSS 变量在 `:root` 中定义且值与预期一致，防止 token 被误删。

**文件**：`src/test/design-tokens.test.ts`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

describe('design system control height tokens', () => {
  const root = document.documentElement;
  const styles = getComputedStyle(root);

  it('--ds-control-h is 2rem', () => {
    expect(styles.getPropertyValue('--ds-control-h').trim()).toBe('2rem');
  });
  it('--ds-button-sm-h is 2.25rem', () => {
    expect(styles.getPropertyValue('--ds-button-sm-h').trim()).toBe('2.25rem');
  });
  it('--ds-button-lg-h is 2.75rem', () => {
    expect(styles.getPropertyValue('--ds-button-lg-h').trim()).toBe('2.75rem');
  });
  it('--ds-ring-tooltip-max-w is 220px', () => {
    expect(styles.getPropertyValue('--ds-ring-tooltip-max-w').trim()).toBe('220px');
  });
});
```

> **注意**：此测试需要在 Phase 2 新增 token 之后再添加，否则当前阶段会失败。

### 第 3 层：硬编码残留 grep 扫描（Shell 脚本）

**目的**：在每个 Phase 执行完毕后自动检查不该有的硬编码是否已全部消除。

**文件**：`scripts/check-hardcoded-tokens.sh`（集成到 `ci:remote` 或 `pre-push` hook）

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="src/"
EXCLUDE="node_modules"

echo "=== Phase 1 后检查：字号硬编码残留 ==="
if grep -rn 'text-\[\(9\|10\|11\|12\|13\)px\]' "$SRC" --include='*.tsx' --include='*.ts'; then
  echo "❌ 仍有 text-[Npx] 硬编码字号，Phase 1 不完整" >&2
  exit 1
fi
echo "✅ 字号硬编码已全部消除"

echo "=== Phase 2 后检查：控件高度硬编码残留 ==="
H8_COUNT=$(grep -rn '\bh-8\b' "$SRC/components/" --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')
H9_COUNT=$(grep -rn '\bh-9\b' "$SRC/components/" --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')
H11_COUNT=$(grep -rn '\bh-11\b' "$SRC/components/" --include='*.tsx' | grep -v '\.test\.' | wc -l | tr -d ' ')
if [ "$H8_COUNT" -gt 0 ] || [ "$H9_COUNT" -gt 0 ] || [ "$H11_COUNT" -gt 0 ]; then
  echo "❌ 仍有 h-8/h-9/h-11 硬编码控件高度: h-8=${H8_COUNT}, h-9=${H9_COUNT}, h-11=${H11_COUNT}" >&2
  exit 1
fi
echo "✅ 控件高度硬编码已全部消除"

echo "=== 反模式检查：ds-text-N 裸用（无 !leading-none 覆盖） ==="
# ds-text-9 或 ds-text-11 出现但后面没有跟着 !leading-none → 反模式
if grep -rn '\bds-text-9\b\|\bds-text-11\b' "$SRC" --include='*.tsx' --include='*.ts' \
  | grep -v '!leading-none'; then
  echo "❌ 发现 ds-text-9/11 裸用无 !leading-none 覆盖（line-height 冲突风险）" >&2
  exit 1
fi
echo "✅ 无 line-height 反模式"

echo "=== 全部检查通过 ==="
```

### 第 4 层：视觉回归截图（Playwright e2e，可选）

**目的**：对 InkAprCalculator FDV 输入框等高风险区域截取截图作为视觉基准。

**文件**：`e2e/token-migration-visual.spec.ts`

```tsx
import { test, expect } from '@playwright/test';

test.describe('token migration visual regression', () => {
  test('InkAprCalculator FDV input desktop', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('[data-testid="ink-apr-calculator"]')).toHaveScreenshot(
      'ink-apr-fdv-desktop.png'
    );
  });

  test('InkAprCalculator FDV input mobile', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-testid="ink-apr-calculator"]')).toHaveScreenshot(
      'ink-apr-fdv-mobile.png'
    );
  });
});
```

> **前提**：需要先给 InkAprCalculator 根元素添加 `data-testid="ink-apr-calculator"`（一行 JSX 改动）。

### 验证执行顺序

```
Phase 1 代码改动
  ├─ 第 1 层 className 断言 → 验证替换语法正确
  ├─ 第 3 层 grep 扫描 → 验证零残留
  ├─ lint + test + build + tsc → 标准门禁
  └─ 第 4 层 e2e 截图（可选）→ 视觉基准
  → Phase 1 ✅

Phase 2 代码改动（Phase 1 全部通过后）
  ├─ 第 2 层 token 定义验证 → 确认 CSS 变量存在
  ├─ 第 1 层 className 断言 → 验证 h-[var(--ds-xxx)] 语法正确
  ├─ 第 3 层 grep 扫描 → 验证 h-8/h-9/h-11 零残留 + 无反模式
  ├─ lint + test + build + tsc → 标准门禁
  └─ 第 4 层 e2e 截图（可选）→ InkAprCalculator + ScenarioControls + button 视觉基准
  → Phase 2 ✅
```

---

## 预期收益（修正后）

| 维度 | Phase 1 | Phase 2 | Phase 3 |
| --- | --- | --- | --- |
| 消除硬编码处 | 19 | ~40 | 3 |
| 新增 token | 0 | 3 | 1 |
| 跨组件共享 | — | h-8: 10+ 组件, h-9: 6 组件 | 3 组件 |
| 风险 | 低-中（line-height 冲突已规避） | 中（需视觉回归，InkAprCalculator 需分步） | 极低 |
