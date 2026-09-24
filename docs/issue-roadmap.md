# Issue Roadmap — Open Issues 优先级与执行状态

GitHub Issues + Linear Issues 的优先级排序、状态追踪与依赖关系。每次 triage 后更新。

> **排序规则：GitHub issue 始终排在 Roadmap 最前面。**

> **交付细节的唯一权威源是 issue 评论**（`gh issue view <N> --comments` / Linear issue comments）。本文件的盘点条目只作对话式上下文，不覆写 tracker。

## 当前状态

> **Last inventory**: 2026-09-24（AAV-1298 交付并 push 验证闭环：bot PR 收敛 dev + codegen 产物自修复 patcher，commit `12037128`；CI run 36003645267 全绿，真实 drift 下 openapi-sync 正确 skipped。遗留清理：bot 僵尸分支 19→0、#655/#657 经 dependabot rebase + automerge 自动合并、GitHub issues 清零。新开排队票：AAV-1301 Medium（eslint 10 工具链升级，GitHub #653）、AAV-1302 Low（release-drafter v7 迁移，GitHub #656，调研结论=不可原样合并）；剩余 open PR 仅此二者，等票消化 + 用户合并拍板）。
>
> **frontier** = AAV-1282（High，移动端 RainbowKit wallets prop；GitHub issues 已清零 open）。

---

## 方案审查结论与关键建议速览

| Issue | 现状 / 方案痛点 | 审查建议与方案修正 | 调整动作 |
| --- | --- | --- | --- |
| **AAV-1297** | 依赖外部 API 推导 slug 存在 CI 网络抖动风险 | **四级兜底推导**：Overrides 表 → AddressBook 模块名正则 → 外部 chainid.network（带超时）→ 通用 `chain-${id}`。配套标准化占位 SVG 与 manifest 自动构建。 | 设为 AAV-1296 前置 |
| **AAV-1296** | 「全或无」门禁导致一旦有缺项整条 sync 瘫痪 | **门禁拆分 + 降级通道**：verify 拆为 critical（报错阻塞）与 advisory（补占位/警告但允许建 PR）。补 `pending-chain-ids.json` 逃生通道。 | 依赖 AAV-1297 产物 |
| **AAV-1298** | openapi-sync 尝试对 lovable 分支建 PR 失败 | **收敛 Bot PR 目标**：依据三分支规范，所有自动同步 bot 统一只对 `dev` 建 PR，禁止直打 lovable；排查 codegen 语法与 PAT 权限。 | 目标分支收敛至 dev |
| **AAV-1299** | E2E 依赖 staging 动态数据致断言超时 | **预检健壮性过滤**：`findIncentiveReserve()` 必须预检 valid APR > 0 且 base rate 正常，排除未定价/0 APR 活动；APR/APY 切换增加计算防抖完成判定。 | 强化断言前置条件 |
| **AAV-1279** | 实际代码已合入三分支（`19b102a1`），状态滞留 | **流转结案**：代码与架构守卫均已落地，移除阻塞标记；剩余生产环境 CDN 配置单独跟进。 | 流转至 Done / 归档 |
| **AAV-1282** | 移动端 RainbowKit 未配 wallets 弹窗空白 | **隔离钱包 Chunk 注入**：在 `WalletProviders.tsx` 动态配置 wallets，严格确保不被提升至首屏 entry bundle，防止 FCP 回归。 | 确认方案，保持 High |
| **AAV-1274** | 跨前后端大范围字段重命名，高风险低收益 | **降级并前端内聚适配**：不进行跨仓库 breaking change，前端仅在输入适配层做兼容别名 `distributionType ?? campaignType`。 | 优先级从 High 降至 Low |
| **AAV-1292** | 3 个 schedule 工作流在 default 分支缺失不跑 | **最小工作流抽离**：不等待大版本晋升，将无依赖的 `uptime-alert.yml` 先行独立抽离并合并进 main 分支，优先恢复全天候存活监控。 | 拆出独立探活 PR |
| **AAV-1275** | AMOUNT 变体 APR 单位非百分比，易误导用户 | **复合展示策略（Option A+）**：主表格无法换算 USD 年化时展示 `—` 且不计入净 APR；Tooltip 完整展示每日代币数与固定发放规则说明。 | 明确产品决策方案 |

---

## GitHub Issues（最前）

GitHub 上创建的 issue，双向链接到 Linear，按用户规则始终排最前。

| GitHub # | Linear | Priority | State | Title | Labels |
| --- | --- | --- | --- | --- | --- |
| #668 | AAV-1297 | **Urgent** | Done（2026-09-24 交付，见 Linear 交付记录） | [Improvement] chainIconMap 自动同步：从 registry 自动生成占位条目 | enhancement, hardcode |
| #667 | AAV-1296 | **Urgent** | Done（2026-09-24 交付，见 Linear 交付记录） | [Improvement] Hardcode Sync 韧性：解除「全或无」门禁单点故障 | enhancement, hardcode, drift |
| #671 | AAV-1299 | **High** | Done（2026-09-24 交付，见 Linear 交付记录） | [Bug] e2e flaky: portfolio-incentive-calculation supply total 超时显示占位符 | bug |
| #670 | AAV-1298 | **High** | Done（2026-09-24 交付，见 Linear 交付记录） | 🔥 Lovable CI failure: openapi-sync | bug, ci-failure-lovable |

---

## Active Linear Issues

非 GitHub 来源的 Linear issue，按 priority 降序排列。仅列 open（非 Done/Canceled/Duplicate）。

### Urgent / High

| Linear | Priority | State | Title | Assignee |
| --- | --- | --- | --- | --- |
| AAV-1282 | High | Todo | 移动端 Connect 弹窗为空：RainbowKit 未配置 wallets prop | — |
| AAV-1280 | High | Backlog | e2e self-loop offset 用例失败：staging Merkl 数据标记 Celo spoke 有活动但 UI incentive 为空 | — |

### Medium

| Linear | Priority | State | Title |
| --- | --- | --- | --- |
| AAV-1301 | Medium | Todo | [Toolchain] eslint 10 升级：@eslint/js 10 peer 冲突，需协调升级整条 eslint 工具链（GitHub #653） |
| AAV-1295 | Medium | Backlog | [CI] smoke test 修好后 auto-rollback 首次可达，但 deploymentRollback mutation 从未执行过 |
| AAV-1292 | Medium | Backlog | railway → main 正式晋升：三个定时工作流从未运行 |
| AAV-1275 | Medium | Backlog | DESIGN: AMOUNT variant campaign APR display strategy (product decision needed) |

### Low / No priority

| Linear | Priority | State | Title |
| --- | --- | --- | --- |
| AAV-1302 | Low | Todo | [CI] release-drafter v7 迁移：autolabeler action 拆分 + category 模型（GitHub #656） |
| AAV-1274 | Low | Backlog | RENAME: campaignType → distributionType (cross-repo API breaking change) *(降级：建议前端别名适配替代跨仓重命名)* |
| AAV-1293 | Low | Todo | [后端] 是否将 /api/seo/* 管理面纳入 OpenAPI spec *(建议：确认为内部管理路由，不予公开)* |
| AAV-1271 | Low | Backlog | 工具：Aave UI ↔ Backend API 对比工具 Phase 3 |
| AAV-1270 | Low | Backlog | 后端：incentive_details 列级 NULL 命中率测试 + 决策 |
| AAV-1269 | Low | Backlog | 后端：LOCF 查询实现（/api/markets/history 历史回放） |
| AAV-1283 | None | Backlog | Security audit: moderate vulnerabilities (tracking) |

---

## Backlog Projects

Linear project（state=backlog），未排入具体 issue 执行序列。

| Project | Status |
| --- | --- |
| Incentive Source Upper-Layer Unification | backlog |
| 全站无障碍校验、实施与规范建设 | backlog |
| ABI Cleanup & Address Book Auto-Upgrade | backlog |
| 增加 market 的 overview | backlog |
| 增加连接钱包功能 | backlog |
| twitter operation | backlog |

---

## Recently Completed

近 session 完成的 issue（仅列代表性的，完整历史见 Linear）。

| Linear | Title | Closed |
| --- | --- | --- |
| AAV-1298 | 🔥 Lovable CI failure: openapi-sync（bot PR 收敛 dev + codegen patcher） | 2026-09-24 |
| AAV-1299 | e2e flaky: portfolio-incentive-calculation supply total 超时显示占位符 | 2026-09-24 |
| AAV-1296 | Hardcode Sync 韧性：解除「全或无」门禁单点故障 | 2026-09-24 |
| AAV-1279 | FCP 优化：延迟加载非首屏 chunk（代码 `19b102a1` 已合入三分支） | 2026-09-24 |
| AAV-1300 | [Hardcode Sync] verify failed after retry | 2026-09-24 |
| AAV-1294 | [CI] deployment-smoke-test 恒为假绿灯 | 2026-09-24 |
| AAV-1289 | 下线 Merit 全链路 | 2026-09-24 |
| AAV-1278 | Side-Data Persistence to PostgreSQL | 2026-09-24 |

---

## 维护规则

- **更新时机**：每次 triage 或 issue 状态变更后更新本文件。
- **排序**：GitHub issue → Linear Urgent/High → Medium → Low/None。
- **不缓存交付细节**：本文件只记 issue 号、priority、state、title；commits、测试、live evidence 沉淀在 issue 评论里。
- **与 `docs/agents/issue-tracker.md` 分工**：本文件是用户可见的 Roadmap 快照；issue-tracker.md 是 agent 内部的 Linear 操作配置 + triage 契约。