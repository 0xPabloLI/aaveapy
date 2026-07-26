# Triage — 2026-07-23（更新于 2026-07-25）

> 快照时间：2026-07-25 UTC+8  
> 分支：`lovable`（与 origin 同步），`dev`（与 lovable 同步）

---

## 一、Open PRs（2 个 — 均 Dependabot）

| PR | 方向 | 内容 | 优先级 |
|---|---|---|---|
| **#469** | → main | bump npm_and_yarn group (2 updates) | 低 |
| **#456** | → main | bump actions/setup-node 6.4.0 → 7.0.0 | 低 |

> 之前的 Dependabot PRs（#452~#455, #457）已全部关闭（被 superseded）。这两个不紧急，可随时 merge。

---

## 二、未提交的本地变更（3 个文件）

| 文件 | 状态 | 内容 |
|---|---|---|
| `AGENTS.md` | Modified | 给 implementation workflow 步骤 1/2/4 加了 scenario-matrix 强制要求 |
| `docs/conventions/scenario-matrix.md` | Untracked | 新增 Scenario & Risk Verification Matrix convention 文档 |
| `docs/plans/handoff-pr-issue-triage-2026-07-23.md` | Untracked | 本 triage 文档 |

**建议**：AGENTS.md + scenario-matrix.md 是一组配套改动，应一起 commit。handoff 文档可单独 commit 或一起。

---

## 三、Ready for Agent Issues（按优先级）

### 3.1 High Priority

| Issue | 标题 | 关键说明 |
|---|---|---|
| **AAV-756** | Portfolio LTV constraint + Net Effective APY + Health Factor | 标记为 **Urgent**，状态 Todo。Portfolio 模式核心增强 |
| **AAV-895** | Borrow ETH with cbETH collateral — cross-asset net position | 独立，需专门 offset 公式 |
| **AAV-802** | Plasma chain console error | 独立 bug |
| **AAV-755** | URL 指向 market 而非 chain | 独立 UX 改进 |
| **AAV-783** | 验证 memory leak 修复效果 | AAV-329 子任务 |

### 3.2 Medium Priority

| Issue | 标题 | 关键说明 |
|---|---|---|
| **AAV-862** | 统一 normalize campaignType 逻辑 (parent) | 含子任务 AAV-868 / AAV-870 / AAV-866 |
| **AAV-843** | Brevis per-user API Dashboard | 独立 feature |
| **AAV-726** | Refactor: flatten monorepo to single-package backend | 独立 tech debt |
| **AAV-734** | 统一 destructive hover 样式 | 独立 UI 改进 |
| **AAV-781** | Unify endDate semantics in Merit cache | 独立 |
| **AAV-782** | Distinguish extraction failed vs not target type | 独立 |

### 3.3 Low / No Priority

| Issue | 标题 |
|---|---|
| AAV-829 | Unify `toLowerCase()` → `normalizeAddress()` |
| AAV-830 | Migrate merit-api to ProviderPool |
| AAV-517 | onchain 查询 spokeAddress |
| AAV-449 | 移除 spokeName 字段 |

---

## 四、推荐下一步（按优先级）

```
第 1 步：提交本地未提交的变更
  ├─ commit AGENTS.md + docs/conventions/scenario-matrix.md（配套改动）
  └─ commit 本 triage 文档（可选）

第 2 步：Dependabot PRs（不紧急）
  └─ merge #469 + #456 到 main

第 3 步：下一个开发任务（按优先级）
  ├─ AAV-756 — Portfolio LTV + Health Factor（Urgent）
  ├─ AAV-802 — Plasma console error
  └─ AAV-895 — cross-asset net position offset formula
```

---

## 五、注意事项

1. **dev 与 lovable 已同步**：PR #468 合并后 dev 包含了 lovable 的所有改动。后续 lovable → dev 的同步 PR 不再有冲突风险（除非 dev 有新的独立 commit）。

2. **schema pipeline 已稳定运行**：`openapi-sync` bot 会自动创建 PR 同步 spec + generated 代码。最近的 PR #463/#465 都是自动同步，无需人工干预。

3. **hardcode sync 已修复**：Issue #451（GitHub）已于本 session 修复并关闭。原因是 `schemas.ts` 使用 Vite alias `@/generated/api/schemas` 导致 Node.js 脚本无法解析，已改为相对路径 `../../generated/api/schemas.ts`。

4. **AAV-1013 已完成**：AAV-962（核心归零逻辑）、AAV-1219（类型 + canary）、AAV-1220（Tooltip 增强）全部 Done。剩余的 hookType=17 HEALTH_FACTOR 显示已拆分到独立 issue AAV-1071。