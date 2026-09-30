# Issue Roadmap — Open Issues 优先级与执行状态

GitHub Issues + Linear Issues 的优先级排序、状态追踪与依赖关系。每次 triage 后更新。

> **排序规则：GitHub issue 始终排在 Roadmap 最前面。**

> **交付细节的唯一权威源是 issue 评论**（`gh issue view <N> --comments` / Linear issue comments）。本文件的盘点条目只作对话式上下文，不覆写 tracker。

## 当前状态

> **Last inventory**: 2026-09-28(AAV-1308 经 `09b42aa4` + `8b27e1fc` 交付关闭(Done):cross-asset-pairing e2e discovery 抽成 `e2e/reserveDiscovery.ts` 纯函数,`merklSupplys`/`merklBorrows` 两侧统一过 `isComputableMerklCampaign`,并补 runner 真正依赖的仓位可行性门(`getBorrowRoomUsd` + supply/borrow room ≥ $5000 + LTV 融资额度);排除自配对与同 symbol 组合;缺身份字段只 skip 不抛错。双轴 review 另揪并修两处既有镜像失真:`getMarketChipLabel` 对 V4 非 Ethereum 市场返回 chainName(UI 只从 marketName 派生→Add 按钮匹配不到就退回 `.first()` 选错行,现加 39 个现网 marketName 一致性测试),以及 Aave `cap=0` 是「无上限」而非「零空间」。97 单测 / 3849 全量 / Playwright 12 passed·20 skipped。按票建出四张 follow-up AAV-1316–1319。此前 09-27:AAV-1310 经 `9552fe60` + `4f93ca0b` 交付关闭;AAV-1311 经 `084131f5` 修复关闭。)
>
> **next pick = AAV-1320**（GA4 被 `vercel.json` 的 `script-src` 拦死，生产自 09-14 起零上报——每天在丢真实数据、修复面仅一行 config + 一次上报验证），排在 AAV-1303 之前。frontier 之后才是 **AAV-1303**(Medium,**Todo**，已由 qoder-0928b 领出，代码未动)。2026-09-28 复核补强三条事实：(1) 直取后端 spec，production `api.aaveapy.com/api/docs/openapi.json` 仍含 Merit 24 处 / `ApiMeritCampaign` 14 处，staging 已全部删除(0 处)，仓内 `public/openapi.json` 停在 24 处——openapi-sync 红灯、wb-0928a 的"已知非阻塞噪声"与前端 TS2551/2339 同此一根源；(2) **但 production `/markets` 实际已不输出 merit 字段（实测 0 处，与 staging 一致）**，故票面「生产运行时不受影响、prod 前后端世界都有 Merit」的前提已推进为「两端数据都为零」，前端清理无运行时风险，不必等后端 prod spec 收敛；(3) 前端引用面实测落在高风险区：`incentiveAggregation.ts` 20 处、`IncentiveTooltip.tsx` 13、`SimulationSubRow.tsx` 7、`types/aave.ts` 5、`merit.ts`/`meritForecast.ts` 及各自测试；**另有一类不在代码链里的东西——`src/locales/*/landing.json`(4 处) 与 `ui.json`(1 处) 的对外文案仍把 Merit 当卖点宣传**，属产品/SEO 决策，应与拆除链分开拍板（AAV-1289 只拆了后端与 worker，前端镜像正是本票）。
> 同批候选:AAV-1316(stub 注入证明 AAV-895 用例可达)/ AAV-1318(offset discovery 复用 room·LTV 门)——均 ready-for-agent 且无外部依赖;AAV-1295/1292 依赖 CI 与部署窗口;AAV-1319 需先认可 AGENTS.md 验证门改动。



---

## 方案审查结论与关键建议速览

| Issue | 现状 / 方案痛点 | 审查建议与方案修正 | 调整动作 |
| --- | --- | --- | --- |
| **AAV-1311** | `userPositionMapper.ts` 中 `wadToHuman` 恒除以 $10^{18}$ 忽略 `meta.decimals`，6-dec 代币（USDT/USDC）在 onchain fallback 路径下 USD 缩小 $10^{12}$ 倍（测试钱包 $1044 显示为 $0.000001） | **最小闭环修复（已交付）**：`rawToHuman` 按 `meta.decimals` 两段法换算；`amountWad` 文档化原生 raw 语义；fixture 形态修正 + 一致性测试量级 invariant。Live 实测 Celo USD₮ $1044.57 正确呈现（`084131f5`）。 | Done（2026-09-27 关闭，交付记录见 Linear） |
| **AAV-1310** | `createClientWithRpcRotation` 轮换超时耗尽返回 `null` 时，`getV3UserPositionsOnChain` 静默返回空成功 `{ positions: [], accountSummary: null }`，导致 `failedSources` 为空且 UI 呈现假 $0 | **语义分流与显式报错**：区分 `rpcUrls.length === 0`（未配置 RPC，平滑降级）与轮换耗尽（基础设施超时/故障，显式抛错）。使 `getV3UserPositionsMultiChain` 捕获至 `errors` 并推入 `failedSources`，让 UI 准确提示降级。 | 标为 ready-for-agent，维持 High |
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
| **AAV-1304** | PortfolioSummaryBar：supply-only 仓位 Lowest HF 空态无上下文 + Advanced 标签字重不一致 | **空态友好化 + 样式归一**：Lowest HF 链上查询恢复后，补充无债务时空态说明（如隐藏或 tooltip 说明）；统一 Advanced 区域同级标签的 Typography token。 | Backlog，Low 优先级排期 |
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

非 GitHub 来源的 Linear issue，按 priority 降序排列。仅列 open（非 Done/Canceled/Duplicate）。

### Urgent / High

| Linear | Priority | State | Title |
| --- | --- | --- | --- |

### Medium

| Linear | Priority | State | Title |
| --- | --- | --- | --- |
| AAV-1323 | Medium | Backlog | [e2e] market-filter-pin 用例 (5) 用绝对几何阈值卡实盘数据 → CI 隔频报红（首跑与 Retry 数值逐位相同，非时序；同族 AAV-1307 是另一种形态。⚠️ AAV-1324 已由 #701 修掉选择器歧义，但本票的阈值假设未动，勿一并关闭） |
| AAV-1303 | Medium | Todo | Merit 退役清理：前端 schema/契约/Forecast 链路移除 + openapi-sync 恢复（next-after-1320；prod `/markets` 已零 merit 数据，唯 landing/UI 文案仍宣传） |
| AAV-1320 | Medium | In Review | [生产] GA4 被 `vercel.json` 的 CSP 拦死：`script-src` 未放 googletagmanager，同意横幅给了 Allow 也不上报（非 #686 引入，自 09-14 起）— **交付完成** `567823ec`…`b1262489`（CSP 放行 + 构建期 hash 校验门 + CodeQL 三连修复 + pre-push e2e 处置）；PR #692 lovable→dev 已合并（09-29）；**PR #693 dev→main 已建未合并，等用户 GitHub UI 操作**，合并后生产复验 GA 上报即关闭 |
| AAV-1316 | Medium | Backlog (ready-for-agent) | [e2e] AAV-895 cross-asset-pairing 用例从未真实执行过：注入 synthetic 载荷证明 min(1,2) 链路可达 |
| AAV-1317 | Medium | Backlog (ready-for-agent) | [e2e] portfolio fill helper 按 token 符号定位输入框，跨链同符号会填到错误的行 |
| AAV-1318 | Medium | Backlog (ready-for-agent) | [e2e] offset discovery 未查借出空间与 LTV 融资额度（AAV-1308 同族缺口，底座已就绪） |
| AAV-1319 | Medium | Backlog (needs-triage) | [CI] e2e 目录不在常态 lint/typecheck 覆盖内；AGENTS.md 验证门 `npx tsc --noEmit` 实际检查 0 文件 |
| AAV-1295 | Medium | Backlog | [CI] smoke test 修好后 auto-rollback 首次可达，但 deploymentRollback mutation 从未执行过 |
| AAV-1292 | Medium | Backlog | railway → main 正式晋升：三个定时工作流从未运行 |
| AAV-1275 | Medium | Backlog | DESIGN: AMOUNT variant campaign APR display strategy (product decision needed) |

### Low / No priority

| Linear | Priority | State | Title |
| --- | --- | --- | --- |
| AAV-1322 | Low | Backlog | [桌面] 储备行展开模拟子行后再点同一行不收起（`handleToggleExpand` 语义是 toggle；dev + 生产 `d39ad25f` 双环境 5 列实测一致）— 由 AAV-1321 实施期发现 |
| AAV-1312 | Low | Backlog (needs-triage) | [Improvement] sync 第三数据源：MarketSwitcher V4_LINKS 外链 logo（V4-only 链官方图标自动化） |
| AAV-1304 | Low | Backlog | PortfolioSummaryBar：supply-only 仓位 Lowest HF 空态无上下文 + Advanced 区标签字重不一致 |
| AAV-1302 | Low | Todo | [CI] release-drafter v7 迁移：autolabeler action 拆分 + category 模型（GitHub #656） |
| AAV-1301 | Low | Backlog | [Toolchain] eslint 10 升级：@eslint/js 10 peer 冲突，需协调升级整条 eslint 工具链（GitHub #653）*(降级：暂缓升级，受阻于上游 react-hooks 插件)* |
| AAV-1274 | Low | Backlog | RENAME: campaignType → distributionType (cross-repo API breaking change) *(降级：建议前端别名适配替代跨仓重命名)* |
| AAV-1293 | Low | Todo | [后端] 是否将 /api/seo/* 管理面纳入 OpenAPI spec *(建议：确认为内部管理路由，不予公开)* |
| AAV-1271 | Low | Backlog | 工具：Aave UI ↔ Backend API 对比工具 Phase 3 |
| AAV-1270 | Low | Backlog | 后端：incentive_details 列级 NULL 命中率测试 + 决策 |
| AAV-1269 | Low | Backlog | 后端：LOCF 查询实现（/api/markets/history 历史回放） |
| AAV-1283 | None | Backlog | Security audit: moderate vulnerabilities (tracking) |

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

近 session 完成的 issue（仅列代表性的，完整历史见 Linear）。

| Linear | Title | Closed |
| --- | --- | --- |
| AAV-1308 | cross-asset-pairing e2e discovery 门控对齐（`09b42aa4` 纯函数抽离 + 仓位可行性 room/LTV 门 + P1–P22 54 单测；`8b27e1fc` spec 登记；review 追加修 `getMarketChipLabel` 镜像与 `cap=0` 语义；现网 0 条 `crossAssetPairing` → 运行时仅证明干净 skip，门控证据在单测） | 2026-09-28 |
| AAV-1310 | RPC 轮换耗尽静默空成功修复(`9552fe60` throw RpcRotationExhaustedError + null 语义收紧;V3/V4 errors 通道非空 + failedSources;HF 消费方降级对齐;spec `4f93ca0b` 含场景矩阵 + review 闭环) | 2026-09-27 |
| AAV-1311 | Onchain fallback 非 18-dec 代币 USD 缩水（`rawToHuman` 按 meta.decimals 换算 `084131f5`；Celo USD₮ live 实测 $1044.57；一致性测试量级 invariant） | 2026-09-27 |
| AAV-1309 | 一致性测试 API base 失效 + 空洞断言 + 假 HITL 标注（`deec631e`，onchain-only 语义；过程中发现 AAV-1310/1311） | 2026-09-27 |
| AAV-1305 | 生产钱包仓位导入失败双层根因（P1 MULTICALL3 常量 `1061bd14`；P2 DataProvider 迁移 `2d6e70fb` + watch-reentry 加固 `5f928681`，Celo 真实仓位实测检出） | 2026-09-27 |
| AAV-1280 | e2e self-loop offset：场景 discovery 对齐 UI 渲染门控（测试侧加固，原始触发数据已消失，e2e 实测干净 skip） | 2026-09-26 |
| GitHub #676 | PR_TARGET 迁移到 pull_request 生产部署（dev→main 合并 52cf2aef，审计日志零残留） | 2026-09-25 |
| AAV-1305 (P1) | 修复 MULTICALL3_ADDRESS 常量缺 hex 字符（19.5B→20B）+ 金丝雀测试防回归（commit `1061bd14`） | 2026-09-25 |
| AAV-1282 | 移动端 Connect 弹窗为空：RainbowKit wallets 注入（connectorsForWallets + 本地工厂，e2e 双端解禁） | 2026-09-25 |
| AAV-1298 | 🔥 Lovable CI failure: openapi-sync（bot PR 收敛 dev + codegen patcher） | 2026-09-24 |
| AAV-1299 | e2e flaky: portfolio-incentive-calculation supply total 超时显示占位符 | 2026-09-24 |
| AAV-1296 | Hardcode Sync 韧性：解除「全或无」门禁单点故障 | 2026-09-24 |
| AAV-1279 | FCP 优化：延迟加载非首屏 chunk（代码 `19b102a1` 已合入三分支） | 2026-09-24 |
| AAV-1300 | [Hardcode Sync] verify failed after retry | 2026-09-24 |
| AAV-1294 | [CI] deployment-smoke-test 恒为假绿灯 | 2026-09-24 |
| AAV-1289 | 下线 Merit 全链路 | 2026-09-24 |
| AAV-1278 | Side-Data Persistence to PostgreSQL | 2026-09-24 |

---

## 维护规则

- **更新时机**：每次 triage 或 issue 状态变更后更新本文件。
- **排序**：GitHub issue → Linear Urgent/High → Medium → Low/None。
- **不缓存交付细节**：本文件只记 issue 号、priority、state、title；commits、测试、live evidence 沉淀在 issue 评论里。
- **与 `docs/agents/issue-tracker.md` 分工**：本文件是用户可见的 Roadmap 快照；issue-tracker.md 是 agent 内部的 Linear 操作配置 + triage 契约。