# AAV-1349 — 缺 chromium 时 pre-push 的 e2e 门必须响亮失败，而不是静默通过

> Status: implemented 2026-11-15 · Issue: [AAV-1349](https://linear.app/aaveapy/issue/AAV-1349) · Type: CI gate (local pre-push)
> Scope: 只改「浏览器缺失时这个门怎么报」；不把 e2e 加进分支必填检查（票面明确 out of scope），不动 `GREP_INVERT` 排除名单。

## 背景与根因

`npm run test:e2e:pre-push` → `scripts/pre-push-e2e.mjs`。脚本开头探测本机 Playwright 浏览器缓存，
没有 `chromium*` 目录就打印一行 ⚠️ 然后 `process.exit(0)`：

```js
if (!hasChromium) {
  console.log('⚠️  Playwright chromium browser not installed — skipping e2e gate.');
  process.exit(0);          // ← 0 = 门禁通过
}
```

**退出码 0 在这里等于「e2e 通过」**——但一条浏览器测试都没跑。`.husky/pre-push` 于是继续跑
osv-scanner / semgrep / knip / dup 四道门，整条 hook 可以全绿收尾。

三个叠加因素让它成为真洞而非「少跑一步」：

1. **本仓两次把同类形态定性为缺陷**：AAV-1294（deployment smoke 的 resolver 永远落 skip 分支却报
   success）、AAV-1330（hook 里 `A && B` 吞掉失败、三次 `rc=0` 假绿）。本条是同一族：**一个本该
   验证代码的门，在无法验证时报告了成功**。
2. **e2e 不在任何分支的必填检查里**（票面实测 `lovable` / `dev` / `main` 的 protection；
   `e2e-desktop` / `e2e-mobile` 三支都不在列表）。本地 gate 静默 + CI 非必填 ⇒ 一次
   `lovable → dev` 合并可以做到零 e2e 验证。
3. **skip 只写在脚本里**：`docs/` 无记载，操作者看到一行 ⚠️ 会以为「基础设施没装，无所谓」，
   而不会意识到自己刚跳过了整个浏览器层。现场（2026-11-10）推送的正是 AAV-1346 的行为变更
   （缓存指纹 + 无条件写 fingerprint），本该过 e2e。

## 决策

| 选项 | 结论 |
| --- | --- |
| 缺浏览器 ⇒ `exit 1`（票面首选） | **采用**。默认状态下，无法验证 = 不通过。 |
| 保留自动 skip + `::warning::`（票面选项 2） | 不采用。GitHub Actions annotation 在本地 hook 里没有消费者，剩下的仍是一行容易读漏的 ⚠️。 |
| 显式 opt-out 环境变量 | **采用** `E2E_SKIP=1`（票面命名）。默认不生效：只认 `1` / `true`，空串、`0`、其他值一律无效——「顺手 `export E2E_SKIP`」不能变成永久的静音开关。 |
| 改 `.husky/pre-push` | 不改。AAV-1330 已给该行加了 `|| { …; exit 1; }`，非零退出会被正确传播；本轮只让脚本的退出码说真话。 |
| 把 `e2e-desktop`/`e2e-mobile` 提为必填检查 | 不做（票面 out of scope：改分支保护属安全控制变更，需单独拍板）。 |

## 设计

### 决策逻辑收进纯函数模块

新增 `scripts/lib/e2e-browser-gate.mjs`，导出：

- `SKIP_ENV_VAR = 'E2E_SKIP'`
- `isSkipRequested(env)` — 只接受 `1` / `true`（大小写、首尾空白不敏感）
- `hasChromiumBrowser(entries)` — 目录名以 `chromium` 开头即算有浏览器
- `decideBrowserGate({ browsersPath, cacheExists, entries, skipRequested })` →
  `{ action: 'run' | 'skip' | 'block', reason }`

判定顺序与理由：

1. **`skipRequested` 最先**：显式 opt-out 是无条件的，即使浏览器齐全也跳过（操作者说跳就跳，但会大声说）。
2. **`PLAYWRIGHT_BROWSERS_PATH === '0'` ⇒ `run`**：这是 Playwright 的「浏览器装在包目录」模式，
   缓存目录本就不该有内容。在这里判成缺失会把一整类合法安装锁死在推送前——**制造一个新的假红**。
   交给 Playwright 自己启动，失败也必然是响亮的。
3. `cacheExists === false` ⇒ `block`。
4. `entries` 里没有 `chromium*` ⇒ `block`。
5. 其余 ⇒ `run`。

`chromium*` 前缀判定保持宽松是有意的：Playwright ≥1.49 的 headless chromium 用
`chromium_headless_shell-<rev>`，只装 shell 也能跑 `--project=chromium`。反之，一个坏安装
（目录在、二进制缺）会走到真跑并让 Playwright 自己报错 → `exit 1`，仍然是响亮的失败，不是静默通过。

### 失败与跳过各自的输出契约

失败（`block`）必须同时给出：**为什么不能跑** + **一条可执行的修复命令** + **显式跳过怎么写**：

```
❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
   Looked in: <cache path>
   A 0-test browser run is not a pass — this gate blocks until browsers exist (AAV-1349).
   Fix (one-off, ~120 MB): npx playwright install chromium
   Deliberate skip (no e2e evidence for this push): E2E_SKIP=1 git push
```

跳过（`skip`）必须让「本次推送没有 e2e 证据」这件事不可误读，并写明如何恢复：

```
⚠️  [pre-push] e2e gate SKIPPED by explicit opt-out (E2E_SKIP=1).
   No browser test ran. This push carries no e2e evidence.
   Restore the gate: unset E2E_SKIP. Install browsers: npx playwright install chromium
```

`exit 1` 沿用仓库其它门的口径（osv / semgrep / knip / dup 都是 1），不引入新退出码——hook 的
`|| { … exit 1; }` 只关心非零。

### 文档

`docs/conventions/e2e-testing-boundary.md` 的 “Acceptable skips” 一节记的是**测试文件里**的 skip；
本次这条是**门禁层**的 skip，两者混淆正是事故成因。因此在同文档新增一节，明确「缺浏览器不是
acceptable skip，是 BLOCKED」，并登记 `E2E_SKIP=1` 为唯一出口。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `scripts/lib/e2e-browser-gate.mjs` | 新增纯函数模块（探测判定 + skip 语义） | Low | 新文件；无副作用 |
| `scripts/pre-push-e2e.mjs` | 缺失 ⇒ `block`（exit 1）；新增 `E2E_SKIP` 分支；头部注释改写为新契约 | Medium | 本机无浏览器时行为从「放行」变「阻断」——这是本票的目的；有浏览器时路径零改动 |
| `scripts/pre-push-e2e.test.mjs` | 新增 8 例（子进程跑真脚本 + stub `npx` 证明「有浏览器⇒真跑」） | Low | 测试 only；随 `npm test` 的 `node --test` 生效，不新增 npm script |
| `docs/conventions/e2e-testing-boundary.md` | 新增「本地门禁：缺浏览器是 BLOCKED」一节 | Low | 文档 only |
| `docs/specs/aav-1349-pre-push-e2e-browser-gate.md` | 本 spec | Low | 新文件 |
| `docs/DOCS-INDEX.md` | 登记本 spec | Low | 索引 only |
| `docs/issue-roadmap.md` | AAV-1349 状态与 frontier 更新 | Low | 快照 only |
| `SESSION-BOARD.md` | 登记/注销本 session | Low | 协调 only |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 缓存目录不存在（`PLAYWRIGHT_BROWSERS_PATH` 指向空路径） | `exit != 0`；输出含 `BLOCKED`、缓存路径、`npx playwright install chromium` | 门禁继续静默通过（本票根因） | 子进程跑真脚本（T-S1） | 默认即阻断；测试钉住非零 |
| S2 | 缓存目录在，但只有 `ffmpeg-*`（无 `chromium*`） | 同上（`exit != 0`） | 把「有缓存目录」误当「有浏览器」 | `decideBrowserGate` 单测（T-S2）+ 子进程 | 判定看目录名前缀，不看目录是否存在 |
| S3 | 缺浏览器 + `E2E_SKIP=1` | `exit 0`，打印「SKIPPED by explicit opt-out」+ 无 e2e 证据 + 恢复方法 | 静音开关比原 bug 更危险 | 子进程（T-S3） | 只有显式 `1`/`true` 生效，且必须打印原因 |
| S4 | 缺浏览器 + `E2E_SKIP=0` / 空串 / `true-ish` 其它值 | `exit != 0`（opt-out 不生效） | `export E2E_SKIP=` 之类的残留把门永久关掉 | 单测（T-S4，三种取值） | `isSkipRequested` 白名单 |
| S5 | 浏览器齐全 | 真跑 Playwright，结果以 Playwright 退出码/摘要为准；`exit 0` 时打印 `✅ e2e tests passed` | 新逻辑把「能跑」也拦下 | 子进程 + stub `npx`（T-S5） | 只在 `block` 分支短路，`run` 分支代码未动 |
| S6 | 只有 `chromium_headless_shell-*` | 视作可用（`run`） | 误判缺少、无故阻断推送 | 单测（T-S6） | 前缀判定覆盖 shell |
| S7 | `PLAYWRIGHT_BROWSERS_PATH=0`（浏览器装在 node_modules） | 视作可用（`run`），交给 Playwright 自己判定 | 把合法安装模式判成缺失 = 新假红 | 单测（T-S7） | 显式分支 + 注释说明 |
| S8 | 浏览器齐全但 Playwright 报 `N failed` | `exit 1`，归档失败现场（既有行为） | 新分支吃掉旧退出码语义 | 既有代码路径；本次未改（`result.code` 分支原样保留） | 不改摘要解析 |
| S9 | 缺浏览器时整条 `.husky/pre-push` 的最终退出码 | 非零（hook 的 `|| { … exit 1; }` 生效） | 脚本改正了但 hook 吞掉 | `scripts/hook-failure-propagation.test.mjs`（既有，AAV-1330）已固定该传播 | 不改 hook；两测试互补 |
| S10 | 本机有缓存目录但 `readdirSync` 抛错（权限/竞态） | 不允许变成「静默通过」：按 `block` 处理 | 探测失败被当作「没装浏览器 ⇒ 跳过」 | 代码路径：`readdirSync` 包 try/catch 并视作缺失 | 失败方向是 block，不是 pass |

## Testing Decisions

**Seam.** 两层：

1. **纯函数层** — `decideBrowserGate` / `isSkipRequested` / `hasChromiumBrowser`：用假 `entries`
   覆盖 S2/S4/S6/S7，不碰文件系统。
2. **真脚本层** — 子进程跑 `node scripts/pre-push-e2e.mjs`，用 `PLAYWRIGHT_BROWSERS_PATH`
   指向临时目录（空 / 只有 ffmpeg / 含 `chromium-1234`）覆盖 S1/S3/S5。S5 用 PATH 上的
   stub `npx` 证明「浏览器齐全时确实调用了 Playwright」，不必真的跑浏览器。

**Good test.** 只断言外部可观察的行为：进程退出码、stdout 里的关键句、stub 是否被调用。
不断言内部函数调用次数、不断言 `console.log` 的行数、不 mock `node:fs`。

**为什么不只看单测.** 事故形态是「脚本走了 `exit 0`」。只有真跑脚本才能证明它不再走那条路——
纯函数测试可以在脚本忘记调用它时全绿。

**Prior art.** `scripts/hook-failure-propagation.test.mjs`（读真文件、跑真命令、stub `npm`）；
`scripts/e2e-port.test.mjs`（纯函数 + 运行时对照）；`scripts/e2e-artifacts.test.mjs`。

## Out of Scope

- 把 `e2e-desktop` / `e2e-mobile` 加进 `lovable` / `dev` / `main` 的 required checks。
- 调整 `GREP_INVERT` 排除名单。
- 在 CI 上加「浏览器缺失即失败」（CI 的 `playwright install` 步骤已有自己的失败语义）。
- 让 `E2E_SKIP` 之外的任何自动跳过路径复活。

## Verification Evidence

### RED → GREEN（`node --test scripts/pre-push-e2e.test.mjs`）

1. **模块未落地**：`ERR_MODULE_NOT_FOUND: scripts/lib/e2e-browser-gate.mjs` —— 整份文件
   fail，13 例一条未执行（测试确实依赖被测物，不是空转）。
2. **模块落地、脚本未改**：**5 failed / 8 passed**。红的正好是
   T-S1 / T-S1b / T-S2b / T-S3 / T-S3b —— 即「缺浏览器仍然 `exit 0`」与「`E2E_SKIP=1` 不生效」。
   T-S5 / T-S6b / T-S8 同轮绿，构成负对照：运行路径与既有「Playwright 报失败即失败」语义没被顺带改掉。
3. **脚本改后**：**13 / 13 passed**。

过程中修掉一处**测试自身**的通道错误：T-S8 读 `stdout`，而脚本的失败摘要走
`console.error`（stderr）⇒ 改为断言 `stdout + stderr`。不改这条就会留下一个假红。

### Runtime smoke（真实进程，缺浏览器与显式跳过）

```bash
TMPD=$(mktemp -d)
PLAYWRIGHT_BROWSERS_PATH="$TMPD" node scripts/pre-push-e2e.mjs            # rc=1
PLAYWRIGHT_BROWSERS_PATH="$TMPD" E2E_SKIP=1 node scripts/pre-push-e2e.mjs # rc=0
```

```
❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
   Reason: no chromium build in the cache at /var/folders/.../tmp.FnPgYRmND3
   A 0-test browser run is not a pass — this gate blocks until browsers exist (AAV-1349).
   Fix (one-off, ~120 MB): npx playwright install chromium
   Deliberate skip (no e2e evidence for this push): E2E_SKIP=1 git push
```

```
⚠️  [pre-push] e2e gate SKIPPED by explicit opt-out (E2E_SKIP=1).
   No browser test ran. This push carries no e2e evidence.
   Restore the gate: unset E2E_SKIP. Install browsers: npx playwright install chromium
```

### 浏览器齐全时行为不变（真跑，非 stub）

`npm run test:e2e:pre-push`（本机 chromium-1234 已装）→ **62 passed / 26 skipped / 0 failed，
3.9m**，末行 `✅ e2e tests passed`，rc=0。与本次改动前同一条命令的口径一致（前几次记录
60–62 passed / 26–29 skipped）。

### Gates

- `npm run ci:remote` → **rc=0**：vitest **190 files passed / 3 skipped**；`node --test`
  scripts **259 pass / 0 fail**（本文件 +13，246 → 259）；build 与
  `check-csp-inline-scripts` 通过。`npm audit --omit=dev --audit-level=high` 仍报
  **11 high**（既有 zod 3 链 `GHSA-mrhx-c7xc-m3w5`，AAV-1348 已按「无法真修」豁免；
  本次未改依赖）。
- `npm run typecheck` → clean；`prettier --check`（3 个新/改脚本 + 本 spec）→ clean；
  `git diff --check` → clean。
- **`eslint .` 不覆盖 `scripts/`**（仓库现状，AAV-1319 已记录）：这三个文件不在 lint 门内。
  如实记录，不声称有 lint 覆盖；行为由 `node --test` 守卫。

### Not verified

- S9 的完整链路（`.husky/pre-push` 最终退出码）本轮没有在缺浏览器状态下实跑整条 hook——
  它需要先跑完 `ci:remote`。该传播由既有的
  `scripts/hook-failure-propagation.test.mjs`（AAV-1330，本轮仍绿）固定，脚本侧的
  `exit 1` 由 T-S1 与 runtime smoke 固定，两段合起来即 S9。
- 分支保护侧（e2e 是否提为必填检查）按票面 out of scope，未动。

## Further Notes

- 票面把「e2e 不是必填检查」列为 out of scope，但它是**同一个洞的另一半**：本次只堵本地这一半。
  若需要「合并前必须有 e2e 绿」，那是分支保护变更，另开票并单独拍板。
- `E2E_SKIP` 是**推送级**开关，不做持久化（不写文件、不进 `package.json`），避免变成默认静音。
