# Dependabot Behavior

本仓依赖自动化的**现状与卡点**。改 `dependabot*` 相关文件、或遇到一个红着的 `dependabot/*` PR 时读这一份。

## 现状：版本升级 PR 已归零

`.github/dependabot.yml` 随 #736（2026-10-06 dev→main）离开默认分支 ⇒ Dependabot 不再开版本升级 PR。npm / github-actions / devcontainer 的升级全部由 [`renovate.json`](../renovate.json) 负责；日常 npm 顺带更新仍走 `hardcode-sync`。

原 Dependabot 配置里的隐式门槛已在 Renovate 侧复刻，别把"配置文件没了"读成"策略也没了"：

- `@eslint/js >= 10` 的忽略（AAV-1301 裁定）⇒ packageRule `allowedVersions: "<10"`。
- npm 只有 `direct:development` 的 patch/minor 可自动合 ⇒ `matchManagers` + `matchDepTypes`。
- 标签与 automerge 仍由本仓 [`automerge.yml`](../.github/workflows/automerge.yml) 的 PAT 路径执行（Renovate 自身 automerge 关），以保住「lovable→dev 用 MERGE、其余 SQUASH」。

## 仍然活着的两件事

- **Security updates**：仓库设置里 `dependabot_security_updates` 为 enabled，它**不依赖** `dependabot.yml`，且只会打在默认分支 `main` 上。抽查最近 100 条 `app/dependabot` PR 无一为 security-update 型（全为 `build(deps*)` 版本升级格式）⇒ 这条路目前没有产出，但没有关闭。
- [`dependabot-auto-triage.yml`](../.github/workflows/dependabot-auto-triage.yml)：`if: github.actor == 'dependabot[bot]'`，是上述 security PR 唯一的分类器（打 `manual-review` / `automerge` 标签并审批）。**保留**，它不靠 `dependabot.yml` 存在。

## `dependabot/*` → main 的 PR 为什么必然红

`branch-flow-guard` 是 main 的必填检查，只放行 head 为 `dev`（例外：`bot/hardcode-sync-*`、`bot/token-icon-sync-*`）。因此任何 `dependabot/*` → main 的 PR 都合不掉。只有两条真解：

1. **把 base 改到 `dev`**，让它走 lovable→dev→main 的正常发布流。改 base 用 REST：`gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f base=dev`（`gh pr edit --base` 会因 Projects classic 已废弃而报错、base 不改）。改前先验合并结果只含预期文件：`git merge-tree --write-tree origin/dev origin/<head>` → `git diff --stat origin/dev <tree>`。GitHub 的 Files tab 会因 merge-base 早于某个 squash 合并而虚报大量文件，以 merge-tree 结果为准。
2. 给 guard 加 `dependabot/*` 白名单——那是**削弱 main 的防护层**，需 maintainer 明确批准，不作为默认处置。

## 已删除

`dependabot-resolve-peer-conflicts.yml`（对 dependabot PR 只做 peer 冲突报告、不改 lockfile）。它的判断能力已被 [`ci.yml`](../.github/workflows/ci.yml) 的 `peer-dep-check`（严格 `npm ci`）完全覆盖，且 `peer-dep-check` 是 dev 与 main **都必填**的硬门。删它不减少放行面。

## 相关

- React 同大版本约束：[`docs/conventions/peer-dependency-guard.md`](./conventions/peer-dependency-guard.md)
- PR 合并与分批策略：[`docs/PR_ANALYSIS.md`](./PR_ANALYSIS.md)
