# Documentation Canonical Map

This index is the source of truth for doc ownership in this repository.

Use it to avoid duplicate policy text and to keep each topic in one canonical location.

**Entry points:** [`README.md`](../README.md) (onboarding), root [`DESIGN.md`](../DESIGN.md) (design links table), this file (full map).
**Reusable templates:** [`docs/reusable/`](./reusable/) (project-agnostic engineering patterns, portable to any repo).

_Last inventory pass: 2026-09-28._

## Canonical Structure

### Product and repo operation

- Canonical: `README.md` (project onboarding, scripts, high-level behavior)
- Canonical: `docs/ARCHITECTURE.md` (技术架构：目录结构、数据流、shared schema、simulation、错误处理模式)
- Canonical: `docs/PR_ANALYSIS.md` (PR batching/automerge policy)
- Canonical: `AGENTS.md` → **PR review threads: no cosmetic resolve** (merge / `resolveReviewThread` policy); workflow copy: `.claude/commands/merge.md` (keep aligned with `~/.cursor/commands/merge.md`)
- Canonical: `docs/dependabot-behavior.md` (依赖自动化现状：Renovate 接管版本升级**但删掉 `dependabot.yml` 不等于管道停了**（#752 实证）/ security updates 不靠 dependabot.yml / `dependabot/*`→main 为何必然红 + 改 base 的正确命令 + 重复 PR 的判据)
- Canonical: `docs/issue-roadmap.md` (Issue Roadmap: open issue 优先级排序与状态快照; GitHub issue 始终排最前; 与 `docs/agents/issue-tracker.md` 分工——本文件用户可见，issue-tracker.md agent 内部配置)

### Agent 内部契约（docs/agents/）

- Canonical: `docs/agents/issue-tracker.md` (agent 内部 Linear 配置与契约：连接配置、write-once body、认知卸载、wayfinding、已知坑)
- Canonical: `docs/agents/triage-labels.md` (triage label 契约角色与流转；实存 label 以 Linear 查询为准)
- Canonical: `docs/agents/harness.md` (相对 agent-harness core 的本地改编登记 + 本机 CDP 测试浏览器环境)
- Canonical: `docs/agents/domain.md` (skills 消费 `CONTEXT.md` / `docs/adr/` 的规则)

### API, contracts, and CI conventions

- Supporting index: `docs/conventions/README.md` (stub pointer to conventions; migration fit now in this file)
- Canonical: `docs/conventions/api-contract-checklist.md`
- Canonical: `docs/conventions/api-base-urls.md`
- Canonical: `docs/conventions/vercel-deployment-smoke-test.md` (post-deploy smoke + rollback; ref normalization vs Vercel metadata)
- Canonical: `docs/conventions/ci-live-schema-cloudflare.md`
- Canonical: `docs/conventions/post-deploy-checklist.md` (Production deployment verification: API endpoint, data, SEO, security, rollback)
- Canonical: `docs/conventions/peer-dependency-guard.md`
- Canonical: `docs/conventions/merge-summary.md`

### Conventions transfer map

| File | Migration fit | Notes |
| --- | --- | --- |
| `docs/conventions/api-contract-checklist.md` | High | Generic API contract migration checklist; replace endpoints and schema names. |
| `docs/conventions/api-base-urls.md` | Medium | Useful if the new project has multiple environments and env-var overrides; replace hostnames. |
| `docs/conventions/peer-dependency-guard.md` | High | Generic React safety pattern; replace versions and package manager details as needed. |
| `docs/conventions/merge-summary.md` | High | Project-agnostic merge hygiene. |
| `docs/conventions/frontend-regression-checklist.md` | Medium | Strong reusable pattern for UI refactors; replace component names and high-risk surfaces. |
| `docs/conventions/vercel-deployment-smoke-test.md` | Medium | Transferable if the new project deploys on Vercel; otherwise adapt to the hosting platform. |
| `docs/conventions/ci-live-schema-cloudflare.md` | Low | Cloudflare-specific mitigation; keep only if the new project uses the same edge setup. |

### Conventions ↔ GitHub Actions mapping

| Convention doc | GitHub Actions touchpoint |
| --- | --- |
| `docs/conventions/vercel-deployment-smoke-test.md` | `.github/workflows/deployment-smoke-test.yml` (deploy smoke, SHA verification, rollback) |
| `docs/conventions/api-contract-checklist.md` | `apiSchemas.live.test.ts` / `apiSchemas.test.ts` / `sync-token-icons.mjs` checks in CI |
| `docs/conventions/ci-live-schema-cloudflare.md` | Operational follow-up when CI live schema checks hit Cloudflare challenge/block |
| `docs/conventions/merge-summary.md` | PR/merge workflow review artifacts (`commit body`/`PR comment`/summary hygiene) |
| `docs/conventions/peer-dependency-guard.md` | Dependency safety gates during install/upgrade in pipeline flows |
| `docs/conventions/frontend-regression-checklist.md` | Manual/local verification required before merge (often alongside PR validation) |

### Frontend runtime/data/simulation

- Canonical: `docs/frontend-data-loading-matrix.md`
- Canonical: `docs/rate-calculation.md`
- Canonical: `docs/fallback-reference.md` (frontend variable fallback chains)
- Canonical: `CONTEXT.md` (opinionated domain glossary: 正名 + _Avoid_ aliases)
- Canonical: `docs/TERMINOLOGY.md` (variable / field naming reference; full mapping chains + units)
- Canonical: `aaveapy-doc/v3-v4-sdk-field-mapping.md` (Aave V3 vs V4 SDK field mapping)
- Canonical: `docs/api-field-optimization.md` (API field-shape optimization analysis)
- Canonical: `docs/pool-explorer-links.md` (pool address explorer deep-link mapping; validation now in `src/lib/poolExplorerLinks.test.ts` — the `e2e/explorer-links-*.spec.ts` files were retired, see `docs/conventions/e2e-testing-boundary.md`)
- Implemented: Portfolio Simulation — 多 token 组合模拟（✅ 全部完成 2026-05-10）；5 Phase 实施完毕，文件：`src/types/portfolio.ts`, `src/hooks/usePortfolioSimulation.ts`, `src/lib/portfolioCalculator.ts`, `src/components/dashboard/Portfolio*.tsx`；三种添加入口：表格 checkbox / 展开面板按钮 / 搜索栏
- Historical supporting note: `docs/archive/merit-base-anchor-vs-last-round-staging.md`
- Historical execution archive: `docs/archive/frontend-redundancy-review-2026-04-06.md`
- Supporting implementation note: `docs/archive/2026-04-09-reserve-id-canonical-key.md`

### Design system and interaction

- Canonical (project profile): `docs/design/DESIGN.md`
- Canonical (reusable system rules): `docs/design/DESIGN-SYSTEM-REFERENCE.md`
- Canonical (product-critical interaction guardrails): `docs/design/frontend-interaction-guardrails.md`
- Canonical (mobile ASCII reference): `docs/design/mobile-reserve-card-ascii-layout.md`
- Canonical (tooltip callout arrow spec): `docs/design/tooltip-arrow.md` (SVG double-path, auto-flip via Radix `data-side`, side-by-side comparison with `IncentiveTooltip`'s custom arrow)
- Implemented: Tooltip 设计规范（✅ 已实施，测试全绿）；Radix Tooltip（轻量）+ IncentiveTooltip（丰富浮层）+ AssetActionMenu Popover 三组件使用场景、API、测试要求；核心规则已合入 DSR §6
- Entry stub: `docs/design/README.md` (index page only)

  > `frontend-interaction-guardrails.md` is *not* under `docs/conventions/` because it is a product-behavior rulebook, not a repo-process convention.

### Specs (live behavior contracts)

- Canonical: `docs/specs/reserve-table-market-hub-filtering.md`
- Canonical: `docs/specs/v4-reserveId-uniqueness.md`
- Canonical: `docs/specs/schema-pipeline-automation.md` (后端驱动全链路 schema 自动生成；Phase 1 ✅, Phase 2–3 pending AAV-1214/1216; ADR-0026)
- Canonical: `docs/specs/chain-icon-map-auto-sync.md` (chainIconMap 双源自动同步；registry 占位条目 + slug 六级推导 + rename 自愈; AAV-1297)
- Canonical: `docs/specs/hardcode-sync-gate-tiering.md` (Hardcode Sync 门禁分级；退出码协议 0/2/critical + sync/verify 双链 runner + pending-chain-ids 白名单 + incomplete-asset/stale-hardcode; AAV-1296)
- Canonical: `docs/specs/aav-1298-openapi-sync-dev-convergence.md` (openapi-sync bot PR 收敛 dev + schedule 安全网修复 + codegen 产物自修复 patcher; AAV-1298)
- Canonical: `docs/specs/aav-1282-mobile-connect-modal-rainbowkit-wallets.md` (移动端 Connect 弹窗修复：connectorsForWallets 注入 rkDetails 钱包 + e2e 双端解禁; AAV-1282)
- Canonical: `docs/specs/aav-1280-offset-discovery-computability.md` (offset e2e 场景 discovery 对齐 UI 渲染门控：isComputableMerklCampaign 收紧 + discoverOffsetScenarios 纯函数抽取; AAV-1280)
- Canonical: `docs/specs/aav-1305-v3-dataprovider-migration.md` (V3 仓位读取迁移 AAVE_PROTOCOL_DATA_PROVIDER：9 字段 ABI 布局互证 + positional tuple 解码 + watch-reentry listener 加固; AAV-1305 P2)
- Canonical: `docs/specs/aav-1311-onchain-fallback-decimals.md` (onchain fallback 非 18-dec 代币 USD 缩水修复：rawToHuman 按 meta.decimals 换算 + amountWad 原生 raw 语义文档化 + 一致性测试量级 invariant; AAV-1311)
- Canonical: `docs/specs/aav-1308-cross-asset-pairing-discovery.md` (cross-asset-pairing e2e discovery 对齐 UI 门控：两端可算性 + 仓位可行性 room/LTV 门 + label 镜像与 cap=0 修正; AAV-1308)
- Canonical: `docs/specs/aav-1310-rpc-rotation-exhaustion.md` (RPC 轮换耗尽语义分流:createClientWithRpcRotation 轮换耗尽改 throw RpcRotationExhaustedError,null 语义收紧为 registry 无 RPC;V3/V4 multichain errors 通道 + HF 消费方降级对齐; AAV-1310)
- Canonical: `docs/specs/aav-1321-scenario-input-modes-e2e.md` (场景模拟交互链路 e2e 覆盖 spec:USD↔Token 模式切换与清空语义 / 相对断言抗 staging 漂移 / 净借贷开关走 label 且验可逆 / 桌面整行展开 vs Market 芯片筛选;含 14 行场景矩阵; AAV-1321)
- Canonical: `docs/specs/aav-1320-ga4-csp-inline-scripts.md` (GA4 CSP 修复:consent 内联块 sha256 放行 + googletagmanager/google-analytics origin + 构建期 hash 校验门接 npm run build;含 16 行场景矩阵与运行时 probe 证据; AAV-1320)
- Canonical: `docs/specs/e2e-parallel-port-isolation.md` (本地 e2e webServer 端口按 run 动态分配:固定 4173 + reuseExistingServer 导致并发门禁互相打断的根因与不变量（CI 固定端口 / origin ≡ baseURL / 分配只算一次 / URL 与命令单一来源）;含 13 行场景矩阵与整条门禁实跑证据; 无 issue 票)
- Canonical: `docs/specs/e2e-hardcoded-market-name-guard.md` (e2e 选择器不得钉死链名的守卫:词汇取 src/lib/chainIconMap、只判选择器行、候选列表与注释豁免、allow 逃生阀、空词汇即报错;含 12 行场景矩阵与事故前文件正对照; 无 issue 票)
- Canonical: `docs/specs/aav-1329-faq-anchor-wait-strategy.md` (e2e 首步等待不得锚网络静默:App.tsx 模块级 prefetch 让 networkidle 永不可达,改锚页面自身产出(H1 + h2#faq);守卫随 npm test 生效、不新增 npm script/hook;含 13 行场景矩阵; AAV-1329)
- Canonical: `docs/specs/architecture-guard-fs-walk-cost.md` (architecture-guard 的 FS 遍历成本:每用例各自重走 src 树撞 5s 超时;globTsFiles 按目录、readFile 按路径记忆化 + components/lib/hooks 清单提到模块作用域;含 8 行场景矩阵与「改前 1 failed → 改后 325 passed、单文件 15s→7s」证据; AAV-1331)
- Canonical: `docs/specs/aav-1316-cross-asset-pairing-synthetic-payload.md` (cross-asset-pairing e2e synthetic 载荷变体:提交修剪版真实 staging fixture + 注入后跑既有 discovery 选场景 + page.route 双拦 /markets 与 /meta/side-data 全 hermetic + baseline 零断言;含 14 行场景矩阵; AAV-1316)
- Canonical: `docs/specs/aav-1318-offset-position-feasibility-gating.md` (offset e2e discovery 仓位可行性门:offset 侧复用 usableForSimulatedPosition 补借出空间与 LTV 融资额度 + self-loop target 借入门 + O 系列 fixture 真实 room 形态;含 13 行场景矩阵 O12–O24 与 staging 场景数 before/after 对比; AAV-1318)
- Canonical: `docs/specs/aav-1322-expanded-row-collapse-probe.md` (桌面展开行收起探针:票面 0→1→1 是 textContent 假象（面板常驻挂载 + 0fr），真浏览器 dev/生产均为 …→0→…；subRowText 改 visible-only + M9 补收起断言;含 9 行场景矩阵; AAV-1322)
- Canonical: `docs/specs/aav-1333-offset-ladder-dimensional-coherence.md` (offset e2e 阶梯与阈值同源：discovery 产出 `OffsetRunnerPlan`（供给额 / 阶梯 / 期望比例），runner 只把金额原样打进去、不再手挑常量；比例 = responding/total 加权后的 `min(B,gross)/gross`，断言 `measured ≥ 0.9×expected` 且饱和步 `after ≤ 0.01`；brevis / protocol / `gross<100` 三道门；cross 用真实 fixture 注入 `netPositionConstraint` 的 stub（37500 / 9375 / 18750 / 56250）首次真实执行；28 行矩阵 L1–L28; AAV-1333)
- Canonical: `docs/specs/aav-1356-v4-spoke-address-key.md` (V4 onchain fallback 的 spoke join key 从名字改为地址:生产方按 API 显示名作 key、消费方按地址簿 raw key 查询导致 0/21 条 spoke 被查询;key 统一为 toV4SpokeKey(地址小写)、生产者改读 reserveId;含 17 行场景矩阵 V1–V17 与生产数据 before/after 21/21; AAV-1356)
- Canonical: `docs/specs/aav-1356-v4-module-union.md` (V4 地址簿 module union:每链合并 base + curated module、按地址去重、同名不同址用 module 前缀消歧、地址簿 4.77.6 升级;含 20 行场景矩阵 U1–U20 与 staging 17/17 覆盖证据; AAV-1356)
- Canonical: `docs/specs/aav-1362-release-age-override-hint.md` (release-age 门禁失败提示指向真实出口:移除不存在的 workflow_dispatch input 指引、统一 formatReleaseAgeOverrideHint、脚本/SECURITY.md/workflow 契约测试;8 行场景矩阵 S1–S8; AAV-1362)
- Canonical: `docs/specs/aav-1362-hardcode-sync-hook-bypass.md` (Hardcode Sync 机器人推送不得跑开发者本地 hook:create-pull-request 的 git push 触发 `.husky/pre-push`(ci:remote + e2e),runner 无 chromium 被 AAV-1349 硬阻断;只在 PR step 加 `HUSKY: '0'` + `scripts/hardcode-sync-hook-guard.test.mjs` 守卫;8 行矩阵 S1–S8; AAV-1362)
- Canonical: `docs/specs/aav-1391-openapi-sync-hook-bypass.md` (机器人 PR 推送不得跑开发者本地 hook 的统一收口:openapi-sync / token-icon-sync / ci-auto-remediation 三处 create-pull-request step 加 `HUSKY: '0'`(hardcode-sync 已有),`scripts/bot-push-hook-guard.test.mjs` 枚举全部 bot PR 步骤并禁止把开关提到 job/workflow 级;14 行矩阵 S1–S14; AAV-1391)
- Canonical: `docs/specs/aav-1389-product-view-gate.md` (产品视角三句门禁:照搬 inside-china-ai 的纯文本校验器(原样),渲染器换 Linear 取数(合同不变:标记/`## 产品视角`/来源 marker/exit 0-1-2),接线到 CI `repo-policy` 的 PR body 校验 + AGENTS.md Step 9 渲染器;13 行矩阵 S1–S13;不搬:作者权限过滤与 GitHub 账本; AAV-1389)
- Canonical: `docs/specs/aav-1335-unit-network-coupling.md` (unit/script 测试不得真实出网:根因(测试导入即跑 `main()`)已由 `7a64abc2` 的 `isDirectRun` 门修掉,本轮补「导入前陷阱 fetch/http(s)/dns/net 后断言零尝试」的行为守卫 + `main()` 门与 `fetchWithTimeout` 调用位置的静态断言 + boundary doc 红线;9 行场景矩阵 S1–S9,含去门 mutant 实测 attempts 命中; AAV-1335)
- Canonical: `docs/specs/aav-1367-nested-zod-floor.md` (嵌套 zod 3.x 的 CVE-2023-54404 收口:全树 zod 下限 `overrides.zod=$zod` + `check-zod-version-floor` 守卫(精确允许清单,新增 zod-3 消费者必须显式登记)+ appkit-wallet `W3mFrameSchema` 的 zod-4 兼容 canary + 删除失效的 osv 豁免;15 行场景矩阵 Z1–Z15; AAV-1367)
- Canonical: `docs/specs/aav-1349-pre-push-e2e-browser-gate.md` (本地 pre-push e2e 门缺浏览器时必须失败:缺失 chromium 由静默 `exit 0` 改为 `exit 1` + 显式 `E2E_SKIP=1` opt-out + `PLAYWRIGHT_BROWSERS_PATH=0` 不误判;判定收进 `scripts/lib/e2e-browser-gate.mjs`;10 行场景矩阵 S1–S10; AAV-1349)
- Canonical: `docs/specs/aav-1319-e2e-static-gates.md` (e2e 目录纳入静态门:`tsconfig.e2e.json` 覆盖 `e2e/**` 与根 `playwright.config.ts`、`typecheck:e2e` 并入 `typecheck`、`ci:remote` 前置类型门、PR CI 的 lint job 补 typecheck step(必须先生成 gitignored 的 icon manifests);eslint 不再忽略 e2e 并对 Playwright 空 fixture 关 `no-empty-pattern`、`_` 前缀豁免 unused-vars;12 行场景矩阵 E1–E12,含「include 漏写即假绿灯」的 mutation 负控; AAV-1319)
- Canonical: `docs/specs/aav-1352-staging-discovery-fetch-outcome.md` (e2e discovery 拉取失败必须与数据缺口区分:`fetchStagingReserves` 返回 tagged outcome(失败不是空数组)+ 2 次×30s 重试 + 进程内缓存成功与失败 + `decideReserveGate` 把数据缺口判 skip、不可达判 fail(唯一出口 `E2E_ALLOW_STAGING_UNREACHABLE=1`);失败落在 live 测试而非模块加载,不依赖 staging 数据的 stub 变体照常执行;29 行场景矩阵 F/G/C/N; AAV-1352)
- Canonical: `docs/specs/aav-1304-portfolio-summary-empty-state.md` (PortfolioSummaryBar supply-only 空态与 Advanced 归一:Lowest HF 徽章三态 computed/no-debt/unknown(`getLowestHfBadgeState` 纯函数,有债但不可算绝不误报 no debt)+ 三段组标签抽 `SECTION_HEADER_CLASS` + 数值 bold、状态文案 medium;9 行场景矩阵 E1–E9; AAV-1304)
- Canonical: `docs/specs/aav-1317-portfolio-fill-row-scoping.md` (portfolio fill helper 按 reserveId 行域定位:三个 fill helper 收进行域共享实现(桌面 tr/移动卡片同锚点 + 移动端 tab 切换 + symbol 正则转义)、Add 流程同符号多候选无标签命中由 `.first()` 静默回退改显式 false、discovery 解除同符号排除(自配对保留)、runner 行归属值断言;同符号 stub(Celo WETH→Base WETH,composite fixture 登记在案)先红后绿,行序=插入序使旧实现红为确定性;12 行场景矩阵 B1–B12; AAV-1317)
- Canonical: `docs/specs/aav-1314-multicall-all-calls-failed.md` (onchain multicall 全失败进 errors 通道:成功判定 = call status + result !== undefined(`0n` 是成功)、V3 按市场全失败 throw、V4 按 spoke 全失败 throw、部分失败保留成功仓位 + warn、account 失败只降级 summary;顺带修 V4 borrow-only 仓位被 `!0n` 丢掉;20 行场景矩阵 M1–M20; AAV-1314)
- Canonical: `docs/specs/aav-1387-rpc-read-rotation.md` (批量读整批失败不再沿用「探活通过」的 RPC:readWithRpcRotation 在 allCallsFailed / attempt 抛错时换下一个 URL、耗尽后仍返回最后一次结果让 AAV-1314 的 MulticallAllCallsFailedError 走 errors→failedSources、value 优先于 transport error、session 级降级缓存 + 端到端反自锁重试、探活成功不清降级;Optimism fastnode 对 >4KB aggregate3 回 413 是触发实例;18 行场景矩阵 M1–M18 + 7 项 mutation; AAV-1387)
- Canonical: `docs/specs/aav-1313-chain-rpc-session-sharing.md` (onchain 仓位路径按 chainId 共享「读会话」而非共享 client:RpcClientPool 的 acquire 单飞探活（并发 market/spoke 只探 1 次）、adopt 记住胜出端点、release 在整批失败/抛错时丢弃端点（保住 AAV-1387 的换点语义）、探活耗尽缓存 rejected promise;`fetchFallbackPositions` 一次同步 V3+V4 共用一个池;V3 errors 按 chainId 去重（console.error 仍逐 market）;16 行矩阵 S1–S16 + live 探针（4 端点两次读只 1 次 createPublicClient）; AAV-1313)
- Canonical: `docs/specs/aav-1315-wallet-partial-ui-notice.md` (钱包 partial 降级在 UI 可见:hook 暴露 failedSources、Index→ReservesTable→PortfolioPanel 同链路透传、`walletLoadState === 'success'` + 非空失败集时状态行渲染琥珀提示（原为 N source(s) unavailable + title 列源；**该文案与判定已由 AAV-1393 取代**为固定 `Wallet data incomplete` + fallback-only 过滤），不新增 WalletLoadState 取值、error/empty 文案不变;12 行矩阵 M1–M12; AAV-1315)
- Canonical: `docs/specs/aav-1393-wallet-sync-notice-copy.md` (钱包降级提示只给结论：固定文案 `Wallet data incomplete`、无 `title`、原始标签进 `data-failed-sources` + 一次 `console.info`；`hasMissingWalletData` 过滤 fallback-only 标签（`sdk-*-fallback` 表示数据已由链上读补齐 ⇒ 不提示），未知标签 fail open；标签词表由 `failureLabels.ts` 单一作者;9 行矩阵 M1–M9; AAV-1393)
- Canonical: `docs/specs/aav-1334-remove-dead-generate-snapshots-job.md` (移除 dispatch-only `generate-snapshots` 死 job:被引用的两个 visual spec 已于 `7c48ae01` 删除、push/PR CI 恒 skip 故只在手动触发时暴露;守卫收进 `scripts/lib/workflow-playwright-specs.mjs` + `node:test`,校验 workflow 显式 spec 路径存在且禁止 `--update-snapshots`;14 行矩阵 S1–S14; AAV-1334)
- Implemented: 移动端 Simulation 表格 Grid 布局改造（✅ 已实施 2026-05-10）；核心结论已合入 `frontend-interaction-guardrails.md` § Simulation breakdown table — Grid layout (mobile)

### ADRs (Architecture Decision Records)

- Canonical: `docs/adr/` (001–026)
- Latest: ADR-0026 (Schema Pipeline Automation — backend-driven codegen, Phase 1 complete)

### Plans and PRDs

- Active plans: `docs/plans/frontend-triage-2026-06/` (14 phases, indexed by `00-overview.md`; 10 issues confirmed done via code comparison and removed 2026-07-21)
- Completed plans: `docs/plans/completed/` (8 handoff documents for done issues)
- Active PRDs: `docs/prd/PRD-simulation-sources-dispatch.md`, `docs/prd/input-surface-normalization.md`
- Completed PRDs: `docs/prd/completed/` (7 PRDs for done issues: AAV-761, AAV-978, AAV-979, AAV-833, AAV-952, brevis-sum-unification, incentive-note-copy)

### Ops and historical plans

- Canonical: `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md`
- Canonical: `docs/ci-remediation-automation.md`
- Historical archive: `docs/archive/2026-04-02-mobile-reserve-ios-connector-plan.md`
- Historical archive: `docs/archive/2026-04-08-campaign-apr-reconciliation.md`
- Historical archive: `docs/archive/2026-04-08-campaign-apr-reconciliation-script.md`
- Archive folder: `docs/archive/` (historical notes, plans, and execution snapshots)

> **已清理的 archive plans**（摘要已合入主文档，源文件已删除）：
> - `2026-03-26-cap-ceiling-unification-plan.md` — 结论在 `docs/rate-calculation.md` + `AGENTS.md`
> - `2026-04-26-utilization-two-levels-design.md` — superseded by `DESIGN-SYSTEM-REFERENCE.md` §2.1

## Inventory and Action Classification

| Document | Purpose / audience | Last meaningful update | Canonicality | Overlap candidates | Action |
| --- | --- | --- | --- | --- | --- |
| `README.md` | Project onboarding and scripts | 2026-04-09 | Canonical | `docs/frontend-data-loading-matrix.md`, `docs/rate-calculation.md` | keep |
| `docs/PR_ANALYSIS.md` | PR batching / automerge / when to split PRs | 2026-04-05 | Canonical | `docs/dependabot-behavior.md`; merge execution + review-thread rules live in `AGENTS.md` / `.claude/commands/merge.md` | keep |
| `docs/dependabot-behavior.md` | 依赖自动化现状（删配置≠停管道）+ `dependabot/*`→main 卡点的处置 | 2026-10-07 | Canonical（guard 诊断、改 base 命令、重复 PR 的判据仅此一处） | `renovate.json`, `docs/PR_ANALYSIS.md` | keep |
| `docs/frontend-data-loading-matrix.md` | Data-loading architecture | 2026-04-27 | Canonical | `README.md` freshness notes | keep |
| `docs/rate-calculation.md` | Unified rate simulation formulas (native, Merkl, display, incentive caps) | 2026-04-28 | Canonical | none (consolidated) | keep |
| `docs/fallback-reference.md` | Frontend variable fallback chains | 2026-04-28 | Canonical | `docs/rate-calculation.md` | keep |
| `docs/TERMINOLOGY.md` | Variable / field naming reference | 2026-04-28 | Canonical | `aaveapy-doc/v3-v4-sdk-field-mapping.md` | keep |
| `aaveapy-doc/v3-v4-sdk-field-mapping.md` | Aave V3 vs V4 SDK field mapping | 2026-04-28 | Canonical | `docs/TERMINOLOGY.md`, `docs/fallback-reference.md` | keep |
| `docs/api-field-optimization.md` | API field-shape optimization analysis | 2026-04-20 | Canonical | none significant | keep |
| `docs/pool-explorer-links.md` | Pool address explorer deep-link mapping | 2026-04-16 | Canonical | live validation in `e2e/explorer-links-*.spec.ts` | keep |
| `docs/specs/reserve-table-market-hub-filtering.md` | Reserve table market/hub filtering behavior contract | 2026-04-22 | Canonical | `src/components/dashboard/ReservesTable.tsx` | keep |
| `docs/specs/v4-reserveId-uniqueness.md` | V4 reserveId uniqueness contract | 2026-04-22 | Canonical | `src/lib/reserveKey.ts`, `src/lib/apiSchemas.ts` | keep |
| `docs/specs/fcp-optimization.md` | FCP 优化 spec（钱包层 lazy 边界 + advancedChunks + 首屏守卫；含场景矩阵与验证证据） | 2026-08-29 | Canonical | `src/App.tsx`, `src/providers/WalletProviders.tsx`, `vite.config.ts`, `src/test/architecture-guard.test.ts` | keep |
| `docs/specs/chain-icon-map-auto-sync.md` | chainIconMap 自动同步 spec（registry 数据源 / 占位 SVG / slug 推导 / rename 自愈；含场景矩阵） | 2026-09-24 | Canonical | `scripts/sync-chain-icon-map-upstream.mjs`, `scripts/lib/chain-slug.mjs`, `src/lib/chainIconMap.ts` | keep |
| `docs/specs/hardcode-sync-gate-tiering.md` | Hardcode Sync 门禁分级 spec（退出码协议 / 双链 runner / 白名单逃生通道 / stale 升级；含场景矩阵与验证证据） | 2026-09-24 | Canonical | `scripts/hardcode-chain-runner.mjs`, `scripts/check-*-upstream.mjs`, `.github/workflows/hardcode-sync.yml` | keep |
| `docs/specs/aav-1298-openapi-sync-dev-convergence.md` | openapi-sync 收敛 spec（bot PR dev-only 路由 / schedule 安全网 / codegen patcher 链；含场景矩阵与验证证据） | 2026-09-24 | Canonical | `.github/workflows/ci.yml`, `scripts/lib/patch-generated-schemas.mjs`, `package.json` | keep |
| `docs/archive/2026-09-24-hardcode-sync-resilience.md` | Hardcode Sync 韧性 + 三分支同步流程交接（AAV-1296/#629 事件复盘、bot PR 收敛决策与实施顺序） | 2026-09-24 | Historical archive | `docs/specs/hardcode-sync-gate-tiering.md`, `docs/specs/aav-1298-openapi-sync-dev-convergence.md` | keep |
| `docs/specs/e2e-wallet-connect-injected.md` | E2E 真实钱包连接测试 spec（mock EIP-1193 + EIP-6963；含场景矩阵与移动端弹窗发现） | 2026-09-05 | Canonical | `e2e/eip1193-mock.ts`, `e2e/wallet-connect-injected.spec.ts`, `docs/conventions/wallet-js-injection-testing.md` | keep |
| `docs/specs/aav-1282-mobile-connect-modal-rainbowkit-wallets.md` | 移动端 Connect 弹窗修复 spec（connectorsForWallets / rkDetails 契约 / FCP 不变量；含场景矩阵） | 2026-09-25 | Canonical | `src/lib/wagmi/config.ts`, `src/lib/wagmi/config.test.ts`, `playwright.config.ts` | keep |
| `docs/specs/aav-1280-offset-discovery-computability.md` | offset e2e discovery 对齐 UI 渲染门控 spec（谓词收紧 / 纯函数抽取 / dedup 语义；含场景矩阵） | 2026-09-26 | Canonical | `e2e/reserveDiscovery.ts`, `e2e/portfolio-cross-reserve-offset.desktop.spec.ts`, `e2e/portfolio-cross-reserve-offset.mobile.spec.ts`, `src/test/reserveDiscovery.test.ts` | keep |
| `docs/specs/aav-1305-v3-dataprovider-migration.md` | V3 仓位读取 DataProvider 迁移 spec（9 字段 ABI 布局 / positional tuple 解码 / 降级矩阵 / watch-reentry 加固；含场景矩阵与实测证据） | 2026-09-27 | Canonical | `src/lib/chainRegistry.ts`, `src/lib/userData/aaveV3UserClient.ts`, `src/hooks/useUserPositionsSdk.ts` | keep |
| `docs/specs/aav-1308-cross-asset-pairing-discovery.md` | cross-asset-pairing e2e discovery spec（纯函数抽离 / 两端可算性门 / supply+borrow room 与 LTV 额度门 / label 镜像与 cap=0 修正；含场景矩阵与验证证据） | 2026-09-28 | Canonical | `e2e/reserveDiscovery.ts`, `e2e/portfolio-cross-asset-pairing.helpers.ts`, `e2e/portfolio-cross-asset-pairing.desktop.spec.ts`, `e2e/portfolio-cross-asset-pairing.mobile.spec.ts`, `src/test/reserveDiscovery.test.ts` | keep |
| `docs/specs/aav-1310-rpc-rotation-exhaustion.md` | RPC 轮换耗尽语义分流 spec(RpcRotationExhaustedError / null 语义收紧 / errors 通道 / HF 降级;含场景矩阵与 review 闭环) | 2026-09-27 | Canonical | `src/lib/userData/rpcResilience.ts`, `src/lib/userData/aaveV3UserClient.ts`, `src/lib/userData/aaveV4UserClient.ts`, `src/hooks/useOnchainHealthFactor.ts` | keep |
| `docs/specs/aav-1321-scenario-input-modes-e2e.md` | 场景模拟交互链路 e2e 覆盖 spec（USD/Token 双模式 + 净借贷开关 + 展开子行；14 行场景矩阵；相对断言抗 staging 数据漂移；发现并登记 AAV-1322 桌面收起缺陷） | 2026-09-28 | Canonical | `e2e/scenario-input-modes.spec.ts` | keep |
| `docs/specs/aav-1320-ga4-csp-inline-scripts.md` | GA4 CSP 修复 spec（consent 内联块 sha256 放行 + GA origin + 构建期 hash 校验门；16 行场景矩阵；含运行时 probe 证据与双轴 review 闭环） | 2026-09-28 | Canonical | `vercel.json`, `scripts/check-csp-inline-scripts.mjs`, `scripts/lib/csp-inline-scripts.mjs` | keep |
| `docs/specs/aav-1311-onchain-fallback-decimals.md` | onchain fallback 非 18-dec USD 缩水修复 spec（rawToHuman 两段法 / amountWad 原生 raw 语义 / fixture 形态契约 / 量级 invariant；含场景矩阵与实测证据） | 2026-09-27 | Canonical | `src/lib/userData/userPositionMapper.ts`, `src/test/userPositionConsistency.test.ts` | keep |
| `docs/specs/e2e-hardcoded-market-name-guard.md` | e2e 选择器钉死链名的守卫 spec（词汇源 `chainIconMap` / 只判选择器行 / 候选列表与注释豁免 / allow 逃生阀 / 空词汇报错；12 行场景矩阵；含事故前文件正对照；并记录 42 处既存 `Parameters<typeof test>[0]['page']` 类型错未修） | 2026-09-30 | Canonical | `scripts/lib/e2e-market-name-literals.mjs`, `scripts/check-e2e-hardcoded-market-names.mjs`, `e2e/marketChips.ts`, `docs/conventions/e2e-testing-boundary.md` | keep |
| `docs/specs/e2e-parallel-port-isolation.md` | 本地 e2e webServer 端口按 run 动态分配 spec（固定 4173 × `reuseExistingServer` 的并发互断根因；CI 固定端口 / origin ≡ baseURL / 分配只算一次三条不变量；13 行场景矩阵，含 4173 被占位下的运行时证据与正对照） | 2026-09-29 | Canonical | `scripts/lib/e2e-port.mjs`, `scripts/e2e-port.test.mjs`, `playwright.config.ts`, `e2e/playwright.fields.config.ts` | keep |
| `docs/specs/aav-1329-faq-anchor-wait-strategy.md` | e2e 首步等待策略 spec（`networkidle` 等的是与页面无关的对象——`src/App.tsx` 模块级 prefetch；改锚页面自身产出 H1 + `h2#faq`；守卫随 `npm test` 生效、不新增 npm script/hook；13 行场景矩阵含注释剥离与 `//` 在字符串内的假阴性对照） | 2026-10-09 | Canonical | `e2e/defi-yield-tracker-faq-anchor.spec.ts`, `scripts/e2e-wait-strategy.test.mjs` | keep |
| `docs/specs/aav-1316-cross-asset-pairing-synthetic-payload.md` | cross-asset-pairing e2e synthetic 载荷变体 spec（提交修剪版真实 staging fixture + 注入后跑既有 discovery 选场景 + `page.route` 双拦 `/markets` 与 `/meta/side-data` 全 hermetic + baseline 零断言；14 行场景矩阵） | 2026-10-10 | Canonical | `e2e/portfolio-cross-asset-pairing.helpers.ts`, `e2e/portfolio-cross-asset-pairing.desktop.spec.ts`, `e2e/portfolio-cross-asset-pairing.mobile.spec.ts`, `e2e/crossAssetPairingStub.ts`, `e2e/fixtures/`, `src/test/crossAssetPairingStub.test.ts` | keep |
| `docs/specs/aav-1349-pre-push-e2e-browser-gate.md` | pre-push e2e 浏览器门 spec（缺 chromium ⇒ `exit 1` 而非静默 `exit 0`；`E2E_SKIP=1` 为唯一且默认关闭的 per-push 出口；`PLAYWRIGHT_BROWSERS_PATH=0` 与 shell-only 安装不误判；纯函数 + 真脚本子进程 13 例；10 行场景矩阵） | 2026-11-15 | Canonical | `scripts/pre-push-e2e.mjs`, `scripts/lib/e2e-browser-gate.mjs`, `scripts/pre-push-e2e.test.mjs`, `docs/conventions/e2e-testing-boundary.md` | keep |
| `docs/specs/aav-1319-e2e-static-gates.md` | e2e 静态门 spec（`eslint` 不再忽略 `e2e`；`tsconfig.e2e.json` 覆盖 `e2e/**` + 根 `playwright.config.ts`；`typecheck:e2e` 并入 `typecheck` 且 `ci:remote` 前置类型门；PR CI 在生成 icon manifests 后跑 typecheck；非 type-aware 基线 28 条存量按规则分类处置；12 行场景矩阵 E1–E12 含 e2e include 的 mutation 负控） | 2026-11-15 | Canonical | `tsconfig.e2e.json`, `package.json`, `eslint.config.js`, `.github/workflows/ci.yml`, `scripts/e2e-static-gate.test.mjs`, `AGENTS.md` | keep |
| `docs/specs/aav-1352-staging-discovery-fetch-outcome.md` | e2e staging discovery fetch outcome spec（`/markets` 失败与空数据在类型上可区分；2 次 × 30s 重试 + 成功/失败都缓存；数据缺口 skip vs 不可达 fail；`E2E_ALLOW_STAGING_UNREACHABLE=1` 唯一出口；失败落在 live 测试、不依赖 staging 数据的 stub 变体照常执行；29 行场景矩阵） | 2026-11-15 | Canonical | `e2e/stagingReservesFetch.ts`, `e2e/test-reserves.ts`, `src/test/stagingReservesFetch.test.ts`, `docs/conventions/e2e-testing-boundary.md` | keep |
| `docs/specs/aav-1318-offset-position-feasibility-gating.md` | offset e2e discovery 仓位可行性门 spec（offset 侧用 `usableForSimulatedPosition` 替换两道弱检查 / self-loop target 追加借入门 / cross-reserve target 侧不动 / O 系列 fixture 改真实 room 形态；13 行场景矩阵 O12–O24，含 staging 场景数 before/after 对照） | 2026-10-12 | Canonical | `e2e/reserveDiscovery.ts`, `src/test/reserveDiscovery.test.ts` | keep |
| `docs/specs/aav-1333-offset-ladder-dimensional-coherence.md` | offset e2e 阶梯与断言量纲自洽 spec（plan 单一 seam；期望比例含 responding/total 加权；cross 阶梯 0.25/0.5/1.5×gross、self-loop 保持 50k/100k/200k；synthetic cross 载荷 desktop+mobile 首次真实执行；28 行矩阵 L1–L28） | 2026-11-16 | Canonical | `e2e/reserveDiscovery.ts`, `e2e/portfolio-cross-reserve-offset.desktop.spec.ts`, `e2e/portfolio-cross-reserve-offset.mobile.spec.ts`, `e2e/crossReserveOffsetStub.ts`, `e2e/stubRoutes.ts` | keep |
| `docs/specs/aav-1317-portfolio-fill-row-scoping.md` | portfolio fill 行域定位 spec（三个 fill helper 按 `[data-reserve-id]` 行域 + 移动端 tab 切换；Add 流程同符号多候选无标签命中显式失败；discovery 解除同符号排除、自配对保留；同符号 stub Celo WETH→Base WETH（composite fixture + 筛选标准 + provenance）；12 行场景矩阵 B1–B12 含旧实现确定性红的取证） | 2026-11-16 | Canonical | `e2e/test-reserves.ts`, `e2e/reserveDiscovery.ts`, `e2e/crossAssetPairingStub.ts`, `e2e/fixtures/`, `e2e/portfolio-cross-asset-pairing.helpers.ts`, `e2e/portfolio-cross-asset-pairing.desktop.spec.ts`, `e2e/portfolio-cross-asset-pairing.mobile.spec.ts`, `e2e/portfolio-cross-reserve-offset.desktop.spec.ts`, `e2e/portfolio-cross-reserve-offset.mobile.spec.ts`, `src/test/reserveDiscovery.test.ts`, `src/test/crossAssetPairingStub.test.ts` | keep |
| `docs/specs/aav-1314-multicall-all-calls-failed.md` | onchain multicall 全失败语义 spec（成功判定 = call status + `result !== undefined`；V3 市场粒度 / V4 spoke 粒度 throw 进既有 `errors` → `failedSources`；部分失败保留成功仓位 + warn；account 失败只降级 summary；顺带修 V4 borrow-only 被 `!0n` 丢掉；20 行场景矩阵 M1–M20） | 2026-11-16 | Canonical | `src/lib/userData/multicallFailure.ts`, `src/lib/userData/aaveV3UserClient.ts`, `src/lib/userData/aaveV4UserClient.ts`, `src/lib/userData/fallbackPositions.ts` | keep |
| `docs/specs/aav-1387-rpc-read-rotation.md` | RPC 读层轮换 spec（`readWithRpcRotation`：`allCallsFailed` 或 attempt 抛错 ⇒ 换下一个 URL；耗尽返回最后一次结果供 `MulticallAllCallsFailedError`，value 优先于 transport error；session 级降级缓存 + 端到端反自锁重试；探活成功不清降级；18 行矩阵 M1–M18） | 2026-11-16 | Canonical | `src/lib/userData/rpcHealth.ts`, `src/lib/userData/rpcResilience.ts`, `src/lib/userData/rpcRead.ts`, `src/lib/userData/aaveV3UserClient.ts`, `src/lib/userData/aaveV4UserClient.ts` | keep |
| `docs/specs/aav-1313-chain-rpc-session-sharing.md` | onchain 仓位路径按 chainId 共享 RPC 读会话 spec（`RpcClientPool`：acquire 单飞探活 / adopt 复用胜出端点 / release 在整批失败或抛错时丢弃端点 / 耗尽缓存；V3 多 market、V4 多 spoke、V3+V4 一次同步共池；V3 errors 按 chainId 去重、V4 保留 spoke 级；16 行矩阵 S1–S16 + live 探针 1 次 `createPublicClient`） | 2026-11-17 | Canonical | `src/lib/userData/rpcResilience.ts`, `src/lib/userData/rpcRead.ts`, `src/lib/userData/aaveV3UserClient.ts`, `src/lib/userData/aaveV4UserClient.ts`, `src/lib/userData/fallbackPositions.ts` | keep |
| `docs/specs/aav-1315-wallet-partial-ui-notice.md` | 钱包 partial 降级 UI 提示 spec（hook `failedSources` → `Index` → `ReservesTable` → `PortfolioPanel`；`success` + 非空失败集才渲染，避免与 error 红字叠加；组件级真浏览器 390/1280 双视口证据；12 行矩阵 M1–M12） | 2026-11-16 | Canonical | `src/hooks/useUserPositionsSdk.ts`, `src/components/dashboard/PortfolioPanel.tsx`, `src/components/dashboard/ReservesTable.tsx`, `src/pages/Index.tsx` | keep |
| `docs/specs/aav-1393-wallet-sync-notice-copy.md` | 钱包降级提示文案/语义修正 spec（内部标签不外露、fallback-only 不误报、日志与提示同源；W1–W7 + P1/P2/P3/P3b/P4–P7；390/834/1440 三视口 + 三条负控） | 2026-11-16 | Canonical | `src/lib/userData/walletSyncNotice.ts`, `src/lib/userData/failureLabels.ts`, `src/components/dashboard/PortfolioPanel.tsx` | keep |
| `docs/specs/aav-1395-e2e-oracle-hardening-and-platform-split.md` | AAV-1333 复核跟进 spec（严格 incentive 读取：缺 cell 只在零档放行；self-loop capacity 改 borrow room 并订正矩阵 L6–L14；points 混合组排除 O23–O24；stub 注入 weight 0.5 S2/S2b/S3；13 个 e2e 文件拆为 16 + 3 helper、`testIgnore` 路由、非平台 skip 保留；R1–R6 + O + S + L + B + C 矩阵） | 2026-11-17 | Canonical | `e2e/incentiveReading.ts`, `e2e/test-reserves.ts`, `e2e/reserveDiscovery.ts`, `e2e/crossReserveOffsetStub.ts`, `e2e/portfolio-cross-reserve-offset.*`, `e2e/portfolio-incentive-calculation.*`, `e2e/segmented-toggle.*`, `playwright.config.ts`, `scripts/e2e-static-gate.test.mjs`, `src/test/incentiveReading.test.ts`, `src/test/reserveDiscovery.test.ts`, `src/test/crossReserveOffsetStub.test.ts` | keep |
| `docs/specs/aav-1399-emode-borrow-capacity.md` | 前端 eMode Borrow capacity spec（`getUserEMode` 按 V3 pool 批量 multicall + `/meta/e-mode/{marketKey}` 类别匹配；effective LTV/LT 只作用 `computeLtvClamping` 与 `computeHealthFactors`；非成员=0；category 0 零请求；400/404/503 回退 base + `eModeFallback` 提示；26 行矩阵 E1–E26） | 2026-11-17 | Canonical | `src/lib/userData/eMode.ts`, `src/lib/userData/onchainEMode.ts`, `src/hooks/useEModeOverrides.ts`, `src/lib/portfolioSimulator.ts`, `src/components/dashboard/PortfolioSummaryBar.tsx` | keep |
| `docs/specs/aav-1334-remove-dead-generate-snapshots-job.md` | 删除 dispatch-only `generate-snapshots` 死 job spec（被引用 visual spec 已删除；守卫扫描全部 workflow 的 Playwright 显式路径并禁止 `--update-snapshots`；14 行矩阵 S1–S14） | 2026-11-16 | Canonical | `.github/workflows/ci.yml`, `scripts/lib/workflow-playwright-specs.mjs`, `scripts/ci-workflow-spec-references.test.mjs`, `docs/conventions/e2e-testing-boundary.md` | keep |
| `docs/specs/aav-1356-v4-spoke-address-key.md` | V4 onchain fallback spoke join key spec（名字→地址：`toV4SpokeKey` 归一小写地址、生产者改读 `reserveId` 的 spoke 段、消费方按地址查询；17 行场景矩阵 V1–V17 含跨模块 invariant 与 mutation 证据；生产数据 before/after = 0/21 → 21/21；curated module union 由后续 spec 交付） | 2026-11-12 | Canonical | `src/lib/reserveKey.ts`, `src/lib/deriveOnchainConfig.ts`, `src/lib/userData/aaveV4UserClient.ts`, `src/test/userPositionConsistency.test.ts` | keep |
| `docs/specs/aav-1356-v4-module-union.md` | V4 地址簿 module union spec（每链合并 base + curated module、按地址去重、同名不同址用 `<module>:<rawKey>` 消歧、hubs 一并 union、地址簿 4.76.1 → 4.77.6 补 `PAXG_PAXOS_ESPOKE`；20 行场景矩阵 U1–U20；chain 1 17/17、全链 25/25；fallback 13/244 → 17/296） | 2026-11-16 | Canonical | `src/lib/userData/aaveV4UserClient.ts`, `src/lib/userData/aaveV4UserClient.test.ts`, `src/test/userPositionConsistency.test.ts`, `src/lib/reserveKey.ts`, `package.json` | keep |
| `docs/specs/aav-1362-release-age-override-hint.md` | release-age 门禁覆盖提示 spec（错误提示不得承诺不存在的 workflow_dispatch input；共享 `formatReleaseAgeOverrideHint` + 脚本/SECURITY.md/workflow 契约测试；8 行场景矩阵；S8 已由 11-16 run 判定为「失败原因与发布年龄无关」，但该 run 因 hook 阻断而红，转由姊妹 spec 收口） | 2026-11-15 | Canonical | `scripts/check-dep-release-age.mjs`, `scripts/lib/dep-release-age-parse.mjs`, `scripts/lib/dep-release-age-parse.d.mts`, `src/test/depReleaseAge.test.ts` | keep |
| `docs/specs/aav-1362-hardcode-sync-hook-bypass.md` | Hardcode Sync 机器人推送 spec（`Create PR when hardcode changed` 的 commit/push 会跑 `.husky/pre-push`；runner 无 Playwright 浏览器 ⇒ AAV-1349 的 e2e 门硬阻断，run 43870754983 为红侧基线；修法＝该 step 加 `HUSKY: '0'`，守卫测试钉住；8 行矩阵 S1–S8） | 2026-11-17 | Canonical | `.github/workflows/hardcode-sync.yml`, `scripts/hardcode-sync-hook-guard.test.mjs` | keep |
| `docs/specs/aav-1391-openapi-sync-hook-bypass.md` | 机器人 PR 推送统一 spec（openapi-sync 的 `Create spec sync PR` 的 push 触发 `.husky/pre-push`，runner 无 Playwright 浏览器 ⇒ AAV-1349 门硬阻断；AAV-1390 连红 11 次的根因；三处同族 step 统一 `HUSKY: '0'` + `scripts/bot-push-hook-guard.test.mjs` 枚举全部 `create-pull-request` step；14 行矩阵 S1–S14） | 2026-11-17 | Canonical | `.github/workflows/ci.yml`, `.github/workflows/token-icon-sync.yml`, `.github/workflows/ci-auto-remediation.yml`, `scripts/bot-push-hook-guard.test.mjs` | keep |
| `docs/specs/architecture-guard-fs-walk-cost.md` | architecture-guard FS 遍历成本 spec（每用例重走 src 树 + 重读全部文件的根因；globTsFiles/readFile 记忆化 + 模块级 components/lib/hooks 清单；8 行场景矩阵；含改前必红的缓存契约断言；不放宽 testTimeout） | 2026-10-09 | Canonical | `src/test/architecture-guard.test.ts` | keep |
| `docs/specs/chainlink-arc-v4-chain-onboarding.md` | Chainlink Arc (chainId 5042) 新链接入 spec（registry/icon map/manifest 四件套原子性；含场景矩阵与实测取证方法；2026-09-27 slug 对齐上游 `arc` + 官方 logo 替换占位图） | 2026-09-16 | Canonical | `src/lib/chainIconMap.ts`, `scripts/check-chain-icon-map-upstream.mjs`, `public/icons/networks/arc.svg` | keep |
| `docs/archive/2026-08-29-fcp-optimization-handoff.md` | FCP 优化 session 交接（已被 spec 取代） | 2026-08-29 | Historical archive | `docs/specs/fcp-optimization.md` | keep |
| `docs/archive/2026-08-29-fcp-chunk-defer-tickets.md` | FCP Round 2 tickets（全部完成） | 2026-08-29 | Historical archive | `docs/specs/fcp-optimization.md` | keep |
| `docs/archive/2026-09-06-scenario-pin-reorder-window-fix.md` | Scenario-pin e2e flake 根因与修复（pagination reorder-grow；含场景矩阵与验证证据） | 2026-09-06 | Historical archive | `src/hooks/reserves-table/useReservesPagination.ts`, `docs/design/frontend-interaction-guardrails.md` | keep |
| `docs/archive/merit-base-anchor-vs-last-round-staging.md` | Historical empirical snapshot | 2026-03-31 | Historical supporting note | `docs/rate-calculation.md` | keep |
| `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md` | Upstream sync and hardcode map | 2026-04-04 | Canonical | none significant | keep |
| `docs/ci-remediation-automation.md` | CI auto-remediation workflow | 2026-03-15 | Canonical | none significant | keep |
| `docs/archive/2026-04-02-mobile-reserve-ios-connector-plan.md` | Mobile reserve iOS connector design plan | 2026-04-09 | Historical archive | `docs/design/mobile-reserve-card-ascii-layout.md` | keep |
| `docs/archive/2026-04-08-campaign-apr-reconciliation.md` | Campaign APR reconciliation analysis | 2026-04-09 | Historical archive | `scripts/reconcile-campaign-apr.mjs` | keep |
| `docs/archive/2026-04-08-campaign-apr-reconciliation-script.md` | Campaign APR reconciliation script notes | 2026-04-09 | Historical archive | `scripts/reconcile-campaign-apr.mjs` | keep |
| `docs/archive/2026-04-09-reserve-id-canonical-key.md` | Reserve key canonicalization note | 2026-04-09 | Supporting implementation note | `src/lib/reserveKey.ts`, `src/hooks/useRateSimulation.ts` | keep |
| `docs/archive/frontend-redundancy-review-2026-04-06.md` | Frontend redundancy review | 2026-04-06 | Historical archive | none significant | keep |
| `docs/design/DESIGN.md` | Project-specific design defaults | 2026-04-26 | Canonical | `docs/design/DESIGN-SYSTEM-REFERENCE.md` | keep |
| `docs/design/DESIGN-SYSTEM-REFERENCE.md` | Reusable design/interaction rules | 2026-04-26 | Canonical | old design split docs | keep |
| `docs/design/frontend-interaction-guardrails.md` | Product-critical normative interaction rules | 2026-04-28 | Canonical | parts of design docs | keep |
| `docs/design/mobile-reserve-card-ascii-layout.md` | Mobile reserve card ASCII reference | 2026-04-26 | Canonical | appendix references in DSR | keep |
| `docs/design/README.md` | Design docs entry/index page | 2026-04-16 | Entry stub | `docs/design/DESIGN-SYSTEM-REFERENCE.md`, root `DESIGN.md`, `docs/design/DESIGN.md` | keep |
| `docs/conventions/vercel-deployment-smoke-test.md` | Vercel smoke test workflow, deploy SHA meta, rollback ref rules | 2026-04-05 | Canonical | `.github/workflows/deployment-smoke-test.yml` | keep |
| `docs/conventions/*` | API/CI/process conventions | 2026-03-16..2026-04-30 | Canonical set | small references in README/AGENTS | keep |
| `docs/conventions/e2e-testing-boundary.md` | E2E boundary: what belongs in Playwright vs Vitest | 2026-08-30 | Canonical | `docs/specs/e2e-suite-boundary-cleanup.md`, `AGENTS.md` E2E skip rule | keep |

## Migration Fit (Transferability)

Documents classified by portability to other projects.

### High (directly reusable)

- `docs/conventions/api-contract-checklist.md` — Generic API breaking-change checklist
- `docs/conventions/peer-dependency-guard.md` — Generic React version-safety pattern
- `docs/conventions/merge-summary.md` — Project-agnostic merge hygiene

### Medium (reusable with context adaptation)

- `docs/conventions/api-base-urls.md` — Multi-env app URL conventions; replace hostnames
- `docs/conventions/vercel-deployment-smoke-test.md` — Transferable if deploying on Vercel
- `docs/conventions/frontend-regression-checklist.md` — UI refactor checklist; adapt component names
- `docs/rate-calculation.md` — Rate simulation reference; adapt formulas to new domain
- `docs/frontend-data-loading-matrix.md` — Data loading architecture; adapt endpoints

### Low (project/platform specific)

- `docs/conventions/ci-live-schema-cloudflare.md` — Cloudflare-specific edge mitigation
- `docs/design/DESIGN.md` — Project-specific design defaults
- `docs/design/frontend-interaction-guardrails.md` — Product-specific interaction rules
- `docs/design/mobile-reserve-card-ascii-layout.md` — Product-specific mobile layout

## Redirect Rule

If a topic is historical or split-legacy, keep a short pointer page and move all normative content to one canonical file only.

## Cross-reference hygiene

- Prefer **existing** headings: `docs/design/DESIGN.md` is a short project profile (§1–§4 only). Do not cite phantom sections (e.g. old "§4.4 Tooltip").
- **Tooltip layout (multi-paragraph + Radix density):** canonical detail in `docs/design/frontend-interaction-guardrails.md` § A · Tooltip/Overlay; cursor/delay summary in `docs/design/DESIGN-SYSTEM-REFERENCE.md` §6.
