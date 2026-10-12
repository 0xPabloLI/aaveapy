# Issue Roadmap — Open Issues 优先级与执行状态

GitHub Issues + Linear Issues 的优先级排序、状态追踪与依赖关系。每次 triage 后更新。

> **排序规则：GitHub issue 始终排在 Roadmap 最前面。**

> **交付细节的唯一权威源是 issue 评论**（`gh issue view <N> --comments` / Linear issue comments）。本文件的盘点条目只作对话式上下文，不覆写 tracker。

## 当前状态

> **Last inventory**: 2026-10-12(上午，**AAV-1323 已交付关闭(Done)**：手动 dispatch 第 3 轮 CI（run `38196292330`）后验收凑满——该 spec 所在 e2e-desktop 双分片在 `38177124100`/`38177997224`/`38196292330` 三 run 全绿，交付评论已按固定标记落 AAV-1323。**附带发现**：第 3 轮 run 整体红是 `generate-snapshots` dispatch-only 遗留破窗（引用已被 `7c48ae01` 删除的 visual spec → "No tests found"，push 触发时该 job 恒 skipped 故从未暴露）→ 新开 **AAV-1334**（Low，整改方向＝删 job）。另 pre-push attempt 1 撞到 `scripts/sync-reserve-patches-upstream.test.mjs` 46s 失败、attempt 3 同套件全绿，疑 unit 层真实网络耦合，**未开票留观**。**当前 frontier：AAV-1315**；次选 AAV-1313·1314 / AAV-1333。）
>
> 此前 2026-10-12(下午，**AAV-1323 整改核实 + 验证收口**：grill 发现根因的**行前提层已由 `eba3be94`（2026-10-05，本地 `lovable` 未 push）落地**——用例 (5) 弃「第 3 个可见行」改 `pickReorderCapableRowIndex(labels)` 发现式挑行 + 整页同 market 条件 skip（与 AAV-1308/1316 discovery+skip 同形），纯函数 9 例矩阵单测在 `src/test/reserveDiscovery.test.ts:949`（含 2026-10-05 全 Ink 快照复现场景），`e2e-testing-boundary.md:127` 已登记该约定。**几何阈值层经 grill 判定无需整改**：`pinnedTopY + 12` 断言的是 app 自有 sticky pin 几何（锚点 = sticky scenario bar/thead 底缘，与实盘数据无关），10-05 全 Ink 快照上 (1)-(4) 全过（filter 无操作仍 pin）佐证阈值不耦合数据——按 boundary doc 几何断言正是 e2e 应有形态。本 session 验证证据：单测 116 passed；e2e chromium 5/5 passed（24.0s），用例 (5) 单独复跑两次绿（9.5s/8.3s，真实执行非 skip，vite staging 手动起服 + `E2E_PORT=4173` 绕 safe-delete shim）。**push 已落地（05:32）**：`2ab2253d..7e3d868c` → `origin/lovable`，本地 ahead-5 清零（含 AAV-1316 `9cc1cebf`、AAV-1318 `d9809781`、AAV-1323 修复 `eba3be94` 及三笔 docs）。pre-push 全门实跑三轮全绿（沙箱 TUN 对 github.com:443 间歇抽风致传输两断一成，每轮门禁均完整跑：单测 4118 passed / e2e 65 passed 3.2m / osv+semgrep "No issues found"）。CI 已触发：run `38177124100` + CodeQL in_progress。**AAV-1323 关票仅剩「CI 连续 ≥3 绿」观察项**。frontier：**AAV-1315**（failedSources 只到 hook）/ AAV-1313·1314 / AAV-1333。）
>
> 此前 2026-10-12(**AAV-1318 已交付关闭(Done)**，commit `d9809781` 仅本地 `lovable` 未 push：offset e2e discovery 补仓位可行性门——cross-reserve 的 offset 侧两道弱检查（`borrowDisabled` + `usableForOffsetPosition`）**替换**为 AAV-1308 底座 `usableForSimulatedPosition(r,'borrow')`（增量＝supply room ≥ $5k + borrow room ≥ $5k + `min(supplyRoom,$100k)×ltv/100` ≥ $5k LTV 融资额度）；self-loop 的 target 追加同一谓词（self-loop 的借入就发生在 target 自己身上，此前完全无门）；cross-reserve 的 target 侧不动（只供给、无实证失败形态，O21 为负对照）。TDD 先红后绿：新增 O12–O22，改实现前 **6 failed（恰为 O12/O16/O17/O18/O19/O22）/ 110 passed** → 改后 **116 passed**；O 系列 fixture 改 6-decimals 真实 room（原 18-decimals 让 `suppliable:'1000000000'` 折成 ~$1e-9，会在新门下被整片误排除）。**staging before/after＝4 → 4（delta 0）**，4 条 self-loop 全保留，cross-reserve 0 条 ⇒ 与 AAV-1308 同态属结构性修复，运行时只证明「未破坏」；**e2e 实跑 8 passed / 8 skipped / exit 0**（desktop+mobile 双平台，真实 UI）。双轴 review 闭环（常量上移消除 TDZ 隐患、O22 编号归位、O21 补 type 断言、注释改「替换」语义、O17 承认与 LTV 项纠缠不可分离）。新开 **AAV-1333**：cross-reserve runner 梯级（$500/$1000/$2000）与 `decrease ≥ 0.4×targetApr` 量纲不自洽（按 `decrease = apr×B/gross` 反推需 `B ≥ 0.4×gross`，即 gross ≤ $2.5k 才可能成立），属 runner 侧、本票不动，当日 0 条 cross 场景故为潜伏态。**当前 frontier：AAV-1323**（绝对几何阈值卡实盘）；次选 AAV-1315 / AAV-1313·1314 / 新票 AAV-1333。
>
> 此前 2026-10-10(**AAV-1316 已交付关闭(Done)**，commit `9cc1cebf` 仅本地 `lovable` 未 push：cross-asset-pairing e2e 新增 synthetic 载荷 stub 变体——提交修剪版真实 staging fixture（AaveV3Base WETH×USDC，414→2 条 reserves 字段形态零改动）+ 纯函数 builder 注入 `crossAssetPairing` 并让**真实 discovery 门控**选场景（零场景必 throw，绝不静默 skip）+ `page.route` 双拦 `/markets` 与 `/meta/side-data` 全 hermetic + runner 可选 baseline 零断言。**AAV-895 min(1,2) 链路首次有运行时证据**：stub desktop/mobile 双平台 passed（6.9s/9.5s，复跑 7.3s/9.7s 确定性确认），断言链 baseline≈0→500 递增→2000 绑定→5000 钉住全部命中；live 路径零变化（整份 spec 2 passed/6 skipped）。单测 8 条新增、全量 4107 passed（+9 全新增）；typecheck/lint/显式 e2e tsc/wait-strategy 守卫/market-name 守卫全绿；双轴 review 闭环（SY4b 恒真测试改确定性负例、sourceSide 类型收紧）。grill 三决策用户拍板：committed fixture / desktop+mobile / 同文件 stub describe。spec `docs/specs/aav-1316-cross-asset-pairing-synthetic-payload.md`（14 行 SY 矩阵 + provenance）。**当前 frontier：AAV-1318**（offset discovery 复用 room·LTV 门，AAV-1308 同族缺口，底座已就绪）。
>
> 此前 2026-10-09(**AAV-1329 与 AAV-1331 同日交付关闭(Done)**（commit `3430b65b` / `a0c8982f`，**仅本地 `lovable`、尚未 push**）：`e2e/defi-yield-tracker-faq-anchor.spec.ts` 三例首步 `waitForLoadState('networkidle')` → 新增内联 `waitForPageReady(page)`（H1 + `h2#faq` 可见），断言一行未动；并新增 e2e 等待策略静态守卫 `scripts/e2e-wait-strategy.test.mjs`（随既有 `npm test` 生效，**不新增 npm script / 不改 hook**；11 例含真实 e2e 目录集成断言，改前必红）。**根因坐实一层**：该页 `src/pages/DefiYieldTracker.tsx` 自身零取数（H1/`h2#faq`/12 条 FAQ 同一次同步渲染），但 `src/App.tsx` 在**模块加载时**就 prefetch `/markets` + side-data，与路由无关 ⇒ `networkidle` 等的是与页面无关的对象，整条 gate 打 staging 期间永不可达；整条套件 3 次有效样本本 spec 均 9/9 绿、单例 1.6–3.1s，而沙箱内「3 次 0 failed」**不可达**且已如实改写口径（红点逐轮轮换、隔离复跑多数转绿 ⇒ 负载性）。另修 **AAV-1331**（`architecture-guard.test.ts` 的 FS 遍历记忆化 + 清单提到模块作用域 + 导入期预热 ⇒ 全量 `npm test` 由 `6 failed` 变 **rc=0 / 4098 passed**，用例只增不减，pre-commit 假红消除），并建 **AAV-1330**（`.husky/pre-push` 缺 `|| exit 1`、三次 `rc=0` 假绿；本轮不动公共 hook，保持 open）。提交途中另踩到沙箱 broker 使 `eslint .` 恒 EPIPE，绕行＝清空 `NODE_OPTIONS`（详见 SESSION-BOARD `wb-1009a`）。**订正过期项**：上一版写的 `next pick = AAV-1303 第二段` **已失效**——Linear 显示 AAV-1303 于 2026-09-30 Done（第二段含 5 语言 landing 文案已随该票关闭）。**当前 frontier**：AAV-1316 / AAV-1318（ready-for-agent、无外部依赖）为下一梯队首选。
>
> 此前 2026-10-05(推送门恢复：**AAV-1328 已交付关闭(Done)**——`osv-scanner.toml` 按条豁免 `braces@3.0.3` 的 GHSA-vfj7-8cjw-p6xm(理由 + `ignoreUntil = 2027-01-31`，实测过期日一到就重新报 High)，`73fda76a` + `95032a77` 已在 `origin/lovable`，pre-push 不绕 hook 全门跑通(`Loaded filter from` → `No issues found`、e2e 64 passed)；上次被 `defi-yield-tracker-faq-anchor` 4 例挡下判定为**负载争用非回归**——**该结论 10-05 已证伪并订正**：1-min load 4.6 时同三例(desktop `:50`/`:87`/`:114`)又挡一次(首跑与 Retry 同因，全是 `waitForLoadState('networkidle')` 撞 60s)，而独立跑恒绿(9 passed / 29.9s)、被推内容只有 3 行 markdown ⇒ 真因是**该 spec 的等待策略耦合实盘网络**，非 CPU、非回归，建票 **AAV-1329**(同族 AAV-1323/1307，机制各异)。同批 `779f66e6` 建 AAV-1327(需用户拍板)。**AAV-1320** 用户已合 #693、生产复验三项全过、Linear 已 Done ⇒ 按本文件「仅列 open」规则从下表移出。)
>
> 此前 2026-10-01(dev CI 恢复正常并补上守卫：#697 回退 `@eslint/js` 二次回归 + `peer-dep-check` 升为 dev 必需检查；#698 收 happy-dom 20.14.5 与 WAAPI 孤儿 rejection shim（取代 #688）；#710/#711 交付 AAV-1303 第一段，`openapi-sync` 恢复绿、顺带 `overrides.axios=^1.20.0` 清掉阻塞所有人推送的 osv 门；新开并关闭 AAV-1324（`Filter by ` 前缀被 hub/market 两颗 chip 共用），AAV-1323 保持 open 并已标注「勿随 1324 一并关闭」。此前 09-28:AAV-1308 经 `09b42aa4` + `8b27e1fc` 交付关闭(Done):cross-asset-pairing e2e discovery 抽成 `e2e/reserveDiscovery.ts` 纯函数,`merklSupplys`/`merklBorrows` 两侧统一过 `isComputableMerklCampaign`,并补 runner 真正依赖的仓位可行性门(`getBorrowRoomUsd` + supply/borrow room ≥ $5000 + LTV 融资额度);排除自配对与同 symbol 组合;缺身份字段只 skip 不抛错。双轴 review 另揪并修两处既有镜像失真:`getMarketChipLabel` 对 V4 非 Ethereum 市场返回 chainName(UI 只从 marketName 派生→Add 按钮匹配不到就退回 `.first()` 选错行,现加 39 个现网 marketName 一致性测试),以及 Aave `cap=0` 是「无上限」而非「零空间」。97 单测 / 3849 全量 / Playwright 12 passed·20 skipped。按票建出四张 follow-up AAV-1316–1319。此前 09-27:AAV-1310 经 `9552fe60` + `4f93ca0b` 交付关闭;AAV-1311 经 `084131f5` 修复关闭。)
>
> **next pick = AAV-1315**（failedSources 只到 hook、组件零消费）。**AAV-1323 已于 2026-10-12 交付关闭**（验收「CI 连续 ≥3 绿」凑满，见顶部 inventory）。**AAV-1318 已于 2026-10-12 交付关闭**（offset discovery 复用 room·LTV 门，见本文件顶部 inventory），**AAV-1316 已于 2026-10-10 交付关闭**（synthetic 载荷 stub）。上一版此处的 `next pick = AAV-1303 第二段` **已失效**（AAV-1303 于 2026-09-30 Done）。此前的 **AAV-1320 已上线并生产复验**：#693 合入 main `f7873eea`，`aaveapy-deploy-sha` 对齐，未同意 0 GA / 点 Allow → `g/collect` 204 / 点 Decline → 0 GA 三项全过。2026-09-28 复核补强三条事实：(1) 直取后端 spec，production `api.aaveapy.com/api/docs/openapi.json` 仍含 Merit 24 处 / `ApiMeritCampaign` 14 处，staging 已全部删除(0 处)，仓内 `public/openapi.json` 停在 24 处——openapi-sync 红灯、wb-0928a 的"已知非阻塞噪声"与前端 TS2551/2339 同此一根源；(2) **但 production `/markets` 实际已不输出 merit 字段（实测 0 处，与 staging 一致）**，故票面「生产运行时不受影响、prod 前后端世界都有 Merit」的前提已推进为「两端数据都为零」，前端清理无运行时风险，不必等后端 prod spec 收敛；(3) 前端引用面实测落在高风险区：`incentiveAggregation.ts` 20 处、`IncentiveTooltip.tsx` 13、`SimulationSubRow.tsx` 7、`types/aave.ts` 5、`merit.ts`/`meritForecast.ts` 及各自测试；**另有一类不在代码链里的东西——`src/locales/*/landing.json`(4 处) 与 `ui.json`(1 处) 的对外文案仍把 Merit 当卖点宣传**，属产品/SEO 决策，应与拆除链分开拍板（AAV-1289 只拆了后端与 worker，前端镜像正是本票）。
> 同批候选:**AAV-1316**(stub 注入证明 AAV-895 用例可达)/ AAV-1318(offset discovery 复用 room·LTV 门)——均 ready-for-agent 且无外部依赖;下一梯队:AAV-1323(绝对几何阈值卡实盘)/ AAV-1315(failedSources 只到 hook、组件零消费)/ AAV-1313·AAV-1314(onchain RPC 未按 chainId 共享 / multicall 全失败返回假成功);AAV-1295/1292 依赖 CI 与部署窗口;AAV-1319 需先认可 AGENTS.md 验证门改动。**AAV-1329 已于 2026-10-09 交付关闭**，不再在候选列。



---

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
| AAV-1330 | High | 已交付待上线（`52e5ace1`，随下一笔 lovable→dev） | [pre-push] hook 吞掉 `ci:remote` 失败。真因是 errexit 对 `&&` 非末位命令的例外，不是"后四道门覆盖 `$?`"；e2e 作末位命令仍能挡（订正见 Linear 与 `.husky/pre-push` 注释） |

### Medium

| Linear | Priority | State | Title |
| --- | --- | --- | --- |
| AAV-1334 | Low | Backlog | [CI] generate-snapshots dispatch job 引用已删除的 visual spec（`7c48ae01` 删文件时漏了 job），手动触发 CI 恒红 "No tests found"（push 触发恒 skipped 故从未暴露；整改方向＝删 job） |
| AAV-1327 | Medium | Backlog | [CSP] Cloudflare **JavaScript detections（bot 检测）**自动注入的内联块被 `script-src` 拦 → 生产每条加载 1 条 console error。**建票时归因错了**（写成「Web Analytics beacon」）：真浏览器复现 + 逐 inline script 扫字面量证明被拦块含 `challenge-platform/scripts/jsd`、不含 beacon，且 Web Analytics 早已是 disabled（用户看板所见一致）。zone plan = Free ⇒ 按一手文档该检测「automatically enabled and cannot be disabled」；hash 也钉不住（`r`/`t` 每请求变，10-05 现场再验，Chrome 建议的 hash 与建票时不同）。详见票内更正 #2。建议：确认没有吃 bot score 的防火墙规则后，按「接受为已知噪音」关闭并附解释（我这份 token 读 zone settings 是 403/9109，需用户在 Dashboard 看） |
| AAV-1323 | Medium | 已 push 待 CI 复验（`7e3d868c` 在 `origin/lovable`；pre-push 全门三轮全绿；CI run `38177124100` 起跑。**剩验收项：CI 连续 ≥3 绿 → 关票**） | [e2e] market-filter-pin 用例 (5) 用绝对几何阈值卡实盘数据 → CI 隔频报红（首跑与 Retry 数值逐位相同，非时序；同族 AAV-1307 是另一种形态） |
| AAV-1303 | Medium | Todo（**第一段已交付** #710/#711：`openapi-sync` 恢复绿、契约改手写 base + 13 例解析测试；剩第二段真删 Merit，含 5 语言 landing 文案需产品拍板） | Merit 退役清理：前端 schema/契约/Forecast 链路移除 + openapi-sync 恢复（prod `/markets` 已零 merit 数据，唯 landing/UI 文案仍宣传） |
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
| AAV-1323 | e2e market-filter-pin 用例 (5) 绝对几何阈值卡实盘（`eba3be94` 行前提发现式挑行+条件 skip；几何阈值判定为 app 自有 sticky 几何无需整改；e2e-desktop 三 run 全绿验收 `38177124100`/`38177997224`/`38196292330`） | 2026-10-12 |
| AAV-1318 | offset discovery gates borrow room and LTV funding power（`d9809781`：O12–O22 单测，staging 4→4 结构性修复，e2e 8 passed） | 2026-10-12 |
| AAV-1316 | cross-asset-pairing e2e synthetic 载荷 stub（`9cc1cebf`：真实 fixture 注入 + 真实 discovery 门控选景 + `page.route` 双拦全 hermetic + baseline 零断言；AAV-895 min(1,2) 链路首次真实执行，stub 双平台 passed 6.9s/9.5s；live 路径零变化） | 2026-10-10 |
| AAV-1329 | e2e 首步等待改「页面自身就绪判据」（`3430b65b`：3 处 `networkidle` → `waitForPageReady(page)`，断言一行未动）+ 新增 `scripts/e2e-wait-strategy.test.mjs` 静态守卫（随既有 `npm test` 生效，11 例含真实 `e2e/` 目录集成断言，改前必红）；3 次整条套件本 spec 均 9/9 绿、单例 1.6–3.1s；**未 push** | 2026-10-09 |
| AAV-1331 | architecture-guard 的 FS 遍历改一次性（`a0c8982f`：记忆化 + 清单提到模块作用域 + 导入期预热；全量 `npm test` 6 failed → **rc=0 / 4098 passed**，用例只增不减；不放宽 `testTimeout`） | 2026-10-09 |
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