# Droid 自动 PR 审查

## 工作机制

仓库配置了两条 Factory Droid workflow(位于 `.github/workflows/`):

| 文件 | 触发方式 | 作用 |
|------|----------|------|
| `droid.yml` | issue/PR 评论或正文包含 `@droid` | 标签式按需响应(改动、答疑、修 bug) |
| `droid-review.yml` | `pull_request` opened / ready_for_review / reopened | 自动代码审查 + 安全审查 |

### droid-review.yml 配置(与 `inside-china-ai` 仓库对齐)

- `automatic_review: true` — 生成式代码审查
- `automatic_security_review: true` — 独立安全审查子代理,severity ≥ medium 才报告;注意:workflow 未配置合并阻断门禁,critical 结论是否阻止合并取决于 branch protection 是否将该 check 设为 required(当前未启用)
- `review_depth: deep` — 两遍流程(candidate 生成 + validator 复核),比 shallow 慢但误报率低
- `allowed_bots: renovate[bot]` — 默认策略忽略 bot 作者的 PR;显式放行 Renovate,因为依赖升级 PR 正是需要审查的对象
- `review_model: glm-5.3-flash` / `security_model: glm-5.3-flash` — 审查模型固定,防止默认模型漂移影响成本与输出稳定性
- `concurrency` 按 PR 号取消旧运行 — 同一 PR 连续 push 时只保留最新一轮
- draft PR 不触发 — 避免半成品触发计费

## 使用者须知

### 前置条件

Workflow 依赖 **`FACTORY_API_KEY` 仓库 secret**(经 `${{ secrets.FACTORY_API_KEY }}` 注入)。Secret 缺失时 action 优雅跳过(exit 0),不会报红,所以静默失效很难从 CI 看出。设置步骤见 `setup-github-actions-secret.md`。

**静默跳过的第二个场景**:Droid action 只校验默认分支(main)上的 workflow 定义。"给 main 开 PR 且该 PR 自带 workflow 变更"时,PR 自身的 run 会跳过(日志: `Skipping action due to workflow validation: Workflow not found on default branch`)——这是 GitHub 的防注入安全机制,合并后即恢复正常。

### 如何与审查结果互动

- Droid 的审查以 review 评论形式发布;可按普通 reviewer 回复互动
- 对审查结论有异议:在 PR 里说明理由,留待 human reviewer 拍板,**不要** cosmetic resolve
- 想主动让 Droid 看某个 PR:评论 `@droid` 即可(draft PR 也能触发标签式响应)

## 成本与配额治理

- 每 PR 上限 `max_runs_per_pr: 10`(action 默认值)
- `security_scan_schedule: false` — 不跑周期性安全扫描,只在 PR 事件触发
- 模型已固定(glm-5.3-flash);如需更换,同步修改两个 model 字段并说明理由

## 同仓库约定冲突点

`AGENTS.md` 的 "Session Workflow" 规定改代码前要走 Grill→Spec→Tickets→TDD→Code Review 流程。该流程适用于**由本仓库 agent harness 主动发起的工作**;Droid auto review 是**对进入 PR 的变更做独立复核**,两者互补而非替代——auto review 不豁免本地 TDD,本地 code-review skill 也不替代 PR 上的 Droid 审查。
