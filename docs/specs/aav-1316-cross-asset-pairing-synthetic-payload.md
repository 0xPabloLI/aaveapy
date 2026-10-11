# AAV-1316 — Cross-Asset Pairing E2E synthetic 载荷变体：证明 min(1,2) 链路真实可达

> Status: drafted 2026-10-10 · Issue: AAV-1316 · Type: test-side capability (e2e) · 先例: `docs/specs/aav-1308-cross-asset-pairing-discovery.md`（Out of scope 第 1 条点名本票）

## 背景与根因

`e2e/portfolio-cross-asset-pairing.spec.ts`（AAV-895 min(1,2) 配对用例）自落地以来**一次真实场景都没跑过**：2026-09-28 实测 staging 与 production `/api/markets`，`crossAssetPairing` 出现 0 次，整份 spec 恒走 "no scenarios found" 分支 skip。AAV-895 交付的交互流（加两个 reserve、按阶梯填 500/2000/5000、读 `data-after` 比大小）是否仍然成立，没有任何运行时证据——UI 侧有单测（`rateSimulationCalculator.test.ts` / `netLendingCrossReserve.test.ts`），但 e2e 这条链是死支路。

AAV-1308 的门控收紧只解决「选中即真」，运行时证据的上限仍是「干净 skip」。本票补一条 **stub 变体**：注入 synthetic `crossAssetPairing` 载荷，让既有 runner 真实执行一次。

## 已裁决的设计决策（2026-10-10 grill）

1. **基底载荷 = 提交进 repo 的修剪版真实 staging 载荷 fixture**。理由：`fetchStagingReserves()` 失败静默返回 `[]`，若 stub 变体依赖实时 staging，CI 网络/数据不配合时它也会 skip——重蹈本票要修的「恒 skip」覆辙。fixture 是真实载荷（保留字段形态，避免单测与运行时各带盲区），同时确定性、CI 不依赖外网。先例：39 个现网 marketName 一致性测试即现网数据快照。fixture 陈旧风险接受：schema 漂移时该测试会红（fail loudly），届时按 spec 内再捕获流程更新。
2. **desktop + mobile 双平台生成**，与既有 spec 对 live 场景的结构一致（Mobile as First-Class Citizen）。
3. **stub 变体放同一 spec 文件新增 describe**：复用模块私有 runner（不导出测试内部函数），与 live 场景同文件可对照。
4. **场景选择 = 注入后跑既有 `discoverCrossAssetPairingScenarios`**。不手工构造 `CrossAssetScenario`：门控语义（AAV-1308 全套）自动复用，且 Node 侧 discovery 与浏览器侧消费同一份注入载荷，两侧天然一致。票面要求的「场景显式传入 runner」由 spec 现有结构保证（runner 本就接收场景参数，不依赖 Node 侧对 staging 的 discovery）。
5. **stub 变体全链路 hermetic**：`page.route` 同时拦 `/markets`（注入载荷）与 `/meta/side-data`（最小确定性载荷）。理由：先例 `wallet-connect-injected` 证明「不碰真网络 → CI 可跑」；side-data 的 forecast 重算路径（`useRateSimulation`）会把 Merkl incentive 换算成 forecast TVL 基准，放行真实 side-data 会引入不确定性。空 side-data 下走 breakdown APR 回退路径，数值确定。
6. **不改 `e2e/reserveDiscovery.ts`**（票面验收标准）：门控语义零改动，只作为被消费方。

## 设计

沿用 AAV-1308 确立的模式：**纯逻辑住独立模块（零 @playwright/test 依赖，可被 vitest 单测），spec 只保留 route 接线与消费**。

1. **新纯函数模块**（e2e 侧）：`buildCrossAssetPairingStub(base, injection)` —— deep-copy 基底载荷、把 `crossAssetPairing: { sourceSide, pairedReserveId, pairedSide, discountFactor }` 注入目标 group、返回改写后载荷与经 `discoverCrossAssetPairingScenarios` 选出的场景。**不 mutate 基底**（fixture 对象被多次使用）。载荷缺 `reserves` / 空数组 / 注入后 discovery 产出 0 场景 → **显式 throw**（fail loudly，绝不静默 skip——本票的存在意义就是消灭静默 skip）。
2. **fixture**：真实 staging `/markets` 响应的修剪版（保留目标 source/paired 两条 reserve 所在市场的完整字段形态），commit 到 `e2e/fixtures/`。捕获时用注入+discovery 试跑选定目标 group（通过 AAV-1308 全部门控），provenance（捕获日期、来源环境、选择依据）记录于本文件。
3. **spec 接线**：stub describe 在 `page.goto` 前挂 route（按 pathname 匹配，host 无关——浏览器侧 API_BASE 默认 `https://staging-api.aaveapy.com/api`）；两条平台 describe 各生成 1 条 stub 用例，调既有 `runCrossAssetPairingScenario`。
4. **runner 微调**：`runCrossAssetPairingScenario` 增加可选参数，stub 变体要求 baseline（paired=0）断言为 **≈0**（live 变体保持既有 `not.toBeNaN()`，行为不变）。这是票面验收标准「证明 paired 仓位为 0 时 incentive 为 0」的落点；fixture 选择时保证注入组是该 reserve 唯一的 incentive 来源，使 0 基线可断言。
5. **阶梯断言不变**：500 → `> baseline`；2000 → `≥ 500 档 − 0.01`；5000 → clamp `|Δ| ≤ 0.05`（runner 既有容差，来源 AAV-895）。
6. **契约锚点**：注入字段名与 wire 契约逐字一致（`sourceSide` / `pairedReserveId` / `pairedSide` / `discountFactor`，见 shared schema 与 `src/types/aave.ts` 的 `CrossAssetPairing`）；`pairedReserveId` 必须解析到 fixture 内真实 reserve（跨系统键匹配）。
7. **静态守卫合规**：无 `networkidle`（等待一律用页面自有信号）；触碰的 e2e 文件显式跑 `tsc --noEmit`（e2e 不在常态 typecheck 覆盖内，AAV-1319 跟踪收编）。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `e2e/crossAssetPairingStub.ts`（新） | `buildCrossAssetPairingStub` 纯函数 + 注入类型 | Low | 零既有消费者，纯新增；复用 `reserveDiscovery` 导出，不改它 |
| `e2e/fixtures/markets-cross-asset-pairing-base.json`（新） | 修剪版真实 staging 载荷 | Low | 纯数据资产；schema 漂移时 SY3/SY4 红（预期失败模式） |
| `e2e/portfolio-cross-asset-pairing.spec.ts` | 新增 stub describe（desktop+mobile）+ route 接线 + runner 可选 baseline 参数 | Medium | live 场景路径行为不变（runner 默认参数）；stub 路径独立 describe；两 describe 共享模块级 TLA 的 staging fetch（live 侧既有行为，stub 侧不依赖其结果） |
| `src/test/crossAssetPairingStub.test.ts`（新） | SY1–SY5 单测 | Low | 纯新增；先例 `src/test/reserveDiscovery.test.ts` import e2e 模块 |

最坏后果：stub 用例在 CI 恒红（fixture 陈旧或 app 渲染依赖超出预期）。缓解：fail loudly 是本票设计意图；修复路径是更新 fixture 或补 route，不是放宽断言。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| SY1 | 注入后 `discoverCrossAssetPairingScenarios(stubPayload)` | 恰产出 1 条场景，字段齐备（AAV-1308 门控全过） | High | automated test | fixture 捕获时已试跑选定 |
| SY2 | builder 对基底载荷 | deep-copy，不 mutate（fixture 复用安全） | Medium | automated test | — |
| SY3 | 载荷缺 `reserves` / 空数组 | builder 显式 throw（非静默 skip） | High | automated test | — |
| SY4 | 注入后 discovery 产出 0 场景（门控不过/键不匹配） | 模块加载即 throw，两条平台 stub 用例标记为 failed 而非 skipped | High | automated test | — |
| SY5 | 注入的 `crossAssetPairing` wire 形态 | 与 `CrossAssetPairing` 契约逐字段一致（含多余字段零容忍，`toEqual` 锁形） | High | automated test | — |
| SY6 | route 拦截后 app 以 stub 载荷渲染 | source/paired 两条 reserve 均可经 `addReserveToPortfolio` 加入，incentive cell 有数值（非 `—`） | High | runtime（Playwright） | 若渲染依赖缺失字段 → 补 fixture 字段（保留真实形态） |
| SY7 | baseline：仅 source 仓位、paired=0 | incentive ≈ 0（runner 可选参数启用精确断言） | High | runtime | 注入组为该 reserve 唯一 incentive 来源 |
| SY8 | paired=500 | incentive > baseline（min(1,2) 生效） | High | runtime | — |
| SY9 | paired=2000 | incentive ≥ 500 档 − 0.01（source 成为绑定约束） | Medium | runtime | — |
| SY10 | paired=5000 | clamp：`|Δ| ≤ 0.05` | Medium | runtime | — |
| SY11 | 双平台 | chromium 与 mobile-chromium 各 1 条 stub 用例 **passed**（非 skipped） | High | runtime | mobile 走 `fillBorrowAmountMobile` / 卡片 `data-after` 路径 |
| SY12 | side-data 空 stub | 数值走 breakdown APR 回退路径；两次独立运行数值逐位一致（确定性） | Medium | runtime（双跑对照） | 若发现 forecast 重算不可回避 → stub side-data 提供最小确定性 metrics |
| SY13 | 静态守卫 | 无 `networkidle`（既有 `scripts/e2e-wait-strategy.test.mjs` 自动覆盖）；触碰的 e2e 文件显式 `tsc --noEmit` 0 error | Medium | automated（既有守卫 + 显式 tsc） | — |
| SY14 | pre-push / CI 覆盖 | stub 用例不在 `scripts/pre-push-e2e.mjs` 排除清单（事实核查）；CI 分片全量跑含本 spec | Low | 静态核查 + runtime | — |

## 验证证据

**fixture provenance**：捕获自 staging `/api/markets`（2026-10-10 ~22:40 UTC+8，`snapshot.lastUpdated` = `2026-10-11T00:40:01.988Z` UTC，同一时刻）。原始载荷 414 reserves；修剪为 AaveV3Base 市场的 WETH（source，唯一 `merklSupplys` 组）与 USDC（paired，无 merkl 组）两条完整对象，字段形态零改动。**候选选择**：对全部 414 reserves 逐一试注入（复用真实 `discoverCrossAssetPairingScenarios`）得 9 个候选，按「注入组为该 reserve 唯一可算激励（baseline=0 可断言）+ 双端同市场异符号 + 无 `netPositionConstraint` 干扰」选定本组（APR 1.434，`borrowBlacklist`/`netPositionConstraint` 均为 null；更高 APR 的 USDe/sUSDe 组带 self-loop offset 约束被排除）。注入参数（`discountFactor=0.5`、宽窗口 2026→2035）记录于 `e2e/crossAssetPairingStub.ts` 的 `AAV1316_STUB_INJECTION`，单测 SY1b 钉住 fixture 与注入的一致性。

- 单测：`src/test/crossAssetPairingStub.test.ts` **8 passed**（SY1/1b/2/3/4/4b/5/5b；SY4b 为确定性负例——过去窗口必 throw）；全量 `npm test` **4107 passed / 14 skipped / 6 todo**（改前 4098，+9 全为新增，既有用例零回退）。
- 静态：`npm run typecheck` 0 error；`npm run lint` 0 error；触碰 e2e 文件显式 `tsc --noEmit` 0 error；`scripts/e2e-wait-strategy.test.mjs` 11/11（SY13）；`scripts/check-e2e-hardcoded-market-names.mjs` 绿（29 specs 扫描，SY13）。
- 运行时（Playwright，本地 dev server，SY6–SY12）：
  - stub desktop **passed 6.9s**；复跑 **passed 7.3s**；stub mobile **passed 9.5s**；复跑 **9.7s**——双平台各 1 条 stub 用例 **passed 非 skipped**（SY11），两轮独立运行全绿 + 严格阶梯断言通过（SY12 确定性：数值走 breakdown-APR 回退路径，空 side-data 下无 forecast 重算）。
  - 断言链实测命中：baseline（paired=0）≈ 0（SY7 零断言经 `toBeCloseTo(0,6)`）→ 500 递增（SY8）→ 2000 不降（SY9）→ 5000 钳住 |Δ|≤0.05（SY10）——min(1,2) 链路首次有运行时证据；若 UI 忽略 `crossAssetPairing`，baseline 即为全 APR ≠ 0，零断言会直接红。
  - 整份 spec 全量（live + stub，双项目）：**2 passed / 6 skipped / 0 failed**——live 场景路径行为零变化（当前 staging 仍 0 条 crossAssetPairing，干净 skip）。
- pre-push（SY14）：`scripts/pre-push-e2e.mjs` `GREP_INVERT` 清单 0 处 `cross-asset-pairing`（静态核查）——stub 用例随 pre-push 门真跑；CI 分片跑全量 spec，同样覆盖。

## Out of scope

- **`e2e/reserveDiscovery.ts` 门控语义**：一字不改（票面验收标准）。
- **live 场景的行为**：既有 staging discovery / skip 逻辑不动；真实配对活动上线后的 live 用例表现不在本票。
- **fill helper 按 `reserveId` 行内定位**（AAV-1317）：本票 fixture 选择时规避同 symbol，不修根因。
- **side-data 最小 stub 的完整契约建模**：只提供让回退路径生效的最小载荷，不校验 side-data 全量 schema。
- **e2e 纳入常态 lint/typecheck**（AAV-1319 跟踪）：本票只做显式 tsc 取证。
- **`test.skip(project.includes('mobile'))` 平台互斥反模式**：仓库级既有模式（AAV-1308 Out of scope 已记录），本票沿用不改。
