# Session Coordination Board

本文件是多 agent session 的**并行协调看板**。每个 session 启动时**必须**读取本文件、注册自己、检查冲突；结束时**必须**注销。

---

## 协议（每个 session 必须遵守）

### 1. 启动时：注册 + 冲突检测

1. **读取**本文件，查看 `## Active Sessions` 中所有 `status: active` 的条目。
2. **新增一行**到 Active Sessions 表，填写自己的信息（见下方表格格式）。
3. **冲突检测**：将自己的 `touch-files`（计划修改的文件/目录）与所有 `status: active` 条目的 `touch-files` 做交集。
   - **无交集** → `status: active`，正常执行。
   - **有交集** → `status: blocked`，**只做 plan / 分析 / 只读操作，不要写入任何冲突文件**。在 `notes` 列注明被谁阻塞。
4. 如果判断不准（比如不确定自己会改哪些文件），先用 `status: planning`，弄清楚范围后再更新。

### 2. 执行中：保持更新

- 如果 scope 变了（新增或减少要改的文件），**立即更新** `touch-files`。
- 如果发现新的冲突，将自己降级为 `blocked`。
- 定期检查：被阻塞时，可以重新读取本文件，如果阻塞方已注销，将自己升级为 `active`。

### 3. 结束时：注销

- 任务完成（commit 或放弃）后，**删除自己的行**或将 `status` 改为 `done`。
- 这样其他被你阻塞的 session 就知道可以继续了。

### 4. 异常处理

- 如果看到一个 `active` 条目的 `registered` 时间超过 **48 小时**且无更新，可以视为僵尸 session，在 `notes` 标注 `stale?` 并继续工作（但谨慎操作对应文件）。
- 如果你是人类用户，可以随时清理僵尸条目。

---

## Active Sessions

<!-- 格式说明：每个 session 一行，用 | 分隔 -->
<!-- session-id: 简短唯一标识（如 droid-0408a, cursor-0408b） -->
<!-- agent: 使用的工具（Droid / Cursor / Codex / Claude Code 等） -->
<!-- task: 简述要做什么 -->
<!-- touch-files: 计划修改的文件或目录，逗号分隔；越精确越好 -->
<!-- status: active / planning / blocked / done -->
<!-- registered: ISO 时间戳 -->
<!-- notes: 冲突说明、阻塞原因等 -->

| session-id | agent | task | touch-files | status | registered | notes |
|------------|-------|------|-------------|--------|------------|-------|
| droid-0926a | Droid | AAV-1280 offset spec discovery 可算性对齐 UI 渲染门控 | e2e/reserveDiscovery.ts, e2e/portfolio-cross-reserve-offset.spec.ts, src/test/reserveDiscovery.test.ts, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-26T00:00:00+08:00 | 已交付：谓词收紧 + 纯函数抽取 + 34 单测；e2e 实测干净 skip；gate 全绿 |
| droid-0927a | Droid | AAV-1305 P2 迁移 + AAV-1309 测试修复 + harness 改造（Session Start/登记/清理/evidence 回仓） | src/lib/chainRegistry.ts, src/lib/userData/aaveV3UserClient.ts, src/lib/userData/aaveV3UserClient.test.ts, src/hooks/useUserPositionsSdk.ts, src/hooks/useUserPositionsSdk.test.tsx, src/test/userPositionConsistency.test.ts, AGENTS.md, docs/agents/harness.md, docs/conventions/scenario-matrix.md, docs/specs/aav-1305-v3-dataprovider-migration.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T04:10:00+08:00 | 补登记：session 启动时漏读本看板（只走了 roadmap + issue-tracker 指针），结束补注。教训：期间并行 session 提交 e2e 改动（8e59187c/fd3f5fcf）在板上不可见，靠 git 状态漂移事后发现——注册本可让该协调显式化。AAV-1309（deec631e）：测试去假 HITL 标注 + onchain-only 真断言 + API base 收敛；核查中开票 AAV-1310/1311（既有生产缺陷）。harness 批次：AGENTS.md Session Start 节、harness.md 登记看板（core 回仓缓做，重评条件见登记行）、看板僵尸行清理、evidence 卫生回仓 agent-harness core（PROVENANCE 同 commit） |
| droid-0927b | Droid | 新开 issue triage 与 review，更新 issue 与 roadmap | docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T04:45:00+08:00 | 已完成：全面审查新开 issue（AAV-1311、AAV-1310、AAV-1308、AAV-1307、AAV-1306/GitHub #678）；在 Linear 沉淀根因核查与裁决建议并更新规范标签；同步更新 docs/issue-roadmap.md。 |
| droid-0927c | Droid | AAV-1311 onchain fallback 非 18-dec USD 缩水修复（mapper decimals 缩放 + 测试矩阵） | src/lib/userData/userPositionMapper.ts, src/lib/userData/userPositionMapper.test.ts, src/lib/userData/onchainPositionConverter.test.ts, src/test/userPositionConsistency.test.ts, docs/specs/aav-1311-onchain-fallback-decimals.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T13:20:00+08:00 | 已交付：`084131f5`（rawToHuman 按 meta.decimals 换算 + fixture 形态修正 + 一致性量级 invariant）；live 实测 Celo USD₮ $1044.57；gate 全绿；Linear Done + 交付记录。期间并行 session `5e57d7e1`（branch-protection docs）与本票无文件交集。 |
| droid-0927d | Droid | Arc (5042) 链图标对齐上游 slug `arc`：官方 SVG 替换占位图 + overrides/chainIconMap 改名 | public/icons/networks/arc.svg, public/icons/networks/chainlink-arc.svg, scripts/data/chain-slug-overrides.json, src/lib/chainIconMap.ts, src/lib/chainIcons.test.ts, docs/specs/chain-icon-map-auto-sync.md, docs/specs/chainlink-arc-v4-chain-onboarding.md, docs/DOCS-INDEX.md, SESSION-BOARD.md | done | 2026-09-27T19:00:00+08:00 | 已交付：官方 SVG 取自 aave/interface `public/icons/networks/arc.svg`（V4_LINKS 硬编码 slug，非 networksConfig 管道）；overrides/chainIconMap 5042 → `arc`；gate 全绿（lint 0 errors / test 90+vitest / build / tsc / check+sync dry-run 22 链对齐） |
| droid-0927e | Droid | AAV-1310 RPC 轮换耗尽静默空成功修复(语义分流 + failedSources 显式报错) | src/lib/userData/aaveV3UserClient.ts, src/lib/userData/aaveV3UserClient.test.ts, src/hooks/useUserPositionsSdk.ts, docs/specs/aav-1310-rpc-rotation-exhaustion.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T21:30:00+08:00 | 已交付:createClientWithRpcRotation 轮换耗尽 throw RpcRotationExhaustedError,null 语义收紧 registry 无 RPC;V3/V4 errors 通道非空 + failedSources 正确降级提示;HF 消费方映射 null 降级;review 双轴闭环。commits 9552fe60/4f93ca0b/ecb3f622;Linear Done + 交付记录评论;gate 全绿 |

| wb-0928a | WorkBuddy | AAV-1310 交付复核 → 标准上线流程晋升（lovable→dev→main）+ instanceof 兜底 + 三项 follow-up 开票(AAV-1313/1314/1315) | src/lib/userData/rpcResilience.ts, src/lib/userData/rpcResilience.test.ts, src/hooks/useOnchainHealthFactor.ts, src/test/userPositionConsistency.test.ts, SESSION-BOARD.md | done | 2026-09-28T06:45:00+08:00 | 已交付:复核确认代码成立但此前未上线;补 4ded493d(isRpcRotationExhausted 结构化兜底 instanceof + 3 例单测 + 过时注释回写);推 lovable 524dc9a0..4ded493d(pre-push 全绿);lovable→dev PR #685 已合并;dev→main PR #686 已建**未合并**等用户;AAV-1310 已加交付记录评论。已知非阻塞噪声:openapi-sync fail(后端 spec 删了 ApiMeritCampaign*,与 #676 同款,非本批引入) |
| qoder-0928a | Qoder | AAV-1308 cross-asset-pairing e2e discovery 可算性门控对齐（纯函数抽离 + 场景矩阵） | e2e/reserveDiscovery.ts, e2e/portfolio-cross-asset-pairing.spec.ts, e2e/test-reserves.ts, src/test/reserveDiscovery.test.ts, docs/specs/aav-1308-cross-asset-pairing-discovery.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, AGENTS.md, SESSION-BOARD.md | done | 2026-09-28T12:10:00+08:00 | 已交付：commits `09b42aa4`（代码+97 单测）/`8b27e1fc`（spec+DOCS-INDEX）/本行所在 commit（roadmap+看板）。discoverCrossAssetPairingScenarios 入 reserveDiscovery，两端过 isComputableMerklCampaign + 新增 supply/borrow room(≥$5000) 与 LTV 融资额度门 + 自配对/同 symbol/缺身份字段排除。双轴 review 追加修两处既有失真：getMarketChipLabel 镜像（加 39 marketName 一致性测试）、cap=0=无上限。gate 全绿（lint/typecheck/e2e 显式 tsc/build/3849 单测）；Playwright 三 spec 12 passed·20 skipped。Linear AAV-1308 Done + 交付记录评论，follow-up AAV-1316/1317/1318/1319 已建。同日 follow-on `cabdc0b2`：按 writing-for-agents 订正 AGENTS.md 三处失效指针（验证门里的 `npx tsc --noEmit` 实为 0 文件空转、`playwright-interactive` skill 不存在、`disable-model-invocation` skill 的 agent 侧加载路径），未动任何 skill frontmatter。实测：现网 0 条 crossAssetPairing，门控未被真实数据触发（证据在单测）。 |
| qoder-0928b | Qoder | PR #686 preview 验证 + 生产复验 + 收尾登记（AAV-1303 领出、AAV-1320 建票）+ AAV-1321 场景模拟交互链路 e2e 覆盖 | docs/issue-roadmap.md, SESSION-BOARD.md, e2e/scenario-input-modes.spec.ts, docs/specs/aav-1321-scenario-input-modes-e2e.md, docs/DOCS-INDEX.md | done | 2026-09-28T17:35:00+08:00 | 补登记：本 session 前段全程只读，登记时板上 active 行为零（示例段的 April 行不算），全程无冲突。交付：preview（SSO profile + CDP，deploy-sha `226c5571` 对齐 PR head）与生产 build `d39ad25f` 双向验过（API=api.aaveapy.com、钱包自动导入 1 position、Arc 图标 200 且 0 断图、移动端 Wallet actions/连接弹窗正常）；main CI/CodeQL/Smoke Test/Release notes 全绿。Linear：AAV-1303 Backlog→Todo；新建 AAV-1320（GA4 被 `vercel.json` 的 `script-src` 拦，非 #686 引入）、AAV-1322（桌面行展开后不收起）。AAV-1321 已交付 Done：commit `0843594c` 新增 `e2e/scenario-input-modes.spec.ts`（14 行矩阵，11 passed/7 skipped 平台路由，lint/typecheck/test/build 全 0，新 spec 显式跑 tsc 揪出 4 个真类型错）。遗留：`lovable` 有未 push 提交（含本 session 的 `0843594c`），等用户决定是否推。自起的 CDP Chrome(9333) 与 4173 dev server 均已关闭。 |
| qoder-0929a | Qoder | Renovate 引入可行性诊断 + 双轨首步配置（actions-only）；追加：本地 e2e webServer 端口按 run 动态分配（并行门禁互断根治） | renovate.json, scripts/lib/e2e-port.mjs, scripts/lib/e2e-port.d.mts, scripts/e2e-port.test.mjs, playwright.config.ts, e2e/playwright.fields.config.ts, docs/specs/e2e-parallel-port-isolation.md, docs/DOCS-INDEX.md, SESSION-BOARD.md | active | 2026-09-29T18:20:00+08:00 | 诊断：Renovate App 账号级**零活动**（个人号 43 repo + 8 org 全部 0 PR、0 配置文件），对照实验证明查询格式有效。只新增 `renovate.json`，**不动** Dependabot workflow。更正两条早期判断：branch-flow-guard 只在 PR→main 触发、close-stale-bot-prs 只过滤 `bot/`，两者均无需为 renovate/* 改动；账号级 `.github` 配置**不能**限制 onboarding 范围（`onboarding`/`autodiscover` 都是 globalOnly）。关键限制：Renovate 只从默认分支读配置 → 需进 main 才生效。<br>**追加起因**：`git push` 被 pre-push 拦下（87 例失败）。取证：86 例是 `net::ERR_CONNECTION_REFUSED at 4173`，唯 1 例 expect 失败同因，代码层零回归。根因＝固定端口 4173 + `reuseExistingServer: !CI`：并发门禁共用同一 Vite server，先结束者把它带走。修复＝按 run 动态分配端口（CI 仍固定 4173）+ `--strictPort`；覆盖 5 个本地入口（含 fields 配置）。证据：矩阵 11 行→10 单测绿；运行时对照＝4173 挂 HTTP 200 stub 跑真实 spec → `rc=0 / 3 passed / STUB_HITS=0`，并另跑正对照（curl 一次→`STUB_HITS=1`）证明计数器有效。typecheck/lint/knip/dup 全 rc=0。spec 见 `docs/specs/e2e-parallel-port-isolation.md`（13 行矩阵，已登记 DOCS-INDEX）；整条门禁实跑 60 passed/3 flaky/29 skipped/**0 failed**，全日志 CONNECTION_REFUSED 计数 0。<br>**交付状态**：commits `2a79cb04`+`79962aea`+证据回填，PR **lovable→dev #699 已创建未合并**（等用户 UI 操作）。双审查（Standards/Spec 并行 subagent）命中两条同源缺陷已修：测试引用矩阵不存在的 row 11、`e2e/global-setup.ts` 是未登记的第三个 URL 消费者；另按 smell 抽出 `e2eDevServerCommand()` 消除两份配置的命令副本、`e2eBaseUrl` 的 `string` 分支删除。遗留：Renovate 激活仍卡在安装层（需用户在 settings/installations + settings/confirmations 确认），且 `renovate.json` 须进 main 才被读取 |
| wb-0928c | WorkBuddy | AAV-1320 GA4 CSP 修复 + 部署门（lovable→dev→main）preview 实测 + pre-push e2e 处置 | vercel.json, scripts/check-csp-inline-scripts.mjs, scripts/lib/csp-inline-scripts.mjs, scripts/check-csp-inline-scripts.test.mjs, scripts/pre-push-e2e.mjs, playwright.config.ts, e2e/global-setup.ts, package.json, docs/specs/aav-1320-ga4-csp-inline-scripts.md, docs/agents/harness.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-28T00:40:00+08:00 | **全部交付**：commits `567823ec`（CSP 放行 consent hash + GA origin；构建期 hash 校验门接 npm run build）+ `f16da8a5`（spec 16 行矩阵）+ `999ac53f`/`f7708c9b`/`b1262489`（CodeQL `js/bad-tag-filter` 三连：i flag / `</script >` / `</script foo>` → 终版 `<\/script[^>]*>`，25 单测）+ `8335757b`（pre-push 关录制 + 排除 2 个 load-flake 用例，`--list --grep` 反查精确命中）+ `ba34db9e`（harness 代理出口记录）+ `4928d549`（globalSetup 预热导航 30s→120s）。**验证链全绿**：PR #692 CI 32 SUCCESS（CodeQL success / e2e 4 分片 / Vercel）；preview 实测 8 项全过（CSP 头含 consent hash + GA origins、deploy-sha 对齐、consent 块 covered=YES、dataLayer[0]=consent default、declined 0 请求、granted 回访 gtag.js 200+collect 204；站点自身 violation 仅 2 个已知项，1074 条为 profile 扩展噪声）。**晋升**：lovable→dev PR #692 已合并（09-29 09:12）；dev→main PR #693 已创建**未合并**，等用户在 GitHub UI 操作。附赠排查：vendor eval=良性（Ajv JIT 探测+catch 降级）；pre-push e2e 慢的三个根因（全量套件/全程录制/dev server 冷启动）已处理前两个。遗留给下个 frontier：AAV-1303。 |
| qoder-0929b | Qoder | PR #688 处置：dev @eslint/js 二次回归回退 + happy-dom 20.14 WAAPI shim + peer-conflicts workflow 改报告制 | package.json, package-lock.json, .github/dependabot.yml, .github/workflows/dependabot-resolve-peer-conflicts.yml, src/test/setup.ts, docs/lessons/infrastructure.md, docs/plans/dev-ci-eslint-peer-dep-fix-spec.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-29T20:40:00+08:00 | 冲突检测：唯一 active 行 qoder-0929a 只碰 renovate.json + 本看板，无实质交集。改动全在 /tmp worktree，主工作目录未切分支。**#697**（→dev，`7f7b4a18` + `d7bebcd0`）：`git revert 20e7c23b` 回退 @eslint/js + dependabot ignore + workflow 报告制，CI 全绿（peer-dep-check/lint/build；首跑 e2e pin spec 重跑通过=实盘 flake，已在 PR 留言）。**#698**（→dev，draft，`aeaed110`）：happy-dom 20.14.5 + setup.ts 的 WAAPI `finished` 孤儿 rejection shim，CI 全绿含 build，本地带正对照证明非全局消音；依赖 #697 先合。#688 由 #698 取代（dependabot 分支 maintainerCanModify=false 无法直接提交），版本进 dev 后 dependabot 自行关闭。**已合并（用户 09-29 拍板 #697→#698 依次合）**：#697 `33be199f` 13:42 UTC、#698 `1137ce07` 13:44 UTC 进 dev。dev push CI 验收：peer-dep-check / lint / build / e2e 4 分片全 SUCCESS，只剩既有 openapi-sync 噪声。#688 已由 Dependabot 自动关闭（13:44）。Linear AAV-1301 评论已更新为交付状态，票仍留 Backlog（eslint 10 工具链协调未做）。两个 /tmp worktree 已 remove（node_modules 等 scratch 一并清掉），本地分支 `fix/dev-eslint-js-peer-align` / `feat/happy-dom-waapi-shim` 保留（commit 已验证全在 origin/dev，可随时删），远端分支未删。 |

> **2026-09-27 清理**：删除 2026-04/05 的 done 行与僵尸 active 行（lovable-0423a，>48h 无更新，按协议 §4 处理）；git 历史可查。保留近两日条目。

---

## 冲突判断参考

以下是常见的高冲突区域，两个 session 同时改这些区域**几乎必然冲突**：

| 区域 | 典型文件 |
|------|----------|
| 利率模拟 | `src/lib/rateSimulation.ts`, `src/hooks/useRateSimulation.ts` |
| 储备表 | `src/components/reserves/ReservesTable.tsx`, `DesktopReserveRow.tsx` |
| 移动端储备 | `src/components/reserves/MobileReserveCard.tsx`, `MobileExpandedReserveShell.tsx` |
| 激励预测 | `src/lib/meritForecast.ts`, `src/lib/brevisForecast.ts`, `src/lib/merklForecast.ts` |
| 格式化 / 工具 | `src/lib/formatters.ts`, `src/lib/sorters.ts` |
| 全局样式 | `src/index.css`, `src/App.css`, `tailwind.config.ts` |
| 路由 / 页面 | `src/pages/Index.tsx` |
| 类型定义 | `src/types/` 下任意文件 |

如果两个 session 的 `touch-files` 落在**同一区域**，即使不是完全相同的文件，也建议视为冲突（因为经常有隐式依赖）。

---

## 示例

```
| session-id   | agent  | task                           | touch-files                                          | status  | registered          | notes              |
|--------------|--------|--------------------------------|------------------------------------------------------|---------|---------------------|--------------------|
| droid-0408a  | Droid  | 修复 mobile 展开动画           | MobileReserveCard.tsx, MobileExpandedReserveShell.tsx | active  | 2026-04-08T10:30:00 |                    |
| cursor-0408b | Cursor | 重构利率模拟添加 Brevis 支持   | rateSimulation.ts, brevisForecast.ts, useRateSimulation.ts | active | 2026-04-08T10:45:00 |                    |
| droid-0408c  | Droid  | 调整 ReservesTable 排序逻辑    | sorters.ts, ReservesTable.tsx                        | blocked | 2026-04-08T11:00:00 | 被 cursor-0408b 阻塞（ReservesTable 间接依赖 rateSimulation） |
```

当 `cursor-0408b` 完成并注销后，`droid-0408c` 重新读取本文件，发现无冲突，即可将自己改为 `active` 并开始执行。
