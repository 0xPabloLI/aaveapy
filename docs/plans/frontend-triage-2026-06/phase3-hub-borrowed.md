# Phase 3: V4 Hub Borrowed 直传验证

> Issue: AAV-1017
> 估计: 0.5 session

## 现状

PRD 中所有改动**已存在于当前代码**：

| PRD 要求 | 现状 |
|----------|------|
| `hubBorrowed` 字段加到 schema | ✅ `schemas.ts:183` 已有 |
| `hubBorrowed` 加到类型 | ✅ `aave.ts:176` 已有 |
| `hubBorrowed` field-canary | ✅ `field-canary.test.ts:58` 已有 |
| `useRateSimulation.ts` 用直传 | ✅ `:277 hubBorrowed = reserve.hubBorrowed` |
| `reserveRateInput.borrowed = hubBorrowed` | ✅ `:280` |
| 删除 hubBorrowed 聚合 | ✅ `hubAggregation.ts` 不存在 |
| 删除 `validateHubAggregateConsistency` | ✅ 不存在 |
| `hubSupplied` 保留 | ✅ `:381 hubSupplied ?? reserve.supplied` |
| capping 层不受影响 | ✅ `scenarioSize.ts` 不引用 hubBorrowed |

## 待做

- dev server 验证：EURC utilization 显示 ~68%（vs 之前 79%）
- Playwright 截图对比（如有 EURC reserve）

## 验收标准

- EURC utilization ≈ 68%
- CI gate 通过
