# AAV-1305 Phase 2 — V3 仓位读取迁移至 AAVE_PROTOCOL_DATA_PROVIDER

> Status: implemented 2026-09-26 · Issue: AAV-1305 · Type: on-chain fallback path fix (data layer)

## 背景与根因

生产钱包仓位导入的 on-chain fallback 依赖 `Pool.getUserReserveData`，但 **Aave V3.2+ Pool 已移除该函数**：mainnet Pool `0x87870Bca…` 对所有钱包 raw `eth_call` revert（`getUserAccountData` 正常）。Phase 1（`1061bd14`）修正了 `MULTICALL3_ADDRESS` 常量打通 viem 校验；Phase 2 将 `getV3UserPositionsOnChain` 的 reserve 级读取迁移到 `AAVE_PROTOCOL_DATA_PROVIDER`（address book 全部 24 条 V3 链均暴露该地址）。

**实测取证（2026-09-26，chainRegistry 同源 RPC）：**

- mainnet Pool `getUserReserveData(DAI, user)` → revert；DataProvider `0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD` → 正常返回（与票面 2026-09-25 实测一致）。
- Celo DataProvider `0x2e0f8D3B1631296cC7c56538D6Eb6032601E15ED` 查 test wallet（`0x4D1c…5314`）USD₮ 仓位：word0 = `1044773458`（1044.77 USDT，6 decimals，与已知仓位精确吻合）、word8 = 1（collateral）。
- 返回共 9 个 word，与 `aave-v3-core` `IPoolDataProvider.getUserReserveData` 接口定义逐字段互证：

| word | 字段 | 说明 |
| --- | --- | --- |
| 0 | `currentATokenBalance` | 已计息 aToken 余额（零换算，原选 Pool 的理由在 DataProvider 上同样成立） |
| 1 | `currentStableDebt` | |
| 2 | `currentVariableDebt` | |
| 3 | `principalStableDebt` | 不消费 |
| 4 | `scaledVariableDebt` | 不消费 |
| 5 | `stableBorrowRate` | 不消费（零仓位用户也非零——市场级） |
| 6 | `liquidityRate` | 不消费（同上，解开了零仓位返回非零 word 的疑点） |
| 7 | `stableRateLastUpdated` (uint40) | 不消费 |
| 8 | `usageAsCollateralEnabled` (bool) | **注意：Pool 版在 idx 4，DataProvider 在 idx 8** |

同票遗留项（验收标准内）：watch-reentry 重提交时 `useUserPositionsSdk` 的 refetch listener 在 AaveClient 未就绪时同步抛错（urql 内部对象，console 打印为 `{}`），被 `refetchEvent` 隔离后仍产生 `listener failed for source watch-reentry {}` 日志噪音。

## 设计

1. **`chainRegistry.ts`**：`AbModuleBase` 增加 `AAVE_PROTOCOL_DATA_PROVIDER?: string`；ENTRIES 采集 `provider` 字段；新增导出 `V3_PROTOCOL_DATA_PROVIDER_ADDRESSES: Record<string, string>`（与 `V3_POOL_ADDRESSES` 同一 auto-discovery 模式，零手工数据）。
2. **`aaveV3UserClient.ts`**：
   - 新增 `DATA_PROVIDER_ABI`：9 输出 `getUserReserveData`（按上表顺序声明）。
   - 新增 `getV3ProtocolDataProviderAddress(chainId)`。
   - `getV3UserPositionsOnChain`：reserve 调用指向 DataProvider，`getUserAccountData` 调用**留在 Pool**（DataProvider 没有该函数；`useOnchainHealthFactor` 不受影响）。单次 multicall 混合两个目标地址（viem 支持逐 call 指定 address+abi）。
   - **结果按位置序解码**：真实 viem multicall 对多输出调用返回**位置 tuple 而非命名对象**（`useOnchainHealthFactor.fetchV3PoolHf` 的既有注释同款结论），字段序 = ABI 输出序。实施期 runtime 证据抓到旧式命名解构在真实 RPC 下产出 `undefined` 字段（`currentATokenBalance === 0n` 对 `undefined` 恒 false → 零余额跳过失效）——旧 Pool 实现同样带此潜伏缺陷（单测 mock 用命名对象掩盖 + fallback 从未被真实流量打过），本次一并修正；`Array.isArray` 守卫 failure 项。
   - 降级独立化：provider 缺失 → 只跳过 reserve 调用（positions 空）；pool 缺失 → 只跳过 account 调用（summary null）；两者全缺 → 早退（现状不变）。result 索引按 call 构造计数，不再硬编码 `reserveIds.length` 位移。
   - `POOL_ABI` 移除 `getUserReserveData` 条目：它在 V3.2+ Pool 上是必然 revert 的死条目，保留会误导复用。`useOnchainHealthFactor` 只消费 `getUserAccountData`，不受影响。
3. **`useUserPositionsSdk.ts`**：listener 内 4 个 `refreshQueryWhere` 调用改走 `safeRefreshQueryWhere` helper——可选链 `client?.refreshQueryWhere?.(…)` + 定向 try/catch。client 未就绪 = urql 尚无活动查询可刷新，吞掉是语义正确（非掩盖错误）；RQ `void` promise 拒绝路径本就静默，不在此列。

**契约不变量**：`V3UserPosition` / `V3AccountSummary` / `V3OnchainResponse` 输出类型零变更；`getV3UserPositionsMultiChain` 的 per-chain `Promise.allSettled` + `errors[]` 语义零变更；reserve 键仍为 underlying asset 地址。下游（`fallbackPositions` / `onchainPositionConverter` / `userPositionMapper` / `gapFallbackQuery` / `useOnchainHealthFactor` / `useUserPositionsSdk`）无需改动。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/lib/chainRegistry.ts` | 采集并导出 DataProvider 地址表 | Medium | 共享 registry，但纯追加（新字段 + 新导出），现有导出不受影响；24 链覆盖 canary 测试锚定 |
| `src/lib/userData/aaveV3UserClient.ts` | reserve 读取目标 Pool → DataProvider；POOL_ABI 收缩；新增 ABI/helper | High | 核心 on-chain fallback 路径，5 个消费方。输出类型不变 + 消费方零改动；真实端点实测（DataProvider 返回与 test wallet 已知仓位逐字段吻合）+ 单测锚定降级矩阵 |
| `src/hooks/useUserPositionsSdk.ts` | listener 内 refreshQueryWhere 调用加固 | Medium | 行为变化仅限「未就绪时不再抛」；正常路径调用次数/谓词由既有测试回归 |
| `src/lib/userData/aaveV3UserClient.test.ts` | 新增/调整单测 | Low | 纯追加 |
| `src/hooks/useUserPositionsSdk.test.tsx` | 新增未就绪 client 场景测试 | Low | 纯追加 |

最坏后果：迁移 ABI 字段序错位 → 仓位金额错读。缓解：ABI 按合约源码顺序声明 + 真实 Celo 仓位实测比对（1044.77 USDT / collateral=true）+ HITL 一致性测试可复跑。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | 正常链（provider+pool 齐全）+ 有余额 reserve | multicall reserve 调用发往 DataProvider 地址；account 调用发往 Pool；positions/summary 正常产出 | High | automated test（断言两个目标地址） | — |
| 2 | 输出 shape：真实 viem multicall 返回位置 tuple | 按位置解构 4 个消费字段（idx 0/1/2/8），忽略 idx 3-7（含市场级 rate 非零不误读为仓位）；failure/非数组结果跳过；零余额（三字段全 0n）跳过 | High | automated test（mock 为位置 tuple 形态，含非零 liquidityRate 场景） | 真实 Celo 仓位实测比对 |
| 3 | provider 地址缺失（防御：未来链） | positions 空，account 调用照发，summary 非 null | Medium | automated test（registry override mock） | — |
| 4 | pool 地址缺失（防御：未来链） | accountSummary null，reserve 调用照发 | Medium | automated test（registry override mock） | — |
| 5 | 未知链（两者全缺，如 999999） | 早退 `{ positions: [], accountSummary: null }`（既有行为回归） | Low | automated test（既有用例） | — |
| 6 | reserve 调用 failure / 零余额 | 跳过该 reserve（既有行为回归） | Low | automated test（既有用例） | — |
| 7 | account 调用 failure | positions 照常、summary null（既有行为回归） | Low | automated test（既有用例） | — |
| 8 | `V3_PROTOCOL_DATA_PROVIDER_ADDRESSES` 覆盖面 | 与 `V3_POOL_ADDRESSES` 键集一致；每个值通过 viem `isAddress` 校验（MULTICALL3 金丝雀同款防线） | Medium | automated test | — |
| 9 | `getV3ProtocolDataProviderAddress` 已知链 | mainnet = `0x0a16f2…3bECD`（票面实测地址）、Celo = `0x2e0f8…15ED`；未知链 undefined | Low | automated test | — |
| 10 | `POOL_ABI` 不再含 `getUserReserveData` | tsc 编译通过（`useOnchainHealthFactor` 只用 `getUserAccountData`） | Low | static-type-lint | — |
| 11 | SDK 不可达时 fallback 真实检出 Celo USD₮ 仓位 | 生产轮换路径（`createClientWithRpcRotation`）+ test wallet 真实 RPC：positions 含 USD₮ supply **1044.776914**（6 decimals）、isCollateral=true、零债务；summary `totalCollateralBaseWad`=104454167203（≈$1044.54）、HF=max uint256（无债务语义） | High | runtime-real-data（2026-09-27 实测，双路径：显式 client + 生产轮换） | 仓位金额随利息漂移——与 1 小时前 raw eth_call 1044.773458 差值即自然累积 |
| 12 | watch-reentry 重提交 + AaveClient 未就绪 | listener 不抛错，`refreshQueryWhere` 不被调用（可选链跳过），无 `listener failed` 日志 | Medium | automated test（复现 `{}` 抛出形态 + undefined client 双用例） | — |
| 13 | watch-reentry 正常路径（client 就绪） | 每 client 仍调用 `refreshQueryWhere` 2 次、谓词不变（既有测试回归） | Medium | automated test（既有用例） | — |
| 14 | 下游消费方类型契约 | `V3UserPosition`/`V3AccountSummary` 零变更，5 个消费方无改动 | Medium | static-type-lint（tsc + 全量既有测试） | — |
| 15 | 全 V3 链真实端到端（HITL 一致性测试） | `WALLET_ADDRESS` + staging API 下 4/4 通过：V3 ETH / V3 OP / V4 ETH / V3+V4 combined（全链链上查询走新代码路径，转换后无重复 reserveId） | Medium | runtime-real-data（2026-09-27 实测；注意需 `VITE_API_BASE` 指向现行 staging，文件内默认 onrender URL 已失效——既有问题，另行处理） | — |

## Out of scope

- V4 fallback（`aaveV4UserClient`）——V4 Spoke 未移除相关函数，无此问题。
- `useOnchainHealthFactor` ——`getUserAccountData` 在 Pool 上仍保留，不迁移。
- SDK GraphQL 端点可用性本身（层 1 瞬态故障）——由 fallback 架构兜底，不在本票范围。
- `e2e/test-wallets.ts` 注释（遗留项 3）——Phase 1 已完成。

## Postscript（2026-09-27，AAV-1309 交付后补记）

- 场景矩阵第 15 行所引「HITL 一致性测试」已按用户裁定改为 onchain-only 集成测试语义（`deec631e`）：该测试 SDK 侧原为硬编码空数组、断言恒真，HITL 标注无协议支撑。第 15 行「4/4 通过」的实际含义是冒烟 + 无重复 reserveId，不是逐字段一致性证明。
- 修复时沿数据流核查发现两个既有生产缺陷，已开票：AAV-1311（onchain fallback 对非 18-dec 代币 amountUsd 缩小 10^(18-dec) 倍——第 11 行证据中的 6 decimals 手工解码即此问题的旁证，pipeline 本身无缩放）、AAV-1310（RPC 轮换耗尽返回空成功而非 error，errors/failedSources 均为空）。
