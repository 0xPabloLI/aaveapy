# Issue Roadmap — Open Issues 优先级与执行状态

GitHub Issues + Linear Issues 的优先级排序、状态追踪与依赖关系。每次 triage 后更新。

> **排序规则：GitHub issue 始终排在 Roadmap 最前面。**

> **交付细节的唯一权威源是 issue 评论**（`gh issue view <N> --comments` / Linear issue comments）。本文件的盘点条目只作对话式上下文，不覆写 tracker。

## 当前状态

> **Last inventory**: 2026-11-17（R24：二次全量对账，真实 open **65 张** = In Progress 2 / Ready for agent 9 / Needs Info 7 / Todo 13 / Backlog 34，比首轮多 23 张。根因是 Linear 列表虚拟化——`read_all` 只拿视口行，`style.zoom='0.4'` 后 Active 18→32、Backlog 19→38；补 Needs Info AAV-891/892、Todo 11 张、Backlog 12 张，AAV-333/364 由 Needs Info 移回 Todo。**frontier：AAV-1356 余项**；AAV-1362 已于 2026-11-17 收口（dispatch `44026720906` 绿 + PR #850）；**AAV-1347 + AAV-1293 已于 2026-11-17 交付 → open 63 / Todo 12 / Backlog 33**。)

> **历史流水**：24 轮盘点记录（2026-10-01 起）与 22 行早期已闭票 → [`archive/2026-11-17-roadmap-inventory-history.md`](./archive/2026-11-17-roadmap-inventory-history.md)。

## 方案审查结论与关键建议速览

| Issue | 现状 / 方案痛点 | 审查建议与方案修正 | 调整动作 |
| --- | --- | --- | --- |
| **AAV-1311** | `userPositionMapper.ts` 中 `wadToHuman` 恒除以 $10^{18}$ 忽略 `meta.decimals`，6-dec 代币（USDT/USDC）在 onchain fallback 路径下 USD 缩小 $10^{12}$ 倍（测试钱包 $1044 显示为 $0.000001） | **最小闭环修复（已交付）**：`rawToHuman` 按 `meta.decimals` 两段法换算；`amountWad` 文档化原生 raw 语义；fixture 形态修正 + 一致性测试量级 invariant。Live 实测 Celo USD₮ $1044.57 正确呈现（`084131f5`）。 | Done（2026-09-27 关闭，交付记录见 Linear） |
| **AAV-1310** | `createClientWithRpcRotation` 轮换超时耗尽返回 `null` 时，`getV3UserPositionsOnChain` 静默返回空成功 `{ positions: [], accountSummary: null }`，导致 `failedSources` 为空且 UI 呈现假 $0 | **语义分流与显式报错**：区分 `rpcUrls.length === 0`（未配置 RPC，平滑降级）与轮换耗尽（基础设施超时/故障，显式抛错）。使 `getV3UserPositionsMultiChain` 捕获至 `errors` 并推入 `failedSources`，让 UI 准确提示降级。 | 标为 ready-for-agent，维持 High |
| **AAV-1318** | `discoverOffsetScenarios` 只有可算性门，仓位可行性停在 `borrowDisabled` + `suppliable > 0`：offset 侧不查借出空间与 LTV 融资额度，self-loop 的 target 侧（借入发生在它自己身上）完全无门 ⇒ 被钳零的借入让相对断言在未变化的数值上通过 | **复用 AAV-1308 底座而非新写逻辑（已交付）**：offset 侧两道弱检查→`usableForSimulatedPosition(r,'borrow')`；self-loop target 追加同谓词；cross-reserve target 侧不动。O12–O22 单测锚定；staging 4→4（结构性修复，运行时只证未破坏）；e2e 8 passed/8 skipped。已知限制：地板 $5,000 对 cross-reserve 梯级（最大 $2,000）偏严；self-loop $5k–$40k 中间带仍会挂比例断言 | Done（2026-10-12 关闭，`d9809781` 未 push；follow-up **AAV-1333** 记录 runner 梯级与 `0.4` 阈值的量纲不自洽） |
| **AAV-1308** | `portfolio-cross-asset-pairing.spec.ts` 裸加 `campaignApr`，未镜像 UI 侧时间窗（排除 open-ended）、白名单与 AMOUNT 变体门控（同 AAV-1280 病因） | **纯函数抽离与门控对齐（已交付）**：`discoverCrossAssetPairingScenarios` 入 `e2e/reserveDiscovery.ts`，两端复用 `isComputableMerklCampaign`；追加仓位可行性门（supply/borrow room ≥ $5000 + LTV 融资额度）与自配对/同 symbol 排除；review 期另修 label 镜像与 `cap=0` 语义两处既有失真。P1–P22 矩阵 54 条单测锚定。 | Done（2026-09-28 关闭，交付记录见 Linear） |
| **AAV-1307** | 本地 `pre-push` 门禁中 `reserves-table-scenario-pin.spec.ts` 8 步时序用例因双 worker 并发高负载耗时 56s 超时 | **Hook 层隔离**：Commit `fd3f5fcf0cb1` 已在 `scripts/pre-push-e2e.mjs` 中通过 `GREP_INVERT` 排除该已在 CI skip 的时序用例，达成验收标准。 | Done（2026-09-27 关闭，交付记录含 A/B 归因与如实记账） |
| **AAV-1306** | GitHub #678，`lovable` 分支 CI 因 `@base-org/account` 与 `@wagmi/connectors` 的 peer-dep 冲突飘红 | **依赖对齐与 CI 恢复**：Commit `4dcd31fc` 已通过 override 修复冲突，最新 CI workflow 全部恢复绿灯。 | Done（2026-09-27 关闭；GitHub #678 已 closed） |
| **AAV-1297** | 依赖外部 API 推导 slug 存在 CI 网络抖动风险 | **四级兜底推导**：Overrides 表 → AddressBook 模块名正则 → 外部 chainid.network（带超时）→ 通用 `chain-${id}`。配套标准化占位 SVG 与 manifest 自动构建。 | 设为 AAV-1296 前置 |
| **AAV-1296** | 「全或无」门禁导致一旦有缺项整条 sync 瘫痪 | **门禁拆分 + 降级通道**：verify 拆为 critical（报错阻塞）与 advisory（补占位/警告但允许建 PR）。补 `pending-chain-ids.json` 逃生通道。 | 依赖 AAV-1297 产物 |
| **AAV-1298** | openapi-sync 尝试对 lovable 分支建 PR 失败 | **收敛 Bot PR 目标**：依据三分支规范，所有自动同步 bot 统一只对 `dev` 建 PR，禁止直打 lovable；排查 codegen 语法与 PAT 权限。 | 目标分支收敛至 dev |
| **AAV-1299** | E2E 依赖 staging 动态数据致断言超时 | **预检健壮性过滤**：`findIncentiveReserve()` 必须预检 valid APR > 0 且 base rate 正常，排除未定价/0 APR 活动；APR/APY 切换增加计算防抖完成判定。 | 强化断言前置条件 |
| **AAV-1279** | 实际代码已合入三分支（`19b102a1`），状态滞留 | **流转结案**：代码与架构守卫均已落地，移除阻塞标记；剩余生产环境 CDN 配置单独跟进。 | 流转至 Done / 归档 |
| **AAV-1282** | 移动端 RainbowKit 未配 wallets 弹窗空白 | **隔离钱包 Chunk 注入**：在 `WalletProviders.tsx` 动态配置 wallets，严格确保不被提升至首屏 entry bundle，防止 FCP 回归。 | 确认方案，保持 High |
| **AAV-1274** | 跨前后端大范围字段重命名，高风险低收益 | **降级并前端内聚适配**：不进行跨仓库 breaking change，前端仅在输入适配层做兼容别名 `distributionType ?? campaignType`。 | 优先级从 High 降至 Low |
| **AAV-1292** | 3 个 schedule 工作流在 default 分支缺失不跑 | **最小工作流抽离**：不等待大版本晋升，将无依赖的 `uptime-alert.yml` 先行独立抽离并合并进 main 分支，优先恢复全天候存活监控。 | 拆出独立探活 PR |
| **AAV-1275** | AMOUNT 变体 APR 单位非百分比，易误导用户 | **复合展示策略（Option A+）**：主表格无法换算 USD 年化时展示 `—` 且不计入净 APR；Tooltip 完整展示每日代币数与固定发放规则说明。 | 明确产品决策方案 |
| **AAV-1301** | @eslint/js 10 peer 强依赖 eslint 10，但 react-hooks / import 等插件尚未适配 | **暂缓升级**：当前 React 生态关键插件（eslint-plugin-react-hooks）peer 仍锁 v9，强升 overrides 引发 CI 脆弱性且业务收益低。待上游发布后跟进。 | Low / Backlog 维持。裁定被破：#653 于 2026-09-29 合入使 dev 二次变红（首次为 `7e6b46be`→`0e85f4d7`），已由 **#697** 回退 + 加 dependabot ignore + peer 冲突 workflow 改报告制 |
| **AAV-1302** | release-drafter v7 在 PR 阶段属假绿灯；autolabeler 拆分且弃用旧 category 配置 | **配置模型迁移 + 拆分契约适配**：重构 `.github/release-drafter.yml` 消除弃用警告；按 v7 规范适配 autolabeler 逻辑，保证 draft release 分组准确。 | 维持 Low / Todo，排期实施并闭环 #656 |
| **AAV-1303** | Merit 后端已下线导致 openapi-sync 自动生成与前端代码引用脱节（TS2551/TS2339） | **前端 Merit 退役清理**：移除契约 wrapper 与 types.ts 中 Merit 残留引用；统一 types.ts 维护方式（自动化或 header 文档对齐），恢复 openapi-sync CI 绿灯。 | Todo（2026-09-28 从 Backlog 领出，已入当前 cycle；「待协同部署」前置已成熟，代码未动） |
| **AAV-1304** | PortfolioSummaryBar：supply-only 仓位 Lowest HF 空态无上下文 + Advanced 标签字重不一致 | **空态友好化 + 样式归一（已交付 2026-11-15）**：徽章改三态（computed/no-debt/unknown，`getLowestHfBadgeState` 纯函数；有债但不可算绝不误报 no debt）；空态 `—` 后跟 muted `no debt`（无 hover 依赖）；Advanced 三段组标签抽 `SECTION_HEADER_CLASS`，数值 bold、状态文案 medium。spec `docs/specs/aav-1304-portfolio-summary-empty-state.md`（9 行矩阵 E1–E9） | Done（grill 三决策用户拍板；发现 `ltv=0` 数据缺口另开 **AAV-1380**） |
| **AAV-1305** | 生产钱包仓位导入失败双层根因（SDK GraphQL 网络不可达 + MULTICALL3 常量缺字符 + Pool 移除 getUserReserveData） | **双阶段分治修复**：第一阶段已修正 `MULTICALL3_ADDRESS` 常量（`1061bd14`）打通 viem 校验；第二阶段已将 `getV3UserPositionsOnChain` 目标由 `Pool` 迁移至 `AAVE_PROTOCOL_DATA_PROVIDER`（`2d6e70fb`），watch-reentry 噪音修复（`5f928681`）。 | 已交付（2026-09-27，双阶段完成，见 Linear 交付记录） |
| **AAV-1280** | 测试侧 discovery 只累加 raw `campaignApr`，未镜像 UI 渲染门控（时间窗/白名单/AMOUNT 变体），选中 UI 渲染 `—` 的 reserve 致 baseline 断言失败 | **测试侧加固**：`isComputableMerklCampaign` 收紧（缺失边界/date-only 规范化/whitelistOnly 排除）+ `discoverOffsetScenarios` 纯函数抽取 + 单测锚定每条门控。UI 侧静态审查三道门均为设计行为，无缺口。 | 已交付（测试侧）；原始触发数据已消失不复现 |

---

## GitHub Issues（最前）

GitHub 上创建的 issue，双向链接到 Linear，按用户规则始终排最前。

| GitHub # | Linear | Priority | State | Title | Labels |
| --- | --- | --- | --- | --- | --- |
| #678 | AAV-1306 | **None** | Done（2026-09-27 关闭；`4dcd31fc` 修复 @base-org/account peer-dep，最新 lovable CI 全绿） | 🔥 Lovable CI failure: e2e-desktop (2/2), socket-firewall, peer-dep-check... | bug, ci-failure-lovable, repo:frontend |
| #668 | AAV-1297 | **Urgent** | Done（2026-09-24 交付，见 Linear 交付记录） | [Improvement] chainIconMap 自动同步：从 registry 自动生成占位条目 | enhancement, hardcode |
| #667 | AAV-1296 | **Urgent** | Done（2026-09-24 交付，见 Linear 交付记录） | [Improvement] Hardcode Sync 韧性：解除「全或无」门禁单点故障 | enhancement, hardcode, drift |
| #671 | AAV-1299 | **High** | Done（2026-09-24 交付，见 Linear 交付记录） | [Bug] e2e flaky: portfolio-incentive-calculation supply total 超时显示占位符 | bug |
| #670 | AAV-1298 | **High** | Done（2026-09-24 交付，见 Linear 交付记录） | 🔥 Lovable CI failure: openapi-sync | bug, ci-failure-lovable |

---

## Active Linear Issues

非 GitHub 来源的 Linear issue，按 **Linear 状态**分组；本区只列 open（Done / Duplicate / Canceled 一律不进本区）。
盘点时点 2026-11-17（第二次全量核对），逐票与 Linear 核对；本次新补入的行以 `•` 标记。共 **65 张 open** = In Progress 2 + Ready for agent 9 + Needs Info 7 + Todo 13 + Backlog 34。

### In Progress（2）

| Linear | Priority | Title |
| --- | --- | --- |
| AAV-1362 | High | Done（三阶段根因全部收口：移除 proactive bump、release-age 提示改真出口、机器人推送绕过本地 hook；dispatch run 44026720906 绿 + PR #850） | Hardcode Sync 结构性自相矛盾：`npm update` 刻意拉 day-zero latest，又被 `check-dep-release-age` 的 7 天冷却期拦下 ⇒ 该 job 自 2026-10-09 起全红。主修复按「移除 proactive bump，bump 归 Renovate」落地（`8830d062`，随 #835 进入 main `b9c30868`）；`workflow_dispatch` 三分支实测全绿（run 43150776651），各开出一笔 bot PR（#823/#824/#825）。**2026-11-12 订正**：本行原标 Done 是错的，Linear 实为 In Progress——票面验收条件 2「schedule 触发能绿」与 3「错误文案与 workflow 实际能力一致」当时均未完成。**2026-11-15 路线 A 收口**：用户拍板不新增 dispatch input；`check-dep-release-age.mjs` 与 `SECURITY.md` 的文案改成「在运行门禁的环境里显式设 `MIN_RELEASE_AGE_DAYS=0` + PR 记录根因 + 无默认 workflow_dispatch input」，并加脚本/文档/workflow 契约测试（commits `5e057bbb` + `7500586b`）；已推送 `dev`（`eeca95d7..7500586b`）。11-14 的 schedule 仍用旧 main `524a9de7`。**唯一待验证**：2026-11-16 04:20 UTC 的 schedule 运行（用户选择不手动 dispatch）；该 run 读 `main` `b9c30868`，验证主修复，文案在 `dev`、随下一次标准 `dev → main` 推广上线；绿后可关票。**2026-11-17 第三种根因**：11-16 的 run `43870754983` 在 11-15 绿过之后又红，`hardcode-sync (dev)` 的 step 10 死在 `peter-evans/create-pull-request` 的 `git push` 触发的 `.husky/pre-push` （`ci:remote` + e2e 门；runner 无 Playwright chromium，AAV-1349 起硬阻断）⇒ 机器人推送被开发机门禁拦住。修法只给该 step 加 `HUSKY: '0'`（+ 注释），`.husky/pre-push` 与其他 workflow 不动；新增 `scripts/hardcode-sync-hook-guard.test.mjs`，spec `docs/specs/aav-1362-hardcode-sync-hook-bypass.md`。**待验证**：一次真实 dispatch 或下一次 schedule 的 `hardcode-sync (dev)`。 |
| AAV-1292 | Medium | railway → main 正式晋升：三个定时工作流从未运行 |

### Ready for agent（9）

| Linear | Priority | Title |
| --- | --- | --- |
| AAV-843 | Medium | • Brevis per-user API 接入：个人 Dashboard + Claim 功能 |
| AAV-726 | Medium | • Refactor: flatten monorepo to single-package backend |
| AAV-781 | Medium | • Unify endDate semantics and data directory paths（Merit cache） |
| AAV-782 | — | • Distinguish「extraction failed」vs「成功但非目标激励类型」（Merit cache） |
| AAV-449 | — | • [Backend] 移除 spokeName 字段（与 marketName 语义冗余） |
| AAV-517 | — | • [Tech Debt] onchain 查询 spokeAddress 从 reserveId 解析，替代 address-book 查询 |
| AAV-1227 | Low | • Spec: Inline Widget Embedding System for Article Pages |
| AAV-829 | Low | • Unify ~35 处地址相关 toLowerCase() → normalizeAddress() |
| AAV-830 | Low | • Migrate merit-api raw RPC fetch → ProviderPool |

### Needs Info（7）

| Linear | Priority | Title |
| --- | --- | --- |
| AAV-79 | — | • deficit 的全局数据（EPIC 子票） |
| AAV-387 | Low | • 对比前后端 API 字段，用不上的看是否可节省（子票 AAV-449 已拆出，1/4） |
| AAV-482 | — | • [前端] Risk Premium Simulation：RP 计算 + Simulation 集成 + UI |
| AAV-535 | Low | • V3/V4 存在多个 collateral 时的清算顺序 |
| AAV-751 | — | • 钱包下拉菜单与 token 跳转下拉字体不协调 |
| AAV-891 | — | • 官方 Interface repo 每次改动时让 LLM 比对是否需借鉴（如 Target total APR 支持） |
| AAV-892 | — | • Merkl 出现新 campaign type 时自动预警建 issue（AAV-329 子票） |

### Todo（12）

| Linear | Priority | Title |
| --- | --- | --- |
| AAV-364 | High | [EPIC] 市场宏观指标聚合 — market size / liquidity / utilization / 全局 deficit（8/14） |
| AAV-333 | Medium | V4 Risk Premium Simulation（per-user portfolio 级别） |
| AAV-135 | — | • [Docs] V4 SDK Embedded Rewards — Intentionally Skipped |
| AAV-248 | Low | • 推进全站无障碍校验、实施与规范建设（1/4） |
| AAV-329 | Low | • 建立自动告警 issue 管理 SOP（8/12） |
| AAV-512 | Low | • SEO：首次部署后到 GSC 提交所有 URL 收录（27 个） |
| AAV-534 | Low | • Future：addressBookRegistry 其他字段动态化（spokeKey、oracleAddress 等） |
| AAV-586 | Low | • [Follow-up] Prometheus counter for new chain RPC detection（AAV-329 子票） |
| AAV-587 | Low | • [Follow-up] 主动通知（Slack/Telegram）新链 RPC 检测（AAV-329 子票） |
| AAV-738 | Low | • Portfolio 模式下当前展开行始终置顶（同 Single simulation 的 sticky 行为） |
| AAV-760 | Low | • 判断哪些 reserve 可作质押 / 可做循环贷，一键最优配置需考虑 |
| AAV-1302 | Low | [CI] release-drafter v7 迁移：autolabeler action 拆分 + category 模型（GitHub #656） |

### Backlog（33）

| Linear | Priority | Title |
| --- | --- | --- |
| AAV-1367 | High | • security: 嵌套 zod 3.x 未覆盖 CVE-2023-54404（Dependabot #99） |
| AAV-1396 | High | • portfolio: LTV 钳制只作用于显示额，incentive / cross-reserve 仍按原始输入计算 |
| AAV-1394 | Medium | [后端] `/markets` 不暴露 eMode 抵押参数：eMode 用户的 Borrow capacity 被低估（AAV-1380 残余缺口）。API 只有 base LTV，而同一资产在 eMode 类别下更高（WETH base 81% vs ETH-correlated 93%）；USDC 在该市场 25 个类别 `canBeCollateral` 全 false。口径建议：按用户实际启用的 eMode 类别取数；验收含 payload 体积评估（441 × 25 类别是否裁剪）、`FIELD_UNITS`/序列化同步、V4 等价物定性、前端额度从 81%→93% 复验、文档同步 |
| AAV-1245 | Medium | • V4 RPC Fallback 架构优化：per-chain Multicall3 超批 + ltv/liquidationThreshold 补全 + V3/V4 统一 |
| AAV-1275 | Medium | DESIGN: AMOUNT variant campaign APR display strategy (product decision needed) |
| AAV-1327 | Medium | [CSP] Cloudflare **JavaScript detections（bot 检测）**自动注入的内联块被 `script-src` 拦 → 生产每条加载 1 条 console error。**建票时归因错了**（写成「Web Analytics beacon」）：真浏览器复现 + 逐 inline script 扫字面量证明被拦块含 `challenge-platform/scripts/jsd`、不含 beacon，且 Web Analytics 早已是 disabled（用户看板所见一致）。zone plan = Free ⇒ 按一手文档该检测「automatically enabled and cannot be disabled」；hash 也钉不住（`r`/`t` 每请求变，10-05 现场再验，Chrome 建议的 hash 与建票时不同）。详见票内更正 #2。建议：确认没有吃 bot score 的防火墙规则后，按「接受为已知噪音」关闭并附解释（我这份 token 读 zone settings 是 403/9109，需用户在 Dashboard 看） |
| AAV-1348 | Medium | • [Deps] zod 3 → 4 迁移被钱包 SDK 阻塞（osv GHSA-mrhx-c7xc-m3w5 已豁免到 2027-01-31） |
| AAV-1361 | Medium | • google-auth-library + googleapis 必须成对合并（冷却期 2026-11-16） |
| AAV-1370 | Medium | • chore(frontend): supplyIncentives/borrowIncentives 两种语义共存，需拍定删除或封口 |
| AAV-1375 | Medium | • SEO 后台已失效：Supabase 项目消失，需决定下线还是重建 |
| AAV-1354 | Low | [后端] TypeScript 7 升级被上游阻塞：`typescript-eslint` 全版本 peer 为 `>=4.8.4 <6.1.0`，且 TS 7 移除 `moduleResolution: "node"`（`TS5108` 硬错，命中 4 个 tsconfig）。已加 `renovate.json` 规则止住重复提案；TS 6.0.3 是可行中间站（仅 `TS5107` deprecate，可用 `ignoreDeprecations` 压掉） |
| AAV-1322 | Low | [桌面] 储备行展开模拟子行后再点同一行不收起（`handleToggleExpand` 语义是 toggle；dev + 生产 `d39ad25f` 双环境 5 列实测一致）— 由 AAV-1321 实施期发现 |
| AAV-1312 | Low | [Improvement] sync 第三数据源：MarketSwitcher V4_LINKS 外链 logo（V4-only 链官方图标自动化） |
| AAV-1274 | Low | RENAME: campaignType → distributionType (cross-repo API breaking change) *(降级：建议前端别名适配替代跨仓重命名)* |
| AAV-1271 | Low | 工具：Aave UI ↔ Backend API 对比工具 Phase 3 |
| AAV-1270 | Low | 后端：incentive_details 列级 NULL 命中率测试 + 决策 |
| AAV-1269 | Low | 后端：LOCF 查询实现（/api/markets/history 历史回放） |
| AAV-360 | Low | • 给 Megaeth 做个反色的 logo |
| AAV-365 | Low | • side-data endpoints 增加 deterministic ETag + 前端 If-None-Match 304 节流 |
| AAV-395 | Low | • 评估从 reserveId 提取数值以省下 API 字段，划不划算 |
| AAV-800 | Low | • PortfolioPanel 重复计算路径：统一 simulationsById 与 computeResultsFromGroups |
| AAV-900 | Low | • Pendle PT token targetTokenPrice：解析 3 个 campaign 的 underlying 资产价格 |
| AAV-1071 | Low | • Frontend + backend：向用户展示 hookType=17 HEALTH_FACTOR 排除条件 |
| AAV-1247 | Low | • Code quality: 自解释代码（JSDoc WHY 注释、TODO 清理、魔数） |
| AAV-1358 | Low | • Sentry v11 落地收尾：cool-down 未到（2026-11-12）+ v11 新增 mcp/queues 类目默认开启 |
| AAV-1364 | Low | • docs: `fallback-reference.md` 整篇停留在已删除的字段与 helper（totalVariableDebt / availableLiquidity / reserveSize…） |
| AAV-1368 | Low | • ci: smoke-test 轮询 curl 没重试，一次 TLS 抖动（exit 35）就把「宽容」的 job 打成红灯 |
| AAV-75 | — | • size 的变化、liquidity 的变化（EPIC 子票） |
| AAV-76 | — | • 对比 defillama 有没有这些内容（EPIC 子票） |
| AAV-91 | — | • reserve 未来 APY 预测（EPIC 子票） |
| AAV-127 | — | • 要有一个总的看 liquidity 的页面（per market，EPIC 子票） |
| AAV-262 | — | • 增加 TVL 历史（EPIC 子票） |
| AAV-1388 | Low | • [CI] Railway `deploymentRollback` 返回 true 但回滚部署 10–30 分钟不对外服务（4/4 实测），自动恢复已改走 `deploymentRedeploy` |

---

## Backlog Projects

Linear project（state=backlog），未排入具体 issue 执行序列。

| Project | Status |
| --- | --- |
| Incentive Source Upper-Layer Unification | backlog |
| 全站无障碍校验、实施与规范建设 | backlog |
| ABI Cleanup & Address Book Auto-Upgrade | backlog |
| 增加 market 的 overview | backlog |
| 增加连接钱包功能 | backlog |
| twitter operation | backlog |

---

## Recently Completed

近三轮（2026-11-12 起）交付的 issue；更早的 22 行已闭票见 [archive](./archive/2026-11-17-roadmap-inventory-history.md)「已闭票行（2026-09 至 10-12）」。

| Linear | Title | Closed |
| --- | --- | --- |
| AAV-1293 | [后端] `/api/seo/*` 不进公开 OpenAPI（判断题收口）：决策理由落 `generate-openapi.ts` 注释（admin 面 / `X-Admin-Token` / 经 Supabase `seo-proxy` / `seo-api-documentation.md` 独立文档 / 非公开契约），2 条守卫（paths 恰好 `/markets` + `/meta/side-data`、注释锚点存在）+ `api-documentation.md` 边界句；mutation 加 `/api/seo/status`、删注释各自打红；生成物逐字节不变；run `44058368427` 四门绿 | 2026-11-17 |
| AAV-1347 | [Chore] Prettier 未纳入 CI 门禁：`check:prettier` 置于 `check:quality` 首位 + CI `quality-gates` 新增 `Prettier format check (tracked files)`；tracked symlink 跳过、`.prettierignore` 保留生成物豁免、25 条守卫（真实 git + 真实 prettier 子进程）；run `44051705352` 四门绿且新 step 在干净 checkout 首跑通过；本地 463 受检 / 2 skipped、负控 rc 1 点名、干净 clone rc 0 | 2026-11-17 |
| AAV-1391 | [CI] 机器人 PR 推送不得运行开发者本地 hook：openapi-sync 由并行提交 `8fe76047` 落地并经 run `44040361980` 开出 PR #852 验证；本票补齐 `token-icon-sync` / `ci-auto-remediation` 两处同族 step（`HUSKY: '0'`）+ `scripts/bot-push-hook-guard.test.mjs`（T1–T6 枚举全部 create-pull-request 步骤、禁止扩到 job/workflow、mutation 控制）；dev CI run `44051928967` 全绿（openapi-sync skipped，无漂移）；症状票 AAV-1390 同步关闭 | 2026-11-17 |
| AAV-1389 | 产品视角三句门禁：照搬 inside-china-ai 的纯文本校验器（原样）+ Linear 取数的渲染器（合同不变）；CI `repo-policy` 校验 PR body、AGENTS.md Step 9 渲染汇报首段；22 例测试全绿 | 2026-11-16 |
| AAV-1335 | unit/script 测试不得真实出网：断网实证（陷阱全拦截下 17 passed / 0.16s / 0 次触发）+ `isDirectRun` 门与 `fetchWithTimeout` 位置的行为/静态守卫 + boundary doc 红线；去门 mutation 实测 attempts 命中 | 2026-11-16 |
| AAV-1334 | 删除 dispatch-only `generate-snapshots` 死 job（引用已删除 visual spec）：ci.yml 删除整 job；新增 workflow Playwright spec 路径守卫（显式路径必须存在 + 禁止 `--update-snapshots`/`=all`/`-u`），随 `npm test` 生效；两处活文档指针订正 + checklist 的 `toHaveScreenshot` 改 geometry；14 行矩阵 S1–S14 | 2026-11-16 |
| AAV-1356 | V4 地址簿 module union（退出条件 #2/#3/#4）：每链合并 base + curated module、按地址去重、同名不同址用 `<module>:<rawKey>` 消歧、地址簿 4.76.1 → 4.77.6 补 `PAXG_PAXOS_ESPOKE`。chain 1 17/17、全链 25/25（4.76.1 union 24/25）；fallback 成本 13 multicalls/244 calls → 17/296；58 条 V4 单测 + live 全链覆盖断言；冷却期例外已记录，`dev → main` PR 需等 2026-11-18T00:32:49Z | 2026-11-16 |
| AAV-1393 | 钱包降级提示内部标签外露 + fallback 成功误报（`efcd50b3`）：新增 `hasMissingWalletData` 与 `failureLabels.ts`（标签词表单一作者），提示固定 `Wallet data incomplete`、无 `title`、原始标签进 `data-failed-sources` + 一次 `console.info`；单一 `showPartialNotice` 驱动提示与日志（原来 error/idle/loading 会误打日志）。W1–W7 + P1/P2/P3/P3b/P4–P7 共 18 条，两项 mutation 各自只红对应例；全量 4414 passed；真浏览器三视口 + 三条负控 | 2026-11-16 |
| AAV-1333 | offset e2e 阶梯与阈值同源（`planOffsetRunner` + `OffsetRunnerPlan`）：runner 不再写死金额，按 `weight×min(B,gross)/gross` 断言比例（0.9 容差）、饱和步 `after ≤ 0.01`；cap 改为收缩 gross、`cap≤0`=无上限；brevis/protocol/`gross<100` 三门；新建 Base WETH×USDC 注入 fixture + 真实 discovery 选景的 stub，cross 链路首次真实执行（desktop+mobile 各 1 passed），live self-loop 双平台 2 passed；单测 151+6、全量 4445 passed | 2026-11-16 |
| AAV-1395 | AAV-1333 复核跟进（`e2e/incentiveReading.ts` 严格读取、self-loop capacity 改 borrow room、points 混合组排除、stub 注入 weight 0.5、13 个 e2e 文件按 platform 拆分 + `testIgnore` 路由）：4 项 mutation 各自打红对应例，164 定向单测 / 4448 全量 / scripts 310 / e2e 4 passed 0 skipped / chromium 89·mobile 62 零违规；订正 AAV-1333 计数 4445→4440 并把 phase9 计划标 SUPERSEDED | 2026-11-17 |
| AAV-1315 | 钱包仓位 partial 降级在 UI 无提示（`b88a055e`）：hook 暴露 `failedSources` + `Index → ReservesTable → PortfolioPanel` 透传 + `success` 且非空时渲染琥珀 `role=status` 提示（`Incomplete sync — N source(s) unavailable`，`title` 列源）；不新增 `WalletLoadState` 取值、error/empty 文案不变。review 加固：`useMemo` 按 join key 稳定引用（避免打穿 `memo`）、`ds-text-amber-600` token、`ReservesTable` 透传用例（删 prop 即红）、H4 覆盖「全成功有仓位」。新增 13 条测试，全量 4393 passed；真浏览器 390/834/1440 三视口各 1 条、console 0 error、negative control 0 条 | 2026-11-16 |
| AAV-1378 | API fields 断言改写：版本读 `MARKETS_API_VERSION`（常量上移到 `backend/src/types/`）、90% 覆盖率换成语义断言（必有字段 100% / borrow 侧全有或全无 / 无借入侧数量基线 19 / `protocolFee` 0..100）。`protocolFee` 定性为「缺席 = 0」契约（AAV-1350），**未改序列化**；45 条是 0 被按契约省略、19 条是 SDK `borrowInfo: null`。附带修 `run_suite` 失败吞没（无 `set -e`，只有最后一个套件决定 step 成败）与 canary 目标按 ref 对齐（main→production） | 2026-11-15 |
| AAV-1376 | canary 改为 build 先于套件（去掉 `if: always()`/`continue-on-error`）+ `backend/tests/testCanaryOrder.test.ts` 11 例按**行号**守卫顺序、锁 `TREND_STEP` 名与 `id: build`、套件名单、`../dist/*`；`shared-contracts` 自身 3 个测试改 import `src`。run `43703832449` **整 run 绿**（1287 pass / 0 fail，该 workflow 历史首次） | 2026-11-15 |
| AAV-1350 | Portfolio 模式在 reserve 缺 rate-calc 字段时激励显示为 —（`protocolFee` 移出 `hasRateCalcFields` 门槛，兜底改走 `getCampaignIncentiveValues` 并传 position/token/decimals；生产复验 6.17% / +$1.64 每天） | 2026-11-12 |
| AAV-1352 | [e2e] 发现数据拉取失败与「数据缺口」不可区分 ⇒ 整个 spec 静默报绿（同族 AAV-1294/1330/1349，修复位置在 spec 的数据获取层） | 2026-11-15 |
| AAV-1349 | [CI] pre-push 的 e2e 门缺 chromium 时静默 `exit 0`：改为 `exit 1` + 唯一显式出口 `E2E_SKIP=1`（默认关闭、必须打印「无 e2e 证据」）+ `PLAYWRIGHT_BROWSERS_PATH=0`/shell-only 不误判；判定收进 `scripts/lib/e2e-browser-gate.mjs`，13 例守卫随 `npm test` 生效。e2e 提为必填检查按票面另行拍板 | 2026-11-15 |
| AAV-1317 | [e2e] portfolio fill helper 按 token 符号定位输入框，跨链同符号会填到错误的行 | 2026-11-16 |
| AAV-1314 | [Bug] onchain multicall 批量读全失败仍返回空成功（AAV-1310 同类：client 健康但结果全 failure → 假 $0） | 2026-11-16 |
| AAV-1387 | [Bug] RPC 探活只看 eth_chainId：批量读整批失败仍沿用该节点（Optimism fastnode 对 >4KB eth_call 回 413 → 假 $0） | 2026-11-16 |
| AAV-1319 | [CI] e2e 目录不在常态 lint/typecheck 覆盖内；AGENTS.md 验证门 `npx tsc --noEmit` 实际检查 0 文件 | 2026-11-15 |
| AAV-1295 | [CI] smoke test 修好后 auto-rollback 首次可达，但 deploymentRollback mutation 从未执行过（drill 入口 + 目标选择 + production 路径 + `rollback_executed` 串联均已实跑；平台缺陷另开 AAV-1388） | 2026-11-16 |
| AAV-1380 | **[后端] `/markets` 的 `ltv` 字段 312/441 条为 0 → 定性为协议真值（base LTV），不是映射缺陷**。三源一致：链上 DataProvider vs staging 全等 103/103（ETH 68 / Base 15 / Arbitrum 20，`ltv` 与 `lt` 双字段）；SDK `maxLTV` 本即 `{value:"0"}`、两层 `!== undefined` 不吞 0；prod 与 staging 同 `reserveId` 差异 0 条（各 441：zero 312 / 正数 129）。312 个 0 = 128 冻结（V3.6 `setReserveFreeze` 联动 LTV→0，LT 不变 ⇒ HF 不受影响）+ 64 有抵押资格但不给 base 借力（稳定币治理 LTV-0）+ 120 非抵押品（`lt` 亦 0）。⇒ 前端借力算 0 对这批资产正确；**残余缺口是 API 不暴露 eMode 参数**（WETH base 81% vs ETH-correlated 93%），另开 AAV-1394。落地：fetcher `ltvZeroPreserved` + backend `ltvSemantics` 守卫（各 3 例，mutation 各只打红一条）；`apiFieldsVerification` 加 `ltv ≤ lt` 与 V4 `ltv === lt` 不变量（staging 真 payload 9/9）；JSDoc 落进 `backend/static/openapi.json` 两处 description；`docs/api/api-documentation.md` 补齐三个风险字段；spec `docs/plans/executed/aav-1380-ltv-zero-semantics.md`（S1-S16） | 2026-11-16 |
| AAV-1386 | [后端] AAV-1379 残余风险收敛：新增 `reserve-shape.ts`，V3 market/reserve 与 V4 reserve 顶层键用 `satisfies keyof` 钉住 SDK fragment 类型（SDK 升级删字段 → build 红），每轮 fetch 审计键存在性（缺失即 warn+样本，干净每进程一行 info）。**关键证据**：`borrowInfo` 在 fragment 里是必填键至多 nullable，键缺失在当前 SDK 版本下结构性不可达——门禁钉住的是「SDK 升级删字段」那条唯一路径。fetcher 433 例全绿、lint 289 warning 持平、变异验证 3/4 fail、部署后快照仍 441/142/19（纯观察）。`protocolFee` 缺席 = 0 仍按 AAV-1350 契约不改 | 2026-11-16 |
| AAV-1379 | [后端] `concurrent-fetch.ts` 只用 `=== null` 判定「无借入侧」：`buildV3BaseDataset(markets: any[])` 入参是 `any`，若 SDK 省略 `borrowInfo` 键而非显式 `null`，该 reserve 会读成「可借但借入侧全零」。**已修**：循环顶部 `const borrowInfo = reserve.borrowInfo ?? null` 收敛一次，11 处改读它；新增 6 例 `packages/aave-fetcher/tests/borrowInfoMissingKey.test.ts`（变异验证只 2 例红，其余为行为不变的对照），fetcher 416 例全绿。**口径订正**：142 条 `borrowDisabled` 里只有 **18** 条真的无借入侧数字（才是 `=== null` 的命中数），另 124 条借入侧齐全（`borrowCap === 1` 等）——别把 142 当作该分支计数。部署后快照仍 441/142/19（纯防御）。**`protocolFee` 不动**（缺席 = 0 是 AAV-1350 契约）；**残余风险已由 AAV-1386 收敛** | 2026-11-15 |
| AAV-1304 | PortfolioSummaryBar：supply-only 仓位 Lowest HF 空态无上下文 + Advanced 区标签字重不一致 | 2026-11-15 |
| AAV-1313 | [Improvement] onchain 仓位路径按 chainId 共享 RPC client（V3 多 market / V4 多 spoke 各自重复轮换） | 2026-11-17 |

---

## 维护规则

- **更新时机**：每次 triage 或 issue 状态变更后更新本文件。
- **排序**：GitHub issue 始终在最前；Linear 部分按 **Linear 状态**分组（In Progress → Ready for agent → Needs Info → Todo → Backlog），组内按 priority 降序。
- **只列 open**：Done / Duplicate / Canceled 一律不进 `## Active Linear Issues`；近三轮的 Done 下沉到 `## Recently Completed`，更早的进 archive——该表不再无限增长。
- **`Last inventory` ≤600 字符**：只承载四件事——轮次 + 票号 + 一句话结论、PR / squash sha、产品验证门定性、frontier。超出的叙事归 archive 与 issue 评论。这是本文件不会长回 100KB 的机制，不要靠"记得写短一点"。
- **历史流水写 archive**：每轮盘点收尾时把上一轮整段追加到 [`archive/2026-11-17-roadmap-inventory-history.md`](./archive/2026-11-17-roadmap-inventory-history.md)，本文件只留当前一轮；archive 满约 20 轮按日期开新档。
- **列表抓取要看全量**：Linear 列表是虚拟化的，`read_all` 只返回视口内的行。盘点前先 `document.body.style.zoom='0.4'` 压缩行高再抓，并反复把列表容器 `scrollTop=scrollHeight` 直到行数不再增长，否则会静默漏票。
- **不缓存交付细节**：本文件只记 issue 号、priority、state、title；commits、测试、live evidence 沉淀在 issue 评论里。
- **与 `docs/agents/issue-tracker.md` 分工**：本文件是用户可见的 Roadmap 快照；issue-tracker.md 是 agent 内部的 Linear 操作配置 + triage 契约。
