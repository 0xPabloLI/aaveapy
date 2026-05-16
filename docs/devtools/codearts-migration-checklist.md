# CodeArts 迁移清单

## Skills

### CodeArts 系统内置（9个，安装即有）

creating-sdd-directory, data-analysis, doc-expert, i18n-integration, ide-tool, managing-design-document, managing-spec-document, managing-tasks-document

注：`frontend-design` 同时存在于系统缓存和用户安装目录，以用户安装版为准。

### 用户安装（59个，需在新设备重新安装）

adapt, animate, animation-porting, audit, bolder, brainstorming, canvas-design, central-station, clarify, colorize, context7, critique, database, delight, deploy, deployment, dispatching-parallel-agents, distill, doc-coauthoring, domain, environment, executing-plans, extract, find-skills, finishing-a-development-branch, frontend-design, harden, linear, merge, metrics, netlify-deploy, new, normalize, onboard, optimize, polish, projects, pua, quieter, railway-central-station, railway-database, railway-deploy, railway-deployment, railway-docs, railway-status, ralph-loop, receiving-code-review, refactor, render-deploy, requesting-code-review, service, skill-creator, spreadsheet, status, subagent-driven-development, sync, system-status, systematic-debugging, teach-impeccable, templates, test-driven-development, threadtracker, using-git-worktrees, using-superpowers, verification-before-completion, web-access, writing-plans, writing-skills

安装方式：在 CodeArts 中逐个 install，或从备份的 `~/.agents/skills/` 目录恢复。

## MCP Servers

| 名称 | 包/URL | 需要认证 |
|------|--------|---------|
| linear | `@mseep/linear-mcp` + LINEAR_API_KEY | 是 |
| railway-mcp-server | `@railway/mcp-server` | 否（CLI 登录） |
| cloudflare | `@cloudflare/mcp-server-cloudflare@latest` + accountID | 是（API token） |
| github | `@modelcontextprotocol/server-github` + GITHUB_PERSONAL_ACCESS_TOKEN | 是 |
| context7 | `https://mcp.context7.com/mcp` (HTTP type) | 否 |

MCP 配置文件模板：`~/.codeartsdoer/shared-config/mcp_settings.json`

## 备份包

- 路径：`~/codearts-config-backup.tar.gz`（3M）
- 内容：`.agents/skills/`、`.codeartsdoer/skills/`、`.codeartsdoer/shared-config/`、MCP 凭据、模型配置
- 恢复：`tar -xzf ~/codearts-config-backup.tar.gz -C ~/`

## 新设备恢复步骤

1. 安装 CodeArts
2. 恢复 `~/.agents/skills/` 目录（从备份 tar.gz 解压），或逐个重新 install skill
3. 将 MCP 配置写入项目级 `.codeartsdoer/mcp/mcp_settings.json`
4. 各 MCP 服务重新 auth 填 token（凭据不跨设备）
