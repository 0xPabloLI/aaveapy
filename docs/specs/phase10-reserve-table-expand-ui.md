# Phase 10: Reserve Table Expand UI Fixes

> Issues: AAV-1121, AAV-1084
> Related (closed as non-bug/fixed): AAV-1107 (pin scroll — fixed), AAV-1114 (net earn width — not a bug), AAV-738 (Portfolio pin — feature request), AAV-1113 (no cap notes in staging data — unverifiable)
> Branch: `fix/aav-1107-reserve-expand-ui`

## Problem Statement

用户展开 Reserve table 中的某一行查看 Simulation 详情时，遇到两个视觉问题：

1. **AAV-1121**: Earn/Cost 表格中 cap spacer 行（不可见进度条占位）与 note spacer 行（不可见文字占位）高度不一致，造成行间距突变（19.5px 高度差）。所有 reserve 都复现，是系统性问题。
2. **AAV-1084**: 桌面 Supply/Borrow 小表格中，label cell 使用 `whitespace-nowrap`，长 label（如 `Supplied / Cap $19.50M`）会溢出到 Current 列的留白区域。代码注释已承认此 trade-off。

## Solution

1. **AAV-1121**: 在 cap spacer 行中添加与 note spacer 相同模式的不可见文字占位（`text-transparent select-none` + `ds-text-11`），让两种 spacer 行高度自然一致。复用已有 pattern，不引入魔数。
2. **AAV-1084**: 将桌面 `renderRow` label cell 的 flex 容器从 `whitespace-nowrap` 改为 `flex-wrap`，与 compact layout 已有实现一致。长 label 的 cap text 会换行到第二行而非溢出到相邻列。

## User Stories

1. 作为 DeFi 用户，我展开 reserve 行查看 simulation 详情时，不希望看到行间距突变的视觉跳变，这样我能更顺畅地阅读数据。
2. 作为 DeFi 用户，我展开有长 label 的 reserve（如 Celo USDT `Supplied / Cap $19.50M`）时，不希望 label 内容溢出到 Current 列造成视觉重叠，这样数据更清晰可读。
3. 作为 DeFi 用户，cap text 在空间不够时换行到第二行是可以接受的，只要不丢失信息且不造成水平滚动。

## Implementation Decisions

### AAV-1121: Cap spacer 行高度统一

- **修改组件**: `SimulationSubRow.tsx` 中的 `renderBandSpacerRows` 函数
- **修改内容**: 在 cap spacer 行（`row.hasCapSpacer` 分支）中，在不可见进度条旁边添加一个不可见文字占位段，使用与 note spacer 行相同的 class 组合：`text-transparent select-none` + `ds-text-11` + `whitespace-normal break-words` + `leading-snug`
- **保留**: 不可见进度条 (`opacity-0`) 仍作为 cap bar 高度参考；`capWarning` 背景色仍正常应用；`aria-hidden` 属性保持
- **影响范围**: 仅桌面 Earn/Cost 表格（`renderEarnCostTable`）。compact layout 不受影响（compact 用 `col-span-4` 行而非 spacer 行）
- **不修改**: note spacer 行逻辑（已正确）

### AAV-1084: 桌面 label cell flex-wrap

- **修改组件**: `SimulationSubRow.tsx` 中的 `renderRow` 函数（桌面 `renderTable` 内的行渲染）
- **修改内容**: 将 label cell 的 flex 容器从 `flex items-baseline gap-x-1.5 whitespace-nowrap` 改为 `flex flex-wrap items-baseline gap-x-1.5`
- **更新注释**: 移除/更新承认 "visually bleeds" 的代码注释，改为描述 flex-wrap 行为
- **保留**: `min-w-0` 在外层 div 上已有；label span 和 cap span 的 `whitespace-nowrap` 保持（让每个 token 不被截断，但允许 cap 换行到第二行）
- **影响范围**: 仅桌面 `renderTable` 的 `renderRow`。compact layout 已使用 `flex-wrap`，不受影响。Earn/Cost 表的 `renderEarnCostTable` 不受影响（其 label 使用 `break-words`）

### 跨 issue 不变量

- 不改变 `table-fixed` + `<colgroup>` 列宽分配
- 不引入 `overflow-x-auto` / `overflow-x-scroll`（guardrails 禁止）
- 不使用 `truncate` / `text-ellipsis`（信息丢失）
- compact layout 测试（`SimulationSubRow.compact.test.tsx`、`SimulationSubRow.compact.render.test.tsx`）保持 green

## Testing Decisions

### 测试 seam

最高 seam: `SimulationSubRow.tsx` 的 jsdom 渲染测试。验证 CSS class 组合而非像素级布局（jsdom 无法测真实布局）。

已有测试文件：
- `SimulationSubRow.compact.test.tsx` — compact layout 的源级不变量
- `SimulationSubRow.compact.render.test.tsx` — compact layout 的 RTL 渲染行为

新增测试位置：扩展现有 `SimulationSubRow` 相关测试，新增桌面 layout 的 class 不变量断言。

### 测试原则

- 只测外部行为（CSS class 组合），不测实现细节
- 不测像素高度（jsdom 无法准确渲染布局）
- Prior art: `DesktopReserveRow.test.tsx` 的 class 断言模式

## Scenario & Risk Verification

### AAV-1121 场景矩阵

| 场景 | cap spacer | note spacer | 期望行为 | 风险 |
|------|-----------|-------------|---------|------|
| cap spacer + note spacer 都存在 | ✅ | ✅ | 两者高度一致（都有不可见文字占位） | 最常见场景，必须正确 |
| 只有 cap spacer，无 note spacer | ✅ | ❌ | cap spacer 行高度与 note spacer 行高度一致 | 需确保即使没有 note spacer，cap spacer 仍正确 |
| cap spacer + capWarning = true | ✅ (warning) | — | 不可见文字占位 + 警告背景色同时存在 | 背景色不应遮挡占位 |
| 无 spacer（hasCapSpacer=false, hasNoteSpacer=false） | ❌ | ❌ | 不渲染 spacer 行 | 空行不影响布局 |
| compact layout | N/A | N/A | 不受影响（compact 不使用 spacer 行） | 回归测试 compact layout 不变 |

### AAV-1084 场景矩阵

| 场景 | label 长度 | cap text | 期望行为 | 风险 |
|------|-----------|---------|---------|------|
| 短 label + 无 cap | 短 | 无 | 单行显示，无变化 | 不应回归正常场景 |
| 短 label + 有 cap | 短 | 有 | 单行显示（fit on one line） | flex-wrap 在空间够时不换行 |
| 长 label + 有 cap | 长 | 有 | cap text 换行到第二行 | 核心修复场景 |
| label + 外链 | 任意 | — | 外链点击不受影响 | flex-wrap 不破坏 anchor |
| label + warning 色 | 任意 | — | warning 样式保留 | flex-wrap 不改变颜色 class |
| compact layout | N/A | N/A | 不受影响（已用 flex-wrap） | 回归测试 compact layout 不变 |

## Out of Scope

- AAV-1107 pin scroll — 已验证修复（700px scroll delta，行 pin 在 y=129）
- AAV-1114 net earn 列宽 — 已验证不是 bug（288px = clamp max）
- AAV-738 Portfolio pin scroll — feature request，guardrails 明确禁用
- AAV-1113 campaign notes 单行 — staging 数据无 cap note 可验证
- AAV-1107 Show more 空白 — 未复现（Show more 按钮未找到）
- 移动端 compact layout 修改
- Earn/Cost 表格列宽调整
- Pin scroll 逻辑修改

## Further Notes

- 验证环境：staging API (`dev:staging`)，viewport 1440×900
- 测试钱包：`0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314`（holds Aave V3 positions on mainnet）
- 10 个 reserve 全部复现 AAV-1121，高度 pattern 一致：`[28, 10, 26, 26, 27, 25.5, 29.5]`
- AAV-1084 未在 staging 数据复现（label 都足够短），但代码注释承认问题存在
