# AAV-1314 — onchain multicall 全失败仍空成功（V3/V4）

> Status: implemented 2026-11-16（commit `fb0cc2e0`）· Issue: [AAV-1314](https://linear.app/aaveapy/issue/AAV-1314) · Type: on-chain fallback error semantics fix（数据层）

## 背景与根因

AAV-1310 修的是「client 建不出来 → 静默空成功」，并把 `RpcRotationExhaustedError` 送进 `errors`。**同一类缺陷在 multicall 层仍在**：client 建得出来、批量读取却全部失败时，消费方依然返回空成功，与「钱包在该链真没仓位」不可区分。

| 消费方 | 现状 |
| --- | --- |
| `getV3UserPositionsOnChain` | `allowFailure: true` 后逐 call 判 `failure` / 非数组就 `continue`；**全部 reserve call 失败**仍返回 `{ positions: [], accountSummary: null }`，`errors` 为空 |
| `getV4UserPositionsOnChain` | 每个 reserve 的 supplied/debt/status 三连 call 全失败 → 返回 `{ positions: [], accountSummaries: [] }`，`errors` 为空 |

触发场景（client 健康但读不到数据）：DataProvider / Spoke 地址或 ABI 与链上不匹配、MULTICALL3 在该链不可用、`allowFailure` 吞掉的 revert、节点限流返回非预期结构。

**相邻缺陷（本 session 用户拍板一并修）**：V4 的位置收录守卫写成 `!suppliedResult.result`，而 `0n` 是 falsy —— 某 reserve「供应为 0、但有借款」时整条 borrow-only 仓位被丢掉。V3 的等价判断用 `=== 0n` 三连，没有该问题。AAV-1314 的全失败判定不依赖这一行，两者同 commit 修掉。

## 设计

核心判据：**「是否一个 reserve read 都没成功」**。成功 = call `status === 'success'` 且 `result !== undefined`；余额为 `0n` 是**成功**读取，不是失败。不改 `allowFailure: true`，不改 `errors` 字段形态。

1. 新增 `src/lib/userData/multicallFailure.ts`：
   - `MulticallAllCallsFailedError`：`chainId`、`scope`（V3 市场名 / V4 spoke 名）、`attemptedCalls`，`name` 与 `type` 可判定（`multicall-all-calls-failed`）。
   - `isSuccessfulRead(res)`：`status === 'success' && result !== undefined`，供 V3/V4 共用，显式钉住「`0n` 是成功」。
   - `MulticallCallResult<T>`：把 V3/V4 各自的 `CallResult<T>` 收敛为同一形状。
2. V3 `getV3UserPositionsOnChain`：
   - 统计 `reserveIds.length` 中成功读取数；`providerAddress` 存在且 `reserveIds.length > 0` 且成功数为 0 → throw `MulticallAllCallsFailedError(chainId, marketName, reserveIds.length)`。
   - 部分失败（成功数 > 0 且 < 总数）→ 保留成功仓位 + `console.warn`（含成功/失败计数），不抛错。
   - account-level call 失败 → `console.warn` + `accountSummary` 保持 `null`；已读到的仓位不丢。
   - `reserveIds` 为空 / 无 `providerAddress` / 无 client → 不抛错（无可读对象 ≠ 读取失败）。
3. V4 `getV4UserPositionsOnChain`：
   - 同构，粒度是**单个 spoke**：`reserves.length > 0` 且三连 call 全部成功的 reserve 数为 0 → throw（`scope = spokeName`，`attemptedCalls = reserves.length * 3`）。
   - 部分 reserve 失败 → 保留成功仓位 + warn。
   - account call 失败 → warn + `accountSummaries` 为空数组。
   - 位置收录守卫改为 `result !== undefined`，borrow-only 仓位（supply 0 / debt > 0）正常返回。
4. 聚合层零改动：`getV3UserPositionsMultiChain` / `getV4UserPositionsAllSpokes` 的 `Promise.allSettled` 已把 rejection 收进 `errors`；`fallbackPositions` 已把 `errors` 映射为既有 `failedSources` 标签（`${prefix}-chain-${chainId}` / `${prefix}-chain-${chainId}-spoke-${spokeName}`）。本票只让「全失败」进入这条既有通道。

**契约不变量**：`errors` 数组仍是唯一失败通道；`failedSources` 标签形态零变更；`allowFailure: true`、无重试、无备用 provider。

## 接口契约

- `MulticallAllCallsFailedError`
  - `chainId: number`
  - `scope: string`（V3 市场名，如 `AaveV3Ethereum`；V4 spoke 名，如 `MAIN_SPOKE`）
  - `attemptedCalls: number`
  - `name = 'MulticallAllCallsFailedError'`；`type = 'multicall-all-calls-failed'`
  - `message` 含 scope / chainId / attemptedCalls
- `isSuccessfulRead(res)`：`undefined`、`failure`、`success + result === undefined` 均返回 `false`；`success + 0n` 返回 `true`。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/lib/userData/multicallFailure.ts` | 新增错误类 + 成功判定 + 共用结果类型 | Low | 纯新增模块，无既有消费者 |
| `src/lib/userData/multicallFailure.test.ts` | 错误字段与 `isSuccessfulRead` 真值表 | Low | 纯新增测试 |
| `src/lib/userData/aaveV3UserClient.ts` | 全失败 throw；部分失败/account 失败 warn；成功计数 | Medium | 只影响「reserve call 全失败」这一路径；正常/部分失败路径的返回值不变（部分失败多一条 warn） |
| `src/lib/userData/aaveV4UserClient.ts` | 同上 + borrow-only 位置收录修复 | Medium | 全失败路径新增 rejection；borrow-only 是用户拍板的既有缺陷修复，改变 V4 fallback 输出（更完整） |
| `src/lib/userData/aaveV3UserClient.test.ts` | 新增全失败/部分失败/空输入/reject/account warn 用例 | Low | 纯测试 |
| `src/lib/userData/aaveV4UserClient.test.ts` | 同上 + borrow-only 回归 + 多 spoke 聚合 | Low | 纯测试 |
| `docs/specs/aav-1314-multicall-all-calls-failed.md`, `docs/DOCS-INDEX.md`, `docs/issue-roadmap.md` | spec 登记与状态 | Low | 文档 |

**风险判定依据**：

1. 是否影响现有功能？— 只影响「所有 reserve read 都失败」与「V4 borrow-only」两类路径；成功路径返回值不变。
2. 下游消费者？— `fallbackPositions` 零改动，标签形态不变；`useUserPositionsSdk` 的 `partial` / `error` 状态由既有 `failedSources` 驱动，自动受益。
3. 最坏后果？— 若全失败路径误判，会把「合法空仓位」报成链路失败。缓解：成功判定基于 call `status` + `result !== undefined`，零余额是成功；`reserveIds`/`reserves` 为空、无 provider、无 client 均不触发。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| M1 | V3 `providerAddress` 存在、`reserveIds` 非空、全部 reserve call 失败（含 `failure` 与缺失条目） | throw `MulticallAllCallsFailedError`（`chainId` / `marketName` / `attemptedCalls` 正确） | High | automated test：V3 `rejects when every reserve read fails` + `reports chain, market and attempted call count` | 全新判定，`attemptedCalls = reserveIds.length` |
| M2 | V3 部分 reserve 失败 | 保留成功仓位，不抛错，`console.warn` 含成功/失败计数 | High | automated test：V3 `keeps successful positions and warns on a partial failure`（warn spy） | 只在 `0 < success < total` 时 warn |
| M3 | V3 全部成功（含 0 余额 reserve） | 行为不变：0 余额不产生仓位、不抛错、不 warn | High | automated test：V3 `does not warn when every read succeeds with zero balances` + 既有 `skips zero-balance reserves` | 成功判定不看向仓位数量 |
| M4 | V3 `reserveIds` 为空 / 无 `providerAddress` / 无 client | 不抛错；account 路径照旧（无 client 仍空成功降级） | High | automated test：V3 `does not throw when there are no reserves to read` + 既有 degradation / unknown-chain 用例 | 空输入 ≠ 读取失败 |
| M5 | V3 `multicall` 整体 reject（非 allowFailure） | 原错误冒泡，行为不变 | Medium | automated test：V3 `bubbles a multicall rejection unchanged` | 不包 try/catch |
| M6 | V3 account call 失败、reserve 成功 | 仓位正常返回，`accountSummary === null`，warn | Medium | automated test：V3 `warns but does not throw when only the account call fails` | account 失败不牵连仓位 |
| M7 | V3 account call 成功、reserve 全失败 | 仍 throw（不返回仅 account 的部分结果） | High | automated test：M1 用例的 mock 里 account call 成功 | throw 在 account 解析之前 |
| M8 | V3 reserve 结果非数组 / 条目缺失 | 计为失败；全失败时 throw | Medium | automated test：V3 `treats a missing result entry as a failed read` + 既有 `skips a success entry whose result is not an array` | `isSuccessfulRead` + `Array.isArray` |
| M9 | V4 单 spoke 全部 reserve 三连 call 失败 | throw（`scope = spokeName`，`attemptedCalls = reserves.length × 3`） | High | automated test：V4 `rejects when every reserve read fails` + `reports chain, spoke and attempted call count` | spoke 粒度；`reserves.length > 0` 才判 |
| M10 | V4 部分 reserve 三连失败 | 保留成功仓位，不抛错，warn | High | automated test：V4 `keeps successful positions and warns on a partial failure`（warn spy） | 只有 2/3 成功的 reserve 也不计入成功 |
| M11 | V4 全部成功（含 0 余额 reserve） | 行为不变：0 余额不产生仓位、不抛错、不 warn | High | automated test：V4 `does not warn when every read succeeds with zero balances` + 既有 `skips zero-balance reserves` | 0n 视为成功 |
| M12 | V4 `reserves` 为空 | 不抛错；只读 account | High | automated test：V4 `does not throw when there are no reserves to read` | 无可读对象 ≠ 读取失败 |
| M13 | V4 `multicall` 整体 reject | 原错误冒泡，行为不变 | Medium | automated test：V4 `bubbles a multicall rejection unchanged` | 不包 try/catch |
| M14 | V4 account call 失败、reserve 成功 | 仓位正常返回，`accountSummaries` 为空，warn | Medium | automated test：V4 `warns but does not throw when only the account call fails` | account 失败不牵连仓位 |
| M15 | V4 borrow-only reserve（supply 0、debt > 0） | 返回该仓位（用户拍板 B 的回归门） | High | automated test：V4 `returns a borrow-only reserve (zero supply, non-zero debt)` | 收录守卫改为 `result !== undefined` |
| M16 | V4 `getV4UserPositionsAllSpokes`：一个 spoke 全失败、另一个成功 | `errors` 只含失败 spoke（带 `spokeName`），`results` 含成功 spoke | High | automated test：V4 `allSpokes records the failing spoke and keeps the healthy one` | 既有 `allSettled` 聚合 |
| M17 | 全失败错误进入 `failedSources` | 标签形态零变更：V3 `${prefix}-chain-${chainId}`、V4 `${prefix}-chain-${chainId}-spoke-${spokeName}` | High | automated test：V3 `multichain captures the all-failed error into errors` + 既有 `gapFallbackQuery.test.ts` 的 V3/V4 标签用例 | `fallbackPositions` 零改动 |
| M18 | 正常空仓位（0 余额、reads 全成功） | 不误报失败；`failedSources` 为空 | High | automated test：M3/M11 | 成功判定基于 call 状态 |
| M19 | 既有 RPC 轮换耗尽语义（AAV-1310） | 既有用例保持绿；两种错误都可判定 | Medium | automated test：既有 AAV-1310 describe（V3 4 例 / V4 3 例） | 不动 `rpcResilience` |
| M20 | 静态门 | `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` 全绿 | Medium | static-type-lint / CI gate（2026-11-16 实跑：vitest 4341 passed / 14 skipped / 6 todo；lint 0 error；build rc=0） | 新增模块被 typecheck 覆盖 |

## Tickets（tracer-bullet 依赖边）

- **T1**（red → green）：`multicallFailure` 错误类 + `isSuccessfulRead` 真值表（M1 判定基础、M3/M11 的 `0n` 语义）。
- **T2**（red → green）：V3 全失败 / 部分失败 / 空输入 / reject / account 失败（M1–M8）。
- **T3**（red → green）：V4 同构 + borrow-only + 多 spoke 聚合（M9–M16）。
- **T4**：`errors → failedSources` 接线验证（M17）与既有回归（M18/M19）。
- **T5**：静态门 + 双轴 review + docs/Linear/commit（M20）。

依赖边：T1 → T2 / T3（T2、T3 可并行）→ T4 → T5。

## Runtime evidence（2026-11-16）

`WALLET_ADDRESS=0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314 npx vitest run src/test/userPositionConsistency.test.ts`：

- **Optimism 从静默空成功变为响亮失败**：`MulticallAllCallsFailedError: multicall returned no successful reads for AaveV3Optimism on chain 10 (14 calls attempted)`。修复前该路径返回 `{ positions: [], accountSummary: null }`，与「钱包在 Optimism 真没仓位」不可区分。
- **逐 RPC 探针**（同一 14 个 reserve + account = 15 call）：`public-op-mainnet.fastnode.io` → **0/15 success**，每个 call 的 error 都是 `HTTP request failed.`；`optimism-rpc.publicnode.com` / `optimism.drpc.org` → **15/15 success**。单 call `readContract` 在 fastnode 上成功，说明它能应答单请求、整批 multicall 才失败。
- **定性**：`createClientWithRpcRotation` 只用 `getChainId` 探活，故 fastnode 被选中；数据读取失败后不换 RPC（本票 out of scope）。这是 AAV-1314 暴露出来的**既有假 $0 路径**，不是本改动引入。修复方向（multicall 探活 / 读取失败换 RPC / 调整列表）另行开票。
- **另一处既有噪声**：`AaveV3EthereumHorizon` 出现 10/13 部分失败 warn。该市场在 registry 的 `ETHEREUM_SUB_POOLS` 中被排除，但 live 测试从 `/markets` 派生资产，而 `getV3ProtocolDataProviderAddress(1)` 只按 chainId 拿到主市场 provider。属测试侧 / registry 的既有键粒度限制，不在本票范围；partial 路径仍保留 3 条成功读取且不抛错。

## Out of scope

- 把「部分失败」升级为 error（需产品决策，本票只 warn）。
- 重试 / 备用 DataProvider / 改 `allowFailure: false`。
- `failedSources` 的 UI 消费（AAV-1315）。
- V4 reserve 内 2/3 call 成功的部分降级语义（本票视为该 reserve 读取失败；不尝试用部分字段拼仓位）。
- multicall 返回**短数组**（entry 存在但字段不足 9 个）的形状校验：既存风险，本票只把「条目缺失」计入失败；短数组不在矩阵内，另行跟进。
- 为 `MulticallAllCallsFailedError` 增加 `isMulticallAllCallsFailed` 结构化判定：当前无生产消费者需要区分类型，`errors` 通道与标签已足够；等 AAV-1315 决定 UI 文案时再补。
