# Merit Message Distribution + Backend Cleanup Plan

**Status**: ✅ Completed (verified 2026-06-27, Playwright 除外)
## Status: Backend Done, Frontend Done

## Problem Statement

1. **前端 message 渲染为原始 JSON 字符串**：后端 `buildCampaignGroupFromMeritEntry` 把 `entry.message: MeritCampaignInfo[]` 序列化为 `JSON.stringify(entry.message)`（字符串），前端 `getMessageLines` 收到 `string` 类型直接原样输出，显示为 `"[{\"action\":\"Supply USDT\",...}]"` 乱码。
2. **后端中间态残留**：`merit-api.ts` 中 `MeritAprEntry` 和 `MeritCampaignInfo` 仍在构建流程中使用（先构建 `MeritAprEntry`，再通过 `buildCampaignGroupFromMeritEntry` 转为 `MeritCampaignGroup`），可以内联消除。
3. **Merit message 的特殊性**：大多数 source（Merkl/Brevis）的 opportunity 下所有 campaign 共享一条 message（纯字符串），但 Merit 的 message 是结构化的 `[{action, description}]` 数组，不同条目与不同 campaign breakdown 有语义关联（如 "Supply USDT" → base, "Self Authentication" → self）。

## Design Decisions

### DD1: Message 分层渲染策略

**决策**：Opportunity 级别 message 在所有 campaign detail 上方渲染 + 每个 campaign 如果有自己的 breakdown 级别 message，在 campaign 卡片下方也渲染。

**理由**：
- 大多数 source（Merkl/Brevis）的 message 是 opportunity 级别的通用描述，所有 campaign 共享 → 在 campaign detail 上方统一显示
- Merit 的 message 条目可以分发到 breakdown 级别（后端特殊处理），每个 campaign 卡片下方显示自己相关的条目
- 前端不需要按 source 类型区分处理方式——统一逻辑：有 opportunity message → 渲染在上方；有 campaign message → 渲染在下方

### DD2: Merit breakdown 级别 message（后端特殊处理）

**决策**：Merit 在 `buildCampaignGroupFromMeritEntry` 中，将 message 条目分发到对应 breakdown：self auth 条目 → self breakdown `message`，非 self 条目（如 "Supply USDT"）→ base breakdown `message`。Opportunity 级别不设 `message`。

**理由**：
- 每个条目只出现在对应 breakdown 里，不重复
- Merit 是唯一有结构化 message 的 source，特殊处理合理
- 其他 source（Merkl/Brevis）的 message 保持 opportunity 级别不变
- Opportunity 级别 message 为空，前端只需渲染 breakdown 级别 message

### DD3: 前端 getMessageLines JSON.parse 兼容

**决策**：前端 `getMessageLines` 对 `string` 类型 message 先尝试 `JSON.parse`，解析成功且为数组则按 `[{action, description}]` 格式分段显示；解析失败则当纯字符串处理。

**理由**：方案 A 兼容性最好，能处理未来任何 JSON 格式的 message，不影响 Merkl/Brevis 的纯字符串 message。

### DD4: 后端 MeritAprEntry 内联消除

**决策**：跳过。经分析 `MeritAprEntry` 仍被 `getMeritEstimateForEntry` 返回类型和 5 处构建点使用，内联消除工作量大但收益有限（`buildCampaignGroupFromMeritEntry` 职责清晰，不是死代码）。`MeritCampaignInfo` 保留（仍用于 Merit API 原始解析和 cloudflare-browser）。

### DD5: 同名同 link 的 Opportunity 合并

**决策**：确认 `groupIncentiveSources` 按 `sourceType|name|link` 合并逻辑正确。同名同 link = 同一个 opportunity，后进覆盖先进。

## 术语（见 CONTEXT.md "Incentive Three-Level Hierarchy"）

- **Source** = 激励提供方（ACI/Merit/Brevis/Protocol）
- **Opportunity** = 独立激励机会（`MeritCampaignGroup`/`MerklOpportunityGroup`/`BrevisIncentive`），有 name/link/message
- **Campaign** = Opportunity 内的子活动（breakdown），有 campaignApr/campaignType/positionCap

前端 `IncentiveSource` = Opportunity 层级。

## Implementation Steps

### Phase 1: 后端（aave-protocol-analysis）— ✅ Done (commit 773cc2c)

| Step | File | Change | Status |
|------|------|--------|--------|
| 1.1 | `packages/aave-shared-contracts/src/index.ts` | `MeritCampaignBreakdown` 加 `message?: string` 字段，`ApiMeritCampaignBreakdown` 加 `'message'` | ✅ |
| 1.2 | `packages/aave-fetcher/src/merit-api.ts` | Merit breakdown 级别 message：self breakdown 加 `message` 字段（JSON string），opportunity 级别 message 保留非 self 条目 | ✅ |
| 1.3 | `packages/aave-fetcher/src/incentive-prune.ts` | `pruneMeritCampaignBreakdown` 加 message 字段 | ✅ |
| 1.4 | `backend/scripts/generate-openapi.ts` | breakdown schema 加 `message` 字段 | ✅ |
| 1.5 | `backend/src/services/persistenceService.ts` | 确认：persistence 不需要存 breakdown message（API 层直接从原始数据获取） | ✅ no change needed |
| 1.6 | `backend/src/services/marketsApiSerialize.ts` | 确认：`scaleMeritCampaignBreakdown` 用 spread 保留 message | ✅ no change needed |
| 1.7 | Tests | 新增 3 个测试覆盖 message 分发 | ✅ |
| 1.8 | Dev server 验证 | curl 验证 API 输出正确 | ✅ |
| 1.9 | 内联消除 MeritAprEntry | 跳过（不必要） | ❌ cancelled |

### Phase 2: 前端（aaveapy，后续 session）

| Step | File | Change |
|------|------|--------|
| 2.1 | `src/components/dashboard/IncentiveTooltip.tsx` | `getMessageLines` 加 `JSON.parse` 尝试 |
| 2.2 | `src/components/dashboard/IncentiveTooltip.tsx` | Campaign 卡片下方渲染 breakdown 级别 message |
| 2.3 | `src/types/aave.ts` | `MeritCampaignBreakdown` 加 `message?: string` |
| 2.4 | `src/shared/market-contract/schemas.ts` | breakdown schema 加 `message` 字段 |
| 2.5 | Tests | 更新/新增测试覆盖 |
| 2.6 | Playwright 验证 | Dev server 验证 tooltip 渲染 |

## Verification Checklist

- [x] 后端 build 通过
- [x] 后端测试通过（834 total, 0 fail）
- [x] Dev server curl 验证：meritSupplys 的 self breakdown 含 message 字段，opportunity message 只含非 self 条目
- [x] 前端 lint + test + build + tsc 通过（Phase 2）
- [ ] Playwright 验证：message 分段显示、不出现 JSON 乱码（Phase 2 — 待手动验证）
