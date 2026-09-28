# AAV-1308 — Cross-Asset Pairing E2E Discovery 与 UI 渲染门控对齐

> Status: drafted 2026-09-28 · Issue: AAV-1308 · Type: test-side hardening (e2e) · 先例: `docs/specs/aav-1280-offset-discovery-computability.md`

## 背景与根因

`e2e/portfolio-cross-asset-pairing.spec.ts`（AAV-895 min(1,2) 配对用例）在模块加载时内联跑 `discoverCrossAssetScenarios()`，用 `breakdowns.reduce((s, b) => s + (b.campaignApr ?? 0), 0)` **裸加 raw APR** 选场景。它与 AAV-1280 修复前的 offset 用例同病，并且缺的门不止一道：

| 缺口 | UI 侧真实行为 | 用例后果 |
| --- | --- | --- |
| 不校时间窗（`isCampaignActive(…, allowOpenEnd=false)`：缺 start/end 即排除）、不排 `whitelistOnly`、不排 AMOUNT 变体 | `sumMerklIncentiveApr`（supply/borrow 两侧共用同一道门链）不计入 → incentive cell 渲染 `—` | `readIncentiveAfter` 取不到 `span[data-after]` → 读到 0 → `halfPairedAfter > baselineAfter` 失败（AAV-1280 原始失败形态） |
| 不查 supply room / borrow room | `availableSupplyRoomUsd` / `availableBorrowRoomUsd` 把输入钳到 0（`rateSimulationCalculator.ts`） | 仓位被钳零 → 断言在同一个值上恒真/恒假（假绿灯） |
| 不查 LTV 融资额度 | 借入侧靠 runner 先 supply $100k 撑出额度；低 LTV 时借不满（AAV-1250 clamping） | 借入金额被钳 → min(1,2) 比例断言失真 |
| 允许 `pairedReserveId === reserveId`（自配对） | UI 正常算 | runner 第二次 `addReserveToPortfolio` 命中同一行，后续 fill **覆盖**上一步金额 → 断言语义失效 |
| 允许 source 与 paired 同 `tokenSymbol` | UI 正常算 | `fillSupplyAmount` / `fillBorrowAmountDesktop` 按 accessible name + `.first()` 定位 → 填错行 |

**当前真实数据（2026-09-28 实测 staging + production `/api/markets`，各 411 reserves / 42 merkl group）**：`crossAssetPairing` 出现 **0 次**（两环境一致；`netPositionConstraint` 42 次），即该用例现在恒 skip，缺陷为潜伏态。门控缺口在真实数据上有牙：带 Merkl 组的 35 条 reserve 中 4 条 `suppliable`=0、3 条借出空间 < $5000（sAVAX/Avalanche = $0、syrupUSDC/Monad = $1、kHYPE/Ink = $90）、39 个 symbol 跨多条 reserve 重复。`openapi.json` 仍声明该字段（6 处）→ 是上游当前无此类活动，不是后端停止下发。

因此本票的运行时证据上限只有「spec 干净 skip」；门控正确性由单测逐条锚定（对齐 AAV-1280 的 M/O 系列口径）。

## 设计

沿用 AAV-1299/1280 确立的模式：**纯选择逻辑住 `e2e/reserveDiscovery.ts`（零依赖、可被 vitest 单测），spec 只保留 fetch + 消费**。镜像而非 import app 代码（`incentiveAggregation.ts` / `rateSimulationCalculator.ts`）是有意的：app 侧门控回归时不会被发现逻辑静默跟随。

1. **`discoverCrossAssetPairingScenarios(reserves, nowIso): CrossAssetScenario[]`** 新纯函数，`CrossAssetScenario` 类型随函数从 spec 迁入。遍历 `merklSupplys`（side=`supply`）与 `merklBorrows`（side=`borrow`）两侧，per-group 只累加 `isComputableMerklCampaign` 通过的 breakdown APR。
2. **可算性门复用**：既有 `isComputableMerklCampaign` 一字不改；把 `merklSupplyBreakdowns` 泛化为按侧取组的内部 helper，使 borrow 侧走同一条门链（AAV-1308 票面要求「两端均复用」）。
3. **可行性门（新增）**：`getBorrowRoomUsd(r)` 导出，优先级与 `getSupplyRoomUsd` 对称——`borrowable` → `max(borrowCap − borrowed, 0)` → `null`（数据不足视为不排除，与既有 `null` 语义一致）。
4. **统一仓位可行性谓词** `usableForSimulatedPosition(r, side)`：一条 reserve 要能在 runner 的输入序列下不被钳。要求 `!frozen && !paused && isActive !== false && ltv > 0 && supplyDisabled !== true && supplyRoom ≥ MIN`；当 `side === 'borrow'` 追加 `borrowDisabled !== true && borrowRoom ≥ MIN && min(supplyRoom, 100_000) × ltv/100 ≥ MIN`（最后一项 = runner 先 supply $100k 后能撑出的 LTV 额度）。source 侧按 `side` 判、paired 侧按 `pairedSide` 判。
5. **常量 `PAIRING_SIM_MIN_ROOM_USD = 5000` / `PAIRING_SIM_FUNDING_USD = 100000`**：前者是 runner 在任一 reserve 上输入的**最大单笔**金额（paired 阶梯 500/2000/5000），故作为两侧 supply/borrow room 的下限；后者是 runner 为撑出借入额度先 supply 的金额，参与 LTV 额度计算。`> 0` 不够：room 只有几美元时每一笔都被钳到同一个值，相对断言退化为噪音。runner 改输入额时同步这两个常量。
6. **数据形态防御**：排除自配对（`pairedReserveId === reserveId`）与 source/paired 同 `tokenSymbol` 的组合——两者都是 fill helper 按符号定位带来的歧义，属测试侧保守限制（真实 min(1,2) 配对几乎都是不同符号；helper 改为按 `reserveId` 行内定位是独立重构，见 Out of scope）。
7. **不镜像 `pairing.sourceSide`**：UI 的 `computeCrossAssetNetEligible` 只按当前侧 gross 计算，完全不读该字段；用例同样忽略它。发现逻辑不替后端做数据体检——若上游给出 `merklSupplys` 里 `sourceSide='borrow'` 的组，用例与 UI 仍一致。
8. **dedup 与排序保持**：dedup key `reserveId:side`（同一 reserve 的 supply/borrow 两侧各出一条，首个**完整通过全部校验**的组胜出）；排序保持 APR 降序；`slice(0, 2)` 留在 spec。
9. **spec 侧清理**：删除内联 discovery 与外层 `try/catch`；`getMarketChipLabel` 改直接从 `./reserveDiscovery` 导入。`test-reserves.ts` 的纯 helper 再导出整条删除（`getMarketChipLabel` 的唯一外部消费者就是本 spec，`getSupplyRoomUsd` 从来无人消费）。
10. **discovery 不得抛错**（review 追加）：`/markets` 载荷在 e2e 侧未经 schema 校验，缺 `marketName`/`tokenSymbol`/`chainName`/`reserveId` 的 reserve 一律不可选（`hasRunnerIdentity`）。删掉 `try/catch` 后若保留裸访问，一条脏数据会把整份 spec 变成 collection error——skip 只该丢一个场景，不该丢一个文件。
11. **label 镜像修正**（review 追加）：`getMarketChipLabel` 原实现「非 Ethereum 直接返回 chainName」，而 app（`getSubMarketLabel`）只从 `marketName` 派生。两者对 `AaveV4AVAXCorrelated`（Avalanche）、`AaveV4CoinbaseStocks`（Base）、`AaveV3XLayer` 等给出不同标签，`addReserveToPortfolio` 匹配不到就静默退回 `.first()` → 填错行。改为与 app 同算法，并用 39 个现网 marketName 的**一致性测试**（P20）钉住镜像。
12. **cap=0 语义**（review 追加）：Aave 的 `supplyCap`/`borrowCap` 为 0 表示「无上限」，app 在 `rateSimulationCalculator.ts` 里也以 `capUsd > 0` 为条件。镜像原先会算出 `max(0 − used, 0) = 0` → 误判「无空间」而假 skip，现补上同一道 `> 0` 守卫（对 supply 侧同样是修正）。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `e2e/reserveDiscovery.ts` | 新增 `discoverCrossAssetPairingScenarios` / `CrossAssetScenario` / `getBorrowRoomUsd` / `PAIRING_SIM_MIN_ROOM_USD` / 内部 `usableForSimulatedPosition` `hasRunnerIdentity` `indexReservesById`；`merklSupplyBreakdowns` 泛化为按侧 helper；两处镜像修正（§11 label、§12 cap=0） | Medium | 波及既有消费者的只有三条共享路径，且方向都是「与 app 对齐」：`getMarketChipLabel`（offset / incentive-calculation 两个 spec 的行匹配由「可能退回 `.first()`」变成命中正确行）、`getSupplyRoomUsd`（cap=0 从假 0 空间变 null=不排除）、`computeSupplyNetApyPercent`/`discoverOffsetScenarios`（改用共享 `computableAprPercent`，逐行等价）。`isComputableMerklCampaign` 与 `usableForOffsetPosition` 语义未动；M/S/O 全系列继续绿。 |
| `e2e/portfolio-cross-asset-pairing.spec.ts` | 内联 discovery 替换为共享纯函数；去掉 `try/catch`；导入改直连；两处 `test.skip('字符串')` 改 `test.skip(true, '…')` | Low | runner 与断言逻辑不动；`CrossAssetScenario` 字段集保持不变以维持与 `addReserveToPortfolio`/`fill*`/`readIncentiveAfter` 的契约。`test.skip` 改形是 review 发现的既有类型错误（不匹配任何 Playwright 重载，靠运行时真值侥幸生效），不改则 e2e 显式 tsc 无法转绿——即 P18 的证据来源。 |
| `e2e/test-reserves.ts` | 删除纯 helper 再导出整行（`getMarketChipLabel` + `getSupplyRoomUsd`） | Low | 静态可判定：前者唯一消费者是本 spec，后者从来无消费者。 |
| `src/test/reserveDiscovery.test.ts` | 新增 P 系列单测覆盖场景矩阵 + marketName/tokenSymbol 形态修正（O2 fixture 的 chain 与 market 原本互相矛盾，被 §11 暴露） | Low | 纯追加 + 一处 fixture 形态修正。 |

最坏后果：门控过紧，未来真实配对活动被误 skip。缓解：每条门都有单测锚定且方向保守（只会把「会失败的场景」变成 skip，不会把「能过的场景」变成失败）；skip 是安全失败模式，不阻塞 push；`MIN=5000` 按实测对主流 reserve 无门槛（241/296 条活跃 reserve 的 supply room ≥ $5000）。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| P1 | `merklSupplys` 上有可算 crossAssetPairing 组，双方 reserve 可行 | 产出一条 `sourceSide='supply'` 场景，字段齐备 | Medium | automated test | — |
| P2 | 组在 `merklBorrows`（AAV-1308 票面核心：borrow 端复用门控） | 产出 `sourceSide='borrow'` 场景，且 borrow 侧可行性门生效 | High | automated test | — |
| P3 | 组内含 expired 大 APR + 可算小 APR | `apr` 只累计可算部分（AAV-1280 O3 同形回归） | High | automated test | — |
| P4 | 组内 breakdown 全不可算（expired / `whitelistOnly` / AMOUNT 变体 / 缺 end 边界） | 不产出场景（原始失败形态 → skip） | High | automated test | — |
| P5 | points-only 组（`campaignApr=0`、`pointsPerThousandUsd>0`） | 不产出（比例断言需要百分比 APR，与 O5 一致） | Low | automated test | — |
| P6 | source 或 paired：frozen / paused / `isActive=false` / `ltv=0` / `supplyDisabled` | 不产出 | Low | automated test | — |
| P7 | supply room 恰为 `MIN-ε` / `MIN` / `null`（数据缺失） | 前者排除、后两者保留（`null` 不排除） | Medium | automated test | — |
| P8 | 需要借入的一侧：`borrowRoom < MIN` / `borrowDisabled` | 不产出；不需要借入的一侧即使 `borrowRoom=0` 也产出 | High | automated test | sAVAX 类 `borrowRoom=0` 实测存在 |
| P9 | 低 LTV：room 充裕但 `min(room,100k)×ltv/100 < MIN` | 借入侧不产出（融资额度不足） | Medium | automated test | — |
| P10 | 自配对 `pairedReserveId === reserveId` | 不产出（防 fill 覆盖） | High | automated test | — |
| P11 | source 与 paired 同 `tokenSymbol` | 不产出（防 fill 选错行） | Medium | automated test | 39 个重复 symbol 实测存在 |
| P12 | `pairedReserveId` 不在载荷中 | 不产出 | Low | automated test | — |
| P13 | dedup：同一 `(reserveId, side)` 多组 → 首条完整合格者胜；同 reserve 的 supply 与 borrow 两侧各一组 → 两条场景 | 与声明一致 | Low | automated test | — |
| P14 | 排序 | `apr` 降序；同 `apr` 保持输入顺序（稳定） | Low | automated test（P14 降序 / P14b 同值） | — |
| P15 | 空数组 / reserve 无任何 merkl 组 / `crossAssetPairing: null` | 返回 `[]` | Low | automated test | — |
| P16 | `pairing.sourceSide` 与所在数组侧不一致 | 仍产出（镜像 UI 忽略该字段） | Medium | automated test | — |
| P17 | `getBorrowRoomUsd` 语义：`borrowable` 优先 → `borrowCap − borrowed` → `null`；`0` 与 `null` 不混同 | 与 `getSupplyRoomUsd` 对称 | Medium | automated test | — |
| P20 | e2e 的 `getMarketChipLabel` 镜像 vs `src/lib/marketLabels` 现网 39 个 marketName | 逐个完全一致（否则 Add 按钮匹配失败退回 `.first()`，选到错行） | High | automated test（一致性测试 P20 + 关键差异例 P20b） | review 追加；镜像修正见设计 §11 |
| P21 | reserve 缺 `marketName` / `tokenSymbol` / `chainName` / `reserveId` | 该 reserve 不可选，且 discovery **不抛错**（否则整份 spec collection 失败） | High | automated test | review 追加；设计 §10 |
| P22 | `supplyCap` 或 `borrowCap` = 0（Aave 语义 = 无上限） | room 判定为 `null`（不排除），而不是 0（排除） | Medium | automated test | review 追加；设计 §12 |

### 验证证据（Evidence Hygiene 要求的非空产出）

- 单测：`src/test/reserveDiscovery.test.ts` **97 passed**（既有 M/S/O 系列 43 条 + 本票 P 系列 54 条），`npm test` 全量 **3849 passed / 176 files**。
- 静态：`npm run lint` 0 error；`npm run typecheck` 0 error；e2e 显式 `tsc --noEmit e2e/{reserveDiscovery,test-reserves,portfolio-cross-asset-pairing}.ts` 0 error（改前 2 error，即 `test.skip` 重载不匹配）。
- 运行时：`npx playwright test portfolio-cross-asset-pairing portfolio-cross-reserve-offset portfolio-incentive-calculation` → **12 passed / 20 skipped / exit 0（55.5s）**。两个 discovery 型 spec（pairing、offset）因 0 场景全 skip；`portfolio-incentive-calculation` 真实点击通过，作为 `getMarketChipLabel` / `getSupplyRoomUsd` 两条被改共享路径的消费者回归证据。
- 数据事实（2026-09-28）：staging 与 production `/api/markets` 各 411 reserves、42 merkl group，`crossAssetPairing` 出现 0 次；带 Merkl 组的 35 条 reserve 中 4 条 `suppliable`=0、3 条借出空间 < $5000、39 个 symbol 跨 reserve 重复。**「0 场景」本身不是门控正确性的证据**，P 系列单测才是；运行时只证明收紧未破坏收集与既有消费者。
| P18 | 产出对象的字段被 runner 全量消费（`*Symbol`/`*MarketLabel`/`*ReserveId`/`*Side`/`discountFactor`/`chainName`/`apr`） | 迁移无字段丢失 | Medium | automated test（P1 用 `toEqual` 锁定整对象形状）+ 显式 e2e tsc | e2e 不在 CI 静态门内（见 Out of scope），须显式跑 `tsc --noEmit … e2e/*.ts` |
| P19 | 当前真实 staging 数据 | `npx playwright test portfolio-cross-asset-pairing` 全量 skip、无失败；显式记录「0 场景」不是门控有效性的证据 | Low | runtime-real-data + 本文件实测计数 | 运行时验证的缺口由单测承担；AAV-895 用例本身的可达性另开票 |

## Out of scope

- **AAV-895 用例的可达性**：该 spec 自落地以来从未真实选中过场景（当前数据 0 条），其交互流与断言是否仍然成立未经运行时验证。需要一条 `page.route('/markets')` 注入 synthetic pairing 组的变体（repo 内已有 3 个 spec 用 `page.route` 的先例）——独立 follow-up 票。
- **fill helper 按 `reserveId` 定位**：修掉 P10/P11 的根因（按符号 + `.first()` 找输入框），涉及 4 个 spec 共用的 `fillSupplyAmount` / `fillBorrowAmountDesktop`，属独立重构；完成后 P11 的保守排除可解除。
- **`discoverOffsetScenarios` 的同类 room/LTV 门**：其 offset 侧目前只查 `borrowDisabled` 与 `suppliable > 0`，未查借出空间与 LTV 额度。本票新增的 `getBorrowRoomUsd` 与 `usableForSimulatedPosition` 即为可复用底座，但改它等于变更 AAV-1280 已验收行为，另票处理。
- **e2e 平台互斥 skip 反模式**（`test.skip(testInfo.project.name.includes('mobile'), …)`）：本文件与 `api-fields-verification` / `portfolio-incentive-calculation` / `portfolio-cross-reserve-offset` 同样写法，属仓库级既有模式，本票不动，待仓库级统一整改。
- **e2e 目录未被静态门完整覆盖**：`npm run lint` 的 eslint 忽略整个 `e2e/`；`npm run typecheck` 只含 `src` + `vite.config.ts`，`e2e/reserveDiscovery.ts` 仅因被 `src/test/reserveDiscovery.test.ts` import 而被顺带编译，`e2e/*.spec.ts` 与 `e2e/test-reserves.ts` 无人检查；AGENTS.md 验证门里的 `npx tsc --noEmit` 在根 solution 配置（`files: []` + references）下检查 **0 个文件**。本票因此显式跑 `tsc --noEmit … e2e/{reserveDiscovery,test-reserves,portfolio-cross-asset-pairing}.ts` 取 P18 证据（改前该命令报 2 个既有错误：`test.skip('字符串')` 不匹配任何 Playwright 重载——正因 CI 从不检查 spec 文件而长期存活）。把 e2e 纳入常态 lint/typecheck 是独立议题。
- **`getMarketChipLabel` 修正的连带影响面**：三个 portfolio spec（本票、`portfolio-cross-reserve-offset`、`portfolio-incentive-calculation`）共用它。修正只让 e2e 标签与 UI 渲染一致（此前 V4 非 Ethereum 市场会退回 `.first()` 选到错行），实跑三者验证见「验证证据」。
- AMOUNT 变体在 UI 侧的实际展示策略（AAV-1275 产品决策，仍 open）。
- 后端 `crossAssetPairing` 下发时机与 `sourceSide` 字段语义（P16 记录的不一致属数据侧观察，非本票修复对象）。
