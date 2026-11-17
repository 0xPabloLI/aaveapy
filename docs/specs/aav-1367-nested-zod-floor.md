# AAV-1367 — 嵌套 zod 3.x 的 CVE-2023-54404 收口：全树 zod 下限 + 消费者允许清单

> Status: implemented 2026-11-17 · Issue: [AAV-1367](https://linear.app/aaveapy/issue/AAV-1367) · 告警: [Dependabot #99](https://github.com/0xPabloLI/aaveapy/security/dependabot/99) · Type: 依赖安全（供应链）
> Scope: 只处理 `zod` 这一条链。不触碰 `braces` 死豁免、不改 WalletConnect/AppKit 版本、不迁移上游到 zod 4（那是 AAV-1348）。

## Problem Statement

Dependabot #99 在默认分支上报 `zod`（transitive、runtime、manifest `package-lock.json`）命中
`CVE-2023-54404` / `GHSA-mrhx-c7xc-m3w5`（“Zod can exhaust memory while validating oversized
constrained collections”，high；CVSS 3.1 7.5 / v4 8.2）。顶层 zod 已是 4.6.7，告警来自**嵌套副本**：

| 路径 | 版本 |
| --- | --- |
| `node_modules/zod` | 4.6.7 ✅ |
| `node_modules/@coinbase/cdp-sdk/node_modules/zod` | 3.25.76 ❌ |
| `node_modules/@reown/appkit-wallet/node_modules/zod` | 3.22.4 ❌（告警指向的就是这一条） |
| `node_modules/openapi-zod-client/node_modules/zod` | 3.25.76 ❌ |

用户可见后果不是漏洞利用（见下“可达性”），而是**安全账面长期失真**：仓库里唯一一条 open
告警无法关闭，`npm audit --omit=dev` 恒为 11 high，`ci:remote` 的 audit 步骤只能靠 `|| echo`
吞掉失败——绿灯不再代表“没有已知漏洞”。

## 票面四问的答案（取证，非推测）

| 问题 | 结论 | 一手证据 |
| --- | --- | --- |
| ① 三个包是否拿 zod 校验不可信外部输入 | **只有 appkit-wallet 是**，且该模块不在我们的产物里；cdp-sdk 校验自家 API 响应，openapi-zod-client 是 dev-only | `W3mFrame.js:42/65/81` 对 `window` 的 `message` 事件 `data` 调 `W3mFrameSchema.frameEvent/appEvent.safeParse` —— 嵌入式钱包 iframe 的消息；`dist/assets/*.js.map` 全量扫描：zod 源只有 `node_modules/zod/v4`（`vendor-forms`），`W3mFrameSchema` 与 `cdp-sdk` 零命中 |
| ② overrides 能否安全抬到 4.6.6+ | **可以**（lock 层已实测；运行时有一个可测的兼容面） | 临时目录探针：`overrides.zod = "$zod"` 把 4 份 zod 收敛为 1 份 4.6.7，`npm audit --omit=dev`（公网 registry）11 high → **0 vulnerabilities** |
| ③ 是否存在 zod 3.x 的回移修复版 | **不存在** | OSV `affected.ranges` 只有 `introduced: 0` → `fixed: 4.6.6`；最新消费者仍全要 zod 3：`@reown/appkit-wallet@2.0.0` 仍**精确钉 3.22.4**、`@coinbase/cdp-sdk@1.62.0` `^3.25.76`、`openapi-zod-client@1.18.3`（最新）`^3.19.1` |
| ④ dev-only 链路可否单独处理 | 可以，但**关不掉 #99** | `openapi-zod-client` 在 `devDependencies`；#99 报的是 runtime 的 appkit-wallet 副本 |

### 可达性与风险评估

* 修复版只有 `>= 4.6.6`；**所有 3.x 都在受影响区间**，上游没有回移版本。
* 漏洞形态是 DoS：校验超大且未约束长度的集合时逐元素累积 issue。本仓的 zod 使用面是
  `W3mFrameSchema.frameEvent`（钱包 iframe 消息）与 cdp-sdk 的 API 响应校验；后者不是攻击者可控输入。
* 当前产物**不含任何 zod 3 代码**，也不含 `W3mFrame`（我们没有启用 embedded wallet，只配了
  `injected` + `WalletConnect`，见 `src/lib/wagmi/config.ts`）⇒ 用户侧可达性为零。
* 真实风险是**未来**：任何一次“启用 embedded wallet / 加上 Base Account connector”的改动都会
  把 `W3mFrameSchema` 或 cdp-sdk 拉进依赖图，而那时没人会记得这条豁免。守卫必须能拦住它。

## Solution

把“zod 下限”从一次性的 lock 修补升级为**全树约束 + 消费者允许清单**：

1. `overrides.zod = "$zod"` —— 全树任何 zod 都解析到根依赖的 `^4.6.6`（当前 4.6.7）。这不是
   “支持 zod 4”的声明，而是**安全下限**：允许上游继续声明 zod 3，但本仓不安装低于 4.6.6 的副本。
2. 新增 `scripts/check-zod-version-floor.mjs`：读 `package-lock.json`，任何 `node_modules/**/zod`
   低于 4.6.6 即失败；任何包声明了“无法满足 4.6.6 的 zod range”，其包名必须在**精确允许清单**
   里，否则失败。新增消费者必须显式登记，不能靠全局 override 静默吞掉。
3. 新增兼容 canary：真实解析 `@reown/appkit-wallet` 的 `W3mFrameSchema.frameEvent`。它同时钉住
   “该包实际解析到的 zod ≥ 4.6.6”与“zod 4 下 schema 仍然可用（正例通过、负例被拒）”。
4. 删除 `osv-scanner.toml` 里 `GHSA-mrhx-c7xc-m3w5` 的 `[[IgnoredVulns]]`——下限生效后它不再命中，
   留着就是一条永不执行的豁免（本仓已有 `braces` 死豁免的先例）。

## Implementation Decisions

* **override 形态取全局 `"zod": "$zod"`，不取逐包 override**。探针事实：逐包 override
  （`"@reown/appkit-wallet": { "zod": "^4.6.6" }`）在**已有 lock 上不触发重解析**（`npm install
  --package-lock-only` 报 `up to date` 且嵌套副本不变）；全局形式会重解析并收敛成单副本。
  逐包形式只在删 lock 重生成时生效，那会带来不可控的全树版本漂移。
* 允许清单是**精确集合**，不是前缀/正则。守卫第一次跑就揪出两处计划没预见的声明：
  `@zodios/core`（peer `^3.x`，但仓库既有 override 早已把它跑在 zod 4 上、且它进主包）
  与 `abitype`（peer `^3 >=3.22.0`，但 `peerDependenciesMeta.zod.optional = true`）。
  前者登记进清单，后者按“可选 peer 不约束安装”跳过——所以清单是四个：
  `@reown/appkit-wallet`、`@coinbase/cdp-sdk`、`@zodios/core`、`openapi-zod-client`。
  多一个即红，少一个也红（防死条目）。
* 守卫读 lock 而不读 `node_modules`：lock 是提交物，`node_modules` 不是。
* 守卫**fail-closed**：lock 没有 `packages` 映射（v1 格式/截断文件）时直接失败，而不是
  “没有条目可遍历”式地静默通过。
* 兼容 canary 用 `node:test`（`scripts/zod-override-compat.test.mjs`），不用 vitest：需要真实的
  Node ESM 解析路径来判断 appkit-wallet 实际拿到哪份 zod（happy-dom 环境会改变解析语境）。
* 不动 `braces` 豁免（AAV-1328 的既有死配置，非本票引入）。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `package.json` | `overrides` 增加 `"zod": "$zod"` | High | 改变全树解析。最坏后果：某个声明 zod 3 的包在运行时拿到 zod 4 并报错。今日三个嵌套副本的宿主（appkit-wallet / cdp-sdk / openapi-zod-client）都不在产物，@zodios/core 早已在 zod 4 上运行；并由 canary + 允许清单守卫约束 |
| `package-lock.json` | 删除 3 个嵌套 zod 条目，统一为 4.6.7 | High | 同上；lock 是唯一提交物，CI `npm ci` 按它安装 |
| `osv-scanner.toml` | 删除 `GHSA-mrhx-c7xc-m3w5` 豁免 | Medium | 缩小豁免面。必须以 `osv-scanner --lockfile package-lock.json` 实跑 exit 0 证明不再命中；否则恢复 |
| `scripts/check-zod-version-floor.mjs` | 新增守卫（纯函数 + CLI） | Low | 纯新增，不触碰运行时代码 |
| `scripts/check-zod-version-floor.test.mjs` | 新增测试（fixture + 真实 lock） | Low | 同上 |
| `scripts/zod-override-compat.test.mjs` | 新增兼容 canary | Low | 只读第三方包，断言真实解析版本与 schema 行为 |
| `docs/DOCS-INDEX.md` | 登记本 spec | Low | 文档索引 |
| `docs/issue-roadmap.md` | AAV-1367 从 Backlog 移入 Recently Completed | Low | 盘点表 |
| `SESSION-BOARD.md` | 本 session 行状态推进 | Low | 共享看板 |

## Behavioral Scenarios（Scenario & Risk Verification Matrix）

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| Z1 | 改动前：lock 有 4 份 zod（3.22.4 / 3.25.76×2 / 4.6.7） | 守卫失败并逐条点名低于 4.6.6 的路径 | High | automated test（真实 lock 的集成断言，先红） | 先写守卫再改依赖（TDD 红） |
| Z2 | 改动后：任意 `node_modules/**/zod` 均 ≥ 4.6.6 | 守卫通过；`npm ls zod` 只剩 4.6.7 一份 | High | automated test + runtime（`npm ls`） | override + lock |
| Z3 | 新增一个声明 zod 3 的消费者（未来 wallet SDK） | 守卫失败并点名该包，要求显式登记 | High | automated test（fixture lock，负对照） | 允许清单精确集合 |
| Z4 | 某个包声明 `>=4` / `*` / `^4` 等可满足下限的 range | 守卫不报（不是所有声明者都进豁免） | Low | automated test（fixture） | range 判定单测 |
| Z5 | 版本比较边界：4.6.5 / 4.6.6 / 4.6.7 / 4.10.0 / 5.0.0 | 4.6.5 拒绝、其余通过 | Medium | automated test | 版本比较单测 |
| Z6 | 删除某个允许清单条目后 | 守卫失败（防止清单变成只增不减的死表） | Medium | automated test（fixture，负对照） | 精确集合比对 |
| Z7 | `npm ci` 在干净环境按新 lock 安装 | 与 `npm install` 结果一致，无 lock/package.json 不一致报错 | High | runtime（`npm ci --dry-run`） | 只改 lock 由 npm 生成，不手写 |
| Z8 | `schema:codegen` 在 zod 4 下重跑 | 输出与提交物**字节一致**；`schema:check` 绿 | High | runtime（sha256 前后对比） | openapi-zod-client 的 dist 无运行时 zod 引用；补跑验证 |
| Z9 | appkit-wallet 的 `W3mFrameSchema` 在 zod 4 下解析真实 frame 事件 | 正例（`FRAME_READY`）通过；负例（`payload: 42`）被拒 | High | automated test（canary） | 只测生产路径唯一 zod 消费者 |
| Z10 | 删除 osv 豁免后跑 `osv-scanner` | exit 0，无 `GHSA-mrhx-c7xc-m3w5` 命中 | High | runtime | 实跑；若仍命中则恢复豁免并回退本方案 |
| Z11 | `npm audit --omit=dev`（公网 registry） | `found 0 vulnerabilities` | High | runtime | override 生效的直接后果 |
| Z12 | 构建产物不得引入 zod 3 | source map 里 zod 源仍只有 `zod/v4`；`W3mFrameSchema` 仍不在产物 | Medium | runtime（`dist/assets/*.js.map` 扫描） | 无新增 import；可以后加 bundle 守卫（本票不做） |
| Z13 | `ci:remote` 全链 | typecheck / lint / test / build / audit 全绿 | High | runtime | 推送前必跑 |
| Z14 | `npm audit fix --omit=dev`（`ci:auto-fix` 会跑） | 不改变 lock（0 vuln 时无操作） | Medium | runtime（`--dry-run`） | audit 已 0；若 fix 想动 lock 则复查 |
| Z15 | 并行 session 同时改 lock | 提交前 HEAD 未移动、staged 名单只含本票文件 | High | runtime（commit 前核对） | 按 issue-tracker 已知坑执行 |

## Testing Decisions

* 守卫是**纯函数 + 薄 CLI**：`evaluateLockfile(lock, {floor, allowlist})` 返回
  `{belowFloor, undeclared, staleAllowlist}`，CLI 只负责读文件与退出码。测试直接喂 fixture，不依赖真实安装。
* 集成断言用真实 `package-lock.json` 跑 `evaluate`，这样“仓库当前状态”被钉住——这是 Z1/Z2 的同一行证据。
* 兼容 canary 走 `node:test`，断言两条：`createRequire` 从 appkit-wallet 目录解析到的 `zod`
  版本 ≥ 4.6.6；`W3mFrameSchema.frameEvent.safeParse` 正例通过、负例拒绝。
* 测试不得出网：全部读本地文件 / 本地 ESM 解析（AAV-1335 红线）。
* 先写测试并确认 Z1 / Z9 的版本断言为红，再改依赖。

## Tickets（tracer bullet）

| # | 票 | Blocked by | 交付 |
| --- | --- | --- | --- |
| T1 | 守卫：`check-zod-version-floor` 纯函数 + fixture/真实 lock 测试 | — | Z1 红、Z3–Z6 绿（fixture 层） |
| T2 | 兼容 canary：appkit-wallet 解析版本 + schema 正/负例 | — | Z9 的版本断言先红 |
| T3 | override + lock + 删除 osv 豁免 | T1、T2 | Z2/Z7/Z8/Z10/Z11 转绿 |
| T4 | 文档与收尾（DOCS-INDEX / roadmap / board / Linear） | T3 | Z13–Z15 |

## Out of Scope

* `osv-scanner.toml` 里的 `braces` 死豁免（AAV-1328 遗留，非本票引入）。
* 上游真正的 zod 3 → 4 迁移（AAV-1348）；本票只是安全下限，不主张三包已支持 zod 4。
* `@walletconnect/ethereum-provider` 降级 / 去掉 AppKit 的路径（方案 C，已否决）。
* 构建产物的 bundle 守卫（Z12 只作为验证证据，不做门禁）。
* 其他 Dependabot 告警面（当前 open 仅剩 #99）。

## Verification Evidence

2026-11-17 实跑（本机 macOS / Node 22.23.2 / npm 11）：

* **红 → 绿**：`node --test scripts/check-zod-version-floor.test.mjs scripts/zod-override-compat.test.mjs`
  改前 `13 pass / 2 fail`（`installed zod copies must be >= 4.6.6`、`wallet package resolves zod 3.22.4`）
  → 改后 `16 pass / 0 fail`。
* **守卫 CLI**：`✅ [zod-floor] 1 zod copy/copies, all >= 4.6.6: node_modules/zod@4.6.7`
* **依赖树**：`npm ls zod --all` 所有路径 dedupe 到 `zod@4.6.7`；lock 只删除 3 个嵌套条目
  （29 行删除、0 行新增，没有全树版本漂移）。
* **audit**：`npm audit --omit=dev --registry=https://registry.npmjs.org` → `found 0 vulnerabilities`
  （本机默认 registry 是 npmmirror，audit 端点 `NOT_IMPLEMENTED`，不能作为证据）。
  `npm audit fix --dry-run --omit=dev` 同样 0 漏洞且不改 lock。
* **osv**：`osv-scanner --lockfile package-lock.json` → `No issues found`，exit 0。输出同时提示
  `braces` 豁免已 unused（既有死配置，见 Out of Scope）。
* **codegen 字节一致**：`npm run schema:codegen` 前后
  `de3b095fe40b2f3bdf0ec70e1eaeea89bbf20b941412c1e2012b18fe1c0d9d89`，`git diff -- src/generated/api/` 为空。
* **产物**：`dist/assets/*.js.map` 里 zod 源只有 `vendor-forms → zod/v4/{core,locales,classic}`；
  `W3mFrameSchema` 零命中。
* **ci:remote**：exit 0（typecheck / lint / check:react-singleton / test / build 全过；末行 audit 因
  npmmirror 端点报错被脚本 `|| echo` 吞掉——独立的公网 registry audit 见上）。
* **pre-push 附加门**：`npm run knip` 无输出；`npm run dup:check` 总重复率 2.93% < 3%。
* **npm ci**：`npm ci --dry-run --ignore-scripts` 通过（lock 与 package.json 一致），未改动工作树。

### 与旧豁免理由的差异（重要）

被删除的 osv 豁免写着「实测 appkit-wallet 9 处、cdp-sdk 57 处单参 `z.record`，强推会炸」。
那是 **当时 latest（1.8.24 / 1.61.0）** 的计数；本仓实际安装的是
`@reown/appkit-wallet@1.8.19`（2 处 `z.record`，均两参）与 `@coinbase/cdp-sdk@1.56.0`
（1 处单参，位于 `_esm/policies/evmSchema.js`，该模块不被本仓导入）。所以「强推必炸钱包连接」
在本仓当前版本上不成立。仍然成立的约束是：任何**新** zod-3 消费者必须显式登记，且 canary
钉住 appkit-wallet 在 zod 4 下的真实解析与解析行为。
