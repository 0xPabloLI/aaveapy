# AAV-1311 — Onchain fallback 非 18-dec 代币 USD 金额缩水修复

> Status: implemented 2026-09-27 · Issue: [AAV-1311](https://linear.app/aaveapy/issue/AAV-1311) · Type: on-chain fallback path fix (data layer)

## 背景与根因

onchain fallback 链路（`onchain-v3` / `onchain-v4` / `gap-v3` / `gap-v4`）对非 18-dec 代币的 USD 金额错误：

```
DataProvider.getUserReserveData.currentATokenBalance  // 代币原生精度 raw（如 USDT 6-dec）
→ V3UserPosition.supplyWad                            // 直传，无缩放（aaveV3UserClient.ts）
→ mapV3PositionToWalletPosition: amountUsd = wadToHuman(amountWad) × tokenPrice  // ÷10^18
```

`wadToHuman` 无条件除以 10^18，忽略 `meta.decimals`。6-dec 代币（USDT/USDC）结果缩小 10^12 倍：Celo USD₮ 1044.77 → ≈$0.000001。18-dec 代币恰好正确，因此 UI 上多数仓位正常、稳定币仓位在 fallback 模式下接近 $0。

**证据链**（triage 评论 + 静态核查）：

1. 合约语义：`getUserReserveData` 返回 `scaledBalance.rayMul(liquidityIndex)`，代币原生精度（aave-v3-core `IPoolDataProvider`）。
2. 实测：Celo USD₮ word0 raw = 1044773458，6-dec 解码 = 1044.77 USDT（与测试钱包实际持仓一致）。
3. 静态链：client / converter / mapper / fallbackPositions / walletPositionToPortfolio 五文件均无 decimals 处理；`WalletPosition.amountWad` 生产代码零消费（下游只消费 `amountUsd`）。
4. 对照：SDK 主路径用人类可读 `balance.amount.value` × price（`sdkPositionConverter.ts` `toSafeUsd`），正确——两条路径在 fallback 合并时金额差 10^12 倍。
5. 单测为何没抓到：mapper / converter 测试 fixture 全部用 `5000n * WAD`（18-dec 形态）配 6-dec meta，mock 世界从未出现非 18-dec raw。
6. 一致性测试为何没抓到：只断言 `> 0` 与 finite，无法区分 10^12 缩水。

**影响面**：SDK 主路径不可达时启用 fallback（AAV-1305 layer 1 设计场景）——持稳定币仓位的用户看到 ≈$0 组合价值。V4 路径同构（Spoke `getUserReserveStatus` 返回原生精度 raw）。

## 设计（方案 1：最小闭环修复，triage 已裁决）

1. **`userPositionMapper.ts`**：
   - `wadToHuman(wad)` 泛化为按精度缩放的 `rawToHuman(raw, decimals)`：`divisor = 10n ** BigInt(decimals)`，保持既有两段法（整数部分 + 分数部分分别转 Number）避免大数丢精度。
   - `mapV3PositionToWalletPosition` / `mapV4PositionToWalletPosition`：`amountUsd = rawToHuman(amountWad, meta.decimals) × meta.tokenPrice`。
   - `decimals` 兜底语义：`meta.decimals` 由 resolver 保证——真实 reserve 命中时 `reserve.decimals ?? DEFAULT_TOKEN_DECIMALS`（=18）；孤儿 meta `decimals: 0` 且 `tokenPrice: 0` → `amountUsd` 恒 0（divisor = 10^0 = 1，数学合法，不特判不 crash）。
   - `WalletPosition.amountWad` 接口注释文档化真实语义：**onchain/gap 路径装的是代币原生精度 raw（非 18-dec wad）**；SDK 路径为混合语义（`onChainValue` 优先 = 原生 raw，缺失时 `decimalToWad` 归一为 18-dec wad）。字段名不改（生产零消费，改名属无关 refactor）。
2. **测试 fixture 形态修正**（evidence hygiene：mock fixture 必须复刻真实数据形态）：既有 mapper / converter 测试中 6-dec meta 配 `5000n * WAD` raw 的 fixture 全部改为真实形态（`5000n * 10n**6n` 配 `decimals: 6`）。
3. **`userPositionConsistency.test.ts` 量级断言**：新增 invariant 复算——每个仓位的 `amountUsd` 必须与「raw / 10^decimals × tokenPrice」（decimals 与 price 独立取自 /markets reserves）相对偏差 < 1e-6。该断言能确定性抓住本类缩放 bug（修复前偏差 10^12 倍）。

**契约不变量**：`WalletPosition` 字段名与类型零变更；`convertWalletPositionsToEntries` 等下游消费方零改动；SDK 转换路径（`sdkPositionConverter.ts`）零改动（其 `amountUsd` 本就来自人类可读值）；gap 路径复用同一对 converter/mapper，修复自动生效。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/lib/userData/userPositionMapper.ts` | `wadToHuman` → `rawToHuman`（+decimals 参数）；两个 map 函数 `amountUsd` 计算改用 `meta.decimals`；`amountWad` 注释文档化 | Medium | 核心 fallback 路径数据流修改，但下游生产代码只消费 `amountUsd`（字段名/类型不变）；18-dec 代币行为逐位不变（divisor 相同）；SDK 路径不经这两个函数 |
| `src/lib/userData/userPositionMapper.test.ts` | fixture 形态修正（6-dec raw 配 6-dec meta）+ 非 18-dec 转换矩阵 | Low | fixture 修正使其首次复刻真实数据形态 |
| `src/lib/userData/onchainPositionConverter.test.ts` | 同上 fixture 修正 + 多 token 混合精度用例 | Low | 纯测试改动 |
| `src/test/userPositionConsistency.test.ts` | 新增金额量级 invariant 断言 | Low | live 测试（无 `WALLET_ADDRESS` 时 skip），断言收紧不放松 |

最坏后果：divisor 计算错误导致 18-dec 代币金额回归。缓解：既有 18-dec 用例（5000×WAD × price）原样保留作回归锚；`rawToHuman(raw, 18)` 与旧 `wadToHuman` 在相同输入下逐位一致（两段法不变）。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | V3 6-dec supply（raw=1044773458, decimals=6, price=1） | amountUsd ≈ 1044.773458（修复前 ≈1.04e-9） | High | automated test（toBeCloseTo） | 票面 Celo 实测值作 fixture 原型 |
| 2 | V3 18-dec supply（5000n×WAD, decimals=18, price=3000） | amountUsd = 15,000,000（既有行为逐位回归） | High | automated test（既有用例保留） | — |
| 3 | V3 6-dec borrow（stable+variable raw 合并后按 6-dec 缩放） | amountUsd 按 6-dec 缩放正确 | High | automated test | — |
| 4 | V4 6-dec supply/borrow（suppliedAssets/debt raw） | 按 6-dec 缩放正确 | High | automated test | — |
| 5 | V4 18-dec supply/borrow | 既有行为回归 | Medium | automated test（既有用例） | — |
| 6 | 孤儿仓位（meta.decimals=0, tokenPrice=0） | amountUsd = 0，无 NaN/异常（divisor=10^0=1） | Medium | automated test | — |
| 7 | 分数精度：raw 两段法转 Number 不丢精度 | 1044773458 / 10^6 = 1044.773458 精确（整数部分 + 分数部分分别转换） | Medium | automated test（toBeCloseTo ≥6 位小数） | — |
| 8 | 多 token 混合（同 wallet 6-dec + 18-dec 并存） | 各仓位按各自 decimals 独立缩放，互不污染 | Medium | automated test（converter 层） | — |
| 9 | decimals 缺失的 reserve | resolver 兜底 DEFAULT_TOKEN_DECIMALS=18，行为与修复前一致 | Low | automated test（既有 resolver 用例） | — |
| 10 | fixture 形态一致性 | onchain 测试 fixture 的 raw 与 meta.decimals 形态匹配（6-dec raw 配 6-dec meta），不再用 18-dec 形态 raw 冒充非 18-dec 代币 | Medium | automated test（由修正后的测试本身保证） | evidence hygiene 契约 |
| 11 | 下游消费契约 | `convertWalletPositionsToEntries` 只消费 `amountUsd`，字段名/类型零变更 | Medium | static-type-lint（tsc + 既有 walletPositionToPortfolio 测试回归） | — |
| 12 | SDK 路径回归 | `sdkPositionConverter` 零改动，既有断言（amountWad=1.5e18 等）不变通过 | Medium | automated test（既有用例） | — |
| 13 | gap 路径 | `fetchFallbackPositions` 复用 converter/mapper，修复自动生效 | Low | automated test（既有 gapFallbackQuery 回归）+ 架构同函数 | — |
| 14 | live 金额量级（runtime） | 测试钱包真实 RPC + staging /markets：每仓位 amountUsd 与独立复算值（raw/10^dec × price）相对偏差 < 1e-6 | High | runtime-real-data（WALLET_ADDRESS 跑一致性测试） | 金额随利息自然漂移，用相对容差 |
| 15 | 验证门 | lint + test + build + tsc 全绿 | Medium | static-type-lint（CI gate 四件套） | — |

## Tickets（tracer-bullet 依赖边）

- **T1**（red）：mapper 测试新增非 18-dec 矩阵（矩阵行 1/3/4/6/7）→ 预期 red
- **T2**（green）：`rawToHuman` + 两个 map 函数实现 + 既有 18-dec 用例保留回归（矩阵行 2）→ red 变 green
- **T3**（green 收尾）：converter 测试 fixture 形态修正 + 多 token 混合用例（矩阵行 8/10/12）
- **T4**：一致性测试量级断言 + live 实测（矩阵行 14）
- **T5**：验证门四件套 + code review + commit + docs/Linear 更新（矩阵行 11/13/15）

依赖边：T1 → T2 → T3 → T4 → T5（T2/T3 改同一测试文件族，串行避免冲突）。

## Out of scope

- AAV-1310（RPC 轮换耗尽静默空成功）——相邻缺陷，独立票。
- `WalletPosition.amountWad` 改名或归一为 18-dec wad——生产零消费，文档化语义即可；如未来开始消费 amountWad，需先统一 SDK `decimalToWad` fallback 的混合语义（另开票）。
- SDK 转换路径（`sdkPositionConverter.ts`）——`amountUsd` 来自人类可读值，无此 bug。
