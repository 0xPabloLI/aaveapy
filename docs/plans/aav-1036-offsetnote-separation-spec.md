# AAV-1036: Separate offsetNote from capNote at Data Layer

> **Linear**: [AAV-1036](https://linear.app/aaveapy/issue/AAV-1036/data-layer-separate-offsetnote-from-capnote-lift-to-source-level)
> **Status**: Spec (pending implementation)
> **Date**: 2026-08-10
> **Scope**: 前端 (aaveapy repo) — `SimulationSourceDetail` 数据层重构
> **Parent PRD**: `docs/prd/completed/incentive-note-copy-refactoring.md`

---

## 1. 问题

Reserve Table 侧的 offset notes（`net_eligible` 类型）和 cap notes（`position_cap`/`pool_budget`/`apr_cap` 类型）混在同一个 `notes: IncentiveNote[]` 数组中，没有类型级别的分离。

### 当前行为

```
attachCampaigns(metric, campaigns, offsetNotes)
  → 将 offsetNotes 追加到每个 campaign 的 notes[]
  → 同时放在 source 的 notes[]
  → campaign notes = [capNotes..., offsetNotes...] (混合)
```

### 具体缺口

| 层级 | 状态 | 详情 |
|------|------|------|
| Portfolio 侧 | ✅ 已分离 | `IncentiveCapWarning` vs `IncentiveOffsetWarning` 独立类型 |
| Reserve Table 侧 | ❌ 未分离 | offset 混入 `SimulationSourceDetail.notes` + 每个 campaign 的 notes |

### 负面影响

1. **offset notes 重复**：每个 campaign 行都显示 offset note（同一 source 下 N 个 campaign = N 份重复）
2. **无类型区分**：消费方需用 heuristic（检查 `note.type === 'position_cap'` 等）区分
3. **与 Portfolio 不一致**：Portfolio 已分离，Reserve Table 未分离

---

## 2. 设计决策

### D1: 新增 `offsetNotes?: IncentiveNote[]` 到 `SimulationSourceDetail`

使用 `IncentiveNote[]` 而非原始 PRD 的 `string`，与现有 `notes` 字段类型一致：

```typescript
export interface SimulationSourceDetail extends SimulationMetric {
  campaigns?: SimulationCampaignDetail[];
  notes?: IncentiveNote[];        // cap notes only (after change)
  offsetNotes?: IncentiveNote[];  // NEW — offset/net-eligible notes
}
```

**依据**: UI Copy Spec 确认 offsetNote 在 source level；PRD Decision 1 要求独立字段。

### D2: `attachCampaigns()` 不再将 offset 追加到 campaign notes

```typescript
// BEFORE (current)
const attachCampaigns = (metric, campaigns, sourceNotes?) => {
  const enriched = sourceNotes?.length
    ? campaigns.map(c => ({ ...c, notes: [...(c.notes ?? []), ...sourceNotes] }))
    : campaigns;
  return { ...metric, campaigns: enriched, notes: sourceNotes };
};

// AFTER (proposed)
const attachCampaigns = (metric, campaigns, offsetNotes?) => {
  return {
    ...metric,
    campaigns: campaigns.length > 0 ? campaigns : undefined,
    offsetNotes: offsetNotes?.length ? offsetNotes : undefined,
  };
};
```

**关键变化**: campaign notes 不再被 offset 污染。offset 只在 `source.offsetNotes`。

### D3: `SimulationTableRow` 新增 `offsetNotes?: IncentiveNote[]`

`SimulationTableRow` 是 `incentiveSourceToTableRows()` 的产出。需要在此层也区分：

```typescript
export interface SimulationTableRow {
  // ... existing fields ...
  notes?: IncentiveNote[];         // cap notes
  offsetNotes?: IncentiveNote[];   // NEW — offset notes
}
```

### D4: `incentiveSourceToTableRows()` 渲染规则

| 条件 | offsetNotes 放置 | notes 放置 |
|------|-----------------|-----------|
| 无 campaigns | main row | main row (如有) |
| 有 campaigns | 每个 campaign row | 每个 campaign row |
| 有 campaigns + `mergeSingleCampaignRow` | merged row | merged row |

### D5: `extractIncentiveCapWarnings()` 简化

Portfolio 侧不再需要 heuristic 区分。直接读 `source.offsetNotes`：

```typescript
// BEFORE: 检查 campaign notes 是否有 cap 类型 → 否则查 source notes
// AFTER: 直接读 source.offsetNotes 和 campaign.notes
if (source.offsetNotes?.length) {
  warnings.push({ kind: 'incentive_offset', side, source, notes: source.offsetNotes });
}
```

### D6: `SimulationSubRow.tsx` 渲染

offset notes 和 cap notes 在同一视觉位置渲染（行下方），但分别来自 `row.offsetNotes` 和 `row.notes`。

`peerCapInfo` 对齐逻辑需同时检查 `notes` 和 `offsetNotes`。

### D7: Brevis 无 offsetNotes

Brevis 的 `attachCampaigns()` 调用不传 `offsetNotes` 参数。Brevis source 不会有 offset notes。无需特殊处理。

---

## 3. 数据流（变更后）

```
meritOffsetNote / merklOffsetNote (IncentiveNote[])
    ↓
attachCampaigns(metric, campaigns, offsetNotes)
    → source.offsetNotes = offsetNotes (NEW field)
    → campaign.notes 不变 (cap notes only)
    ↓
SimulationSourceDetail { campaigns: [{ notes: capNotes }], offsetNotes }
    ↓
incentiveSourceToTableRows(src)
    → main row.offsetNotes = src.offsetNotes (when aggregate shown)
    → firstCampaignRow.offsetNotes = src.offsetNotes (when aggregate hidden)
    → campaign rows: notes = capNotes only
    ↓
SimulationTableRow { notes: capNotes, offsetNotes }
    ↓
SimulationSubRow.tsx
    → renders row.notes (cap, amber/muted)
    → renders row.offsetNotes (offset, muted)
    → peerCapInfo checks both
```

---

## 4. 接口契约

### 4.1 `SimulationSourceDetail` (producer → consumer)

| 字段 | 类型 | 内容 | 变更 |
|------|------|------|------|
| `notes` | `IncentiveNote[]?` | cap notes (position_cap, pool_budget, apr_cap) | **语义变更**: 不再包含 offset notes |
| `offsetNotes` | `IncentiveNote[]?` | offset notes (net_eligible) | **NEW** |
| `campaigns` | `SimulationCampaignDetail[]?` | per-campaign rows | **语义变更**: campaign.notes 不再包含 offset |

### 4.2 `SimulationTableRow` (producer → consumer)

| 字段 | 类型 | 内容 | 变更 |
|------|------|------|------|
| `notes` | `IncentiveNote[]?` | cap notes only | **语义变更** |
| `offsetNotes` | `IncentiveNote[]?` | offset notes | **NEW** |

### 4.3 跨 Step 验证

| Producer | Field | Consumer | 验证 |
|----------|-------|----------|------|
| `attachCampaigns()` | `source.offsetNotes` | `incentiveSourceToTableRows()` | 传递到 main row 或 first campaign |
| `incentiveSourceToTableRows()` | `row.offsetNotes` | `SimulationSubRow.tsx` | 渲染为 muted color notes |
| `attachCampaigns()` | `source.offsetNotes` | `extractIncentiveCapWarnings()` | 读 source.offsetNotes → IncentiveOffsetWarning |
| `attachCampaigns()` | `campaign.notes` | `extractIncentiveCapWarnings()` | 读 campaign.notes → IncentiveCapWarning (cap only) |

---

## 5. 实现变更清单

### 5.1 类型层

| 文件 | 变更 |
|------|------|
| `src/lib/rateSimulationCalculator.ts` | `SimulationSourceDetail` 加 `offsetNotes?: IncentiveNote[]` |
| `src/lib/simulationIncentiveTableRows.ts` | `SimulationTableRow` 加 `offsetNotes?: IncentiveNote[]` |

### 5.2 逻辑层

| 文件 | 变更 |
|------|------|
| `src/lib/rateSimulationCalculator.ts` | `attachCampaigns()` 改为 D2 方案 |
| `src/lib/simulationIncentiveTableRows.ts` | `incentiveSourceToTableRows()` 按 D4 规则放置 offsetNotes |
| `src/lib/portfolioCapWarnings.ts` | `extractIncentiveCapWarnings()` 简化为 D5 方案 |

### 5.3 渲染层

| 文件 | 变更 |
|------|------|
| `src/components/dashboard/SimulationSubRow.tsx` | 渲染 `row.offsetNotes` + 更新 `peerCapInfo` 逻辑 |

### 5.4 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `src/lib/portfolioSimulator.ts` | 只读 `campaign.forecastUnavailable`，不读 notes |
| `src/hooks/useRateSimulation.ts` | 通过 group 对象自动传递，不需新增参数 |
| `src/components/dashboard/IncentiveTooltip.tsx` | 有独立的数据结构，不消费 SimulationSourceDetail.notes |
| `src/components/dashboard/MobilePortfolioCard.tsx` | 读 PortfolioCapWarning.notes，不读 SimulationSourceDetail |
| `src/components/dashboard/PortfolioTablePrimitives.tsx` | 同上 |

---

## 6. Scenario & Risk Verification Matrix

### 6.1 数据层场景 (S1-S8)

| # | 场景 | 风险维度 | 预期行为 | 测试文件 |
|---|------|---------|---------|---------|
| S1 | Source 有 offsetNotes，无 campaigns | Null/Undefined | offsetNotes 在 main row | `rateSimulationCalculator.test.ts` |
| S2 | Source 有 offsetNotes + campaigns (aggregate shown) | 正常路径 | offsetNotes 在 main row，不在 campaign rows | `rateSimulationCalculator.test.ts` |
| S3 | Source 有 offsetNotes + campaigns | 正常路径 | offsetNotes 在每个 campaign row | `simulationIncentiveTableRows.test.ts` |
| S4 | Source 有 offsetNotes + campaigns + `mergeSingleCampaignRow` | 边界 | offsetNotes 在 merged row | `simulationIncentiveTableRows.test.ts` |
| S5 | Source 无 offsetNotes | Null/Undefined | offsetNotes = undefined，无渲染，无 crash | `rateSimulationCalculator.test.ts` |
| S6 | Source offsetNotes = [] (空数组) | Empty boundary | 同 undefined，无渲染 | `rateSimulationCalculator.test.ts` |
| S7 | Campaign 有 cap notes + source 有 offsetNotes | 分离验证 | campaign.notes = cap only，source.offsetNotes = offset only | `rateSimulationCalculator.test.ts` |
| S8 | 多 source 各有 offsetNotes | 多实体 | 每个 source 的 offsetNotes 独立，无交叉 | `rateSimulationCalculator.test.ts` |

### 6.2 Portfolio 消费场景 (S9-S10)

| # | 场景 | 风险维度 | 预期行为 | 测试文件 |
|---|------|---------|---------|---------|
| S9 | `extractIncentiveCapWarnings` source 有 offsetNotes | 跨消费者 | 生成 `IncentiveOffsetWarning`，notes = source.offsetNotes | `portfolioCapWarnings.test.ts` |
| S10 | `extractIncentiveCapWarnings` campaign 有 cap notes，source 无 offsetNotes | 跨消费者 | 生成 `IncentiveCapWarning`，不生成 `IncentiveOffsetWarning` | `portfolioCapWarnings.test.ts` |

### 6.3 渲染场景 (S11-S12)

| # | 场景 | 风险维度 | 预期行为 | 测试文件 |
|---|------|---------|---------|---------|
| S11 | `peerCapInfo` 对齐：row 有 offsetNotes 无 notes | 跨 Step 契约 | hasCapNote = true (offsetNotes 也算)，placeholder 正确 | `SimulationSubRow.test.tsx` |
| S12 | 渲染：offsetNotes 在行下方显示 | UI | offsetNotes 渲染为 muted color，位置同 notes | E2E / integration |

### 6.4 `attachCampaigns` 行为变更场景 (S13-S16)

| # | 场景 | 风险维度 | 预期行为 | 测试文件 |
|---|------|---------|---------|---------|
| S13 | `attachCampaigns(metric, campaigns, offsetNotes)` — campaign notes 不被污染 | 分离验证 | campaign.notes 不包含 offsetNotes | `rateSimulationCalculator.test.ts` |
| S14 | `attachCampaigns(metric, campaigns, offsetNotes)` — source.offsetNotes 正确设置 | 正常路径 | result.offsetNotes = offsetNotes | `rateSimulationCalculator.test.ts` |
| S15 | `attachCampaigns(metric, campaigns)` — 无 offsetNotes | Null/Undefined | result.offsetNotes = undefined | `rateSimulationCalculator.test.ts` |
| S16 | `attachCampaigns(metric, [], offsetNotes)` — 无 campaigns | 边界 | result.campaigns = undefined, result.offsetNotes = offsetNotes | `rateSimulationCalculator.test.ts` |

---

## 7. 不在 scope 内

- Brevis offsetNotes（Brevis 不产生 offset notes）
- IncentiveTooltip 渲染变更（有独立数据结构）
- 文案变更（`net_eligible` → `Net eligible` 等，已在 AAV-761 PRD 中完成）
- `buildNetEligibleNote` / `buildCrossReserveNetEligibleNote` 文案格式变更
- Mobile rendering 独立处理（mobile 用 `SimulationTableRow` 相同结构）

---

## 8. 参考文档

- PRD: `docs/prd/completed/incentive-note-copy-refactoring.md` — 原始 PRD
- UI Copy Spec: `docs/conventions/ui-copy-specification.md` — 渲染规则 + 文案模板
- Offset Alignment Spec: `aave-protocol-analysis/docs/plans/aav-1022-offset-alignment-rules-spec.md`
- Cross-Asset Pairing Spec: `aave-protocol-analysis/docs/plans/aav-895-cross-asset-pairing-spec.md`
