# 移动端 Simulation 表格 Grid 布局改造方案

> 文档版本：v1.2（二次核对 + 补齐测试用例）
> 创建日期：2026-05-08
> 修订日期：2026-05-10
> 适用版本：aaveapy v1.0+
> 关联文件：
> - [src/components/dashboard/SimulationSubRow.tsx](../../src/components/dashboard/SimulationSubRow.tsx)
> - [src/components/dashboard/SimulationSubRow.compact.test.tsx](../../src/components/dashboard/SimulationSubRow.compact.test.tsx)
> - [src/components/dashboard/MobileExpandedReserveShell.tsx](../../src/components/dashboard/MobileExpandedReserveShell.tsx)

---

## 0. 前置状态（v1.1 新增）

撰写本计划时工作区已 `clean`，原方案"第一步 Commit 当前修改"已完成，相关 commit 包含：

- `33880b6 refactor: extract shared progress ring content, use data-disabled group pattern for simulation disabled state`
- `289d881 fix: improve disabled state text readability in simulation table`
- 以及更早的 `tight` 模式 padding 收紧改动

下文从「第二步 Grid 改造」开始。

## 1. 改造目标

彻底解决移动端 Simulation 展开内容溢出问题，同时实现以下视觉与交互目标：

1. **Label + Cap 一行优先**：`Supplied / Cap $XX.XM` 优先在同一行显示，利用右侧 Current 列的视觉间隙。
2. **间隙用满后自动换行**：当 Label + Cap 内容超出 Label 列宽度时，自动换行显示，而不被截断或省略。
3. **禁止横向滚动**：彻底移除 `overflow-x-auto`，通过布局设计确保内容不溢出屏幕。
4. **桌面端零回归**：桌面端继续使用现有 `<table>` 布局，视觉与交互保持不变。
5. **移动端面板更宽**：通过调整 panel padding，增加可用内容宽度。

## 2. 当前实现核对（v1.1 修订）

### 2.1 当前实现并非"单纯 table-fixed + 百分比"
[SimulationSubRow.tsx](../../src/components/dashboard/SimulationSubRow.tsx) 已经做了多轮压缩：

- L501–L510：`tight` 模式动态切换 padding：
  - `metricCellPx = 'pl-2 pr-0.5'`
  - `valueCellPx  = 'px-0.5'`
  - `deltaCellPx  = 'pl-0.5 pr-2'`
  - `numericFontClass = 'ds-text-11'`（compact 下数字降一档字号）
- L646–L666：`renderCompactLayout` 显式注释 "Hard-disable horizontal scroll on mobile: table-fixed + explicit fractional column widths"，使用 `colgroup` 写死 `34% / 22% / 22% / 22%`。
- L528–L546：label + cap 用 `whitespace-nowrap` 视觉溢出到右侧 Current 列空隙；外层 `overflow-hidden` 兜底裁剪，已避免横向滚动。

### 2.2 仍未解决的问题
- 当 label + cap 同时较长（典型：Celo USDT `Supplied / Cap $19.50M`）时，溢出空间被吃满后**没有自动换行机制**，文字会与右侧数字过近、视觉拥挤。
- `table-fixed` 无法表达"先溢出列、再自动换行"的语义。

### 2.3 文件中的多个 `<table>`（v1.1 新增）
本次仅替换 `renderCompactLayout`（L639）这一处，**不要碰**：

| 行号 | 用途 | 处理 |
|------|------|------|
| L657 | 移动端 compact `<table>` | ✅ 改造目标 |
| L769 | renderTable 桌面端主表 | ❌ 保留 |
| L1041 | renderTable 桌面端兜底 | ❌ 保留 |

代码审查 checklist 必须包含「桌面端 `<table>` 数量与改造前一致（≥2）」。

### 2.4 `renderRow` 是桌面 / 移动**共享**渲染器（v1.2 新增 — 致命发现）

[L684, L741](../../src/components/dashboard/SimulationSubRow.tsx#L684) 移动端 compact 直接调用同一个 `renderRow(..., true /* tight */, ...)`，该函数 L524–L636 内部产生 `<tr><td>...</td></tr>`，桌面端 `renderTable`（L800）也调用它。

**结论**：§4.1 步骤 1「抽取行数据模型」不是优化项，而是**前置必须**。可选实现策略：
- ✅ **推荐**：抽 `buildRowDescriptor(row, ...)` 纯数据函数，分别提供 `renderRowAsTable(desc)`（桌面）与 `renderRowAsGrid(desc)`（移动）。
- ❌ 不要给 `renderRow` 加 `mode` 参数：会让单函数维护两套 DOM 模板。
- ❌ 不要复制粘贴 `renderRow` ≈110 行：双份维护成本不可接受。

### 2.5 `renderCompactLayout` 内**还有两行内联 `<tr>`**（v1.2 新增）

L685–L740 的 **Spread 行** 与 **Liquidity 行**直接写在 `renderCompactLayout` 里、**不走** `renderRow`。改 Grid 时必须同步重写并纳入测试用例（详见 §5.1 TC-08、TC-09）。

## 3. Grid 布局方案设计

### 3.1 核心思路
将 `renderCompactLayout` 内层从 `<table>` 改为 CSS Grid：

- Label 列 `1fr`：自适应剩余宽度，优先容纳 label + cap。
- 数字列 `auto`：按内容宽度分配，保证数字不被压缩。
- 内容超出列宽时自动换行，不会溢出屏幕。

### 3.2 模板结构

```tsx
<div
  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1"
  role="table"
  aria-label="Simulation breakdown"
>
  {/* Header Row */}
  <div className="contents" role="row">
    <div className="px-2 py-1 bg-muted/30 border-b border-border/50" role="columnheader">{tokenOnChainLabel}</div>
    <div className="px-0.5 py-1 bg-muted/30 border-b border-border/50 text-right whitespace-nowrap" role="columnheader">Current</div>
    <div className="px-0.5 py-1 bg-muted/30 border-b border-border/50 text-right whitespace-nowrap" role="columnheader">After</div>
    <div className="px-0.5 py-1 bg-muted/30 border-b border-border/50 text-right whitespace-nowrap" role="columnheader">Δ</div>
  </div>

  {/* Data Row（每条 row 一组 4 cell + 可选 col-span-4 行） */}
  <div className="contents" role="row">
    <div className="px-2 py-1 min-w-0" role="cell">
      <div className="flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap">
        <span className="ds-text-12">{label}</span>
        {cap != null && (
          <span className="ds-text-11 tabular-nums">/ Cap {formatScenarioSize(cap)}</span>
        )}
      </div>
    </div>
    <div className="px-0.5 py-1 text-right whitespace-nowrap" role="cell">
      <span className="ds-text-11 tabular-nums">{formatValue(current)}</span>
    </div>
    <div className="px-0.5 py-1 text-right whitespace-nowrap" role="cell">
      <span className="ds-text-11 tabular-nums">{formatValue(after)}</span>
    </div>
    <div className="px-0.5 py-1 text-right whitespace-nowrap" role="cell">
      <span className="ds-text-11 tabular-nums">{formatDelta(delta)}</span>
    </div>
  </div>

  {/* Cap Progress Row（可选，col-span-4） */}
  {capBar && (
    <div className="col-span-4 pt-0 pb-1 pl-0.5 pr-2" role="row">
      <div className="relative h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        {/* current / after 双色条同当前实现 */}
      </div>
    </div>
  )}

  {/* Cap Note Row（可选，col-span-4） */}
  {capNote && (
    <div className="col-span-4 pt-0 pb-0.5 pl-2 pr-0.5" role="row">
      <p className="ds-text-11 text-muted-foreground whitespace-normal break-words">{capNote}</p>
    </div>
  )}
</div>
```

> ⚠️ `flex flex-wrap` 与 `whitespace-nowrap` 组合：每个子 `<span>` 内部不换行，但 flex 容器本身允许在 span 之间换行——正好实现"label 一行装得下就一行，装不下让 cap 整体换到第二行"。

### 3.3 样式细节
- **列模板**：`grid-cols-[1fr_auto_auto_auto]`
- **间隙**：`gap-x-2 gap-y-1`（水平 8px、垂直 4px）
- **数字列**：`text-right whitespace-nowrap tabular-nums ds-text-11`
- **跨行元素**：cap progress / cap note / placeholder 全部 `col-span-4`
- **边框**：header 行靠 `border-b border-border/50` 在每个 cell 上重复一次（或用 grid line 模拟）

### 3.4 移动端面板宽度优化
[MobileExpandedReserveShell.tsx#L80](../../src/components/dashboard/MobileExpandedReserveShell.tsx#L80) 当前内层 panel 使用 `ds-card-pad-sm`（12px 水平 padding）。建议改为 `px-2 py-3`，节省 4px × 2 = 8px 横向空间。

> 注意：先确认 `ds-card-pad-sm` 是否还被其他地方依赖；若是，仅在该处覆盖（添加 `px-2`）以避免连锁影响。

## 4. 实现步骤（v1.1 修订）

### 4.1 代码改造
1. **抽取行数据模型**：把当前 `renderRow` 内部计算的 `row` → cell 渲染数据（label / cap / current / after / delta / capNote / capBar 等）抽成纯数据函数，桌面端和移动端共用，**避免在 `renderRow` 内部直接复用 `<td>` 拼装**——否则桌面端的 colSpan/align-key 行为会被 Grid 改动污染。
2. **新增 `renderCompactRow` 函数**：消费上述数据模型，输出 `<div role="cell">` Grid 子项；包含 main row、可选 cap progress（col-span-4）、可选 cap note（col-span-4）、可选 placeholder。
3. **改写 `renderCompactLayout`（L639）**：
   - 移除 `<table>/<colgroup>/<thead>/<tbody>`。
   - 改为顶层 `<div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1" role="table">`。
   - Header 用 4 个 `<div role="columnheader">`。
   - body 通过 `renderCompactRow` 输出。
4. **保留 `renderTable`（L769、L1041）一字不动**。
5. **调整 panel padding**：[MobileExpandedReserveShell.tsx#L80](../../src/components/dashboard/MobileExpandedReserveShell.tsx#L80) 的 `ds-card-pad-sm` 局部覆盖为 `px-2`，垂直 padding 保留。

### 4.2 测试改造
[SimulationSubRow.compact.test.tsx](../../src/components/dashboard/SimulationSubRow.compact.test.tsx) 当前 74 行、断言基于 `<td>` 结构。Grid 改造后这些断言**几乎全部失效**，需要：

- 完全重写 DOM 查询断言（不再用 `td`，改用 `[role="cell"]` / `[role="columnheader"]`）。
- 新增 Grid 行为断言：
  - 容器具有 `grid-cols-[1fr_auto_auto_auto]` 类。
  - Cap progress / Cap note `<div>` 含 `col-span-4`。
  - Label cell flex container 同时具备 `flex-wrap` 与子级 `whitespace-nowrap`。
- 保留无障碍断言：`role="table"` / `role="row"` / `role="cell"` / `aria-label`。

### 4.3 渐进式策略
- 旧 table 实现可临时通过 feature flag（`?simGrid=1` 之类的 URL query 或 env）保留一周做 A/B 验证；上线稳定后再删除。
- 若不引入 flag，则确保 PR 包含完整快照截图比对（详见 §6）。

### 4.4 验证点
1. **Celo USDT**：`Supplied / Cap $19.50M` 在窄屏一行内完整显示，不截断、不与右侧数字重叠。
2. **极端长 cap**（如 `/ Cap $1.23B`）：自动换行到第二行，与 label 整体可读。
3. **数字列对齐**：Current / After / Δ 三列右对齐宽度一致；不同行之间数字列宽度保持一致（`auto` + 同字号 + tabular-nums 保证）。
4. **零横向滚动**：极端输入（如 supply=10000）下不出现横向滚动条，panel 内不出现裁剪箭头。
5. **桌面端无变化**：本仓库已有的桌面端 e2e / 截图无 diff。
6. **a11y 检查**：`role="table"` 下读屏可正确遍历行 / 单元格。

## 5. 测试用例（v1.2 新增 — TDD 提前定义）

### 5.0 测试策略
现有 [SimulationSubRow.compact.test.tsx](../../src/components/dashboard/SimulationSubRow.compact.test.tsx) 是**源码正则**风格（`readFileSync` + regex），刻意避开了构造 simulation fixture 的成本。本次改造延续此风格 + 补充少量 RTL 渲染断言：

- **保留** 源码正则测试（结构 invariants），重写所有断言。
- **新增** RTL 渲染测试（行为 invariants：长 cap、wrap、a11y），用最小 fixture（mock simulation 对象）。

理由：Grid 的核心价值是「先溢出后换行」，必须真实渲染才能验证；但 invariants（如"必须含 grid-cols-[1fr_auto_auto_auto]"）正则即可锁定。

### 5.1 测试用例清单

| ID | 类型 | 用例 | 断言 |
|----|------|------|------|
| **TC-01** | 源码正则 | renderCompactLayout 不再含 `<table>` / `table-fixed` / `<colgroup>` | `block.match(/<table/)` 为 null；`/table-fixed/` 为 null |
| **TC-02** | 源码正则 | renderCompactLayout 顶层是 grid 容器 | `/grid-cols-\[1fr_auto_auto_auto\]/` 命中 1 次 |
| **TC-03** | 源码正则 | 不引入横向滚动 | `/overflow-x-(auto|scroll)/` 不命中（保持现有断言） |
| **TC-04** | 源码正则 | 数字列保留 `whitespace-nowrap tabular-nums ds-text-11` | 命中 ≥ 3 次 |
| **TC-05** | 源码正则 | Cap progress / Cap note / placeholder 行使用 `col-span-4` | 至少命中 3 处 |
| **TC-06** | 源码正则 | label 列容器使用 `flex flex-wrap items-baseline` | 命中 1 次 |
| **TC-07** | 源码正则 | 无障碍角色齐全 | `/role="table"/` `/role="row"/` `/role="cell"/` `/role="columnheader"/` 各命中 ≥ 1 |
| **TC-08** | 源码正则 | Spread 行已重写为 Grid（不再含 `<tr><td>` 形式的 Spread 块） | 在 renderCompactLayout 内不出现 `<tr.*>\s*<td.*>Spread` |
| **TC-09** | 源码正则 | Liquidity 行已重写为 Grid | 同上，针对 Liquidity 块 |
| **TC-10** | 源码正则 | 桌面端 `renderTable` 仍含 2 处 `<table className="w-full min-w-0 table-fixed">` | 命中次数 = 2 |
| **TC-11** | RTL 渲染 | **短 label**（`Supplied`）+ 短 cap → 一行内显示 | label 与 cap 在同一 flex 行（`getBoundingClientRect().top` 相同） |
| **TC-12** | RTL 渲染 | **长 label + cap**（mock `Supplied / Cap $19.50M`，window 360px） | 仍在一行（吃掉右侧间隙） |
| **TC-13** | RTL 渲染 | **极端长 cap**（mock `/ Cap $1.234567B`） | label 与 cap 分两行（cap 整体换行，未截断、未与数字重叠） |
| **TC-14** | RTL 渲染 | **极端 supply 输入**（mock supply=10000，强制大数字） | 容器 `scrollWidth <= clientWidth`（无横向滚动） |
| **TC-15** | RTL 渲染 | **数字列宽度跨行一致** | 同列 3 行 cell 的 `getBoundingClientRect().width` 误差 ≤ 1px |
| **TC-16** | RTL 渲染 | **Disabled 状态** | `data-disabled="true"` 下数字 cell 含 `text-muted-foreground` |
| **TC-17** | RTL 渲染 | **Cap warning 高亮** | warning row 含 `ds-bg-warning-row` |
| **TC-18** | RTL 渲染 | **Reward 行 / Native 行 breakdown indent** | 子行 cell 含 `ml-2`/`ml-3`/`ml-4` 之一 + `border-l` |
| **TC-19** | RTL 渲染 | **a11y**：Tab 键可遍历到每个 columnheader | `axe` 无 violation |
| **TC-20** | 视觉回归 | 7 场景手动截图比对 | Celo USDT / 长 cap / 极端 supply / disabled / frozen / paused / reward — 均与设计稿一致 |

### 5.2 验收 Gate（合并前必须全部通过）

```bash
npm run lint            # ✅
npm test                # ✅ 含 TC-01 ~ TC-19
npm run build           # ✅
npx tsc --noEmit        # ✅
```

外加：
- [ ] TC-20 截图比对完成并附 PR 描述
- [ ] [docs/conventions/frontend-regression-checklist.md](../conventions/frontend-regression-checklist.md) 中 Reserves table / Simulation 条目逐项过

### 5.3 TDD 顺序建议

1. 先写 TC-01 ~ TC-10（源码正则） → 全部 RED。
2. 抽 `buildRowDescriptor`（重构，旧测试不应破坏） → GREEN。
3. 实现 `renderRowAsGrid` + 重写 `renderCompactLayout` → TC-01 ~ TC-10 GREEN。
4. 写 TC-11 ~ TC-19（RTL fixture） → 必要时增量调样式 → GREEN。
5. TC-20 视觉比对收尾。

## 6. 优势与风险

### 6.1 优势
- Grid 的弹性列宽 + 内容自适应，从机制上杜绝溢出。
- 桌面端零改动（`renderTable` 不动），降低回归面。
- 行内 col-span-4 表达 cap progress / cap note 比 `<table colSpan={4}>` 更直观。

### 6.2 风险与缓解
| 风险 | 缓解 |
|------|------|
| HTML 语义从 `<table>` 退化为 `<div>` | 显式 `role="table"/"row"/"cell"/"columnheader"` + `aria-label`；通过 axe 测试（TC-19）。 |
| 行高在不同 row 间不一致（cap bar/cap note 行高不同） | gap-y 统一控制；placeholder 行保留同样 col-span-4 高度策略。 |
| Label 列 wrap 后影响整体行高，破坏数字行垂直对齐 | 数字 cell 设 `align-self: start` 或 `items-start`；视觉以 baseline 对齐（TC-15 锁定）。 |
| `renderRow` 桌面端 / 移动端共享，重构易破坏桌面端 | §2.4 推荐策略：抽 `buildRowDescriptor` 数据模型；TC-10 锁定桌面端 `<table>` 数量。 |
| 测试需要大改 | §5 已用 TDD 顺序定义 20 条用例。 |
| 桌面端被误改 | TC-10 + PR review checklist：搜索 `<table` 数量未减少。 |
| Disabled / Frozen / Paused / Reward 多分支需逐一验证 | TC-16/17/18 + TC-20 视觉比对覆盖。 |

## 7. 时间估算（v1.2 修订）

| 任务 | 估算 |
|------|------|
| 抽取 `buildRowDescriptor` 数据模型（§2.4 前置必须） | 2.5h |
| 实现 `renderRowAsGrid` + 改写 `renderCompactLayout`（含 Spread / Liquidity 行） | 2.5h |
| 调整 panel padding | 0.5h |
| 重写源码正则测试 TC-01 ~ TC-10 | 1.0h |
| 新增 RTL 渲染测试 TC-11 ~ TC-19（含 fixture） | 2.5h |
| 多分支回归 + 视觉回归 TC-20（7 场景截图） | 1.5h |
| **总计** | **10.5h** |

> v1.1 估算 9h 未单独列 RTL 测试与 fixture 成本；v1.2 拆分后更接近真实工作量。

## 8. 回滚方案

- 改造控制在「`renderCompactLayout` + `buildRowDescriptor` + `renderRowAsGrid` + panel padding」范围内，回滚 = `git revert` 单 PR。
- 若希望保留 `buildRowDescriptor` 重构（桌面端无回归）但回退 Grid 视觉，可分 commit 推送，便于精细 revert。

## 9. 后续优化

- Grid 列宽比可调成 `grid-cols-[2fr_minmax(0,auto)_minmax(0,auto)_minmax(0,auto)]` 以给数字列设上限。
- 横竖屏切换可结合 `useMediaQuery` 切换 gap-x。
- 若未来引入更多列（如 APY），Grid 模板拓展成本远低于 `colgroup`。
- 桌面端是否一并迁移到 Grid，可作为 v2 议题独立评估。
