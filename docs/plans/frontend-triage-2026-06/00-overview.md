# Phase 0: Overview & Index

> `docs/plans/frontend-triage-2026-06/`

## 总进度（2026-07-27 更新）

> 这是所有 triage phase 的**唯一状态跟踪源**。每次完成一个 phase 或 issue 后更新此表。

| 状态 | Phase | Issue(s) | 说明 |
|------|-------|----------|------|
| ✅ Done | 1 | AAV-962 | BorrowBL incentive 归零逻辑 |
| ✅ Done | 2 | AAV-1013 | 962/1219/1220 全部 Done；剩余 hookType=17 拆分到 AAV-1071 |
| 🔄 Partial | 3 | AAV-1192/1193/1194 | T1/T2 Done，T3（测试完善+文档）待做 |
| ⏸️ Blocked | 4 | AAV-756 | 阻塞于后端 AAV-1222（ltv/liquidationThreshold 字段） |
| ✅ Done | 5 | AAV-755 | URL 指向 market — query param 方案（AAV-1225/1226 子 issue） |
| ✅ Done | 6 | AAV-802 | Plasma console error（问题已自然消失） |
| 🔄 Partial | 7 | AAV-1096 | 主体 grid→flex Done，RecentlyEnded section 待统一 |
| 🔄 Partial | 8 | AAV-1104/734/1095/783/1141 | destructive hover ✅, URL 优化待做, memory leak 验证待做 |
| 🔄 Partial | 9 | AAV-1144~1158 | staging API ✅, testid ✅, skip→describe 迁移大量待做 |
| 📝 Backlog | 10 | AAV-1107/1084/1121/1114/1113/738 | Reserve table 展开部分 UI 修复 |
| 📝 Backlog | 11 | AAV-1136/1135/1123/1122/1110/1102/1162/1160/1159/733 | Portfolio simulation UI 全面优化 |
| ⏸️ Blocked | 12 | AAV-1023/1024 | 阻塞于 AAV-1022（外部 issue） |
| ⏸️ Blocked | 13 | AAV-843 | 阻塞于 AAV-842（Brevis 后端 distributedSoFarUsd） |
| 📝 Backlog | 14 | AAV-364/564/333+482/1071/248/512 | 前端功能扩展（长期 roadmap） |

**统计**：✅ Done 4 | 🔄 Partial 4 | 📋 Ready 0 | ⏸️ Blocked 3 | 📝 Backlog 3

---

## 当前状态（2026-07-27）

- **分支**：`lovable` = `dev` = `main`，零 divergence
- **工作树**：干净
- **Open PRs**：0
- **阻塞项**：AAV-756（等后端 AAV-1222）、Phase 12（等 AAV-1022）、Phase 13（等 AAV-842）

### 下一步顺序

Ready / Partial 的按编号顺序做；Blocked 的等解除后插入；Backlog 的在 Ready/Partial 都做完后按编号做。

| 顺序 | Phase | Issue | 状态 |
|------|-------|-------|------|
| **1** | 5 | AAV-755 | ✅ Done — 2026-07-28 |
| 2 | 3 | AAV-1193/1194 | 🔄 Partial |
| 3 | 7 | AAV-1096 | 🔄 Partial |
| 4 | 8 | AAV-1104/783/1141 | 🔄 Partial |
| 5 | 9 | skip→describe 迁移 | 🔄 Partial |
| 6 | 10 | AAV-1107 等 | 📝 Backlog |
| 7 | 11 | AAV-1136 等 | 📝 Backlog |
| — | 4 | AAV-756 | ⏸️ Blocked |
| — | 12 | AAV-1023 | ⏸️ Blocked |
| — | 13 | AAV-843 | ⏸️ Blocked |
| — | 14 | AAV-364 等 | 📝 Backlog |

---

## lovable 分支恢复记录（2026-07-21）

`lovable` 分支于 2026-07-18 后被删除（无分支保护，最可能由 Lovable 平台 bot 在 sync 操作中删除）。已从本地 `refs/remotes/origin/lovable` 恢复到远程。`lovable` 分支缺少 `allow_deletions: false` 保护规则（仅 `dev` 和 `main` 有），建议后续补充。

---

## 代码对比结果（2026-07-21 更新）

以下 issue 经代码对比确认已完成，已从 plan 中剔除并同步 Linear 状态为 Done：

| Issue | 原属 Phase | 代码证据 |
|-------|-----------|----------|
| AAV-951 | 原 Phase 6 | IncentiveTooltip `RecentlyEndedSection` 已实现；Linear 已是 Done |
| AAV-1133 | 原 Phase 13 | commit `bb72e5b2`；SimulationLane 已移除 headlineIncentive |
| AAV-1105 | 原 Phase 13 | `buildMerklCampaignDetails/Merit/Brevis` 全部改为 options object |
| AAV-1190 | 原 Phase 9 | `addReserve` 签名有 `hubName?/hubId?`；`walletPositionToPortfolio` 已传递 |
| AAV-1191 | 原 Phase 9 | `ReserveIdentity.tsx` 已提取，有 compact/stacked 两种 variant + 测试 |
| AAV-1142 | 原 Phase 9 | Fix 22 Playwright failures — Done ✅ |
| AAV-1145 | 原 Phase 9 | `playwright.config.ts` 已用 `dev:staging` ✅ |
| AAV-1152 | 原 Phase 9 | `PortfolioUnifiedTable.tsx` 12 列全部有 `data-cell` 属性 ✅ |
| AAV-1153 | 原 Phase 9 | `MobilePortfolioCard.tsx` 有 `data-testid="delta-current/after/value"` ✅ |
| AAV-1199 | — | `loadRegistryChainIds` regex 修复 — Done ✅ |

部分完成的 issue（保留在 plan 中，标注进度）：

| Issue | 当前 Phase | 已完成 | 未完成 |
|-------|-----------|--------|--------|
| AAV-1096 | Phase 7 | IncentiveTooltip 主体 grid→flex + 测试 | RecentlyEnded section 仍有 `grid-cols-[1fr_5rem]`（第 339/381 行） |
| AAV-1192 | Phase 3 | PortfolioUnifiedTable + PopularTokenChip 已用 ReserveIdentity | MobilePortfolioCard 内联 hubName 未用 ReserveIdentity（可能不需要改） |
| AAV-734 | Phase 8 | PortfolioPanel 已用 `destructive` token | PortfolioTokenRow 已被 UnifiedTable 替代；全项目审查未完成 |

---

## Phase 列表（2026-07-21 全面审查后）

| Phase | File | Issue(s) | Scope | Status | Branch |
|-------|------|----------|-------|--------|--------|
| 1 | `phase1-borrow-bl.md` | AAV-962 | `CampaignGroup.borrowBlacklist` + `merklGroupMultiplier` 归零 + current 也乘 groupMul + 测试 | PR #458 In Review | `feat/aav-962-borrow-bl-incentive` |
| 2 | `phase2-borrow-blacklist-tooltip.md` | AAV-1013 (剩余) | IncentiveTooltip 传 `userHasBorrow` + BORROW_BL 归零文案 + `CampaignAccessEntry.borrowHookProtocols` | ✅ Done (962/1219/1220 全部 Done) | `feat/aav-1013-borrow-bl-tooltip` |
| 3 | `phase3-reserve-identity.md` | AAV-1192, AAV-1193, AAV-1194 | ReserveIdentity 补全：MobilePortfolioCard 评估 + 测试完善 + 文档更新 | Backlog (T1/T2 已 Done) | `refactor/aav-1192-reserve-identity` |
| 4 | `phase4-portfolio-ltv.md` | AAV-756 | Portfolio LTV constraint + Net Effective APY (with LTV) + Health Factor | Todo (阻塞于后端 AAV-1222) | `feat/aav-756-portfolio-ltv` |
| 5 | `phase5-url-market.md` | AAV-755 | URL 只指向 chain → 改为指向 market | Ready for agent | `fix/aav-755-url-market` |
| 6 | `phase6-plasma-console-error.md` | AAV-802 | Console 报 plasma chain 请求错误 | ✅ Done (2026-07-27) | `fix/aav-802-plasma-console` |
| 7 | `phase7-incentive-tooltip-layout.md` | AAV-1096 | IncentiveTooltip RecentlyEnded section grid→flex 统一 | Backlog (部分完成, 测试与代码不一致) | `ui/aav-1096-tooltip-layout` |
| 8 | `phase8-frontend-infra.md` | AAV-1104, AAV-734, AAV-1095, AAV-783, AAV-1141 | 前端基础设施：URL query 优化 + destructive hover 统一 + Zod schema 统一 + memory leak 验证 + 性能 | Backlog (部分完成) | `refactor/aav-1141-frontend-infra` |
| 9 | `phase9-e2e-test-hardening.md` | AAV-1144→1145~1149; AAV-1151→1152~1158; AAV-1150 | E2E 测试加固：staging API ✅ + testid ✅ + skip→describe 迁移 (大量未完成) | Backlog (核心已完成, skip 迁移待做) | `test/aav-1144-e2e-hardening` |
| 10 | `phase10-reserve-table-expand-ui.md` | AAV-1107, AAV-1084, AAV-1121, AAV-1114, AAV-1113, AAV-738 | Reserve table 展开部分 UI 修复 + 优化 | Backlog | `fix/aav-1107-reserve-expand-ui` |
| 11 | `phase11-portfolio-simulation-ui.md` | AAV-1136, AAV-1135, AAV-1123, AAV-1122, AAV-1110, AAV-1102, AAV-1162, AAV-1160, AAV-1159, AAV-733 | Portfolio simulation UI 全面优化 | Backlog | `ui/aav-1136-portfolio-sim-ui` |
| 12 | `phase12-offset-reserve-table.md` | AAV-1023 + AAV-1024 | Reserve table offset 规则改造 + Shared scenario 同步 | Backlog (blocked by AAV-1022) | `refactor/aav-1023-offset-reserve` |
| 13 | `phase13-brevis-user-dashboard.md` | AAV-843 | Brevis per-user API 接入：Dashboard + Claim | Ready for agent | `feat/aav-843-brevis-dashboard` |
| 14 | `phase14-frontend-roadmap.md` | AAV-364, AAV-564, AAV-333+482, AAV-1071, AAV-248, AAV-512 | 前端功能扩展（长期 roadmap） | Backlog | 按子项创建 |

### Needs Info（暂不分配 phase）

| Issue | 说明 |
|-------|------|
| AAV-751 | 钱包下拉菜单字体不一致 |
| AAV-891 | 监控 Aave 官方前端 repo 变更 |

---

## 依赖关系

大部分 phase 之间**无强依赖**，按编号顺序从前往后做即可。仅有的依赖：

```
Phase 1 ──→ Phase 2 (tooltip 文案依赖归零逻辑)
Phase 5 ←──→ Phase 8 / AAV-1104 (URL 路由重构有重叠，建议合并)
Phase 12 (阻塞于 AAV-1022 — 外部 issue，不在本 plan 内)
Phase 4 (阻塞于后端 AAV-1222 — ltv/liquidationThreshold 字段)
Phase 13 (阻塞于 AAV-842 — Brevis 后端 distributedSoFarUsd)
```

其余各 phase 互相独立。

## Branch & Worktree 规范

每个 phase 使用独立 worktree + feature branch。

### Branch 命名

```
{type}/aav-{id}-{kebab-slug}
```

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | bug 修复 |
| `refactor` | 重构 |
| `test` | 测试 |
| `perf` | 性能 |
| `ui` | UI 优化 |

### Worktree 创建模板

```bash
git worktree add /tmp/aaveapy-{type}-aav-{id} \
  -b {type}/aav-{id}-{slug} lovable
```

> **命名来源说明**：branch 命名 `{type}/aav-{id}-{slug}` 是参考 conventional commits 风格设计的，不是项目已有的既定规范，可以根据你的偏好调整。
