# Phase 0: Overview & Index

> `docs/plans/frontend-triage-2026-06/`

## 总进度（2026-07-30 更新 — Phase 11 Re-eval 完成）

> 这是所有 triage phase 的**唯一状态跟踪源**。每次完成一个 phase 或 issue 后更新此表。

| 状态 | Phase | Issue(s) | 说明 |
|------|-------|----------|------|
| ✅ Done | 1 | AAV-962 | BorrowBL incentive 归零逻辑 |
| ✅ Done | 2 | AAV-1013 | 962/1219/1220 全部 Done；剩余 hookType=17 拆分到 AAV-1071 |
| ✅ Done | 3 | AAV-1192/1193/1194 | T1/T2/T3 全部 Done；MobilePortfolioCard 保留内联（ADR-0028） |
| ⏸️ Blocked | 4 | AAV-756 | 阻塞于后端 AAV-1222（ltv/liquidationThreshold 字段） |
| ✅ Done | 5 | AAV-755 | URL 指向 market — query param 方案（AAV-1225/1226 子 issue） |
| ✅ Done | 6 | AAV-802 | Plasma console error（问题已自然消失） |
| ✅ Done | 7 | AAV-1096 | grid→flex 统一完成（commit `103254c5`，子 issue AAV-1234 Done） |
| 🔄 Shrunk | 8 | AAV-1104/734/1095/783/1141 | AAV-734 Done, AAV-1095 Done, AAV-1104 Canceled（ADR-0027）; 剩 AAV-783（后端）+ AAV-1141（低优先） |
| ✅ Done | 9 | AAV-1144~1158 | staging API ✅, testid ✅; 25 处 platform-conditional skip → project config routing (AAV-1154 Done) |
| ✅ Done | 10 | AAV-1107/1084/1121/1114/1113/738 | AAV-1121+1084 fixed; AAV-1107 fixed (scroll spacer reset on data change, PR #489); AAV-1114 Canceled; AAV-738 Backlog; AAV-1113 Backlog（有数据但代码未满足：每个note是独立`<tr>`，需改为inline） |
| ✅ Done | 11 | AAV-1136/1135/1123/1122/1110/1102/1162/1160/1159/733 | Re-eval 完成：733/1135/1102/1123/1110 Done; 1136/1122 搁置(Backlog); 1160/1159/1162 保留可做 |
| ⚠️ Dormant | 12 | AAV-1023/1024 | 阻塞于 AAV-1022（No priority, 自 6/27 无进展）；投入产出比低 |
| 🔄 Unblocked | 13 | AAV-843 | 阻塞项 AAV-842 已 Canceled；per-user API 独立于 distributedSoFarUsd，可解除阻塞 |
| 📝 Backlog | 14 | AAV-364/564/333+482/1071/248/512 | 前端功能扩展（长期 roadmap） |

**统计**：✅ Done 11 | 🔄 Shrunk 1 | 📝 Backlog 2 | ⏸️ Blocked 1 | ⚠️ Dormant 1 | 🔄 Unblocked 1

---

## 2026-07-28 Phase 评估结果

### Phase 8 大幅缩减

| Issue | 评估结果 | 证据 |
|-------|---------|------|
| AAV-734 | ✅ **Done** — 代码已干净 | `PortfolioPanel.tsx` 已用 `destructive` token；全项目 grep `hover:bg-red`/`hover:text-red-500` **零匹配**；`PortfolioTokenRow.tsx` 已被 UnifiedTable 替代 |
| AAV-1095 | ✅ **Done** — Linear 已标记 | Schema pipeline 完成（ADR-0026）；`src/generated/api/schemas.ts` 存在 |
| AAV-1104 | ❌ **Canceled** — 被 ADR 推翻 | ADR-0027 正式接受 `?chain=xxx&market=yyy` query param 方案（multi-select 友好、不与 SEO 页冲突）。原始诉求"去掉?"已被 ADR 推翻 |
| AAV-783 | 🔄 后端跟踪 | `repo:backend` 标签；railway 分支有修复，需后端 PR railway → main |
| AAV-1141 | 📉 低优先 | No priority；无用户投诉；需先跑 Lighthouse 确认瓶颈 |

### Phase 9 精确统计

经精确 grep，违反 AGENTS.md 规范的 platform-conditional `test.skip(testInfo.project.name.includes('mobile/desktop'))` 模式共 **21 处**（非之前估计的 ~32 处）：

| 文件 | 数量 |
|------|------|
| `portfolio-incentive-calculation.spec.ts` | 10 |
| `segmented-toggle-visual.spec.ts` | 6 |
| `portfolio-cross-reserve-offset.spec.ts` | 2 |
| `portfolio-results-inline-delta.spec.ts` | 1 |
| `top-opportunities-mobile-layout.spec.ts` | 1 |
| `portfolio-mobile-spacing.spec.ts` | 1 |

其余 ~19 处 `test.skip` 是合理的（`!WATCH_ADDRESS` 环境变量检查、`test.skip(true, 'data-dependent')` 数据依赖检查）。

### Phase 12 评估

阻塞项 AAV-1022（offset 对齐规则定义）自 2026-06-27 创建至今 **No priority**，无任何进展。offset 计算逻辑已在 `rateSimulationCalculator.ts` 完整实现。AAV-1022 是设计决策（展示语义），不是 bug。除非有用户反馈"被 offset 后的数字困惑"，投入产出比低。建议维持 Dormant 状态。

### Phase 13 阻塞解除

阻塞项 AAV-842 已被 **Canceled**。经分析，AAV-843 的 per-user API 端点（`POST /v1/getMerkleProofsBatch`、`POST /v1/getUserRewardsBatch`）与 AAV-842 的 `distributedSoFarUsd` 字段是独立功能。AAV-843 可解除阻塞，但需单独走 grill-with-docs → to-spec 流程（substantial feature + protobuf 序列化风险）。

---

## 当前状态（2026-07-30）

- **分支**：`lovable` = `dev` = `main`，零 divergence
- **工作树**：干净
- **Open PRs**：0
- **阻塞项**：AAV-756（等后端 AAV-1222）

### 下一步顺序

前端可做的按优先级排列；后端依赖的往后移。

| 顺序 | Phase | Issue | 状态 | 估计 |
|------|-------|-------|------|------|
| ~~1~~ | ~~9~~ | ~~21 处 platform skip→describe 迁移~~ | ✅ Done (AAV-1154) | ~~0.5 session~~ |
| ~~1~~ | ~~10~~ | ~~AAV-1107 等~~ | ✅ Done (commit `738a068c`) — AAV-1121+1084 fixed, 1107 verified, 1114 canceled | ~~0.5 session~~ |
| ~~1~~ | ~~11~~ | ~~AAV-1136 等~~ | ✅ Done — Re-eval 完成: 7 issues Done, 2 deferred, 3 actionable | ~~0.5 session~~ |
| **1** | 11 | AAV-1160/1159/1162 | 📝 Actionable — 3 issues 保留可做 | 1 session |
| **3** | 13 | AAV-843 | 🔄 Unblocked — 需单独 spec | 2-3 sessions |
| — | 8 | AAV-1141 | 📉 低优先 — 需先 Lighthouse | 待定 |
| — | 4 | AAV-756 | ⏸️ Blocked — 等后端 AAV-1222 | — |
| — | 12 | AAV-1023 | ⚠️ Dormant — AAV-1022 No priority | — |
| — | 14 | AAV-364 等 | 📝 Backlog — 长期 roadmap | — |

---

## lovable 分支恢复记录（2026-07-21）

`lovable` 分支于 2026-07-18 后被删除（无分支保护，最可能由 Lovable 平台 bot 在 sync 操作中删除）。已从本地 `refs/remotes/origin/lovable` 恢复到远程。`lovable` 分支缺少 `allow_deletions: false` 保护规则（仅 `dev` 和 `main` 有），建议后续补充。

---

## 代码对比结果（2026-07-28 更新）

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
| AAV-734 | 原 Phase 8 | `PortfolioPanel.tsx` 已用 `destructive` token；全项目 `hover:bg-red`/`hover:text-red-500` 零匹配；`PortfolioTokenRow.tsx` 已被 UnifiedTable 替代 — Done ✅ |
| AAV-1095 | 原 Phase 8 | Schema pipeline 完成（ADR-0026）；`src/generated/api/schemas.ts` 存在 — Done ✅ |
| AAV-1104 | 原 Phase 8 | ADR-0027 正式接受 query param 方案；原始诉求"去掉?"被推翻 — Canceled ❌ |

部分完成的 issue（保留在 plan 中，标注进度）：

（无 — Phase 7 AAV-1096 已全部完成，commit `103254c5`）

---

## Phase 列表（2026-07-28 全面审查后）

| Phase | File | Issue(s) | Scope | Status | Branch |
|-------|------|----------|-------|--------|--------|
| 1 | `phase1-borrow-bl.md` | AAV-962 | `CampaignGroup.borrowBlacklist` + `merklGroupMultiplier` 归零 + current 也乘 groupMul + 测试 | ✅ Done | `feat/aav-962-borrow-bl-incentive` |
| 2 | `phase2-borrow-blacklist-tooltip.md` | AAV-1013 (剩余) | IncentiveTooltip 传 `userHasBorrow` + BORROW_BL 归零文案 + `CampaignAccessEntry.borrowHookProtocols` | ✅ Done | `feat/aav-1013-borrow-bl-tooltip` |
| 3 | `phase3-reserve-identity.md` | AAV-1192, AAV-1193, AAV-1194 | ReserveIdentity 补全：测试覆盖 + 文档 + ADR-0028 | ✅ Done | `refactor/aav-1192-reserve-identity` |
| 4 | `phase4-portfolio-ltv.md` | AAV-756 | Portfolio LTV constraint + Net Effective APY (with LTV) + Health Factor | ⏸️ Blocked (后端 AAV-1222) | `feat/aav-756-portfolio-ltv` |
| 5 | `phase5-url-market.md` | AAV-755 | URL 只指向 chain → 改为指向 market | ✅ Done | `fix/aav-755-url-market` |
| 6 | `phase6-plasma-console-error.md` | AAV-802 | Console 报 plasma chain 请求错误 | ✅ Done | `fix/aav-802-plasma-console` |
| 7 | `phase7-incentive-tooltip-layout.md` | AAV-1096 | IncentiveTooltip RecentlyEnded section grid→flex 统一 | ✅ Done (commit `103254c5`) | `ui/aav-1096-tooltip-layout` |
| 8 | `phase8-frontend-infra.md` | AAV-1141 (剩余) | ~~AAV-734 Done~~ ~~AAV-1095 Done~~ ~~AAV-1104 Canceled~~ AAV-783 后端跟踪 | 🔄 Shrunk (仅 AAV-1141 低优先) | `refactor/aav-1141-frontend-infra` |
| 9 | `phase9-e2e-test-hardening.md` | 25 处 platform skip | E2E 测试加固：staging API ✅ + testid ✅ + skip→describe 迁移 (25 处, AAV-1154 Done) | ✅ Done | `test/aav-1154-e2e-skip-migration` |
| 10 | `phase10-reserve-table-expand-ui.md` | AAV-1107, AAV-1084, AAV-1121, AAV-1114, AAV-1113, AAV-738 | Reserve table 展开部分 UI 修复 + 优化 | ✅ Done (commit `738a068c`) — AAV-1121 cap spacer height + AAV-1084 flex-wrap; AAV-1107/1114 verified; AAV-738 feature request; AAV-1113 no data | `fix/aav-1107-reserve-expand-ui` |
| 11 | `phase11-portfolio-simulation-ui.md` | AAV-1160, AAV-1159, AAV-1162 (剩余) | Portfolio simulation UI — Re-eval 后仅 3 个 actionable; AAV-733/1135/1102/1123/1110 Done; AAV-1136/1122 搁置 | ✅ Done (Re-eval) — 3 issues 待实施 | `ui/aav-1136-portfolio-sim-ui` |
| 12 | `phase12-offset-reserve-table.md` | AAV-1023 + AAV-1024 | Reserve table offset 规则改造 + Shared scenario 同步 | ⚠️ Dormant (AAV-1022 No priority) | `refactor/aav-1023-offset-reserve` |
| 13 | `phase13-brevis-user-dashboard.md` | AAV-843 | Brevis per-user API 接入：Dashboard + Claim | 🔄 Unblocked (AAV-842 Canceled) | `feat/aav-843-brevis-dashboard` |
| 14 | `phase14-frontend-roadmap.md` | AAV-364, AAV-564, AAV-333+482, AAV-1071, AAV-248, AAV-512 | 前端功能扩展（长期 roadmap） | 📝 Backlog | 按子项创建 |

### Needs Info（暂不分配 phase）

| Issue | 说明 |
|-------|------|
| AAV-751 | 钱包下拉菜单字体不一致 |
| AAV-891 | 监控 Aave 官方前端 repo 变更 |

---

## 依赖关系

大部分 phase 之间**无强依赖**，按优先级排列即可。仅有的依赖：

```
Phase 1 ──→ Phase 2 (tooltip 文案依赖归零逻辑) — 已完成
Phase 4 (阻塞于后端 AAV-1222 — ltv/liquidationThreshold 字段)
Phase 12 (阻塞于 AAV-1022 — No priority, Dormant)
Phase 13 (原阻塞于 AAV-842 — 已 Canceled, 解除阻塞)
```

> ~~Phase 5 ←──→ Phase 8 / AAV-1104 (URL 路由重构有重叠，建议合并)~~ — AAV-1104 已 Canceled（ADR-0027 接受 query param 方案），此依赖不再相关。

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
