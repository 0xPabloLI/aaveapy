# Incentive Note Copy Refactoring

**Priority**: Medium
**Status**: Draft

## Problem Statement

Incentive capNote 在 Reserve Table 和 Portfolio 面板中有三个 UX 问题：

1. **Position cap 不标识 campaign 归属**：`Incentive on first $1,000` 没有说是哪个 campaign 的 cap。多 campaign 时（Merit base + self），用户无法区分。
2. **Position cap 和 net offset 混在一个字符串里**：`appendNotes` 把两种不同性质的信息拼成一个 `capNote`，导致它们颜色相同、粒度相同，无法独立控制。
3. **Net offset 语义丢失**：AAV-761 修复时将文案从 `Net eligible $X of $Y` 改为 `$X of $Y eligible after offsets`，丢失了 "Net" 这个有信息量的词。

## Solution

将 position cap note 和 offset note 彻底分层：

| Note 类型 | 粒度 | 性质 | 颜色 | 位置 |
|-----------|------|------|------|------|
| Position cap note | per-campaign | 限制性（warning） | amber | campaign 行下方 |
| Offset note | per-source | 信息性（explanation） | 灰色 | source aggregate 行下方 |

### 文案变更

**Position cap note**（per-campaign，加 campaign 名称 + "only"）：

| 旧 | 新 |
|---|---|
| `Incentive on first $1,000.00` | `Merit base incentive on first $1,000.00 only` |
| `Incentive on first $5,000.00 · combine` | `Merit base incentive on first $5,000.00 only · combine` |

**Offset note**（per-source，恢复 "net"）：

| 旧 | 新 |
|---|---|
| `$500 of $1,000 eligible after offsets` | `$500 of $1,000 net eligible` |
| `$500 of $1,000 eligible after offsets (supply minus USDC+DAI borrows)` | `$500 of $1,000 net eligible (supply minus USDC+DAI borrows)` |

### 渲染效果

**Reserve Table (SimulationSubRow)**：

```
ACI Incentive           3.5%          ← source aggregate 行
  $41 of $1,042 net eligible          ← offset note (灰色, source level)
  Merit #1              1.5%          ← campaign 行
    Merit base incentive on first $1,000.00 only   ← capNote (amber, campaign level)
  Merit #2              0.8%
    Merit self incentive on first $500.00 only
```

**Portfolio (CapWarningRow)**：

```
⚠ Merit base incentive on first $1,000.00 only    ← position cap (amber + ⚠)
  $41 of $1,042 net eligible                       ← offset note (灰色, 无 ⚠)
```

**IncentiveTooltip**：当前使用 `Position cap $X`（与 Reserve Table/Portfolio 不一致），统一为 campaign-name + `incentive on first $X only`。

## User Stories

1. As a Reserve Table user, I want to see which campaign a position cap belongs to, so that I can understand which incentive is capped
2. As a Reserve Table user, I want position cap warnings and offset explanations in different visual styles, so that I can distinguish limits from explanations
3. As a Reserve Table user, I want offset notes shown on every campaign row under the same source, so that I can identify which source each campaign belongs to
4. As a Portfolio user, I want to see both position cap warnings and offset explanations, so that I understand why my incentive is discounted
5. As a Portfolio user, I want offset notes in a different color than warnings, so that I can tell explanatory text from actionable warnings
6. As a user, I want "net eligible" wording that clearly states it's about the net portion, so that I understand the offset concept
7. As a user, I want position cap text to include "only" to make it clear that amounts above the cap earn no incentive
8. As a user viewing IncentiveTooltip, I want consistent copy with Reserve Table, so that the same concept isn't described differently

## Implementation Decisions

### 1. Data structure: `SimulationSourceDetail` 新增 `offsetNote?: string`

Offset note 提升到 source level，不放在 `capNote` 里。

```typescript
export interface SimulationSourceDetail extends SimulationMetric {
  campaigns?: SimulationCampaignDetail[];
  offsetNote?: string;  // NEW
}
```

### 2. Data structure: `SimulationCampaignDetail.capNote` 不再包含 offset

`capNote` 只包含 position cap 文案（含 campaign 名称）。`appendNotes` 不再用于拼合 position cap + offset note。

### 3. `buildPositionCapEffect` 接收 campaign 名称参数

新增 `campaignName` 参数，用于生成 `Merit base incentive on first $X only` 格式文案。当 `campaignName` 缺失时 fallback 到 `Incentive on first $X only`。

### 4. `buildMeritCampaignDetails` / `buildMerklCampaignDetails` 变更

- `capNote` 不再调 `appendNotes(capNote, crossReserveNote, netNote)`
- 改为 `capNote` 只放 position cap（带 campaign 名称）
- 返回值新增 `offsetNote?: string`（或通过上层 dispatch map 计算）

### 5. Offset note 计算

Offset note 在 dispatch map 的 source level 计算，由 `buildNetEligibleNote` + `buildCrossReserveNetEligibleNote` 生成。文案恢复 `net eligible`。

### 6. `appendNotes` 函数

简化为只处理 position cap note 的内部拼接（budget remaining · calendar end · combine），不再拼 offset note。或者如果 position cap 内部不需要多段拼接，可以直接删除。

### 7. IncentiveTooltip 统一

当前 IncentiveTooltip 用 `Position cap $X`（直接读 `campaign.positionCap`），改为使用与 capNote 一致的文案。

### 8. Portfolio `IncentiveCapWarning` 新增 `offsetNote?: string`

`extractIncentiveCapWarnings` 从 source 的 `offsetNote` 提取，传入 `CapWarningRow`。

### 9. `CapWarningRow` 支持混合渲染

Position cap 用 amber + AlertTriangle，offset note 用灰色无图标。

## Testing Decisions

### 测试 seam

最高 seam：`buildRateSimulationResult` 的返回值结构。

- **`SimulationSourceDetail.offsetNote`**：在 `rateSimulationCalculator.test.ts` 中断言 source level 的 offsetNote 值
- **`SimulationCampaignDetail.capNote`**：在 `rateSimulationCalculator.test.ts` 中断言 campaign level 的 capNote 包含 campaign 名称和 "only"
- **`buildNetEligibleNote` 文案**：在 `incentiveCaps.test.ts` 中断言新文案格式
- **`buildPositionCapEffect` 文案**：在 `incentiveCaps.test.ts` 中断言新文案格式
- **Portfolio `extractCapWarnings`**：在 `portfolioCapWarnings.test.ts` 中断言 `offsetNote` 字段
- **`appendNotes` 变更**：在 `incentiveCaps.test.ts` 中更新测试

### 测试原则

- 只测试外部行为（返回值结构、文案格式），不测内部实现
- 遵循现有测试模式：`rateSimulationCalculator.test.ts` 用 `buildRateSimulationResult` 端到端测试

## Out of Scope

- Brevis position cap note 文案（Brevis campaign 目前只有一个 "Brevis Incentive" label，无 sub-campaign 名称区分需求）
- Merkl campaign 名称优化（Merkl 的 capNote 已有 per-opportunity 区分）
- `buildFixRewardCapEffect` 和 `buildMaxRewardCapEffect` 文案变更
- Protocol cap warning 文案变更（已有独立 spec）
- SimulationSubRow 或 PortfolioTokenRow 的布局/样式重构

## Further Notes

- 此 PRD 与 AAV-761 修复独立。AAV-761 的 F1-F5 已提交，此 PRD 是文案层面的改进。
- `appendNotes` 函数的 `;` 分隔符是 AAV-761 引入的，此 PRD 后可能不再需要该函数（position cap 内部用 `·` 拼接 budget/combine 后缀已由 `capEffectToSimulationFields` 处理）。
- Campaign 名称来源：Merit 的 `group.groupName`（如 "base"、"self"），Merkl 的 opportunity name。需确认所有 campaign 都有可用的名称字段。
