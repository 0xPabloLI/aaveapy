# Phase 0: Overview & Index

> `docs/plans/frontend-triage-2026-06/`

## Projects & Phases

| Phase | File | Issue(s) | Project | Scope | Est. session |
|-------|------|----------|---------|-------|-------------|
| 1 | `phase1-borrow-bl.md` | AAV-962 | Incentive Source Upper-Layer Unification | `CampaignGroup.borrowBlacklist` + `merklGroupMultiplier` 归零 + current 也乘 groupMul + 测试 | 1 |
| 2 | `phase2-borrow-blacklist-tooltip.md` | AAV-1013 (剩余) | Incentive Source Upper-Layer Unification | IncentiveTooltip 传 `userHasBorrow` + BORROW_BL 归零文案 + `CampaignAccessEntry.borrowHookProtocols` | 1 |
| 3 | `phase3-hub-borrowed.md` | AAV-1017 | 独立 PRD | 确认已有实现 + dev server 验证 EURC utilization ~68% | 0.5 |
| 4 | `phase4-url-market.md` | AAV-755 | Frontend Bug | URL 只指向 chain → 改为指向 market | 0.5 |
| 5 | `phase5-plasma-console-error.md` | AAV-802 | Frontend Bug | Console 报 plasma chain 请求错误 | 0.5 |
| 6 | `phase6-recently-ended-campaign.md` | AAV-951 | Incentive Source Upper-Layer Unification | recently ended campaign 没起作用 | 0.5 |
| 7 | `phase7-offset-reserve-table.md` | AAV-1023 + AAV-1024 | 独立 | Reserve table offset 规则改造 + Shared scenario 同步（待 AAV-1022 定） | 1-2 |

## 依赖关系

```
Phase 1 ──→ Phase 2 (tooltip 文案依赖归零逻辑)
Phase 3 (独立，验证型)
Phase 4, 5, 6 (互相独立)
Phase 7 (依赖 AAV-1022 规则确定)
```

## 建议执行顺序

1 → 3 → 2 → 4 → 5 → 6 → 7
