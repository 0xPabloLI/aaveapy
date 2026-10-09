# Dependabot Behavior

本仓依赖自动化的**现状与卡点**。改 `dependabot*` 相关文件、或遇到一个红着的 `dependabot/*` PR 时读这一份。

## 现状：删掉配置文件 ≠ 管道停了

`.github/dependabot.yml` 随 #736（2026-10-06 dev→main）离开默认分支，npm / github-actions / devcontainer 的升级改由 [`renovate.json`](../renovate.json) 负责，日常 npm 顺带更新仍走 `hardcode-sync`。

但**不要据此认为 Dependabot 不再开版本 PR**——实测被证伪一次：#752 于 2026-10-07T11:16Z（配置离开 main 约 24 小时后）创建，标题 `build(deps-dev): bump the npm_and_yarn group…`、commit trailer 是 `dependency-type: indirect` + `dependency-group: npm_and_yarn`，即**版本升级 PR 的格式**，而且它复用的正是 #746 那条 `dependabot/npm_and_yarn/npm_and_yarn-784f71ca69` 分支、head commit 一模一样。机制层面这里没有权威解释（配置缓存生效延迟、或对"仍未满足"的更新继续提案都有可能），要守的是**判据**而不是推测：

1. 先看 `git diff --stat origin/dev origin/<head>` 是否为空。#752 就是空的——它要带的内容已经由 #746 进了 dev，等 dev→main 上线即满足 ⇒ **关闭**，并预期上线后不再重开。
2. 若 diff 非空（dev 也还没修），把它 base 改到 `dev` 走发布流（见下一节），不要直接关。
3. 不要因为"重复"给依赖加 `ignore` 规则：那会连带压制这个依赖将来的合法提案，也会削弱 Security 面板的可见性。

原 Dependabot 配置里的隐式门槛已在 Renovate 侧复刻，别把"配置文件没了"读成"策略也没了"：

- eslint 上限（AAV-1301 裁定）⇒ packageRule `allowedVersions: "<10"`，`matchPackageNames` **必须同时含 `@eslint/js` 与 `eslint`**。只钉前者是半个上限：`eslint` 本体仍会被升，而 `eslint-plugin-import` 的 peer 只到 `^9`（实测 2026-10-09：`eslint-plugin-react-hooks@7` 与 `typescript-eslint@8` 已接受 `^10`）⇒ 严格 `npm ci` 失败，`peer-dep-check` 是 dev 与 main 都必填。这条由 `scripts/renovate-config.test.mjs` 守住（对照实验：把上限改回只管 `@eslint/js`，该用例变红）。
- npm 只有 `direct:development` 的 patch/minor 可自动合 ⇒ `matchManagers` + `matchDepTypes`（同一测试守这条）。
- 标签与 automerge 仍由本仓 [`automerge.yml`](../.github/workflows/automerge.yml) 的 PAT 路径执行（Renovate 自身 automerge 关），以保住「lovable→dev 用 MERGE、其余 SQUASH」。

**生效路径提醒**：Renovate 只读**默认分支**的配置，所以 `renovate.json` 的改动要走到 main 才算数（本仓经 lovable→dev→main）。

## Dependency Dashboard 不是待办事项

那张 `Dependency Dashboard` 卡由每轮 `ensureIssue()` 按标题维持，**手工关掉不持久**：下一轮运行它要么被重开、要么按同一标题重建。源码 `lib/workers/repository/dependency-dashboard.ts` 里真正的关闭路径只有两条：

1. `dependencyDashboardAutoclose: true`，且那一轮没有任何 branch 要展示、也没有 deprecation/replacement ⇒ `ensureIssueClosing()`。**这条是我们取的**（2026-10-09 加上），队空了卡片自己关，不需要人去清。注意它今天还关不掉 #715：卡上挂着 35 条 Awaiting Schedule、8 条 Pending Status Checks，以及 `framer-motion` 的 replacement 条目——三个条件都不满足。
2. `dependencyDashboard: false`，且没有任何规则用 `dependencyDashboardApproval` / `prCreation: approval` 把分支停在卡里 ⇒ 同样走 `ensureIssueClosing()`，而且此后**不再重建**。**这条不取**：本仓那个只钉了 `@eslint/js` 的半个 eslint 上限，正是从这张卡的 `update dependency eslint to v10` 一行看出来的；关掉它等于把 `minimumReleaseAge: 7 days` 和排程挡住的东西重新变回黑盒——而"看不见"是这一周已经付过两次学费的东西（#752/#757 复发）。

所以"让 open issue 数归零"不是这张卡该交付的目标。要看的是队列而不是计数：`prConcurrentLimit: 5` + `schedule: before 6am on monday` ⇒ "Awaiting Schedule" 是**还没到点的排程**，不是漏掉的活儿。要催某一条，勾它前面的 `unschedule-branch=` 复选框（或一次全催 `create-all-awaiting-schedule-prs`），Renovate 下次运行就建 PR。

`scripts/renovate-config.test.mjs` 钉住三条：卡开着（off-switch 没被拉）、autoclose 开着、没有规则把分支永久停在卡里。

## 仍然活着的两件事

- **Security updates**：仓库设置里 `dependabot_security_updates` 为 enabled，它**不依赖** `dependabot.yml`，且只会打在默认分支 `main` 上。抽查最近 100 条 `app/dependabot` PR 无一为 security-update 型（全为 `build(deps*)` 版本升级格式）⇒ 这一条**形状**的 PR 目前没有产出，但开关是开着的。
- [`dependabot-auto-triage.yml`](../.github/workflows/dependabot-auto-triage.yml)：`if: github.actor == 'dependabot[bot]'`，给任何 Dependabot PR 打 `manual-review` / `automerge` 标签并审批。**保留**，且它确实在跑：#752（2026-10-07）带着 `manual-review` 标签，而那次 `triage` 检查是 pass —— 这就是保留它的实证理由，与 `dependabot.yml` 是否存在无关。

## `dependabot/*` → main 的 PR 为什么必然红

`branch-flow-guard` 是 main 的必填检查，只放行 head 为 `dev`（例外：`bot/hardcode-sync-*`、`bot/token-icon-sync-*`）。因此任何 `dependabot/*` → main 的 PR 都合不掉。只有两条真解：

1. **把 base 改到 `dev`**，让它走 lovable→dev→main 的正常发布流。改 base 用 REST：`gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f base=dev`（`gh pr edit --base` 会因 Projects classic 已废弃而报错、base 不改）。改前先验合并结果只含预期文件：`git merge-tree --write-tree origin/dev origin/<head>` → `git diff --stat origin/dev <tree>`。GitHub 的 Files tab 会因 merge-base 早于某个 squash 合并而虚报大量文件，以 merge-tree 结果为准。
2. 给 guard 加 `dependabot/*` 白名单——那是**削弱 main 的防护层**，需 maintainer 明确批准，不作为默认处置。

## 已删除

`dependabot-resolve-peer-conflicts.yml`（对 dependabot PR 只做 peer 冲突报告、不改 lockfile）。它的判断能力已被 [`ci.yml`](../.github/workflows/ci.yml) 的 `peer-dep-check`（严格 `npm ci`）完全覆盖，且 `peer-dep-check` 是 dev 与 main **都必填**的硬门。删它不减少放行面。

## 相关

- React 同大版本约束：[`docs/conventions/peer-dependency-guard.md`](./conventions/peer-dependency-guard.md)
- PR 合并与分批策略：[`docs/PR_ANALYSIS.md`](./PR_ANALYSIS.md)
