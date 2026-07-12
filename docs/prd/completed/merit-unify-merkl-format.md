# PRD: Merit 格式统一到 Merkl Campaign 格式（v2）

**日期**: 2026-06-19
**父 Issue**: AAV-952
**状态**: Design Approved
**Supersedes**: v1 (2026-06-18)

---

## Problem Statement

三种激励源（Merit / Merkl / Brevis）的前端处理路径各自独立维护：Merit 用扁平 `MeritIncentive` + 文本正则解析 positionCap，Merkl 用 `CampaignGroup<Breakdown>` 遍历 breakdowns，Brevis 用 `BrevisIncentive` + `toMerklBreakdown` 适配层。每新增一种差异就需在三套入口分别修改，维护成本高且容易遗漏。

## Solution

将三种激励源统一到同一个 `CampaignGroup<UnifiedCampaignBreakdown>` 泛型框架。Merit 从扁平结构迁移到 CampaignGroup 格式（后端已完成），前端全量消费新格式并删除旧类型。Brevis 去掉 `toMerklBreakdown` 适配层，直接用统一 breakdown 进入 forecast。所有可选字段（whitelist、points、positionCap 等）谁有谁传，缺失即跳过。

### Grill 决策记录（v2 更新）

| # | 决策 | 理由 |
|---|---|---|
| 1 | Merit campaignType 硬编码为 `DUTCH_AUCTION` | Merit 机制本质是 Dutch auction + position cap |
| 2 | "deposit ceiling" / "self cap" → "position cap" | 与 Brevis `positionCap` 同术语，per-user cap 不区分来源 |
| 3 | Merit 只有 self 部分有 position cap | base breakdown 无 cap，self breakdown 有 cap |
| 4 | IncentiveTooltip 按 `campaignType` + `positionCap` 组合文案 | 四种 campaign type 文案通用；position cap 谁有谁加 |
| 5 | 文案选 "Dutch auction" 不选 "variable reward rate" | 跟代码/梅克尔 UI 一致，更短 |
| **6** | **后端删旧 `meritSupplys` 字段，新格式接管 `meritSupplys/borrows` 命名** | **非渐进迁移，前端全量切新格式**（v2 新增，替代 v1 的渐进保留） |
| **7** | **`MeritIncentive` 类型删除，`meritSupplys` 类型改为 `MeritCampaignGroup[]`** | **与 Merkl/Brevis 同一 `CampaignGroup<T>` 框架**（v2 新增） |
| **8** | **Forecast 模型统一 — 一个 `forecastWithTVL`，可选字段缺失就跳过** | **删掉 `toMerklBreakdown`，Brevis 直接传 unified breakdown**（v2 新增） |
| **9** | **`BaseCampaignBreakdown` 加 `positionCap?`** | **三种 breakdown 共享 position cap 语义**（v2 新增） |
| **10** | **`campaignApr=0` + `TARGET_TOTAL_APR` 的 early return 保留** | **防御性语义守卫，避免 nativeAPY 快照不一致**（v2 新增） |

---

## User Stories

1. As a developer, I want all incentive sources to use the same `CampaignGroup<Breakdown>` data structure, so that I only maintain one set of aggregation/rendering logic
2. As a developer, I want `meritSupplys` to return `MeritCampaignGroup[]` from the API, so that frontend code can iterate breakdowns the same way as Merkl and Brevis
3. As a developer, I want `MeritIncentive` type removed, so that there is no ambiguity about which data structure to use
4. As a developer, I want `BaseCampaignBreakdown` to include `positionCap?`, so that position cap is a first-class optional field shared by all breakdown types
5. As a developer, I want Brevis to pass breakdowns directly into `forecastWithTVL` without `toMerklBreakdown`, so that there is no adapter layer maintaining a separate type mapping
6. As a developer, I want `sumMeritIncentiveApr` rewritten to use `sumActiveCampaignBreakdownValues`, so that Merit APR aggregation follows the same framework as Merkl and Brevis
7. As a developer, I want IncentiveTooltip to render Merit incentives by iterating `MeritCampaignGroup.breakdowns`, so that the rendering path is unified with Merkl and Brevis
8. As a developer, I want `recentlyEndedCampaigns` to collect Merit campaigns by iterating breakdowns, so that the logic mirrors Merkl and Brevis
9. As a developer, I want `splitMeritMessageBySelfAuth` and `extractMeritSelfPositionCapUsd` removed from frontend, so that position cap comes from the API field instead of text parsing
10. As a developer, I want `getFirstActiveMeritLink` to work with `MeritCampaignGroup[]`, so that it follows the same pattern as `getFirstActiveBrevisLink`
11. As a developer, I want optional fields (whitelistOnly, pointsPerThousandUsd, rewardTokenIconUrl, plannedDaily, budgetBoundMode, positionCap) to be truly optional in the unified breakdown, so that each source only populates what it has
12. As a user, I want Merit "Dutch auction" campaigns to show position cap in the tooltip when present, so that I understand my incentive eligibility
13. As a user, I want Brevis campaigns to show reward token icons when `rewardTokenSymbol` is available, so that the visual experience is consistent with Merkl
14. As a developer, I want the `campaignApr=0` + `TARGET_TOTAL_APR` early return in `forecastMerklApr` preserved, so that nativeAPY snapshot inconsistencies don't produce wrong forecasts
15. As a developer, I want `BrevisIncentive` type eventually replaced by `CampaignGroup<BrevisCampaignBreakdown>`, so that all three sources share the same `CampaignGroup<T>` wrapper

---

## Implementation Decisions

### ID1: Unified Campaign Breakdown

`BaseCampaignBreakdown` gains `positionCap?: number`. All three breakdown types (`MeritCampaignBreakdown`, `MerklCampaignBreakdown`, `BrevisCampaignBreakdown`) inherit this field. Sources that don't have position cap simply omit it.

Optional fields that only some sources use:
- `whitelistOnly?`, `pointsPerThousandUsd?`, `rewardTokenIconUrl?`, `plannedDaily?`, `budgetBoundMode?` — Merkl only
- `positionCap?` — Merit (self breakdown) and Brevis
- `rewardTokenSymbol?` — all three (Merit optional, Merkl always, Brevis from gRPC)

### ID2: `meritSupplys` type change

`ReserveWithSpread.meritSupplys` type changes from `MeritIncentive[]` to `MeritCampaignGroup[]` (same for `meritBorrows`). Backend already outputs this format under `meritCampaignSupplys`; backend will delete the old `meritCampaignSupplys` field and output the new format directly under `meritSupplys`.

### ID3: Delete `MeritIncentive` type

`MeritIncentive` interface and `MeritIncentiveSchema` Zod schema are removed. All consumers migrate to `MeritCampaignGroup` + `MeritCampaignBreakdown`.

### ID4: Delete `toMerklBreakdown` adapter

`brevis.ts:toMerklBreakdown` is removed. Brevis breakdowns pass directly into `forecastWithTVL` as-is. The FIX_REWARD aprCap fallback logic (if `aprCap` is null, use `campaignApr` for FIX type) moves into the forecast path or the Brevis breakdown resolution.

### ID5: Rewrite `sumMeritIncentiveApr` using `sumActiveCampaignBreakdownValues`

```typescript
const sumMeritIncentiveApr = (groups?: MeritCampaignGroup[]): number => {
  return sumActiveCampaignBreakdownValues(groups, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, b) => b.campaignStartedAt,
    getEndDate: (_group, b) => b.campaignEndedAt,
    include: () => true,
    mapValue: (_group, b) => !isNaN(b.campaignApr) && b.campaignApr >= 0 ? b.campaignApr : 0,
  });
};
```

### ID6: Unify IncentiveTooltip Merit rendering

Merit rendering in IncentiveTooltip changes from manual `apr + selfApr` split + regex positionCap extraction to iterating `MeritCampaignGroup.breakdowns`. Each breakdown produces one `IncentiveCampaign` entry, same pattern as Merkl and Brevis.

### ID7: Unify `recentlyEndedCampaigns` Merit collection

Merit collection changes from iterating `MeritIncentive[]` and manually splitting base/self to iterating `MeritCampaignGroup.breakdowns`, mirroring Merkl/Brevis logic.

### ID8: Unify `reserveHasIncentiveTooltipSources` Merit branch

The Merit-specific branch in `reserveHasIncentiveTooltipSources` (which manually checks `apr + selfApr`) is replaced with a `sumActiveCampaignBreakdownValues`-based check, consistent with Merkl and Brevis.

### ID9: Delete frontend Merit text-parsing functions

`splitMeritMessageBySelfAuth` and `extractMeritSelfPositionCapUsd` in `meritForecast.ts` are removed. Position cap now comes from `MeritCampaignBreakdown.positionCap` (API field), not from regex on message text.

### ID10: `calculateTotalIncentiveApr`/`Apy` signature change

Both functions change `meritIncentives?: MeritIncentive[]` parameter to `meritGroups?: MeritCampaignGroup[]`. All callers updated accordingly.

### ID11: `BrevisIncentive` type long-term unification

`BrevisIncentive` currently extends `Omit<CampaignGroup<BrevisCampaignBreakdown>, 'breakdowns' | 'link'>` with additional flat fields. Long-term it should become `CampaignGroup<BrevisCampaignBreakdown>` with `link` required. This PRD does not mandate this change — it's noted for future work. The immediate focus is on Merit unification and deleting `toMerklBreakdown`.

### ID12: `campaignApr=0` handling in unified forecast

Unified rules for `campaignApr=0`:
1. `campaignApr > 0` → use directly (Merit/Brevis/most Merkl)
2. `campaignApr = 0` + has `pointsPerThousandUsd` → points fallback (Merkl AMOUNT variants only)
3. `campaignApr = 0` + no points + `TARGET_TOTAL_APR` → return 0 (nativeAPY ≥ targetAPR, early return preserved)
4. `campaignApr = 0` + no points + non-TARGET → forecast fallback from budget/TVL

Merit and Brevis have no `pointsPerThousandUsd`, so they naturally skip rule 2.

---

## Testing Decisions

- **Good test**: tests external behavior (aggregation output, tooltip rendering, recently-ended detection) not implementation details (which internal function is called)
- **Modules to test**:
  - `sumMeritIncentiveApr` — verify it correctly sums `campaignApr` from `MeritCampaignGroup.breakdowns`
  - `sumForecastMeritIncentiveApr` — verify breakdown-level forecast with position cap dilution
  - IncentiveTooltip — verify Merit campaigns render from breakdowns, position cap displays from API field
  - `recentlyEndedCampaigns` — verify Merit recently-ended detection from breakdowns
  - `getFirstActiveMeritLink` — verify it works with `MeritCampaignGroup[]`
  - `forecastMerklApr` — existing tests still pass (unified model unchanged)
- **Prior art**: existing `IncentiveTooltip.test.tsx` (44 tests), `incentiveAggregation.test.ts`, `recentlyEndedCampaigns.test.ts`, `meritForecast.test.ts`

---

## Out of Scope

| Item | Reason |
|---|---|
| `BrevisIncentive` → `CampaignGroup<BrevisCampaignBreakdown>` type migration | Separate PRD; current Brevis type works, just needs `toMerklBreakdown` removal |
| Merit merge into Merkl source grouping | Keep source identity (ACI vs Merkl vs Brevis), only unify data format |
| Brevis `rewardTokenIconUrl` | Brevis gRPC API has no icon URL; future: local symbol → icon mapping |
| Backend changes (already completed in AAV-960) | Backend outputs `meritCampaignSupplys/Borrows` in CampaignGroup format |
| `meritSupplys` old format backend deletion | Backend will delete old format and rename new format to `meritSupplys` in same deploy |

---

## Further Notes

### Differences that remain after unification

These are **business differences**, not format differences. They are expressed through which optional fields are populated, not through separate code paths:

| Dimension | Merit | Merkl | Brevis |
|---|---|---|---|
| Whitelist/Blacklist | None | Has `whitelistOnly`, `campaignAccessStatuses` | None |
| Points path | None | Has `pointsPerThousandUsd`, `pointToUsdRate` | None |
| Position cap | Self breakdown only | Has `positionCapNative` (from `maxDeposit`, per-side per-user balance cap, `isCombineCap=false`) | Has `positionCapUsd` (`isCombineCap=true`) |
| Forecast model | DUTCH_AUCTION path | All four campaignType paths | FIX_REWARD path |
| Reward token icon | None | Has `rewardTokenIconUrl` | None (future: symbol mapping) |

### Key files affected

**High risk** (core logic change):
- `src/types/aave.ts` — type changes
- `src/shared/market-contract/schemas.ts` — schema changes
- `src/lib/incentiveAggregation.ts` — `sumMeritIncentiveApr` rewrite
- `src/lib/rateSimulationCalculator.ts` — `sumForecastMeritIncentiveApr` rewrite
- `src/components/dashboard/IncentiveTooltip.tsx` — Merit rendering unification
- `src/lib/recentlyEndedCampaigns.ts` — Merit collection unification
- `src/lib/brevis.ts` — delete `toMerklBreakdown`

**Medium risk** (consumer updates):
- `src/lib/meritForecast.ts` — delete text-parsing functions
- `src/lib/merit.ts` — `getFirstActiveMeritLink` type change
- `src/components/dashboard/SimulationSubRow.tsx` — `getFirstActiveMeritLink` usage
- `src/pages/DebugDelta.tsx` — debug page update

**Low risk** (test fixture updates):
- All test files that reference `MeritIncentive` or `meritSupplys` fixtures
