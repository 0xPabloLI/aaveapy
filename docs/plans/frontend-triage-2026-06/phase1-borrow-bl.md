# Phase 1: BORROW_BL Incentive 归零逻辑

> Issue: AAV-962
> Project: Incentive Source Upper-Layer Unification
> 估计: 1 session
> **Status: In Review** — commit `041909b9`, branch `feat/aav-962-borrow-bl-incentive`, PR #458

## 标准工作流合规性审查（2026-07-21）

> ⚠️ Phase 1 实施未走完标准工作流，以下是逐项对照：

| 步骤 | 状态 | 说明 |
|------|------|------|
| 1. Grill with Docs | ❌ 未执行 | 无 grill-with-docs skill 记录；设计决策直接在 plan 中确认，未经 ADR/glossary 审查 |
| 2. To Spec | ❌ 未执行 | 无 spec 文档（`docs/specs/` 下无 borrow-bl 相关文件） |
| 3. To Tickets | ❌ 未执行 | 未拆分为 tracer-bullet tickets，直接整块实现 |
| 4. TDD Implement | ⚠️ 部分 | 17 个测试与实现在同一 commit 中，无法确认 red→green→refactor 顺序 |
| 5. Code Review | ❌ 未执行 | 无 code-review skill 记录（Standards + Spec 双轴审查） |
| 6. Dev Server + Playwright | ❌ 未执行 | 纯 calculator 逻辑无 UI 交互，但未做浏览器验证 |
| 7. Commit | ✅ 已执行 | 单 commit `041909b9`，7 文件 331 行 |
| 8. 更新文档及 Issue | ❌ 未执行 | Linear AAV-962 未更新状态；Phase 1 plan 已有实施结论但未补充工作流审查 |

### 补救措施

- [ ] 补走 Code Review（Standards + Spec 双轴审查）
- [ ] 补更新 Linear AAV-962 状态
- [ ] 后续 Phase 必须严格走完标准工作流

---

## 实施结论（2026-07-21）

### 设计决策确认

1. **`current` 也乘 `groupMul`** — plan 描述已过时。代码中 `current` 已通过 `walletMerklGroupMultiplier` 乘 groupMul（AAV-1101）。真正的问题是 unified eligibility 路径（`crossReserveNetEligibleUsdFn`）忽略 `merklGroupMultiplier`，需要单独加 BORROW_BL 归零。
2. **`walletBorrowUsd` 参与归零判断** — 确认。`current` 用 `walletBorrowGrossForEligibility`，`after` 用 `borrowGrossForEligibility`。Golden Rule #1 保持。
3. **`borrowBlacklist?: true`** — 确认。与 `isActive?: false` 模式一致。

### 改动清单（实际执行）

1. `src/types/aave.ts` — `CampaignGroup` 新增 `borrowBlacklist?: true` ✅
2. `src/shared/market-contract/schemas.ts` — `MerklOpportunityGroupSchema` 新增 `borrowBlacklist: z.literal(true).optional()` ✅
3. `public/openapi.json` — 新增 `borrowBlacklist` 字段 ✅
4. `src/types/field-canary.test.ts` — 4 个 canary 测试 ✅
5. `src/lib/rateSimulationCalculator.ts` — 4 个函数新增 BORROW_BL 归零分支 ✅
   - `merklGroupMultiplier` (after, fallback path)
   - `walletMerklGroupMultiplier` (current, fallback path + per-campaign)
   - `crossReserveNetEligibleUsdFn` (after, unified eligibility path)
   - `walletCrossReserveNetEligibleUsdFn` (current, unified eligibility path)
6. 测试：5 aggregation + 8 simulation + 4 field-canary = 17 个新测试 ✅

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
