# AAV-1313 onchain 仓位路径按 chainId 共享 RPC 读会话

## Problem Statement

钱包同步的 onchain 兜底按「市场 / spoke」而不是按「链」组织读取：

- `getV3UserPositionsMultiChain` 对每个 market 调一次 `getV3UserPositionsOnChain`；
- `getV4UserPositionsAllSpokes` 对每个 spoke 调一次 `getV4UserPositionsOnChain`；
- 两者最终都走 `readWithRpcRotation(chainId, attempt)`，而它每次都会重新 `getAllRpcUrls` → `selectRpcUrlsByHealth` → 逐个 `createPublicClient` + `getChainId` 探活（单 URL 预算 3s）。

于是同一个 chainId 在一次同步里会做 N（market 数）+ M（spoke 数）次**完全独立**的轮换。Ethereum 的 V4 有 17 个 spoke，意味着同一条链、同一批 RPC URL 被探活 17 次。后果：

1. 请求量放大：`URL 数 × (market + spoke) 数` 次 `eth_chainId`，公共端点 429 / 限流风险上升。
2. 延迟放大：每个 URL 的 3s 超时预算被重复消耗，逼近外层 `FALLBACK_TIMEOUT_MS = 15_000` 后整条链被 `withTimeout` 打断，退化成粗粒度 `${prefix}-chain-${chainId}` 失败，一条链的仓位全部拿不到。
3. 轮换耗尽时同一 chainId 产生 N 条重复 error（当前靠 `mergeFailedSources` 的 Set 兜住，属下游兜底而非源头正确）。

反例（已有正确实现）：HF 路径 `fetchOnchainHfBaselines` 早已按 chainId 分组共享 client（`useOnchainHealthFactor.ts`），仓位路径未对齐。

## 票面前提订正（必须先读）

票面正文写于 AAV-1310 时期，方案是「建 `Map<chainId, Promise<PublicClient | null>>`，把共享 client 透传给 `getV3UserPositionsOnChain`」。**该 recipe 在 AAV-1387 落地后不再成立**：

- `getV3UserPositionsOnChain` 已不再调用 `createClientWithRpcRotation`，而是走 `readFromHealthyRpc → readWithRpcRotation`；
- `readFromHealthyRpc` 对显式 client 直接 `attempt(client)`（bypass rotation by contract）；
- 因此「共享一个 client 透传下去」会绕过 AAV-1387 刚加上的读层轮换：fastnode 这类**探活能过、批量读 413** 的端点会重新被钉死到同步结束，Optimism 那种假失败回归。

本实现的「共享」对象改为**每链一个读会话（池）**：探活结果与当前胜出端点被共享，但整批读失败仍然触发降级换点。票面验收条第 1 条的 `createClientWithRpcRotation` 调用次数因此改为等价的「每链只探活一次」。

## Solution

1. 在 `rpcResilience.ts` 内新增 `RpcClientPool`（`createRpcClientPool`）：
   - `acquire(chainId)`：**单飞（single-flight）**探活，同一 chainId 的并发调用共享同一个 in-flight promise；返回 `{url, client}`。全部 URL 探活失败 ⇒ 本次同步内直接抛 `RpcRotationExhaustedError`（不再重复消耗 3s×URL×N）。
   - `release(chainId, url)`：某次读在该端点上整批失败/抛错后丢弃池条目，让下一次读重新探活（保留 AAV-1387 语义）。
   - `adopt(chainId, entry)`：某次读成功后记住胜出端点，后续 market/spoke 直接复用。
2. `readWithRpcRotation(chainId, attempt, pool?)`：池存在时用池内 client 作为第一个候选（不重复探活），失败则标记 unhealthy + `release` 后沿健康列表继续轮换；成功则 `adopt`。池缺省时行为与今天完全一致（内部即一次性池）。
3. `readFromHealthyRpc(chainId, client, attempt, pool?)` 透传。
4. `getV3UserPositionsMultiChain` 与 `getV4UserPositionsAllSpokes` 各自建池并传给每个 market / spoke；`fetchFallbackPositions` 建**一个**池同时传给 V3 与 V4（一次同步内每链只探活一次）。
5. V3 `errors` 按 chainId 去重（保留首个错误），V4 保留 spoke 级粒度。

## Implementation Decisions

- **共享读会话，而不是共享 client**：见「票面前提订正」。这是本票最关键的偏离，理由是一手代码事实（`rpcRead.ts` 的 explicit-client 旁路）与 AAV-1387 的运行时证据（fastnode 413）。
- **单飞而非「缓存已解析的 client」**：多个 market/spoke 由 `Promise.allSettled` 同时启动，只有共享同一个 in-flight promise 才能把 N 次探活压成 1 次；缓存已解析值对并发首轮无效。
- **失败即 release，不缓存坏端点**：一次整批失败是端点级证据（AAV-1387 的 `rpcHealth` 也是这个口径），必须让下一次读重新探活/换点；否则会把 413 端点钉死。
- **探活耗尽在池内缓存（抛错）**：所有 URL 的 `getChainId` 都失败是链级事实，不是批次级；缓存成 rejected promise 可避免 N 个 market 各烧一轮 3s×URL。`RpcRotationExhaustedError` 仍按原样冒泡进 errors。
- **池的作用域 = 一次 `fetchFallbackPositions`**（V3+V4 共用），不跨请求持久化（票面 out of scope）。页面刷新即重建。
- **不合并 V3 多 market 的 multicall**：合并能进一步减少批量读次数，但会改返回装配与失败归属（另一个风险等级）；本票只消除重复探活，保持 per-market 批量与 `MulticallAllCallsFailedError(marketName)` 归属。
- **V3 error 按 chainId 去重**：`errors` 条目只有 `chainId` 没有 market，同链 N 条相同失败对消费者零信息增益；`failedSources` 本来就按 chain 聚合。`console.error` 仍逐 market 输出，取证不丢。
- **V4 不去重**：`spokeName` 是错误的一部分，spoke 级粒度是票面验收要求。
- **显式 client 的旁路语义不变**：测试 / HF 路径传入 client 时不触碰池。
- **无池时调用形状不变**：`readFromHealthyRpc` 只在真的有池时传第三参（`pool ? … : readWithRpcRotation(chainId, attempt)`），避免把既有 `toHaveBeenCalledWith(1, attempt)` 这类断言从「两参」变成「两参 + undefined」。语义相同，好处是 AAV-1387 的单测不需要跟着改形状。
- **池内端点排在候选第一位，其余仍逐点探活**：`healthyRpcClients` 有池时先 yield 池内端点（跳过它的重复探活），再走列表其余 URL。这样「复用」与「整批失败换点」不互相压制。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `src/lib/userData/rpcResilience.ts` | 新增 `RpcClientEntry` / `RpcClientPool` / `createRpcClientPool`；`readWithRpcRotation` 增加可选第三参 `pool` | Medium | 现有 R1–R15 全部保留；缺省池等价于「一次性池」，单次读行为与今天一致。最坏后果：池实现有竞态 ⇒ 某次读多探活一次，不会改变「读不到」的判定（仍走同一 `allCallsFailed`/throw 分支）。 |
| `src/lib/userData/rpcRead.ts` | `readFromHealthyRpc` 增加可选 `pool` 透传 | Low | 纯追加参数；`client` 分支保持不变。 |
| `src/lib/userData/aaveV3UserClient.ts` | `getV3UserPositionsMultiChain` 建池；`getV3UserPositionsOnChain` 增加可选 `pool`；errors 按 chainId 去重 | Medium | 位置装配、空成功降级、`MulticallAllCallsFailedError` 均不变。消费方 `fetchV3Positions` 只读 `results/errors`，去重后标签不变。 |
| `src/lib/userData/aaveV4UserClient.ts` | `getV4UserPositionsAllSpokes` 建池并透传；`getV4UserPositionsOnChain` 增加可选 `pool` | Medium | spoke 级 errors / 地址键过滤（AAV-1356）不变。 |
| `src/lib/userData/fallbackPositions.ts` | `fetchFallbackPositions` 建一个池，传进 `fetchV3Positions` / `fetchV4Positions` | Low | 只增参数；`failedSources` 形态不变。 |
| 四个 `*.test.ts` | 新增池单飞/降级/耗尽、V3/V4 接线与 V3 去重用例 | Low | 纯新增断言，复用既有 mock seam。 |

## Behavioral Scenarios（Scenario & Risk Verification Matrix）

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 同一 chainId 3 个 market 顺序读，同一池 | 只探活 1 次（`createPublicClient` = 1），`attempt` 3 次 | Medium | automated test | 池 `acquire` 缓存 resolved entry |
| S2 | 同一 chainId 3 个 market **并发**读 | 仍只探活 1 次（单飞） | High | automated test | in-flight promise 共享 |
| S3 | 两条链各 2 个 market，同一池 | 每链各 1 次探活，互不复用 | Medium | automated test | 池按 chainId 分桶 |
| S4 | 池内 client 整批失败（模拟 fastnode 413） | 标记 unhealthy → `release` → 换下一个 URL 并成功；不返回失败 | High | automated test | 复用 AAV-1387 的 `attemptAcrossRpcUrls` |
| S5 | 池内 client 抛传输错误 | 同上：换点后成功 | Medium | automated test | 同上 |
| S6 | 所有 URL 探活失败 | 抛 `RpcRotationExhaustedError`；同池第二次读**不再**新建 client | Medium | automated test | acquire 缓存 rejected promise |
| S7 | registry 无 RPC | 读返回 `null` → 空成功，`attempt` 不被调用 | Medium | automated test | acquire 返回 null 分支 |
| S8 | 显式 client（测试/HF） | 完全旁路池与轮换 | Medium | automated test | `readFromHealthyRpc` client 早返回 |
| S9 | V3 同链 3 个 market 全部失败 | `errors` 只有 1 条该 chainId；`console.error` 3 条 | Medium | automated test | 聚合处按 chainId 去重 |
| S10 | V4 同链 2 个 spoke，其中一个失败 | `errors` 保留失败 spoke 的 `spokeName` | Medium | automated test | 不加去重 |
| S11 | 一次 `fetchFallbackPositions` 同时跑 V3+V4 | 两条路径共用同一个池实例 | Medium | wiring test | 参数透传断言 |
| S12 | 健康列表只剩 1 个且其探活也失败 | 回退全列表（反自锁） | High | automated test | acquire 内 anti-lockout |
| S13 | 成功读后端点恢复 | 清除 demotion 并把胜出端点存回池 | Medium | automated test | `clearRpcUnhealthy` + `adopt` |
| S14 | 真实链路 smoke | 探活次数按链收敛，仓位结果与改动前一致 | High | runtime-real-data | live 单文件复跑 + 结果对比 |
| S15 | 同步跨 leg（V3→V4）同链 | 第二次 leg 不新增探活 | Medium | wiring test | `fetchFallbackPositions` 共池断言 |
| S16 | 连续两次 `fetchFallbackPositions` | 不复用上一次的池（不跨请求持久化） | Low | wiring test | 每次调用 `createRpcClientPool()` |

## Tickets（tracer bullet）

1. **T1 池 + 读层接线**：`createRpcClientPool` + `readWithRpcRotation(pool)` + `readFromHealthyRpc(pool)`；新增 S1/S2/S3/S4/S5/S6/S12/S13 单测，R1–R15 全绿。
2. **T2 V3/V4 接线**：多链 / all-spokes 建池透传，V3 errors 去重；S7/S8/S9/S10 单测。
3. **T3 同步级共池 + 收口**：`fetchFallbackPositions` 共池（S11），文档 / roadmap / Linear / 全门禁 / live smoke（S14）。

## Out of Scope

- 跨 chain 复用 client（池天然按 chainId 分桶）。
- client / 池跨请求持久化（刷新即重建）。
- 修改 `RpcRotationExhaustedError` 语义或 `errors` 字段结构。
- 把 V3 多 market 合并成一次 multicall（改返回装配与失败归属，另票）。
- HF 路径改造（它已按 chainId 分组，且显式 client 旁路是既有契约）。

## Testing Decisions

- 只断言外部行为：探活次数（`createPublicClient` 调用数）、`attempt` 调用次数、返回值/抛错类型、`errors` 条数。
- 复用 `rpcResilience.test.ts` 既有 `serveClients()` seam（mock `viem` + `getAllRpcUrls`），不新增 mock 框架。
- V3/V4 层沿用既有 `vi.mock('./rpcResilience')` 的 `readWithRpcRotation` 捕获，断言「同一 chainId 拿到同一个 pool 实例」。
- 运行时证据：live `userPositionConsistency` 单文件复跑（真实 RPC），记录探活次数与仓位结果；必要时加一次临时探针统计，事后删除。

## Evidence

- 定向单测（全部 automated，除 S14）：
  - `rpcResilience.test.ts` **64 passed** — 原有 R1–R15 全绿 + 新增 P1–P9（顺序/并发单飞、按链分桶、整批失败换点并 adopt、抛错换点、探活耗尽缓存、无 RPC 返回 null、反自锁、无池不共享）。S1/S2/S3/S4/S5/S6/S7/S12/S13。
  - `rpcRead.test.ts` **5 passed** — 新增「有池才传第三参」与「显式 client 忽略池」。S8 + 无池调用形状。
  - `aaveV3UserClient.test.ts` **47 passed** — 新增 4 条：同池透传给同链每个 market、无注入时多 market 共用同一池、同链 2 market 全失败只 1 条 error（`console.error` 仍 2 条）、两条链各 1 条。S9/S13。
  - `aaveV4UserClient.test.ts` **60 passed** — 新增 2 条：同池透传给同链每个 spoke、无注入时同链 spoke 共用同一池。S10 + 接线。
  - `fallbackPositions.test.ts`（新文件）**2 passed** — V3 leg 与 V4 leg 拿到同一个池实例；连续两次调用不复用。S11/S15/S16。
  - `gapFallbackQuery.test.ts` **9 passed** — 既有调用形状断言按新签名（第 4 位 client、第 5 位 pool）更新。
  - `src/lib/userData` 目录 **266 passed / 4 skipped**。
- 全量门禁：
  - `npx tsc -p tsconfig.app.json --noEmit` → **exit 0**。
  - `npx vitest run` → **4469 passed / 14 skipped / 6 todo（199 files passed, 3 skipped）**。
  - `npm run lint` → **0 error**（74 warnings，均为既有 complexity 等，未新增）。
  - `npm run build` → **绿**，`[check-csp] All inline scripts are covered by script-src and GA origins are allowed.`
- live smoke（S14，真实 RPC，临时探针跑完即删）：
  - `[live-probe] chain=1 rpcUrls=4 block1=26431614 block2=26431614 createPublicClient: firstRead=1 afterSecondRead=1`
  - 即：以太坊主网 4 个候选端点，同一池两次真实 `getBlockNumber` 读合计只 1 次 `createPublicClient`（只探活 1 个端点），两次读均返回真实区块号。改动前同一链的第二次读会再烧一轮探活。
- 未做：V3/V4 真实仓位端到端 smoke（需要 API 侧 reserves 输入，属 S14 的「仓位结果与改动前一致」一半；已由 fallback 层共池的 wiring 断言 + 全量 `userPositionConsistency` 覆盖替代）。
- commit / Linear：待回填。
