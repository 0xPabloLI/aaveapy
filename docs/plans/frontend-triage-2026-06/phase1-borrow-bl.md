# Phase 1: BORROW_BL Incentive 归零逻辑

> Issue: AAV-962
> Project: Incentive Source Upper-Layer Unification
> 估计: 1 session

## 问题

Merkl API 中部分 supply opportunity 包含 `BORROW_BL` 标记：用户有该 token borrow position → 整个 supply incentive 归零。5 个 LIVE opp 受影响，前端未处理。

## 数据事实

| Chain | Token | opportunityType | identifier 后缀 |
|-------|-------|----------------|----------------|
| Ethereum | USDtb | AAVE_SUPPLY | BORROW_BL |
| Ethereum | USDe | MULTILOG_DUTCH | BORROW_BL |
| Plasma | USDe | MULTILOG_DUTCH | BORROW_BL |
| Mantle | USDe | MULTILOG_DUTCH | BORROW_BL |
| MegaETH | USDe | AAVE_SUPPLY | BORROW_BL |

全部 supply 侧，0 个 borrow 侧。不存在 SUPPLY_BL。

## 后端现状

后端已完成：
- `merkl-api.ts`: `isBorrowBl = opp.identifier?.includes('BORROW_BL') || hasBlacklistWithBorrowHook(opp)`
- 输出字段：`borrowBlacklist: true`（`CampaignGroup` 级别，opportunity 粒度）
- 前端 API 已返回此字段，但前端 schema/类型/逻辑均未接入

## BORROW_BL vs NET

| | NET | BORROW_BL |
|--|-----|-----------|
| 效果 | borrow 量按比例抵消 supply incentive | 有 borrow → incentive 归零（二元） |
| offset tokens | 有 | 无 |
| hooks | 无 | hookType=14 |
| 代码处理 | `netPositionConstraint` | 未处理 |

## 归零策略：`merklGroupMultiplier` 返回 0

与 `netPositionConstraint` 相同模式（乘法归零），BORROW_BL 是 group-level 属性。

判断条件：
- `group.borrowBlacklist === true`
- `hasBorrowPosition = borrowInputUsd > 0 || (walletBorrowUsd != null && walletBorrowUsd > 0)`

## 改动清单

1. `src/types/aave.ts` — `CampaignGroup` 新增 `borrowBlacklist?: true`
2. `src/shared/market-contract/schemas.ts` — `MerklOpportunityGroupSchema` 新增 `borrowBlacklist: z.literal(true).optional()`
3. `public/openapi.json` — 新增 `borrowBlacklist` 字段
4. `src/types/field-canary.test.ts` — 新增 borrowBlacklist canary
5. `src/lib/rateSimulationCalculator.ts`:
   - `merklGroupMultiplier` 新增 BORROW_BL 归零分支
   - `buildMerklCampaignDetails` 中 `current` 也乘 `groupMul`（之前只 `after` 乘，current/after 不一致）
6. 测试：aggregation 3 条 + simulation 4 条 + field-canary 2 条

## 关键设计决策（Grill 时需确认）

1. **`current` 也乘 `groupMul`** — 之前 `buildMerklCampaignDetails` 中 `current` 没有乘 `groupMul`，netPositionConstraint 场景下也不一致。是否应该统一？
2. **`walletBorrowUsd` 参与归零判断** — Portfolio 模式下用户可能有 wallet borrow 但没有 borrow input。按 "deposit ceiling dilution is wallet property" 原则，应该归零。确认？
3. **`borrowBlacklist?: true` 而非 `boolean`** — 只有 `true` 有意义，缺失 = 无。类型约束更强。确认？

## 不在 Scope

- IncentiveTooltip current display 归零 → Phase 2
- BORROW_BL 归零的 tooltip 说明文案 → Phase 2
