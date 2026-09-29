# E2E webServer 端口并行隔离

指针：本地 e2e 门禁的 webServer 端口与命令如何解析，见 `scripts/lib/e2e-port.mjs`；本文只记录**为什么**必须是动态端口，以及改动的影响与验收边界。

## 问题

2026-09-29 一次 `git push` 的 pre-push e2e 失败 87 个用例，其中 86 个是 `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/`，唯一 1 个 `expect` 失败同属该批（server 已消失，首个 locator 120s 超时）。断言层零失败——代码没有回归。

根因是两个并发事实：

1. 端口写死 4173，而本机同一时刻可能有多个 e2e 运行（不同 session、不同 worktree，共用同一网络命名空间）。
2. `playwright.config.ts` 在非 CI 下 `reuseExistingServer: true`：后来者**静默复用**先来者的 server，先来者退出时把它带走，后来者剩余用例全部连接被拒。

`reuseExistingServer` 本身是对的（人工起 `npm run dev:staging` 后跑 e2e 不该重复起），它与固定端口的组合才是缺陷。因此修端口，不动复用策略。

## 不变量

- **CI 固定 4173**：CI 路径由 `preview:staging` 提供该端口，且 `enforce_admins` 的 main 分支保护依赖可预测的检查环境；动态化只作用于本地。
- **origin ≡ baseURL**：`storageState` 里预授权 analytics consent 的 `origin` 必须与实际 `baseURL` 同端口。两者一旦分叉，consent banner 会重新出现并拦截指针事件，表现为大面积超时而非清晰报错——这是本改动最危险的失效模式。
- **URL 与 server 命令只有一个来源**：端口字符串一律经 `e2eBaseUrl()`，本地启动命令一律经 `e2eDevServerCommand()`。两份配置各写一遍命令字面量，正是本改动要消灭的那类漂移。
- **分配者只算一次**：worker 进程继承 runner 的 `process.env`，所以端口一旦解析就写回 `E2E_PORT`；任何在 worker 内重新分配的实现都是错的。
- **不泄漏 socket**：探测可用端口用的临时 listener 必须在返回前关闭。

## Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `scripts/lib/e2e-port.mjs` | 新建：端口解析/分配 + `e2eBaseUrl()` + `e2eDevServerCommand()` | Low | 纯新增，无既有消费者 |
| `scripts/lib/e2e-port.d.mts` | 新建：类型声明（沿用 `dep-release-age-parse.d.mts` 约定） | Low | 两份 playwright 配置不在 typecheck 覆盖内，缺声明不会红灯，故必须手写 |
| `scripts/e2e-port.test.mjs` | 新建：矩阵行为用例 | Low | 由 `node --test "scripts/**/*.test.mjs"`（pre-commit）执行 |
| `playwright.config.ts` | 改为 Promise 默认导出；baseURL / consent origin / webServer url 同源解析；本地命令走 `e2eDevServerCommand()` | Medium | 消费者 4 个（`test:e2e`、`:headed`、`:strict-stick`、`:pre-push`）。CI 分支的命令字面量与端口取值逐字不变；`--strictPort` 关闭 vite 端口漂移，使竞争失败显式化 |
| `e2e/playwright.fields.config.ts` | 同上（单 worker，该配置本无 CI 分支，故命令恒为本地形态） | Medium | 消费者 `test:e2e:api-fields`；不改则该入口仍是固定 4173，与主配置互相打断 |
| `e2e/global-setup.ts` | 去掉 `?? 'http://127.0.0.1:4173'` 兜底，改为无 baseURL 即 throw | Medium | 它是第三个 URL 消费者；旧兜底今天失效只因 Playwright 会把根 `use` 合并进 project，失效原因不显眼，留着迟早漂移 |

最坏后果：端口解析出错 → e2e 起不来或连不上，门禁红。属于「响亮失败」，不会静默放行坏改动。

## Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | CI 环境、未设 `E2E_PORT` | 解析为 4173，且不写回 env | High（会改变 CI 行为） | automated test | CI 分支硬绑默认端口 |
| 2 | 显式 `E2E_PORT=4500` | 用 4500，不改写、不重新分配 | Medium | automated test | 尊重调用方意图，便于手工复用已起的 server |
| 3 | 本地、未设 `E2E_PORT` | 返回一个 ≠4173 的可分配端口，并写回 `E2E_PORT` | High | automated test | 并发运行彼此不再共享 server |
| 4 | 同一 env 连续两次解析 | 第二次直接复用写回值，不二次分配 | High（worker 一致性） | automated test | runner/worker 同源 |
| 5 | `E2E_PORT` 非数字 / 0 / 负 / 小数 / >65535 | 抛错，消息点名 `E2E_PORT` | Medium | automated test | 避免 NaN 端口静默连到别处 |
| 6 | 解析返回后该端口未被占用 | 临时 listener 已关闭，可再次 bind | Medium | automated test | 不泄漏 socket，不留半死 server |
| 7 | 两个独立 env 并发解析（模拟两个 session 同时跑门禁） | 两个不同端口，两次运行都能起自己的 server | High（本次事故场景） | automated test | 根因修复 |
| 8 | 配置产出的 consent origin 与 baseURL | 同一次 `e2eBaseUrl()` 调用的返回值，结构上不可能分叉 | High（静默失效模式） | static（两处引用同一 const）+ automated test（字符串形状） | 单一构造点；注意：**没有**断言去比对配置产物本身 |
| 9 | 默认端口 4173 被其他进程的 HTTP 200 server 占用时跑本地 e2e | 正常通过，且不向 4173 发任何请求 | High | runtime smoke | 见「证据」第 2 条 |
| 10 | Vite 目标端口在 probe-to-bind 窗口被抢走 | 命令带 `--strictPort`，Vite 显式失败而非漂到相邻端口后 180s urlTimeout | Medium | automated test（命令字符串逐字断言） | 失败可见即等于可诊断 |
| 11 | CI 下 `E2E_PORT` 被设成非 4173 | 抛错（与 CI 固定的 `preview:staging` 端口矛盾） | Medium | automated test | 防「配置说 A、server 起在 B」的静默错配 |
| 12 | `E2E_PORT=''`（设了但为空） | 视为未设置，走本地分配分支 | Low | automated test | 空串不能变成 `parsePort('')` → NaN |
| 13 | `globalSetup` 拿不到 `projects[0].use.baseURL` | 直接 throw，不回落到任何字面端口 | Medium | static + runtime smoke（每次 e2e 运行都会经过这里） | 兜底字面量是漂移源 |

## 证据

1. **automated**：`node --test scripts/e2e-port.test.mjs` → 10 tests / 10 pass，覆盖第 1–8、10–12 行；先 red（模块不存在时 import 失败）后 green。第 13 行无独立单测，依 static + 每次运行必经该路径。
2. **runtime smoke（第 9 行）**：在 4173 上挂一个返回 HTTP 200 的占位 server（并统计入站请求数），跑 `npx playwright test e2e/segmented-toggle.spec.ts --project=chromium --workers=1` → `rc=0 / 3 passed / 3 skipped`，占位 server 计数 `STUB_HITS=0`。正对照同仪器：手工 `curl` 一次 → `STUB_HITS=1`，证明 0 不是计数器坏了。**注意口径**：这是单个 spec，不是 spec 点名的整条 `npm run test:e2e:pre-push`（约 200 例）；整条门禁的实际执行发生在下面的推送 attempt，结果需回填本行。
3. **static**：`npm run typecheck` / `npm run lint` / `npm run knip` / `npm run dup:check` 均 rc=0（knip 未把新文件判为 unused）；`npx playwright test --list` 与 `--config=e2e/playwright.fields.config.ts --list` 均成功加载 Promise 式配置（Playwright 1.62.1）。两份配置另按 AGENTS.md 要求显式跑 `tsc --noEmit`（它们不在 lint/typecheck 覆盖内）。

## 未纳入本改动

- 人工 `npm run dev`（8080）与 e2e 端口无冲突，不需要处理。
- `vite.config.ts` 的 `preview.port` 默认 4173 是 CI 路径，保持不变。
- `e2e/` 目录整体不在 lint/typecheck 覆盖内（AGENTS.md 已记），新增配置行为靠运行时验证。
- `docs/plans/frontend-triage-2026-06/phase9-e2e-test-hardening.md` 里的历史行号引用属归档文档维护，另案。
