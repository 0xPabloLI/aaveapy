# Triage — 2026-07-23（更新于 2026-07-27）

> 快照时间：2026-07-27 UTC+8  
> 分支：`lovable` = `dev` = `main`（三分支完全同步）

---

## 一、Open PRs（0 个）

无 open PR。上次 triage 的两个 Dependabot PR 均已 merge：

| PR | 方向 | 内容 | 状态 |
|---|---|---|---|
| **#469** | → main | bump npm_and_yarn group (2 updates) | ✅ Merged 2026-07-25 |
| **#456** | → main | bump actions/setup-node 6.4.0 → 7.0.0 | ✅ Merged 2026-07-25 |

---

## 二、未提交的本地变更

无。工作树干净。上次 triage 的 3 个未提交文件已在 commit `3aa3e429` 中提交。

---

## 三、Ready for Agent Issues（按优先级）

### 3.1 High Priority

| Issue | 标题 | 关键说明 |
|---|---|---|
| **AAV-756** | Portfolio LTV constraint + Net Effective APY + Health Factor | 标记为 **Urgent**，状态 Todo。阻塞于后端 issue AAV-1222（需增加 ltv + liquidationThreshold 字段） |
| **AAV-895** | Borrow ETH with cbETH collateral — cross-asset net position | 独立，需专门 offset 公式 |
| ~~AAV-802~~ | ~~Plasma chain console error~~ | ✅ **Done**（2026-07-27 验证：问题已不存在，RPC 正常 + address book 有 Pool） |
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
第 1 步：提交本地未提交的变更 ✅ 已完成 (3aa3e429)

第 2 步：Dependabot PRs ✅ 已完成 (#469 + #456 merged)

第 3 步：下一个开发任务（按优先级）
  ├─ AAV-756 — Portfolio LTV + Health Factor（Urgent）→ 阻塞于后端 AAV-1222
  ├─ AAV-802 — Plasma console error ✅ Done（问题已不存在）
  ├─ AAV-755 — URL 指向 market ← 下一个
  └─ AAV-895 — cross-asset net position offset formula
```

---

## 五、注意事项

1. **三分支完全同步**：`lovable` = `dev` = `main`，零 divergence（PR #479/#480 完成同步）。

2. **schema pipeline 已稳定运行**：`openapi-sync` bot 自动创建 PR 同步 spec + generated 代码。最近包含 16 个 schema 更新。

3. **hardcode sync 已修复**：`schemas.ts` 使用 Vite alias 导致 Node.js 脚本无法解析的问题已修复（commit `06665f0a`）。

4. **AAV-1013 已完成**：AAV-962（核心归零逻辑）、AAV-1219（类型 + canary）、AAV-1220（Tooltip 增强）全部 Done。剩余的 hookType=17 HEALTH_FACTOR 显示已拆分到独立 issue AAV-1071。

5. **AAV-802 已关闭**（2026-07-27）：Plasma (9745) 在 address book 中有 `AaveV3Plasma` 模块（有 POOL 地址），已在 `AAVE_CHAIN_IDS` 中。三个 RPC 端点均正常。Production 站点 Playwright 测试：零 plasma console error。问题已自然消失。

6. **AAV-756 后端 blocker 已创建**：AAV-1222 — 要求后端 `GET /markets` API 增加 per-reserve `ltv` + `liquidationThreshold` 字段。AAV-756 已设为其子任务。

7. **前后端协同部署工作流已文档化**：`docs/workflows/frontend-backend-coordinated-deployment.md` + AGENTS.md 中的 5 步部署说明。