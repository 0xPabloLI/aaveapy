# Fact Verification Procedures

> 规则本体在 `docs/agents/proposal-review.md`（§3 事实双源、§4 新工具准入）；本文件是操作程序。加载时机：执行 proposal-review §3/§4 检查时。

## 源码验证链（库/框架功能支持）

1. 包管理器确认版本（`npm ls <pkg>`、`npx --no-install <pkg> --version`）；
2. `Grep` 读实现与默认值（`node_modules/<pkg>/dist` 与 `src`，不只看 README）；
3. 用正确 API 做最小 smoke test（本仓用 `npx tsx` 单文件脚本或 Playwright 单测，不写临时 spec）；
4. 再查文档/网络讨论作为补充；冲突时以源码与实际调用为准——文档常滞后于代码。

## CLI / 工具存在性

`command -v` / `--help` + 官方文档双源确认。本机坑：macOS BSD 无 GNU `timeout`，探网络用 `GIT_TERMINAL_PROMPT=0 git ls-remote` 带自然超时。

## 网络讨论的解读边界

网络讨论反映**已报告**的问题，不代表**已修复**状态。要证明当前行为必须本地复现。

## 数值性事实（定价 / 费率 / 资源分配）

必须查官方定价页或官方 CLI，不能以模型记忆为准——同一平台可能有多套定价（标准 compute 与 Sandbox）。本仓展示的 APY/TVL 等数值以 staging API 实际响应为地面真值，不以 mock 或旧 snapshot 为准。

## 新工具 / 框架 / 服务引入前维护状态检查

1. `gh repo view --json isArchived`；2. `gh api repos/<owner>/<repo>/commits?per_page=1` 看最近 commit；3. open/closed issue 活跃度；4. 是否有新 release。

已停止维护或超 6 个月无新 commit 的项目不得推荐引入；存在活跃 fork / 新 maintainer 时作为独立候选重做本节检查，不把「计划中会维护」当豁免。

## 平台事实（本仓高频）

- **分支即部署**：`dev` 是前端首段（staging），`main` 是 production；跨分支操作禁止在共享目录 `checkout`/`switch`，走 worktree。
- **worktree 必须 `npm install`**：husky 的 `core.hooksPath` 由 `prepare` 解析，新 worktree 缺依赖会导致 pre-commit/pre-push 全部门静默消失，`git commit` 仍退出 0（已机制化，`npm run check:hooks-path` 自查 verdict）。
- **pre-push 有四道只存在于本地的门**：`osv-scanner`、`semgrep`、`knip`、`dup:check`，GitHub CI 无对应 job → PR 全绿不证明它们跑过。
- **本机 npm registry** 为 npmmirror，`npm audit` 端点未实现 → audit 结论需 `npm_config_registry=https://registry.npmjs.org` 复跑。
- **GitHub 连通性**不稳定（`curl 52/56`、75s connect timeout）：推送结论以 `git ls-remote` 回读为准。
