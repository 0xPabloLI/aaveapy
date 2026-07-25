# Handoff: PR & Issue Triage — 2026-07-23（更新于 2026-07-25）

> 快照时间：2026-07-25 UTC+8  
> 分支：`lovable`（与 origin 同步），`dev`（与 lovable 同步）

---

## 一、已完成事项

### 1.1 已合并 PR

| PR | 方向 | 标题 | 合并时间 | 关联 Issue |
|---|---|---|---|---|
| **#458** | `feat/aav-962 → lovable` | BORROW_BL incentive zeroing | 2026-07-24 01:49 UTC | AAV-962 ✅ Done |
| **#468** | `lovable → dev` | Schema pipeline automation | 2026-07-24 01:55 UTC | AAV-1209 ✅ Done, AAV-1216 ✅ Done |

**本 session 贡献**：解决了 PR #458 与 schema pipeline 改造的合并冲突（`schemas.ts` + `openapi.json`），使 PR 从 DIRTY 变为 CLEAN 并成功合并。

### 1.2 已关闭的 Linear Issues

| Issue | 标题 | 状态 |
|---|---|---|
| AAV-962 | BorrowBL: 前端 Simulation 中 BORROW_BL opp 的 incentive 归零逻辑 | ✅ Done |
| AAV-1209 | Schema Pipeline Automation: 后端驱动全链路自动生成 | ✅ Done |
| AAV-1216 | [前端] Phase 3: 转 strict + 删除手写 schema 代码 | ✅ Done |

### 1.3 后续 commit（非本 session）

lovable 分支在 PR 合并后还新增了两个 commit（可能来自其他 session）：

- `dfccb36a` feat(types): add MerklBorrowHookProtocol + borrowHookProtocols to CampaignAccessEntry (AAV-1219)
- `eabc0103` feat(tooltip): apply borrowBlacklist zeroing in IncentiveTooltip via userHasBorrow prop (AAV-1220)

这两个 commit 实现了 AAV-1013 中描述的 Tooltip 增强部分。

---

## 二、当前 Open PRs（2 个 — 均 Dependabot）

| PR | 方向 | 内容 | 优先级 |
|---|---|---|---|
| **#469** | → main | bump npm_and_yarn group (2 updates) | 低 |
| **#456** | → main | bump actions/setup-node 6.4.0 → 7.0.0 | 低 |

> 之前的 Dependabot PRs（#452~#455, #457）已全部关闭（被 superseded）。这两个不紧急，可随时 merge。

---

## 三、未提交的本地变更（3 个文件）

| 文件 | 状态 | 内容 | 来源 |
|---|---|---|---|
| `AGENTS.md` | Modified | 给 implementation workflow 步骤 1/2/4 加了 scenario-matrix 强制要求 | 本 session |
| `docs/conventions/scenario-matrix.md` | Untracked | 新增 Scenario & Risk Verification Matrix convention 文档 | 之前 session |
| `docs/plans/handoff-pr-issue-triage-2026-07-23.md` | Untracked | 本 handoff 文档 | 本 session |

**建议**：AGENTS.md + scenario-matrix.md 是一组配套改动，应一起 commit。handoff 文档可单独 commit 或一起。

---

## 四、Ready for Agent Issues（按优先级）

### 4.1 High Priority

| Issue | 标题 | 关键说明 |
|---|---|---|
| **AAV-756** | Portfolio LTV constraint + Net Effective APY + Health Factor | 标记为 **Urgent**，状态 Todo。Portfolio 模式核心增强 |
| **AAV-895** | Borrow ETH with cbETH collateral — cross-asset net position | 独立，需专门 offset 公式 |
| **AAV-802** | Plasma chain console error | 独立 bug |
| **AAV-755** | URL 指向 market 而非 chain | 独立 UX 改进 |
| **AAV-783** | 验证 memory leak 修复效果 | AAV-329 子任务 |

### 4.2 Medium Priority

| Issue | 标题 | 关键说明 |
|---|---|---|
| **AAV-1013** | ✅ Done — borrowBlacklist + borrowHookProtocols 前端适配 | AAV-962（核心归零）+ AAV-1219（类型+canary）+ AAV-1220（Tooltip 显示一致性）全部完成。hookType=17 留待 AAV-1071 |
| **AAV-862** | 统一 normalize campaignType 逻辑 (parent) | 含子任务 AAV-868 / AAV-870 / AAV-866 |
| **AAV-843** | Brevis per-user API Dashboard | 独立 feature |
| **AAV-726** | Refactor: flatten monorepo to single-package backend | 独立 tech debt |
| **AAV-734** | 统一 destructive hover 样式 | 独立 UI 改进 |
| **AAV-781** | Unify endDate semantics in Merit cache | 独立 |
| **AAV-782** | Distinguish extraction failed vs not target type | 独立 |

### 4.3 Low / No Priority

| Issue | 标题 |
|---|---|
| AAV-829 | Unify `toLowerCase()` → `normalizeAddress()` |
| AAV-830 | Migrate merit-api to ProviderPool |
| AAV-517 | onchain 查询 spokeAddress |
| AAV-449 | 移除 spokeName 字段 |

---

## 五、推荐下一步

```
第 1 步：提交本地未提交的变更
  ├─ commit AGENTS.md + docs/conventions/scenario-matrix.md（配套改动）
  └─ commit handoff 文档（可选）

第 2 步：AAV-1013 已完成 ✅
  └─ AAV-1219/1220 + AAV-962 全部 Done。hookType=17 留待 AAV-1071

第 3 步：Dependabot PRs（不紧急）
  └─ merge #469 + #456 到 main

第 4 步：下一个开发任务（按优先级）
  ├─ AAV-756 — Portfolio LTV + Health Factor（Urgent）
  ├─ AAV-802 — Plasma console error
  └─ AAV-895 — cross-asset net position offset formula
```

---

## 六、注意事项

1. **AAV-1013 已完成**：AAV-962（核心归零）+ AAV-1219（类型+canary）+ AAV-1220（Tooltip 显示一致性）全部 Done。hookType=17 HEALTH_FACTOR 排除条件显示留待 AAV-1071（语义不同，独立 issue）。

2. **AAV-1071（AAV-1013 遗留项）**：`hookType=17` (HEALTH_FACTOR) 排除条件显示。与 BORROW_BL（`hookType=14`，二元归零）语义不同——HEALTH_FACTOR 是基于用户健康因子阈值（`healthFactorThreshold`）的排除条件。需后端提供 `healthFactorHooks` 字段（当前 OpenAPI spec 中缺失），前端需新增阈值显示逻辑。实施前需确认后端是否已就绪。

3. **dev 与 lovable 已同步**：PR #468 合并后 dev 包含了 lovable 的所有改动。后续 lovable → dev 的同步 PR 不再有冲突风险（除非 dev 有新的独立 commit）。

4. **schema pipeline 已稳定运行**：`openapi-sync` bot 会自动创建 PR 同步 spec + generated 代码。最近的 PR #463/#465 都是自动同步，无需人工干预。
