# Agent Harness 本地改编登记

> core 通用层的唯一编辑入口在 agent-harness 核心仓（`~/Documents/code/agent-harness`，其 MANIFEST.md 是跨 repo 全景与拷贝映射）。本文件只登记**本 repo 相对 core 的偏离**：同步 core 时按此表保留本地化，防止覆盖；不承担组件地图职责。

## 本地改编登记（相对 core 的偏离）

| 文件 | 偏离 | 原因 |
| --- | --- | --- |
| 实施工作流 | **内联在 AGENTS.md**（8 步 + Session 结束 checklist），无独立 `implementation-workflow.md` | 历史；S0–S3×R0–R3 双分流未引入。若 AGENTS.md 膨胀再考虑拆出 |
| issue-tracker.md | core 后端无关契约 + 本 repo Linear 段（teamId/AAV/MCP 工具/wayfinding/sub-issue 坑） | 后端是 Linear |
| git 纪律 | 无独立 git-workflow.md；规则在 AGENTS.md（stash 禁令、禁本地切分支、commit cadence 外链） | 内联模式；core 的「写入者独占 worktree」规则未整体引入，仅保留禁切分支部分 |
| proposal-review.md | **未引入** | AGENTS.md 无对应路由；需要引入时同时加路由行 |
| git-concurrent-recovery.md | **未引入** | 单写者纪律下竞态应急未触发过；触发时从 core 仓取 |
| scenario 两文件 | 住 `docs/conventions/`，用 core 合并版原样 | 与 core 一致 |
| AGENTS.md 设计段 | Users/Brand/Aesthetic/Principles/Token 全套内联（AAVE repos 中最完整） | 本 repo 的插槽值；core 不收品牌内容 |
| SESSION-BOARD.md | **本地发明组件**（core 无对应物），经 AGENTS.md `## Session Start` 路由 | 多 agent 并发协调：启动注册 + 冲突检测 + 结束注销。core 回仓**缓做**——重评条件：board 实际拦截或暴露过一次真实冲突（当前唯一一次靠 git 事后发现）；届时与 core git-workflow 的 Session-Id trailer 分工一起定义（trailer = 事后溯源，board = 事前协调） |

## 本机 CDP 测试浏览器环境（machine-local）

> 不属 core 偏离登记——本机环境事实，住这里避免 AGENTS.md 常驻载入膨胀。

- **网络出口（直连不可达）**：`*.vercel.app` 直连解析到异常 IP（connection refused / timeout）；`git push` 直连 GitHub 会被 `Connection reset by peer`、`SSL_ERROR_SYSCALL` 中断。出口是本机代理，**端口随代理应用每次启动漂移**，所以这里不写死数字：
  - **先读 `scutil --proxy`** 拿当前 HTTP/HTTPS/SOCKS 端口。`7891`（本文件旧值）、`7899`/`7898`（`docs/issue-roadmap.md` 2026-11-11 记录）都已失效，2026-11-12 实测落在 `49967`。
  - git 走 **SOCKS5**：`git -c http.proxy=socks5://127.0.0.1:<端口> push`（临时 `-c`，不动全局配置）。实测同一端口上 `http://` 代理对 `github.com` 直接 403，`socks5h://`（代理解析 DNS）报 `SSL_ERROR_SYSCALL`，只有 `socks5://`（本机解析 DNS）通——三种写法都试过，不是猜的。
  - 排查时注意：代理核以 root 运行，`lsof -iTCP:<端口>` 可能查不到任何监听进程，但端口实际可用；用 `nc -z 127.0.0.1 <端口>` 或 `curl -x http://127.0.0.1:<端口> https://example.com/` 判断死活。`github.com:443` 直连被黑洞时 `api.github.com` 仍 200，`gh` 命令因此照常可用，不要用 `gh` 的可用性推断 git 传输可用。
  - 浏览器加 `--proxy-server="socks5://127.0.0.1:<端口>"`（Playwright 用 `E2E_PROXY=socks5://127.0.0.1:<端口>`，见 `playwright.config.ts`）。
  - 生产站 `aaveapy.com` 直连可达。
- **专用 profile**：`/Users/pabloli/chrome-tiktok-profile`（用户维护，内含 Vercel SSO 登录态）。
- **启动 + 附着**：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir=/Users/pabloli/chrome-tiktok-profile --remote-debugging-port=9333 --no-first-run` 起可见窗口，`chromium.connectOverCDP('http://127.0.0.1:9333')` 附着；`browser.newContext({ ...devices['Pixel 7'] })` 可叠加移动端仿真。
- **staging 鉴权墙备选**：Vercel 项目 `protectionBypass` 密钥加 `x-vercel-protection-bypass` 请求头（配 `x-vercel-set-bypass-mode: persist`），免登录过墙。
- **不可用路径**：Chrome 默认目录（Chrome 136+ 对默认 user-data-dir 禁 CDP）；Factory 桌面代理 `127.0.0.1:54233`（隔离空 profile、禁 `Target.createTarget`）。
- **zh-CN 陷阱**：附着真实 profile 时 UI 为中文（弹窗标题「连接钱包」），探针/选择器需兼容中文文案。
