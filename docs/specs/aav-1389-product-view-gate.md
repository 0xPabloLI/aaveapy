# AAV-1389 — 产品视角三句门禁：照搬 inside-china-ai 的通用件，只换取数源

> Status: implemented 2026-11-16 · Issue: AAV-1389 · Type: workflow tooling
> 用户指令：通用部分尽量直接复用 inside-china-ai 的工作流，别再发明本仓专属版本。

## 背景

AGENTS.md `Session 结束验证` 一直有「产品视角结论完成」这一项，但它不可判定：没有内容形状、没有脚本、没有门禁。2026-11-16 的 AAV-1335 交付实证了后果——九步全打勾、`ci:remote` 全绿、dev CI 全绿，产品视角依然缺席，没有任何门禁发现。

inside-china-ai 已经把这条规则做成可判定形态（其 `docs/agents/implementation-workflow.md` §9 步骤 8–9，及其 `docs/archive/.../product-view-gates-history` 记录的结论：**文字从未缺席，缺的是可判定的边界**）。所以本票不重写规则，只搬通用件。

## 取舍：哪些算「通用」，哪些必须本地化

| 件 | 处置 | 理由 |
| --- | --- | --- |
| 三句定义（可见问题 / 现在看到什么 / 哪些没变，No user-visible change 时第三句写明原因） | 原样 | 与语言、仓库、技术栈无关 |
| `scripts/check-product-view.mjs`（含 `PRODUCT_VIEW_ROLES`、`extractSection`、`countUnits`、两类豁免） | **原样复制** | 纯文本、无依赖、只吃 env（`PR_BODY` / `PR_AUTHOR` / `PR_LABELS` / `GITHUB_EVENT_NAME`），不含 GitHub 调用 |
| PR 模板的 `## 产品视角` 节 | 原样结构，占位符三行保留 | 校验器的占位符规则就是针对它写的 |
| 渲染器 `product-view-section.mjs` | **本地适配**：`gh api issues/<n>/comments` → Linear GraphQL `issue(id:).comments` | 本仓票在 Linear；合同（标记 `交付记录`、`## 产品视角`、来源 marker、exit 0/1/2）全部沿用 |
| 作者权限过滤（OWNER/MEMBER/COLLABORATOR） | **未搬** | Linear 评论没有等价字段；工作区私有，记录由 session 写入，来源 marker 带 comment id 可追溯。若将来出现外部协作者再评估 |
| bot 豁免判据 | **加一路 `user.type`**（原版只看 login 的 `[bot]` 后缀） | 同一个 Renovate PR 在事件 payload 里是 `renovate[bot]`、在 `gh pr list` 里渲染成 `app/renovate`；只认后缀会漏掉不带后缀的 App actor。`user.type` 是 GitHub 的事实，不是作者可选的 |
| `issue-tracker-ledger.mjs` 的 `isRecordComment` | 未搬 | 它服务 GitHub 账本，本仓没有账本；只搬它判定的标记语义 |

## 设计

- **校验器**：`evaluateProductView`（PR body，带 bot/`skip-product-view`/非 PR 事件豁免）与 `evaluateCommentProductView`（交付记录评论，无豁免）共用同一套节提取与实质单元计数。
- **渲染器**：`node scripts/product-view-section.mjs AAV-1234` → 拉票、取带 `交付记录` 标记的评论、按 `createdAt` 从新到旧找第一条过门禁的、输出「来源 marker + `## 产品视角` + 正文」；`exit 0` 渲染成功 / `1` 无可引用（附每个候选被拒的原因）/ `2` 用法错。
- **两处接线**：CI `repo-policy` 在 `pull_request` 事件跑 `npm run check:product-view`（`repo-policy` 是既有 required check，门禁继承阻断力）；AGENTS.md Step 9 把「三句 + 渲染器 + PR 门禁」写成一条。
- **凭据**：渲染器先读 `LINEAR_API_KEY`，本地回退 `.codeartsdoer/mcp/mcp_settings.json`（未跟踪文件）。渲染器是本地收尾工具，不进 CI。

## Modified Files Impact

| 文件 | 修改 | 风险 | 评估 |
| --- | --- | --- | --- |
| `scripts/check-product-view.mjs` | 新增（复制） | Low | 纯函数；只在 CI 的 PR 事件中被调用 |
| `scripts/product-view-section.mjs` | 新增（Linear 适配） | Low | 本地工具；无 npm 依赖；网络只在 CLI 路径发生，测试注入 loader |
| `scripts/*.test.mjs` 两份 | 新增 22 例 | Low | 进既有 `node --test "scripts/**/*.test.mjs"`，不新增 hook |
| `.github/workflows/ci.yml` | repo-policy 增一步（`if: pull_request`） | Medium | required check 变严；必须先确认所有在途 PR 的 body 不被打红 |
| `.github/pull_request_template.md` | 新增 `## 产品视角` 节 | Low | 模板 only |
| `package.json` | 增 `check:product-view` / `product-view` | Low | 别名 |
| `AGENTS.md`、`docs/agents/harness.md` | 规则行 + 偏离登记 | Low | 常驻上下文 +1 行 |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | PR body 有三条实质内容 | PASS | — | `evaluateProductView` 用例 | 纯文本判定 |
| S2 | PR body 缺节 | FAIL，报「no product-view section」 | 门禁空转 | 用例 | 缺节即红 |
| S3 | PR body 原样提交模板（占位符） | FAIL | 模板满足门禁 ⇒ 门禁装饰化 | 用例（`PLACEHOLDER_TAIL_RE`） | 行尾冒号即剔除 |
| S4 | 只有 2 条实质内容 | FAIL，报「needs 3」 | 一句带过 | 用例 | 计数下限 |
| S5 | Renovate/bot 开的 PR | SKIP 并说明原因，不伪装成 PASS | 机器人被卡死 | 用例 | `author.endsWith("[bot]")` |
| S6 | 纯内部重构打 `skip-product-view` | SKIP 并说明 | 豁免不可控 | 用例 | 标签需写权限 |
| S7 | `push` 事件（无 PR body） | SKIP，不因空 body 变红 | 每次 push 红 | 用例 | 事件判定 |
| S8 | 交付记录有新有旧、旧的更薄 | 取最新合规；薄的那条报出原因 | 引用了错误记录 | 渲染器用例（`old`/`new`/`note`） | 新→旧扫描 |
| S9 | 票上没有任何 `交付记录` 标记 | exit 1，报「no comment carries the marker」 | 拿闲聊当记录 | 用例 | 标记前置 |
| S10 | 渲染器测试环境断网 | 22 例全绿，`fetch` 陷阱 0 调用 | unit 层出网（AAV-1335 同源教训） | 用例 `hermeticity` | 注入 `loadIssue` |
| S11 | Linear 不可达 / 无 key / 票号错 | exit 1 并说明，不输出半节 | 汇报缺节却像成功 | CLI 分支 | 错误路径直通 stderr |
| S12 | 非 `AAV-1234` 形态的参数 | exit 2 + usage | 静默取错票 | `parseArgs` 用例 | 形态校验 |
| S13 | 在途 PR body 未带本节 | 只有非 bot 作者会红；bot/App actor 豁免 | 上线即卡住所有 Renovate PR | 预检 2 张开放 PR（#845/#846） | 见下：预检先踩了 `gh pr list` 的 login 渲染坑，补 `user.type` 判据 |

**S13 预检实录**：用 `gh pr list --json author` 得到 `app/renovate`、`is_bot=true`，按空格则两张 Renovate PR 全 FAIL；改查 REST `pulls/846` 的 `user.login` 得到 `renovate[bot]`（`type=Bot`），与 CI 事件 payload 一致 ⇒ 两张 PR 实际都是 SKIP，不阻塞。为避免同类 App actor 不带 `[bot]` 后缀，校验器额外接受 `PR_AUTHOR_TYPE=Bot`，CI 已把 `pull_request.user.type` 一并路由进 env。

## Testing Decisions

**Seam.** 校验器是纯函数（输入 body/labels/event → 判定）；渲染器的 seam 是注入 `loadIssue`，网络只在默认实现里。两套测试都不碰磁盘以外的状态。

**Good test.** 断言可判定的外部事实：是否 PASS/FAIL/SKIP、拒绝原因里的关键短语、输出是否带来源 marker、`fetch` 是否被调用。不断言日志排版。

**不测什么.** 不测 Linear 真实响应（会引入凭据与网络）；不测 PR body 的 GitHub 事件装配（那是 workflow 的活儿，靠 `if: pull_request` 与 env 路由）。

## Verification Evidence

- `node --test scripts/check-product-view.test.mjs scripts/product-view-section.test.mjs` → **22 passed / 0 failed**；两次红都是断言/实现口径问题（① 测试夹具里「其它」与断言词撞车；② `parseArgs(['--repo','x'])` 先报「参数个数」而非「未知 flag」——改为先扫 flag）。
- `npm test`（vitest 4405 + scripts 全套）与 `ci:remote`：见交付记录。
- CI 端到端：需一个真实 PR 才能看到 `repo-policy` 里的这一步；本地等价断言 = 用真实模板 body 跑 `check:product-view`（模板必须红，填好必须绿）。

## Out of Scope

- 搬 `issue-tracker-ledger` 的账本与提醒机制（本仓没有 GitHub issue 账本）。
- 给渲染器做 CI（CI 拿不到 Linear 凭据，且汇报是聊天文本）。
- 改 `skip-product-view` 的标签名或豁免口径。

## Further Notes

- 门禁只能断言形式，判不了裁决真假——这条边界同样适用于本票：三句写错内容仍会 PASS。真人审查才是真假的那一层。
- 这条与 AAV-1335 的教训互为正反：AAV-1335 证明「有测试文件 ≠ 测试在跑」，本票证明「规则在场 ≠ 规则被执行」；两者的补法都是把不可判定的东西换成可判定的边界。
