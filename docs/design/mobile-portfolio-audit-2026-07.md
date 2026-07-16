# Mobile Portfolio Simulation 设计审计

**初次审计日期**: 2026-07-16
**更新审计日期**: 2026-07-16 (代码更新后复审 + 结构修订)
**审计工具**: impeccable audit (product register)
**审计范围**:
- `src/components/dashboard/MobilePortfolioCard.tsx` (515 行)
- `src/components/dashboard/PortfolioTablePrimitives.tsx` (403 行)
- `src/components/dashboard/PortfolioPanel.tsx` (738 行)
- `src/components/dashboard/portfolioTheme.ts` (22 行)

**参考基准**:
- `PRODUCT.md` — 产品要求（WCAG AA、触控目标 44px、reduced-motion、屏幕阅读器）
- `docs/design/DESIGN-SYSTEM-REFERENCE.md` — 可复用设计规则（§3 文字与边框、§4 布局原则、§10 无障碍与键盘）
- `AGENTS.md` — 移动端规则（禁止 `hover:`、触控目标 ≥44px）
- impeccable `SKILL.md` — 绝对禁令（gradient text 等）+ `reference/audit.md` 审计格式
- `docs/design/mobile-portfolio-simulation.md` — 原始设计文档（用于矛盾检查）

---

## 代码更新变更日志

上次审计后代码有以下变更（影响审计结论）：

| 变更 | 位置 | 审计影响 |
|------|------|----------|
| Token header 从双行改为单行紧凑布局（chain 标签右对齐 `ml-auto`） | :198-219 | 新问题 #9 |
| TokenIcon 20px（原 16px），token 名称 `ds-text-14`（原 `ds-text-13`） | :211-213 | 改善 |
| Hub 信息已移除 | :218 | 改善（简化） |
| Pill tabs 更紧凑 `gap-0.5`（原 `gap-[var(--ds-space-1)]`） | :222 | 改善 |
| Metrics strip 从 `gap-px + bg-border/40` 改为 `divide-x divide-border/40` | :270 | #10 部分解决 |
| Metrics strip 仍保留 `ring-1 ring-border/50`（原 `ring-border/60`） | :270 | #10 仍存在 |
| Total 值升级为 `ds-text-14 font-bold`（原 `ds-text-13 font-semibold`） | :273 | 改善 |
| Native 值降为 `text-foreground/75`（原 `text-foreground/80`） | :279 | 微调 |
| Incentive 渐变文字仍在 | :290 | #3 未修复 |
| Daily earnings 背景改为 `bg-muted/25 active:bg-muted/50`（原 `active:bg-muted/40`） | :316 | #12 部分改善 |
| Daily earnings 标签加了 `font-medium` | :319 | 改善 |
| ListCollapse 图标仍为 `h-3 w-3` | :325 | #12 未完全解决 |
| Panel header 移动端文案简化为 `'Simulation only.'` | PortfolioPanel:388 | 改善 |
| 卡片间距仍为 `space-y-2` | :452 | #11 未修复 |
| Summary 仍缺 $/day 分项 | :481-509 | #5 未修复 |

---

## Audit Health Score

| # | 维度 | 评分 | 关键发现 |
|---|------|------|----------|
| 1 | Accessibility | 1/4 | 多个触控目标 < 44px（移除 26px、清除 32px、Pill tab 28px、展开 27px）；Pill tab 缺 ARIA tablist 语义；reduced-motion 缺失 |
| 2 | Performance | 3/4 | framer-motion `height:auto` 动画是布局属性动画，但在单卡片展开/折叠场景下影响可控 |
| 3 | Responsive | 1/4 | 4/6 交互元素触控目标不达标；token symbol `truncate` 违反"never truncate"强制规则；`hover:` 未加移动端 guard |
| 4 | Theming | 3/4 | token 使用一致；暗色模式覆盖完整；`text-foreground/75` 非标准透明度档位 |
| 5 | Anti-Patterns | 3/4 | Incentive 值使用渐变文字（impeccable 绝对禁令，但与品牌签名有张力）；其余设计刻意且无 AI slop |
| **Total** | | **11/20** | **Acceptable — 需要显著改进** |

**Rating bands**: 18-20 Excellent (minor polish) · 14-17 Good (address weak dimensions) · 10-13 Acceptable (significant work needed) · 6-9 Poor (major overhaul) · 0-5 Critical

---

## Anti-Patterns Verdict

**Pass/fail**: Partial fail — 1 noticeable tell.

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Gradient text | ⚠️ Tell | `MobilePortfolioCard.tsx:290` — Incentive 值使用 magenta→cyan 渐变文字（`bg-clip-text text-transparent`） |
| AI color palette | ✅ Pass | 语义色体系（emerald/cyan/amber/red）有意为之，非紫色渐变 AI 套路 |
| Glassmorphism | ✅ Pass | 无 glass card / backdrop-blur 滥用 |
| Hero-metric template | ✅ Pass | 等权三列 metric strip，刻意避免了 hero-metric 模板 |
| Identical card grids | ✅ Pass | 卡片虽重复，但每张含不同 reserve 数据，非 icon+heading+text 套路 |
| Eyebrow / numbered markers | ✅ Pass | 微型大写标签仅用于数据表列头，非 eyebrow 滥用 |
| Bounce easing | ✅ Pass | 使用 `[0.25, 0.1, 0.25, 1]`（ease-out 变体） |

**Gradient text 细节**: impeccable `SKILL.md` "Absolute bans" 禁止 `background-clip: text` + gradient，称之为 "Decorative, never meaningful"。但 `AGENTS.md` 将 magenta→cyan 渐变描述为"品牌签名"（brand signature）。此冲突需用户裁决：
- **一致性论点**（有效）：桌面端 `PortfolioUnifiedTable.tsx` 同列用 `SUPPLY_COLOR` / `BORROW_COLOR`（emerald/cyan 实色），移动端用品牌渐变——两端不一致。
- **品牌身份论点**：magenta→cyan 是项目品牌签名，在特定位置使用可视为有意为之。
- **建议**：无论最终保留还是移除，至少应与桌面端保持一致。如保留，需在 AGENTS.md 中为 impeccable gradient text 禁令添加明确例外。

---

## Executive Summary

- **Audit Health Score**: 11/20 (Acceptable)
- **Issues found**: 2 P0 · 5 P1 · 5 P2 · 4 P3 = 16 total
- **Top 5 critical issues**:
  1. **Token symbol `truncate`** 违反 "never truncate" 强制规则（`DESIGN-SYSTEM-REFERENCE.md` §3）
  2. **4/6 交互元素触控目标 < 44px**（`PRODUCT.md` 明确要求 "touch targets meet 44px minimum"）
  3. **`hover:` 未加移动端 guard** — 3+ 元素使用 `hover:` 而无 `md:` 前缀（`AGENTS.md`："移动端禁止 `hover:`"）
  4. **framer-motion 动画无 reduced-motion 支持**（`PRODUCT.md` 要求 "Reduced motion support for all animations"）
  5. **Pill tabs 缺 ARIA tablist 语义** — 无 `role="tablist"` / `role="tab"` / `aria-selected`（`PRODUCT.md` 要求 "Screen reader optimization with proper ARIA labels"）
- **Recommended next steps**: 先修复 P0（truncate + 触控目标），再处理 P1（hover→active、reduced-motion、ARIA、渐变文字决策、信息对等）

---

## Detailed Findings by Severity

### P0 — Blocking (prevents WCAG AA compliance, violates mandatory rules)

#### #1. Token symbol `truncate` 违反 "never truncate" 强制规则

**Location**: `MobilePortfolioCard.tsx:212`
**Category**: Responsive / Anti-Pattern
**Impact**: Token symbol（如 `syrupUSDT`）在窄屏下会被尾部截断，丢失关键信息；设计系统明确禁止此行为。
**Standard**: `DESIGN-SYSTEM-REFERENCE.md` §3: "禁止使用 `truncate` / 尾部省略号、`break-all`、逐字符换行或中间截断"。

```tsx
// :212 — 当前
<span className={cn('ds-text-14 font-semibold truncate', ...)}>
  {entry.tokenSymbol}
</span>
```

**Recommendation**: 移除 `truncate`，改用 `break-words` + `min-w-0` + flex 父级 `flex w-full min-w-0`，遵循"优先单行、放不下时换行"规则。

---

#### #2. 多个交互元素触控目标 < 44px

**Location**: `MobilePortfolioCard.tsx` + `PortfolioTablePrimitives.tsx`
**Category**: Accessibility / Responsive
**Impact**: 移动端用户难以准确点击，违反 WCAG 2.5.5 (AAA) 和 PRODUCT.md 明确要求。
**Standard**: `PRODUCT.md` "touch targets meet 44px minimum on all devices"；`DESIGN-SYSTEM-REFERENCE.md` §4 "触控目标 ≥ 44×44px"。

| 元素 | 文件:行 | padding | icon | 实际尺寸 | 达标 |
|------|---------|---------|------|----------|------|
| 移除按钮 | MobilePortfolioCard:203 | `p-1.5` (6px) | `size-3.5` (14px) | ~26px | ❌ |
| 清除按钮 (Eraser) | Primitives:394 | `p-2` (8px) | `size-4` (16px) | ~32px | ❌ |
| Pill tab | MobilePortfolioCard:227 | `py-1` (4px) + container `p-0.5` (2px) | text ~16px | ~28px | ❌ |
| 展开按钮 | MobilePortfolioCard:315 | `py-1.5` (6px) | content ~15px | ~27px | ❌ |
| $/T 切换 | Primitives:349 | `h-11 w-11` | — | 44px | ✅ |
| WarningMarker | Primitives:125 | `min-w-[44px] min-h-[44px]` | — | 44px | ✅ |

**Note**: 原始设计文档 `mobile-portfolio-simulation.md` §7.4 规定移除按钮 "p-2 补足"（44px）和 Pill tab "py-2"（36px），但：(1) 实现使用了更小的 `p-1.5` / `py-1`；(2) 设计文档本身指定 Pill tab 为 36px 已低于 44px 要求。

**Recommendation**: 统一使用 `min-h-[44px]` 显式保证，或增大 padding 使总尺寸 ≥ 44px。Pill tab 至少 `py-2.5`（容器 `p-0.5` + tab `py-2.5` + text ~16px ≈ 41px，仍不足，需 `min-h-[44px]` 补足）。

---

### P1 — Major (significant difficulty, WCAG AA violation, fix before release)

#### #3. Incentive 渐变文字 — 需用户决策

**Location**: `MobilePortfolioCard.tsx:290`
**Category**: Anti-Pattern
**Impact**: 违反 impeccable "Absolute bans" gradient text 禁令；与桌面端不一致。
**Standard**: impeccable `SKILL.md` "Absolute bans": "Gradient text. `background-clip: text` combined with a gradient background. Decorative, never meaningful."

```tsx
// :290
'bg-clip-text text-transparent bg-gradient-to-r from-[rgb(var(--ds-brand-magenta-rgb))] to-[rgb(var(--ds-brand-cyan-rgb))]'
```

**冲突**: `AGENTS.md` 将 magenta→cyan 渐变描述为"品牌签名"。impeccable 禁令与品牌身份存在张力，需用户裁决。

**Recommendation**:
- **方案 A（一致性优先）**: 改为与桌面端一致的实色（`activeColor`，即 emerald/cyan 语义色）。1 行改动。
- **方案 B（品牌保留）**: 如保留渐变作为有意为之的品牌表达，需在 AGENTS.md 中为 impeccable gradient text 禁令添加明确例外，并确保仅用于品牌签名位置（而非所有 incentive 值）。

**Suggested command**: `/impeccable quieter` 或 `/impeccable colorize`

---

#### #4. `hover:` 未加移动端 guard

**Location**: `MobilePortfolioCard.tsx` + `PortfolioTablePrimitives.tsx`
**Category**: Accessibility / Responsive
**Impact**: 移动端无 hover 状态，这些元素在触摸设备上缺少视觉反馈。
**Standard**: `AGENTS.md`: "移动端禁止 `hover:`，改用 `active:`"；`PRODUCT.md`: "WCAG 2.1 AA compliance"。

| 元素 | 文件:行 | 违规 class |
|------|---------|-------------|
| 移除按钮 | MobilePortfolioCard:204-205 | `hover:ds-bg-blue-500-10` / `hover:ds-text-blue-500`（来自 `PORTFOLIO_THEME`） |
| $/T 切换 | Primitives:348 | `hover:bg-muted hover:text-foreground` |
| 清除按钮 | Primitives:394 | `hover:bg-muted/60 hover:text-foreground` |

**Note**: Pill tab 的非选中态已正确使用 `active:text-foreground/70`，是正面参考。

**Recommendation**: 将 `hover:` 替换为 `active:`，或在 Tailwind 中同时使用 `hover:` + `active:` 以覆盖桌面端和移动端。桌面端保留 `md:hover:` 前缀（桌面端不受限）。

---

#### #5. Summary 缺少 Supply/Borrow 的 $/day 分项

**Location**: `MobilePortfolioCard.tsx:481-509`
**Category**: Information Parity
**Impact**: 桌面端 tfoot（`PortfolioUnifiedTable.tsx:408-409`）有独立的 `supplyUsdPerDay` 和 `borrowUsdPerDay` 列，移动端只显示 `netUsdPerDay`，用户无法了解 net 的构成。
**Standard**: `DESIGN-SYSTEM-REFERENCE.md` §4 "移动和桌面应共享相同的语义含义"。

**Recommendation**: 在 Summary 的 Supply/Borrow 区块下各加一行 `$/day`：

```
Supply          Borrow
$15,000         $8,000
3.24%           2.18%
+$1.23/day      -$0.54/day
```

数据源：`PortfolioSummary.supplyUsdPerDay` / `borrowUsdPerDay`（类型已确认存在）。

**Suggested command**: `/impeccable adapt`

---

#### #6. framer-motion 动画无 reduced-motion 支持

**Location**: `MobilePortfolioCard.tsx:331-337`
**Category**: Accessibility
**Impact**: 开启 `prefers-reduced-motion` 的用户仍会看到 `height:auto` 展开动画，违反无障碍承诺。
**Standard**: `PRODUCT.md`: "Reduced motion support for all animations and transitions"；impeccable `SKILL.md`: "Reduced motion is not optional. Every animation needs a `@media (prefers-reduced-motion: reduce)` alternative."

```tsx
// :333-337 — 当前无 reduced-motion 检测
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
```

**Recommendation**: 使用 framer-motion 的 `useReducedMotion()` hook 或 `<MotionConfig reducedMotion="user">` 包裹。在 reduced-motion 模式下跳过动画或使用瞬时切换。

**Suggested command**: `/impeccable harden`

---

#### #7. Pill tabs 缺 ARIA tablist 语义

**Location**: `MobilePortfolioCard.tsx:222-247`
**Category**: Accessibility
**Impact**: 屏幕阅读器无法识别这是 tablist widget，也无法获知当前选中状态。视觉上选中态通过颜色区分，但 ARIA 语义缺失。
**Standard**: `PRODUCT.md`: "Screen reader optimization for data tables with proper ARIA labels"；WCAG 4.1.2 (Name, Role, Value)。

```tsx
// :222 — 容器无 role="tablist"
<div className="mx-3 mb-2 flex gap-0.5 rounded-lg bg-muted/50 p-0.5">
  <button  // 无 role="tab"、aria-selected
    type="button"
    onClick={() => setActiveTab('supply')}
    ...
  >
    Supply
  </button>
```

**Recommendation**:
- 容器加 `role="tablist"`
- 每个 button 加 `role="tab"` + `aria-selected={activeTab === 'supply'}`
- 内容区域加 `role="tabpanel"` + `aria-labelledby`
- 或简化为 toggle button 模式：加 `aria-pressed`

**Suggested command**: `/impeccable harden`

---

### P2 — Minor (annoyance, workaround exists)

#### #8. MetricValue / WarningMarker tooltip 移动端可达性未验证

**Location**: `PortfolioTablePrimitives.tsx:85-101` (MetricValue), `:121-171` (WarningMarker)
**Category**: Accessibility
**Impact**: 两个组件依赖 Radix Tooltip 的 hover 触发。移动端无 hover，tooltip 内容可能不可达。
**Note**: 原始设计文档 `mobile-portfolio-simulation.md` §7.2 声称 "Radix Tooltip 默认支持 pointer 交互，移动端用户 tap 虚线下划线的值即可触发 tooltip"。**此说法未经实际测试验证**——审计未能在浏览器中确认 tap 触发行为。

**Recommendation**:
- **步骤 1（验证）**: 在移动端浏览器（或 Chrome DevTools touch mode）中实际测试 Radix Tooltip 的 tap 行为。
- **步骤 2a（如 tap 可达）**: 确认即可，无需改动。但 `cursor-auto` 在触摸屏上无视觉 affordance，考虑加 `active:` 下划线变粗作为触控反馈。
- **步骤 2b（如 tap 不可达）**: 方案 A——移动端跳过 tooltip 包裹，直接显示 after 值（展开区域已有完整 DeltaRow 覆盖 delta 信息，tooltip 在移动端冗余）。给 `MetricValue` 加 `skipTooltip?: boolean` prop，移动端传 `true`。

---

#### #9. framer-motion `height:auto` 是布局属性动画

**Location**: `MobilePortfolioCard.tsx:333-337`
**Category**: Performance
**Impact**: `height` 是 CSS 布局属性，动画期间每帧触发 layout recalculation。单卡片场景影响可控，但多卡片同时展开时可能掉帧。
**Standard**: impeccable `SKILL.md`: "Don't animate CSS layout properties unless truly needed."

**Recommendation**: 低优先级——当前场景（单卡片展开/折叠，内容量小）影响可控。如后续出现性能问题，可改用 `transform: scaleY` + `transform-origin: top` 替代，或使用 framer-motion 的 `layout` prop。

---

#### #10. Metrics strip ring 造成视觉双重边框

**Location**: `MobilePortfolioCard.tsx:270`
**Category**: Visual Quality
**Impact**: strip 的 `ring-1 ring-border/50` 与卡片本身的 `border border-border/60` 形成双重边框，视觉累赘。

**更新前**: `gap-px + bg-border/40 + ring-1 ring-border/60`
**更新后**: `divide-x divide-border/40 + ring-1 ring-border/50`（改善：语义更正确，ring 透明度降低）
**遗留**: strip 仍有 `ring-1`，与卡片外框形成双层。

**Recommendation**: 去掉 strip 的 `ring-1`，改为 `border border-border/30`（降一级视觉权重），或完全移除 ring 依赖 `divide-x` + 背景色区分。

---

#### #11. 卡片间距偏紧（主观）

**Location**: `MobilePortfolioCard.tsx:452`
**Category**: Visual Quality
**Impact**: 每张卡片含 6 层内容（header + tabs + input + metrics + earnings + expand），`space-y-2` (8px) 在移动端显得拥挤。
**Note**: 纯主观判断，无设计规则直接引用。8px 在移动端列表中是常见值。

**Recommendation**: 改为 `space-y-3` (12px) 给更多呼吸空间。如用户认为 8px 可接受则保留。

---

#### #12. Pill tabs 切换内容硬跳变

**Location**: `MobilePortfolioCard.tsx:130`
**Category**: Interaction Quality
**Impact**: 切 tab 时 CompactInput 值、metrics strip、daily earnings 全部硬切换。`transition-all duration-200` 仅在 pill 按钮本身，内容区域无过渡。功能正常，仅缺视觉过渡。
**Note**: 优先级低——功能上无问题。

**Recommendation**: 给内容区域加极轻 fade-through（100ms）。需 `AnimatePresence` 或 CSS keyframe，工作量中等。

---

### P3 — Polish (nice-to-fix, no real user impact)

#### #13. Expand toggle 图标偏小

**Location**: `MobilePortfolioCard.tsx:325`
**Category**: Visual Discoverability
**Impact**: `ListCollapse` 图标 `h-3 w-3` (12px) 在移动端偏小，影响可发现性。背景和 active 态已改善。

**Recommendation**: 改为 `h-3.5 w-3.5` (14px)，在可发现性和紧凑性之间取平衡。

---

#### #14. Token header 单行布局 chain 标签截断风险

**Location**: `MobilePortfolioCard.tsx:198-219`
**Category**: Responsive
**Impact**: 单行 `[remove] [icon] [name] [chain ml-auto]` 布局在 320px 视口下可能挤压 chain 标签。实际风险低（token 名称通常 ≤6 字符）。

**Recommendation**: 保持现状，在 320px 视口下测试确认。如 chain 标签被截断，加 `shrink-0`。

---

#### #15. 非标准透明度档位

**Location**: `MobilePortfolioCard.tsx:279` (`text-foreground/75`)
**Category**: Theming
**Impact**: `/75` 不是 Tailwind 标准透明度步进（标准为 `/70`、`/80`）。轻微不一致，无功能影响。

**Recommendation**: 统一为 `text-foreground/70` 或 `text-foreground/80`。

---

#### #16. 微型大写标签 — 保留（无需修改）

**Location**: `MobilePortfolioCard.tsx:272`
**Category**: —
**Judgment**: `tracking-[0.06em]` 在数据表列头语境下是合理的数据表格惯例，非 eyebrow 滥用。**保留**。

---

## Patterns & Systemic Issues

### 1. 触控目标系统性不足（4/6 元素不达标）

并非个别遗漏，而是**设计文档到实现的系统性偏差**：
- 设计文档 `mobile-portfolio-simulation.md` §7.4 规定 Pill tab 为 36px——**设计文档本身已低于 44px 要求**
- 设计文档 §7.1 声称 `p-2 size-4` = 44px——**数学错误**（实际 32px）
- 实现进一步偏离（`p-1.5` 替代 `p-2`，`py-1` 替代 `py-2`）

**根因**: 设计文档的触控目标计算有误，且实现未使用 `min-h-[44px]` 显式保证。

### 2. `hover:` 泛滥（3+ 元素）

多个交互元素使用 `hover:` 而无 `md:` 前缀 guard，违反 AGENTS.md 移动端规则。Pill tab 的非选中态正确使用了 `active:` 是正面参考，说明团队知道规则但未全面执行。

### 3. Tooltip 可达性假设未验证

设计文档 §7.2 假设 Radix Tooltip 支持 tap 触发，但从未在真实移动端浏览器中验证。`MetricValue` 和 `WarningMarker` 都依赖此假设。如果假设错误，两个组件在移动端的 tooltip 内容完全不可达。

---

## Positive Findings

| 做法 | 位置 | 说明 |
|------|------|------|
| 等权三列 metric strip | :270-305 | 刻意避免 hero-metric 模板，与桌面端表格哲学一致 |
| Progressive disclosure | :331-419 | 展开/折叠提供完整 delta + cap details + wallet vs effective，核心数据一眼可见、细节按需展开 |
| DeltaRow 显式展示 | :60-92 | current→after+delta 在展开区域完整呈现，弥补了 tooltip 在移动端的潜在缺失 |
| 语义色一致 | 全局 | emerald=Supply、cyan=Borrow、amber=警告，与桌面端完全对齐 |
| 暗色模式覆盖 | 全局 | `dark:text-emerald-400` 等显式 dark 变体，token 使用一致 |
| CompactInput CSS 响应式 | Primitives:349,384 | `h-11 md:h-5` 等通过 `md:` 前缀精确控制移动/桌面尺寸差异，桌面端行为不变 |
| WarningMarker 44px 触控 | Primitives:125 | `min-w-[44px] min-h-[44px]` + `-my-2` 负 margin，正确实现触控目标不占额外布局空间 |
| $/T 切换 44px | Primitives:349 | `h-11 w-11` 移动端正确达标 |
| Pill tab 非选中态 `active:` | :230,242 | 正确使用 `active:text-foreground/70` 而非 `hover:`，是 `hover:` 问题的正面参考 |
| 输入框 44px | Primitives:384 | `h-11` 移动端正确达标 |
| Token icon 放大 | :211 | 20px（桌面 14px），提升移动端可读性 |

---

## Recommended Actions

| 顺序 | 优先级 | 命令 | 描述 |
|------|--------|------|------|
| 1 | P0 | `/impeccable adapt` | Token symbol `truncate` → `break-words` + `min-w-0`（#1） |
| 2 | P0 | `/impeccable adapt` | 触控目标统一 `min-h-[44px]`（#2，4 个元素） |
| 3 | P1 | `/impeccable quieter` | 渐变文字 → 实色（#3，需用户决策品牌 vs 一致性） |
| 4 | P1 | `/impeccable adapt` | `hover:` → `active:` 或 `md:hover:` guard（#4，3+ 元素） |
| 5 | P1 | `/impeccable adapt` | Summary 加 $/day 分项（#5，~10 行） |
| 6 | P1 | `/impeccable harden` | framer-motion reduced-motion 支持（#6） |
| 7 | P1 | `/impeccable harden` | Pill tabs ARIA tablist 语义（#7） |
| 8 | P2 | `/impeccable audit` | 验证 Radix Tooltip tap 行为（#8，需浏览器测试） |
| 9 | P2 | `/impeccable polish` | Metrics strip ring → border/30（#10，1 行） |
| 10 | P2 | `/impeccable polish` | 卡片间距 `space-y-3`（#11，1 行，主观） |
| 11 | P3 | `/impeccable polish` | ListCollapse `h-3.5 w-3.5`（#13，1 行） |
| — | — | `/impeccable polish` | 最终 polish pass（#15 透明度统一等零散项） |

> Re-run `/impeccable audit` after fixes to see your score improve.
