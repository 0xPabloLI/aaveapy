# AAV-1387 — 批量读整批失败仍沿用探活通过的 RPC

> Status: implemented 2026-11-16 · Issue: [AAV-1387](https://linear.app/aaveapy/issue/AAV-1387) · Type: RPC 选择层修复（数据层）

## 背景与根因

AAV-1314 让「整批 reserve 读全失败」不再伪装成空仓位，于是 live 一致性测试在 Optimism 上响亮失败：

```
MulticallAllCallsFailedError: AaveV3Optimism on chain 10 (14 calls attempted)
```

失败不再被吞掉之后，根因暴露在**上一层**：`createClientWithRpcRotation` 只用 `client.getChainId()` 探活，探活通过就把该节点当作健康节点返回；之后整批 `eth_call` 失败也不会再换节点。

`public-op-mainnet.fastnode.io` 是 `CHAIN_RPC_URLS[10]` 的第一项，它对 `aggregate3` 批量 `eth_call` 有约 4KB 的请求体上限（2026-11-16 探针实测）：

| 请求 | fastnode | publicnode / drpc |
| --- | --- | --- |
| `eth_chainId` / `eth_blockNumber` / `eth_getCode` / 单笔 `eth_call` | 200 | 200 |
| `aggregate3` 4 笔子调用（1.8KB） | 200 | 200 |
| `aggregate3` 8 笔（3.3KB） | **413 Payload Too Large** | 200 |
| `aggregate3` 14 笔（5.6KB，= Optimism V3 仓位批） | **413 Payload Too Large** | 200 |
| `aggregate3` 32 笔（12.5KB） | **413 Payload Too Large** | 200 |

viem 把 413 表达为逐 call 的 `ContractFunctionExecutionError`（message `HTTP request failed.`，details `"Payload Too Large"`），在 `allowFailure: true` 下变成 14 个 failure —— 于是 AAV-1314 的判定正确地报告「一个都没读到」，但用户仍然拿不到仓位。

探活本身也不稳：fastnode 的 `eth_chainId` 实测 3.27s，而探活超时是 3s —— 是否通过取决于当场延迟。只探活不验读，等于用最弱的一次调用代表节点的数据能力。

横向扫描其他链的首选 curated RPC（1/56/100/137/8453/42161/43114/59144/534352）同批 14 笔全部 200 —— 当前 fastnode 是唯一异常点，但「只探活不验读」这个缺陷对任何降级的公共节点都成立。

## 设计

用户拍板三条：**轮换覆盖「整批全失败」与「attempt 抛错」两档**；**加 session 级降级缓存**；**fastnode 保留在 curated 列表**，靠轮换与缓存兜住。

核心判据：**「这一批里有没有读到任何数据」**。`allCallsFailed` 由各 client 计算（与 AAV-1314 的 throw 判据同源），`rpcResilience` 只负责「换下一个 URL，还是交回调用方」。

1. 新增 `src/lib/userData/rpcHealth.ts`（纯内存状态，无 viem 依赖）：
   - `markRpcUnhealthy(chainId, url)` / `clearRpcUnhealthy(chainId, url)`：按 chainId 分桶的 `Map<number, Set<string>>`，session 级（不写 storage）。后者只删除降级标记，名字即行为（没有「正向健康」概念）。
   - `isRpcUnhealthy(chainId, url)`。
   - `selectRpcUrlsByHealth(chainId, urls)`：只返回未降级 URL、保持 curated 顺序；**当所有 URL 都被降级时返回完整列表**（反自锁：否则一次坏链判断会让该链整个 session 无法读取）。
   - `resetRpcHealthCache()`：测试与未来手动恢复用。
2. `rpcResilience.ts` 新增：
   - `interface RpcReadAttempt<T> { value: T; allCallsFailed: boolean }`。
   - `readWithRpcRotation<T>(chainId, attempt): Promise<T | null>`：
     - `getAllRpcUrls` 为空 → `null`（既有「registry 无 RPC」降级路径，不变）。
     - 第一轮按 `selectRpcUrlsByHealth` 取候选；逐个建 client + 探活（复用既有 3s 超时与 warn 文案）；探活失败继续下一个。
     - `attempt(client)` 返回 `allCallsFailed === false` → `clearRpcUnhealthy` 并返回 `value`。
     - `allCallsFailed === true` → `markRpcUnhealthy` + warn（`returned no successful reads`），记下该 `value` 后继续下一个 URL。
     - `attempt` 抛错 → `markRpcUnhealthy` + warn（含 `classifyRpcError`），记下错误后继续下一个 URL。
     - 全部 URL 耗尽：有 `value` → 返回它（让调用方按 AAV-1314 抛 `MulticallAllCallsFailedError`，继续走 `errors → failedSources`）；只有错误 → rethrow 最后一个错误；一次都没探活成功且候选是健康集的子集 → **用完整列表再跑一轮**（反自锁必须端到端成立：健康集只剩一个 URL 而它探活又失败时，被降级的端点否则永远不会再被尝试），仍无结果才抛 `RpcRotationExhaustedError`。
   - `createClientWithRpcRotation` 改为共用同一个「建 client + 探活」迭代器，候选先经 `selectRpcUrlsByHealth`（HF 等其它消费方自动跳过已降级 URL）。
   - **探活成功不解降级**：fastnode 的探活能过、读却失败，若探活能清除标记，降级会在下一次 HF 调用后立刻失效。
3. 新增 `src/lib/userData/rpcRead.ts`：`readFromHealthyRpc(chainId, client, attempt)` —— 有显式 client 时直接读、否则走 `readWithRpcRotation`。抽成独立模块而不是 `rpcResilience.ts` 内的函数，是因为模块内自调用无法被 `vi.mock` 拦截，而 V3/V4 的轮换接线用例正是替换 `readWithRpcRotation`。
4. V3 `getV3UserPositionsOnChain`：把「一次 multicall」抽成 `attempt`，`allCallsFailed = providerAddress 存在 && reserveIds.length > 0 && 成功 reserve 读数 === 0`；无显式 client 时走 `readFromHealthyRpc`，有显式 client（单测 / HF 路径）时直接调用、不轮换。返回 `null` 时保持既有空成功降级。
5. V4 `getV4UserPositionsOnChain`：同构，`allCallsFailed = reserves.length > 0 && 三连 call 全成功的 reserve 数 === 0`，spoke 粒度；`getV4UserPositionsAllSpokes` 的每个 spoke 各自轮换，互不影响。
6. 部分失败（有成功读）**不轮换**：AAV-1314 的「保留仓位 + warn」语义不变；轮换只发生在「一个都没读到」或「整批抛错」时。

**契约不变量**：`errors` / `failedSources` 形态零变更；部分失败语义零变更；`allowFailure: true` 不变；不拆批；不改 curated RPC 列表；降级缓存只在内存、只在 session 内。

## 接口契约

- `RpcReadAttempt<T>`
  - `value: T`：`attempt` 读到的原始结果（V3/V4 是 `multicall` 的结果数组）。
  - `allCallsFailed: boolean`：该批里没有任何一次有效读取。
- `readWithRpcRotation<T>(chainId, attempt)`
  - 返回 `T`：某个 URL 读到了数据，或所有 URL 都报 `allCallsFailed` 时的**最后一次**结果。
  - 返回 `null`：该链没有配置 RPC。
  - 抛出：没有任何 URL 产出 `value` 时抛最后一个 `attempt` 错误（只有错误、没有值）；所有候选（含反自锁重试）都探活失败时抛 `RpcRotationExhaustedError`。
  - **优先级与顺序无关**：只要有一个 URL 产出 `value`（`allCallsFailed === true` 也算），就返回它，即便另一个 URL 抛了运输错误 —— 「节点答了、整批读不到」是关于链的领域证据，运输错误只说明那个端点不可达。
  - 副作用：按结果维护 `rpcHealth` 标记；每次轮换/降级各一条 `console.warn`。
- `selectRpcUrlsByHealth(chainId, urls)`
  - 至少一个健康 URL：只返回健康 URL（保持 curated 顺序）。
  - 全部不健康：返回完整列表（同一顺序）。
- 降级标记的生命周期
  - 置位：`allCallsFailed === true`、`attempt` 抛错。
  - 清除：同一 URL 后续读到 `allCallsFailed === false`。
  - **不**由探活成功清除。
  - 并发读之间是「后写获胜」：两个 reader 都可能在对方置位前选好候选，其中一个读到数据即清除标记；没有任何路径会让标记永久粘住（M16/M18）。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `src/lib/userData/rpcHealth.ts` | 新增：降级标记 + 候选选择 + 全降级回退 | Low | 纯内存状态，无 viem / 网络依赖 |
| `src/lib/userData/rpcHealth.test.ts` | 新增：8 条真值表用例 | Low | 纯测试 |
| `src/lib/userData/rpcResilience.ts` | 新增 `readWithRpcRotation`；抽出共享探活迭代器；`createClientWithRpcRotation` 走健康过滤；反自锁端到端重试 | Medium | 既有探活/warn/exhaustion 语义保持；新增「读失败换 URL」这一层 |
| `src/lib/userData/rpcResilience.test.ts` | 新增 15 条轮换/降级/并发用例；既有用例适配候选过滤 | Low | 纯测试（viem 与 chainDiscovery 已 mock） |
| `src/lib/userData/rpcRead.ts` | 新增：显式 client / 轮换的单一分支（可被 mock 的模块边界） | Low | 两行逻辑，行为由 V3-R4 / V4-R4 与 `rpcRead.test.ts` 双重覆盖 |
| `src/lib/userData/rpcRead.test.ts` | 新增 3 条分支用例 | Low | 纯测试 |
| `src/lib/userData/aaveV3UserClient.ts` | multicall 抽成 attempt；无 client 时走 `readFromHealthyRpc` | Medium | 成功路径返回值不变；失败路径多一次跨 RPC 重试 |
| `src/lib/userData/aaveV4UserClient.ts` | 同构（spoke 粒度） | Medium | 同上；多 spoke 并发时可能同时尝试同一个坏 URL（无害） |
| `src/lib/userData/aaveV3UserClient.test.ts` / `aaveV4UserClient.test.ts` | 新增轮换接线用例（V3-R1..R4 / V4-R1..R5）；既有 AAV-1310 用例改用新入口 | Low | 纯测试 |
| `docs/specs/aav-1387-rpc-read-rotation.md`, `docs/DOCS-INDEX.md`, `docs/issue-roadmap.md` | spec 登记与状态 | Low | 文档 |

**风险判定依据**：

1. 是否影响现有功能？— 只在「整批读不到数据 / 整批抛错」时多走几个 URL；成功与部分失败路径的返回值不变。
2. 下游消费者？— `fallbackPositions` / `failedSources` 零改动；最坏情况下（所有 URL 都失败）行为与今天一致。
3. 最坏后果？— 降级缓存误判会让某个节点在本 session 内被跳过；反自锁回退保证不会整链不可用，且任何一次成功读取都会清除标记。延迟代价上限 = 每个 URL 一次探活（≤3s）+ 一次批量读，且失败 URL 只付一次（之后被跳过）。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| M1 | 首个 RPC `allCallsFailed`、第二个读到数据 | 返回第二个的结果；首个被标记降级；不抛错 | High | automated test：`R1 rotates when the first RPC reports all calls failed` | 只按 `allCallsFailed` 轮换，不依赖错误字符串 |
| M2 | 所有 RPC 都 `allCallsFailed` | 返回最后一次结果 → 调用方抛 `MulticallAllCallsFailedError` → `failedSources` | High | automated test：`R2 returns the last all-failed result when no RPC has data` + V3/V4 wiring 用例 | 保留 value 而不是抛错，AAV-1314 语义不变 |
| M3 | 首个 RPC 部分失败（有成功读） | 不轮换，直接返回该批结果 | High | automated test：`R3 does not rotate on a partial read` | `allCallsFailed` 只在成功数为 0 时为真 |
| M4 | 首个 RPC `attempt` 抛运输错误、第二个成功 | 返回第二个结果；首个被降级 | High | automated test：`R4 rotates when the attempt throws` | 抛错与全失败同档（用户拍板） |
| M5 | 所有 RPC 的 `attempt` 都抛错 | rethrow 最后一个错误 | Medium | automated test：`R5 rethrows the last attempt error when every RPC throws` | 与既有 `errors` 冒泡语义一致 |
| M6 | 所有 RPC 探活失败 | `RpcRotationExhaustedError`（不变） | Medium | automated test：`R6 throws RpcRotationExhaustedError when every probe fails` + 既有 AAV-1310 用例 | 复用共享迭代器 |
| M7 | 链上没有配置 RPC | `null`（既有降级路径） | Medium | automated test：`R7 returns null when the chain has no RPC URLs` + V3/V4 wiring | 迭代前先判空 |
| M8 | 已被降级的 URL | 后续读取直接跳过，从剩余 URL 开始 | High | automated test：`R8 skips a demoted RPC on the next read` | `selectRpcUrlsByHealth` |
| M9 | 所有 URL 都被降级 | 回退到完整列表重试，不空转 | High | automated test：`R9 retries the full list when every RPC is demoted` | 反自锁回退 |
| M10 | 降级后再次读到数据 | 标记被清除 | Medium | automated test：`R10 clears the demotion when a read succeeds again` | `clearRpcUnhealthy` 仅由成功读触发 |
| M11 | 探活成功但读仍失败（fastnode 形态） | 标记不被探活清除 | High | automated test：`R11 probe success does not resurrect a demoted URL` | `createClientWithRpcRotation` 不调用 `clearRpcUnhealthy` |
| M12 | V3 无显式 client | 走 `readFromHealthyRpc` → 轮换，attempt 的 `allCallsFailed` 与 throw 判据同源 | High | automated test：`V3-R1` / `V3-R2` / `V3-R3`；`rpcRead.test.ts` | 两个判据共用同一个成功计数 helper；分支抽到 `rpcRead.ts` |
| M13 | V3/V4 传入显式 client | 不轮换（单测与 HF 路径行为不变） | High | automated test：`V3-R4` / `V4-R4` + `rpcRead.test.ts` + 既有 explicit-client 用例 | client 参数存在时直接读 |
| M14 | V4 多 spoke 中只有一个整批失败 | 只有该 spoke 轮换，其它 spoke 结果不受影响 | Medium | automated test：`V4-R5`（两个 spoke 各走一次 `readWithRpcRotation`，坏的进 errors、好的留 positions）+ 既有 allSpokes 聚合用例 | 每 spoke 独立 attempt |
| M15 | 静态门 + live 一致性 | typecheck / lint / test / build 全绿；Optimism 仓位读到且无 chain error | High | static gate + `WALLET_ADDRESS=… npx vitest run src/test/userPositionConsistency.test.ts` | 见 Runtime evidence |
| M16 | 两个 reader 并发，一个已对 A 置降级、另一个仍在 A 上飞 | 两者都完成；后到的成功读清除标记，不产生永久降级 | Medium | automated test：`R15 a concurrent success clears a demotion made while it was in flight` | 标记只有「置位 / 删除」两态，后写获胜；反自锁重试兜底 |
| M17 | 一个 URL 抛错、另一个 URL 报整批全失败（两种顺序） | 都返回全失败的那批 value → 调用方抛 `MulticallAllCallsFailedError` | Medium | automated test：`R13 returns the all-failed value even when another endpoint throws` | `value` 与 `error` 分开记录，耗尽后 value 优先 |
| M18 | 健康集只剩一个 URL，且它探活失败 | 用完整列表重试一轮，被降级的端点仍有机会被读 | High | automated test：`R14 retries demoted endpoints when the surviving endpoint fails its probe` | 端到端反自锁重试（候选集为子集且零次 attempt 时） |

## Tickets（tracer-bullet 依赖边）

- **T1**（red → green）：`rpcHealth` 标记 / 候选选择 / 全降级回退（M8–M11 的基础）。
- **T2**（red → green）：`readWithRpcRotation` 语义 + 共享迭代器 + `createClientWithRpcRotation` 过滤（M1–M11）。
- **T3**（red → green）：V3 接入 + 既有 AAV-1310 用例迁移（M12/M13）。
- **T4**（red → green）：V4 接入（M12–M14）。
- **T5**：静态门 + live 运行时验证 + 双轴 review + docs/Linear/commit（M15）。
- **T6**（review follow-up，red → green）：`rpcRead.ts` 分支抽取（M12/M13）、value 优先于 error（M17）、端到端反自锁重试（M18）、并发一致性（M16）、命名改为行为描述。

依赖边：T1 → T2 → T3 / T4 → T5 → T6。

## Runtime evidence（2026-11-16）

`WALLET_ADDRESS=0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314 npx vitest run src/test/userPositionConsistency.test.ts`

**Before（AAV-1314 session 的同一命令）**：Optimism 红灯

```
MulticallAllCallsFailedError: multicall returned no successful reads for
AaveV3Optimism on chain 10 (14 calls attempted)
```

**After**：fastnode 被识别为「无有效读取」并让位，Optimism 测试转绿

```
[rpc-rotation] https://public-op-mainnet.fastnode.io returned no successful reads for chain 10; trying next RPC
✓ V3 Optimism: positions resolve against /markets and stay chain-scoped 11298ms
```

其余读数（同一天、多次运行）：

| 观察 | 结果 |
| --- | --- |
| V4 (Ethereum hub) 单跑 | **9.1s / 12.9s 通过**（13 个 spoke 各 1 次探活 + 1 次批读，与改动前同一数量级） |
| 全文件单跑 + 300s 预算 | V3 ETH / V4 / V3+V4 combined 全绿（12.0s / 12.9s / 23.0s） |
| 全文件 + 默认 60s 预算 | V4 hub 两次卡在 60s 预算上；同时段日志有 6 条链的 3s 探活超时（publicnode / 1rpc / metis / soniclabs / inkonchain），单跑即绿 ⇒ 网络拥塞，不是轮换引入的额外探活（每 spoke 的探活次数不变） |
| `AaveV3EthereumHorizon` | 仍报 `10/13 reserve reads failed`（既有键粒度限制，AAV-1314 spec 已记录，out of scope） |
| `GOLD_SPOKE` | 本轮新观察到 `5/8 reserves had failed reads`（部分失败，保留仓位 + warn，符合 AAV-1314 契约） |

**静态门（本地实跑）**：`npx vitest run` **4380 passed / 14 skipped / 6 todo / 0 failed**（195 files + 3 skipped）；`npm run typecheck` rc=0；`npm run lint` 0 error / 74 warning（与基线一致）；`npm run build` rc=0（CSP 门绿）；`npx knip` rc=0；`dup:check` 2.79%。

**Mutation（每项只打红对应用例，恢复后全绿）**：

| Mutation | 红 |
| --- | --- |
| `readWithRpcRotation` 忽略 `allCallsFailed` | R1 / R2 / R9 / R12（4 failed） |
| 失败时不写降级标记 | R1 / R2 / R4（3 failed） |
| `orderRpcUrlsByHealth` 不过滤 | R8（1 failed） |
| `attempt` 抛错时直接 rethrow（不轮换） | R4 / R5（2 failed） |
| 探活成功清降级标记 | R11（1 failed） |
| 反自锁重试去掉（只在候选集内失败即 exhaustion） | R14（1 failed） |
| 耗尽后 error 优先于 value | R13（1 failed） |


## Review 处置（双轴，2026-11-16）

**Standards 轴**（finding → 处置）：

| Finding | 处置 |
| --- | --- |
| spec 自述测试条数与文件不符（7 vs 8），总计数 29 与实际不符 | 已修：本文件 `rpcHealth.test.ts` 8 条；board/roadmap 改为 35 条新测试、4380 passed |
| 缺并发/竞态矩阵行（`rpcHealth` 是进程级可变状态） | 已修：M16 + `R15`（两个 reader 并发置位/清除，后写获胜、无永久降级） |
| `orderRpcUrlsByHealth` 名不副实（实际是过滤）、`markRpcHealthy` 无正向语义 | 已修：改名 `selectRpcUrlsByHealth` / `clearRpcUnhealthy` |
| V3/V4 轮换分支重复 | 已修：抽 `readFromHealthyRpc` 到 `rpcRead.ts`（放独立模块才能被 `vi.mock` 拦截） |
| 测试里 `AttemptFn` + 捕获块重复 4 份 | 已修：两文件各一个 `captureAttempt` helper |
| 成功计数 helper 与解析循环各判一次 `isSuccessfulRead` | 接受：解析循环本来就需要逐元素守卫，两处共用同一 helper 已消除漂移源；合并成单遍会改动解析路径，收益不抵风险 |
| `(chainId, url)` 成对传递（Data Clumps） | 接受：两参数是此处最直接的表达，引入包装类型只增加间接层 |
| `isRpcUnhealthy` / `resetRpcHealthCache` 无生产消费者 | 接受：测试与手动恢复 seam，knip 绿 |
| 5 个 ticket 一个未提交批次（commit cadence） | 部分接受：按「代码一个 commit + 文档一个 commit」切分（同 AAV-1314）；T1–T5 是 tracer bullet，逐条提交会留下未被调用的中间态 |

**Spec 轴**（finding → 处置）：

| Finding | 处置 |
| --- | --- |
| M14 无真测试（被引用的 allSpokes 用例走显式 client 旁路） | 已修：`V4-R5`（两 spoke 各走 `readWithRpcRotation`，坏 spoke 进 `errors`、好 spoke 保留仓位） |
| 混合 `all-failed` / `thrown` 的优先级随顺序变化，与契约不符 | 已修：value 与 error 分开记录、耗尽后 value 优先；新增 `R13`（两种顺序）并改写契约段 |
| 反自锁不端到端（健康集只剩一个 URL 而它探活失败 → 直接 exhaustion） | 已修：候选集为子集且零次 attempt 时用完整列表重试一轮；新增 `R14`，`healthyRpcClients` 不再二次过滤 |
| 任何 throw 都降级（含 TypeError / 解码 bug 这类逻辑错误） | 接受：spec 明文如此，且任何成功读会清除标记；按 `isInfrastructureFailure` 细分是另一个决定（会改变 transport 错误面），留作后续 |
| 文档/看板计数漂移 | 已修（同上） |

## Out of scope

- 拆批（chunking）适配低容量节点：轮换已能拿到数据；拆批会改变「部分失败」的语义与请求数。
- 移除 / 重排 fastnode（用户拍板保留）。
- `useOnchainHealthFactor` 显式接线（它经 `createClientWithRpcRotation` 自动跳过降级 URL，但单 call 批量小、本就没触发 413）。
- 指数退避、跨进程 / 持久化的 RPC 健康度、把探活换成更深的读探针。
- 探测「节点容量」本身（如按 payload 大小预判），避免把 4KB 这类实现细节写进代码。
