# Handoff: Merit 格式统一到 CampaignGroup (AAV-952/960/961/963)

**日期**: 2026-06-19
**分支**: `lovable`
**状态**: In Review（待后端部署 + 合并）

---

## 变更摘要

将三种激励源（Merit / Merkl / Brevis）统一到同一个 `CampaignGroup<Breakdown>` 泛型框架。Merit 从旧的扁平 `MeritIncentive` 格式迁移到 `MeritCampaignGroup`（= `CampaignGroup<MeritCampaignBreakdown>`），前端全量消费新格式并删除旧类型。Brevis 去掉 `toMerklBreakdown` 适配层。

## Commits

| SHA | 描述 |
|-----|------|
| `1d85465d` | AAV-963: 类型/schema 统一（删除 MeritIncentive、BaseCampaignBreakdown 加 positionCap、MeritCampaignGroup 新格式） |
| `c3a8f3f9` | AAV-964/965/966: 逻辑层统一（incentiveAggregation、IncentiveTooltip、recentlyEndedCampaigns、meritForecast 适配、删除旧辅助函数） |
| `ebe695e3` | ForecastableBreakdown 接口 + 删除 toMerklBreakdown + FIX aprCap fallback 移入 resolver |
| `c537ef4c` | 修复: 传 baseAprPercent 到 MERIT_SELF_CAP forecast + Merit campaignType 硬编码 DUTCH_AUCTION |
| `9b3b7d27` | ADR-0018 合规: 移除 getMerklBreakdownApr 默认参数, tydroPointToUsdRate → pointToUsdRate |

## 关键设计决策

1. **`ForecastableBreakdown` 中间接口** — `BaseCampaignBreakdown` → `ForecastableBreakdown` → `MerklCampaignBreakdown`。forecast 函数接受 `ForecastableBreakdown`，Brevis 的 `BrevisResolvedBreakdown` 结构兼容无需转换。
2. **`toMerklBreakdown` 删除** — FIX_REWARD aprCap fallback 移入 `getBrevisResolvedBreakdown`，逻辑内聚。
3. **Merit campaignType 硬编码 `DUTCH_AUCTION`** — PRD 决策 #1，Merit 机制本质是 Dutch auction + position cap。
4. **`breakdowns` schema `.optional().default([])`** — 后端未部署新格式时兼容，部署后可移除 `.default([])`。
5. **`baseAprPercent` 传入 MERIT_SELF_CAP** — 新格式下每个 breakdown 是独立 campaign，`baseAprPercent = breakdown.campaignApr`。
6. **`baseLastRoundRewardUsd` 未传入** — 后端新格式不提供此字段，`forecastMeritApr` 走 fallback 路径（anchorTvlUsd 估算）。
7. **ADR-0018 合规** — 移除 `getMerklBreakdownApr` 默认参数，`tydroPointToUsdRate` → `pointToUsdRate`。

## ADR 合规检查

| ADR | 状态 | 备注 |
|-----|------|------|
| ADR-0009 | ✅ | delta 语义不变，baseAprPercent 传入 MERIT_SELF_CAP |
| ADR-0014 | ✅ | positionCap 在 BaseCampaignBreakdown，与新格式一致 |
| ADR-0018 | ✅ | 已修复：移除默认参数 + 重命名 tydroPointToUsdRate |
| ADR-0019 | ✅ | parseCampaignBoundaryMs 统一从 campaignGroups.ts 导入 |

## 已删除

- `MeritIncentive` 接口 + `MeritIncentiveSchema` zod schema
- `splitMeritMessageBySelfAuth` / `extractMeritSelfPositionCapUsd`
- `toMerklBreakdown` 适配函数

## 已知限制

- **后端未部署**：staging API 不含 `meritSupplys[].breakdowns` 字段，schema 用 `default([])` 兼容。部署后应移除 `default([])` 恢复必填校验。
- **`baseLastRoundRewardUsd` 缺失**：后端新格式不提供 Merit 的 `lastRoundRewardUsd`，self-cap forecast 精度可能略低。
- **IncentiveTooltip `(self)` 后缀**：新格式下每个 breakdown 是独立 campaign，不再手动添加 `(self)` 后缀。
- **`DebugDelta.tsx` 未修改**：用户说可以后续处理。
- **`meritForecast.ts` JSDoc 删减**：review 指出部分合约文档被删除，可后续补充。

## 验证

- lint: 0 error (1 pre-existing warning)
- test: 2996 passed
- tsc: 0 new errors in modified source files
- build: success
- Playwright: 页面加载 0 console errors

## 相关文档

- PRD v2: `docs/prd/merit-unify-merkl-format.md`
- Linear: AAV-952, AAV-960, AAV-961
