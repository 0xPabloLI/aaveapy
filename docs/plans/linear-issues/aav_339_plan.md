# 开发方案 — AAV-339+ 🚨 staging smoke test 持续失败 — 合并修复

> **Meta-issue**：合并 AAV-339/340/341/342/343/345/346/347/348 及同标签重复项（均为同一根因的重复触发）

## 1. Issue 概述
staging 环境部署后自动触发的 smoke test **持续失败**，每次失败自动创建新 GitHub / Linear Issue，导致大量重复 ticket。自动回滚在 preview 分支（`lovable` / `dev`）被设计为跳过，需 manual recovery。需要：
1. 一次性修复 smoke test 根因
2. staging 回滚采用 **manual playbook**（不实现 preview promote spike）
3. workflow 中 issue 去重逻辑合入 `main`，防止再次产生重复 issue

## 2. 已确认根因（证据）

| Run | Branch | 失败 Step | 日志结论 |
|-----|--------|-----------|----------|
| [#26015997962](https://github.com/0xPabloLI/aaveapy/actions/runs/26015997962) | `lovable` | **Check production domain** (`site_check`) | Vercel deployment 已 READY；`staging.aaveapy.com` HTTP 200，但 `aaveapy-deploy-sha` **不等于** 本次 `github.sha`（域名仍指向旧 deployment） |
| [#25896995693](https://github.com/0xPabloLI/aaveapy/actions/runs/25896995693) | `lovable` | **Wait for Vercel deployment** | 10 分钟内未找到匹配 commit 的 READY deployment（次要模式） |

**主因（高频）**：preview deployment READY 后，`staging.aaveapy.com` 自定义域名别名更新滞后，`site_check` 在约 30s 内即判定 SHA 不匹配而失败。

**非 gate**：`api_check` 仅 warning，不会导致 job 失败。

## 3. 历史触发记录

| Issue | Commit | Actions Run | 失败 Step | Rollback 原因 |
|-------|--------|-------------|-----------|---------------|
| AAV-339 | `91a45ed` | — | — | `preview_skip` |
| AAV-340 | `95aa35b` | — | — | `preview_skip` |
| AAV-341 | `3c39369` | [#25896995693](https://github.com/0xPabloLI/aaveapy/actions/runs/25896995693) | Wait for Vercel | `preview_skip` |
| AAV-342 | `b583a91` | [#25900208459](https://github.com/0xPabloLI/aaveapy/actions/runs/25900208459) | site_check (SHA) | `preview_skip` |
| AAV-343 | `d913b4e` | [#25900440054](https://github.com/0xPabloLI/aaveapy/actions/runs/25900440054) | site_check (SHA) | `preview_skip` |
| AAV-345 | `9966dae` | [#25903871396](https://github.com/0xPabloLI/aaveapy/actions/runs/25903871396) | site_check (SHA) | `preview_skip` |
| AAV-346 | `4dac8bc` | [#25904070523](https://github.com/0xPabloLI/aaveapy/actions/runs/25904070523) | site_check (SHA) | `preview_skip` |
| AAV-347 | — | — | — | — |
| AAV-348 | `61fdaaf` | [#25967072690](https://github.com/0xPabloLI/aaveapy/actions/runs/25967072690) | site_check (SHA) | `preview_skip` |

> 注：表中「已执行」曾误标为 production rollback；`lovable` 分支 rollback job 成功仅表示 **创建了 notification**，实际为 `preview_skip`。

## 4. 影响范围
- 前端仓库：`aaveapy`（**`lovable`** 分支为主触发；`dev` 亦映射 `staging.aaveapy.com`）
- CI/CD： [`.github/workflows/deployment-smoke-test.yml`](../../.github/workflows/deployment-smoke-test.yml)
- 文档：[`docs/conventions/vercel-deployment-smoke-test.md`](../../conventions/vercel-deployment-smoke-test.md)
- Vercel：preview target + `staging.aaveapy.com` 别名
- **Linear**：GitHub workflow dedup **不会**自动关闭 Linear；需 `duplicateOf → AAV-339`

## 5. 实现方案

### 5.1 根因排查（已完成，保留命令供复现）
```bash
gh run list --workflow=deployment-smoke-test.yml --status=failure --limit=10
gh run view <RUN_ID> --log-failed
```

**会导致 job 失败的步骤**：
- `Wait for Vercel deployment` — 超时 / ERROR
- `Check production domain` (`site_check`) — HTTP / SPA / **deploy-sha 不匹配**
- `Check Vercel deployment URL` (`deploy_url_check`) — HTTP / deploy-sha 不匹配

**诊断-only（非 gate）**：
- `Check API connectivity` (`api_check`) — `/api/markets` 失败仅 warning

### 5.2 修复方案（PR2 — 根因）

**已实现方向**：
- **staging / 非 `main`**：对 `staging.aaveapy.com` 的 deploy-sha 检查增加 **最长 5 分钟轮询**（15s 间隔），等待域名别名追上 Vercel READY deployment
- **`deploy_url_check`**：对本次 `DEPLOY_URL` 校验 `aaveapy-deploy-sha == github.sha`（preview 上的权威来源）
- **`main`**：保持现有严格单次检查

场景 A–D 仍作 checklist；当前证据指向 **场景 C 的别名滞后变体**，非 API 或构建失败。

### 5.3 Staging 回滚 — manual playbook（已选）

preview 分支**不**调用 Vercel instant project rollback（`deployment-smoke-test.yml` L221-226）。rollback step 输出固定 manual recovery：

1. 在 Vercel Dashboard 找到上一 READY 的 `lovable` preview deployment  
2. Promote 到 `staging.aaveapy.com`，或 revert 失败 commit 后重推  
3. 参考 workflow 日志中的 `DEPLOY_URL` / commit SHA  

> **不采用** preview promote 自动化（选项 B spike）；单独 issue 再评估。

### 5.4 Issue 去重逻辑 — ✅ 已实现（待 PR1 合入 `main`）

工作区已实现（优于原 body 拼接方案）：`smoke-test-failure` 标签 + 固定 title → 重复失败 **comment** 追加。

```javascript
// deployment-smoke-test.yml — Create rollback notification issue
const match = existingIssues.data.find(i => i.title === dedupTitle);
if (match) {
  await github.rest.issues.createComment({ issue_number: match.number, body: failureEntry });
} else {
  await github.rest.issues.create({ ... });
}
```

**验收**：`main` 上 dedup 已上线；后续失败不再开新 GitHub issue。

### 5.5 关闭重复 Linear issues
- 保留 **AAV-339** 为主 issue
- 将 AAV-320/330~338/340~354 等同标签 open 项标为 `Duplicate` → AAV-339（GitHub dedup 不同步 Linear）
- 重复 plan 文档：本地已删 17 个 `aav_*_plan.md`（待 commit）

### 5.6 PR 策略

| PR | 目标分支 | 内容 |
|----|----------|------|
| **PR1（紧急）** | `main` | workflow dedup + `lovable` trigger |
| **PR2** | `lovable` | staging SHA 轮询 + deploy URL SHA gate + manual recovery 日志 |

## 6. 依赖关系
- 后端 staging API 稳定（`api_check` 非 blocking，但影响数据质量告警）
- GitHub secrets：`VERCEL_TOKEN`、`VERCEL_PROJECT_ID`（缺失时 smoke **跳过**，属假绿风险 — 后续可改为 fail）

## 7. 验收标准
- [ ] staging smoke test 通过（`site_check` 在别名滞后时可轮询成功，或 deploy URL SHA 已通过）
- [ ] preview 分支 rollback **跳过**，但 issue / 日志含 **manual recovery playbook**
- [ ] `main` 已合入 GitHub issue **dedup**（comment 追加，不新建）
- [ ] Linear：AAV-339 外同标签重复项均为 Duplicate
- [ ] `vercel-deployment-smoke-test.md` 与 workflow 一致
- [ ] 重复 plan 文档删除已提交

## 8. 复杂度评估
- **Medium** — 根因已确认；PR1 小改；PR2 为 workflow 轮询 + 文档
