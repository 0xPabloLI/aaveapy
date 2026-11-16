# AAV-1356 — V4 address-book module union（curated spoke 纳入 + 同名标签消歧）

> Status: implemented 2026-11-16 · Issue: [AAV-1356](https://linear.app/aaveapy/issue/AAV-1356) · Type: on-chain fallback data-layer fix
> Scope: AAV-1356 退出条件 #2/#3/#4。前置 #1（spoke join key 名字→地址）见 `docs/specs/aav-1356-v4-spoke-address-key.md`。

## 背景与根因

`@aave-dao/aave-address-book` 会为同一条链提供多个 V4 module：一个 base module + curated 变体。chain 1 同时有：

| module | CHAIN_ID | SPOKES（过滤 oracle/treasury 后） | HUBS |
| -- | -- | -- | -- |
| `AaveV4Ethereum` | 1 | 14（4.77.6） | 4 |
| `AaveV4EthereumSentoraCurated` | 1 | 3 | 1 |

`selectModulesPerChain()` 只选「名字是其余候选名字前缀」的 base module，curated module 被有意跳过。后果：用户在这些 spoke 上的仓位在 SDK 失败后的 on-chain fallback 路径中不可见。AAV-1356 #1 已把 join key 从名字改为地址，同名不同址不再污染 reserve 分组，因此 union 的前置条件已满足；剩下的阻塞点只有 union 本身与同名标签消歧。

两个 module 的地址簿原始键会重名不同址：

- `BLUECHIP_SPOKE`：base `0x973a023A…`（12 条 reserve） vs Sentora `0xA37e7cdC…`（4 条 reserve）。
- `TREASURY_SPOKE`：两边都有，但一直被过滤。
- `_ORACLE` 后缀：两边都有，一直被过滤。

## 证据链

**staging `/markets`（2026-11-16 实测）**：441 reserves / 124 条 V4；chain 1 共 93 条 reserve、17 个不同 spoke 地址。

| 地址簿版本 | union 后 chain 1 spokes | payload 覆盖 | 缺口 |
| -- | -- | -- | -- |
| 4.76.1 | 16（base 13 + Sentora 3） | **16/17** | `0x115af1c2…`（`Gold Correlated`，2 条 reserve） |
| 4.77.6 | 17 | **17/17** | 无 |

`4.77.6`（published `2026-11-11T00:32:49Z`）相对 `4.76.1` 的差异已用包内容逐项对比：130 个顶层导出名不变、0 删除、0 改名；唯一变化是 `AaveV4Ethereum.SPOKES` 新增 `PAXG_PAXOS_ESPOKE` 与 `PAXG_PAXOS_ESPOKE_ORACLE`。`PAXG_PAXOS_ESPOKE` 正是 payload 里的 `0x115af1c2…`，且 2 条 reserve 已在 payload 中 ⇒ union + 4.77.6 后立即可见。

**RPC 代价（仅 on-chain fallback 激活时）**：每个 spoke 一次 multicall，调用数 = `3 × reserve 数 + 1`（supplied/debt/status + account）。

| 状态 | chain 1 spoke 数 | multicall 数 | 合约调用数 |
| -- | -- | -- | -- |
| 修前（base 13） | 13 | 13 | 244（77 reserve） |
| union 4.76.1（+3 curated） | 16 | 16 | 289（91 reserve） |
| union 4.77.6（+1 base） | 17 | 17 | 296（93 reserve） |

（2026-11-16 按 payload 每个 spoke 的 reserve 数逐条复算；只统计能查到 reserve 的 spoke。union 净增 4 次 multicall / 52 次合约调用，仅在 fallback 激活时发生。）

代价只在 SDK 全挂、fallback 生效时发生；常态路径零变化。没有 reserve 的 spoke 不会被查询（`getV4UserPositionsAllSpokes` 的既有 `targeted` 过滤）。

**版本冷却门**：`4.77.6` 发布至今约 5.3 天，低于仓库 7 天 supply-chain 窗口（2026-11-18T00:32:49Z 才满）。用户明确选择立即升级，接受一次有记录的例外：

- 本地 pre-commit 以 `MIN_RELEASE_AGE_DAYS=0` 运行 `check:dep-age -- --staged`，不绕过 hook。
- CI 的 `repo-policy` 在 push 上因 `BASE_REF=CI_REF` 跳过；`dev → main` PR 的 release-age 检查在 2026-11-18T00:32:49Z 前会红，需等窗口关闭后再建/重跑该 PR。
- 根因记录在本 spec、commit message 与 AAV-1356 交付评论中。

## 设计

1. **按地址 union，不再选一个 module**：`V4_SPOKE_ADDRESSES` / `V4_HUB_ADDRESSES` 从「每链一个 module」改为「每链所有 module 的地址并集」。
   - module 按名字排序后处理，使同址多名的取舍与枚举顺序无关。
   - 按小写地址去重；同一地址只保留首次出现的条目（base module 名字前缀更短，排序在前，因此优先保留 base 的原始键）。
   - spoke 过滤 `_ORACLE` 后缀与 `TREASURY_SPOKE`；hub 不过滤。
   - 地址形状非法（非 `0x` + 40 hex）的条目跳过，复用 `toV4SpokeKey` 的守卫。
2. **`V4SpokeEntry` / `V4HubEntry` 增加 `rawName`**：
   - `rawName` 永远是地址簿原始键（`BLUECHIP_SPOKE`）。
   - `name` 是链内唯一的诊断标签：原始键不重复时等于 `rawName`；同一链内原始键重复且地址不同时，改为 `<moduleName>:<rawName>`，例如 `AaveV4Ethereum:BLUECHIP_SPOKE` 与 `AaveV4EthereumSentoraCurated:BLUECHIP_SPOKE`。
   - `name` 进入 `failedSources` / 日志 / `V4UserPosition.spokeName` / `V4AccountSummary.spokeName`；生产侧除 `failedSources` 外不消费这些字段（`rg spokeName src/`）。
3. **join key 不变**：生产方 `deriveV4ReservesBySpoke` 与消费方 `getV4UserPositionsAllSpokes` 继续共用 `toV4SpokeKey`；`reservesBySpoke` 的参数/值类型不变，调用点零改动。
4. **地址簿升级**：`@aave-dao/aave-address-book` 4.76.1 → 4.77.6（exact pin），使 union 从 16/17 变为 17/17。升级 diff 为纯追加，风险面已在证据链记录。
5. **测试侧补两道地面真值**：
   - `assertV4AddressBookCoversPayload`：payload 出现的每个 V4 链上，所有 spoke 地址都必须在 `V4_SPOKE_ADDRESSES` 中（4.77.6 下 chain 1 17/17、全链 25/25；修前 chain 1 会红在 `0x115af1c2…`）。
   - `assertV4QueriedSpokeCount` 改为以 payload 的 spoke 数为地面真值（而不是地址簿条目数），避免「地址簿领先 payload」时把合法的未查询误报为失败。

**单一条命名规则**：`name` 只用于诊断/日志，不参与任何 join；`rawName` 与 `address` 保留地址簿身份。这样同名不同址在 `failedSources` 里可区分，而 reserve 归组仍由地址保证。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/lib/userData/aaveV4UserClient.ts` | 删除 `selectModulesPerChain`；新增 `unionV4ModuleAddresses` + `rawName`；spokes/hubs 按地址 union；同名标签加 module 前缀 | **High** | 核心 fallback 数据流。验证：union/标签/查询数单测 + live 17/17 + 既有 AAV-1310/1314/1387 用例全绿。下游 `reservesBySpoke` 类型与 join key 不变。最坏后果是「多查几条本该查的 spoke」或诊断标签变化，不会把仓位归到错误 spoke。 |
| `src/lib/userData/aaveV4UserClient.test.ts` | 新增 union、同名标签、双 BLUECHIP 查询/失败归属、hubs union、纯函数边界用例 | Low | 测试侧；含真实地址簿与合成 module 两组 seam。 |
| `src/test/userPositionConsistency.test.ts` | 新增 payload→地址簿覆盖断言；查询数改为 payload 地面真值 | Low | live 测试（无 `WALLET_ADDRESS` 时 skip）；证据为 runtime-real-data。 |
| `package.json` / `package-lock.json` | `@aave-dao/aave-address-book` 4.76.1 → 4.77.6 | Medium | 纯追加升级；冷却期例外已记录。验证：导出名/diff 对比 + hardcode 检查 + 全量门。 |
| `docs/specs/aav-1356-v4-module-union.md` | 本 spec | Low | 文档。 |
| `docs/specs/aav-1356-v4-spoke-address-key.md` | out-of-scope 指向本 spec，标记 union 已交付 | Low | 文档指针，避免两份 canonical 重叠。 |
| `docs/DOCS-INDEX.md` | 登记本 spec | Low | 文档索引。 |
| `CONTEXT.md` | 更新 V4 Fallback / Spoke Discovery / 过时的 Tech Debt 描述 | Low | 术语表；只改实现描述，不引入新业务概念。 |
| `docs/issue-roadmap.md` | inventory + AAV-1356 状态 + frontier | Low | roadmap 快照。 |
| `SESSION-BOARD.md` | 注册/注销本 session | Low | 并行协调。 |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| U1 | chain 1 同时有 base + Sentora module | `V4_SPOKE_ADDRESSES[1]` 同时含 base-only（`MAIN_SPOKE`/`GOLD_SPOKE`/`LIDO_ESPOKE`）与 curated-only（`RLUSD_YIELD_SPOKE`/`OUSD_YIELD_SPOKE`） | High | automated test | 直接回归门：退回只选 base 即红 |
| U2 | `BLUECHIP_SPOKE` 同名不同址 | 两个条目都在；`rawName` 相同；`name` 分别为 `AaveV4Ethereum:BLUECHIP_SPOKE` / `AaveV4EthereumSentoraCurated:BLUECHIP_SPOKE` | High | automated test + runtime-real-data | 地址去重 + 原始键计数后加 module 前缀 |
| U3 | 无重名的 spoke（`MAIN_SPOKE` 等） | `name === rawName`，既有诊断标签不变 | Medium | automated test | 只对重复原始键加前缀 |
| U4 | 两个 module 含同一地址（任意原始键） | 只保留一个条目；不重复发 RPC；名字取排序后第一个 module | Medium | automated test（合成 module） | 按小写地址 `Map` 去重；module 按名字排序 |
| U5 | module 枚举顺序变化 | 输出条目/标签不依赖 `Object.entries` 顺序 | Medium | automated test（合成 module 反序输入） | 显式排序 module 名 |
| U6 | `_ORACLE` / `TREASURY_SPOKE` | union 后仍被过滤；不进入查询集合 | Medium | automated test（真实 + 合成） | 过滤在 union 内、按 module 逐项执行 |
| U7 | 地址值非法/缺失 | 跳过该条目；不产生永远匹配不上的 key | Low | automated test（合成） | 复用 `toV4SpokeKey` 形状守卫 |
| U8 | 空 module 列表 / 空 SPOKES/HUBS | 返回空 Map / 空数组，不抛错 | Low | automated test | 纯函数边界 |
| U9 | hubs union | `V4_HUB_ADDRESSES[1]` 含 `SENTORA_HUB`；同址 hub 去重 | Medium | automated test | 与 spokes 同一 union 函数 |
| U10 | 两个同名 BLUECHIP spoke 都被查询 | `getV4UserPositionsAllSpokes` 对两个地址各发一次 multicall；两边仓位都出现在 results | High | automated test + runtime-real-data | `targeted` 按地址遍历，不使用名字去重 |
| U11 | 其中一个同名 spoke 失败 | 错误进 `errors`，`spokeName` 是 module 前缀标签，能定位到具体地址；健康 sibling 的结果保留 | High | automated test | `Promise.allSettled` 下标对应；标签唯一 |
| U12 | 地址簿有 spoke 但 payload 无 reserve | 不查询、不进 results/errors；查询数断言以 payload 为准，不因此变红 | Medium | automated test（既有 `filters spokes with no reserves` + 新查询数断言） | 查询数地面真值改为 payload |
| U13 | payload 有 spoke 但地址簿没有 | live 测试在每条 V4 链上响亮失败并点名缺失地址（4.76.1 下 chain 1 会红在 `0x115af1c2…`；4.77.6 下全链 25/25 绿） | High | runtime-real-data | `assertV4AddressBookCoversAllPayloadChains` |
| U14 | RPC 代价 | chain 1 fallback 从 13 次 multicall / 244 调用变为 17 次 / 296 调用（+4 / +52）；仅 fallback 激活时发生 | Medium | runtime-real-data（staging 计数） | 只查有 reserve 的 spoke；无 reserve 不发请求 |
| U15 | 地址簿 4.77.6 升级 | 130 导出名不变、0 删除；唯一变更是新增 PAXG_PAXOS_ESPOKE+ORACLE | Medium | static diff + `npm view time` | 逐项对比包内容；记录 7 天冷却例外 |
| U16 | 既有多失败/轮换语义 | AAV-1310/1314/1387 的 all-failed throw、RPC 轮换、部分失败 warn 不回归 | High | automated test（既有用例全绿） | 不改 `getV4UserPositionsOnChain` 语义；只改条目集合与标签 |
| U17 | chain 集合消费者 | `Object.keys(V4_SPOKE_ADDRESSES)` 不新增链；gap fallback 的 v4ChainIds 行为不变 | Medium | runtime-real-data（本次 5 个 chain 键与 4.76.1 相同）+ `rg` 复核 | 4.77.6 无新链；union 不改变 chain 键集合 |
| U18 | 下游 `spokeName` 消费 | 仅 `failedSources` 使用；无 UI 常规展示；同址条目不再合并 | Medium | static-type-lint + `rg spokeName src/` | `rawName` 保留溯源；`address` 是 join key |
| U19 | 验证门 | lint / typecheck / vitest / build / knip / dup 全绿 | High | CI gate | 全部实跑，记录条数 |
| U20 | live 端到端 | staging + 真实 RPC：chain 1 查询 17 条 spoke、0 chain errors、仓位金额可解析 | High | runtime-real-data（`WALLET_ADDRESS` + `userPositionConsistency`） | 无 wallet 时 skip；证据附查询数/错误数 |

## Tickets（tracer-bullet 依赖边）

- **T1**（red）：新增 `unionV4ModuleAddresses` 纯函数用例（U4/U5/U6/U7/U8/U9）+ 真实地址簿 union/标签断言（U1/U2/U3）。预期 red。
- **T2**（green）：实现 `unionV4ModuleAddresses`、`rawName`、spokes/hubs union；更新既有断言使用 `rawName`。T1 转 green，U16 既有用例保持 green。
- **T3**：升级 `@aave-dao/aave-address-book` 4.77.6；断言 `PAXG_PAXOS_ESPOKE` 进入 chain 1；跑 hardcode 相关检查。依赖 T2。
- **T4**：补 live 测试的 `assertV4AddressBookCoversPayload` 与 payload-based 查询数（U12/U13）；补双 BLUECHIP 查询/失败标签用例（U10/U11）。依赖 T2/T3。
- **T5**：全量门 + 双轴 code review + live runtime 证据（U14/U20）。依赖 T3/T4。
- **T6**：spec/DOCS-INDEX/CONTEXT/roadmap/Linear 交付记录与关票。依赖 T5。

依赖边：T1 → T2 → T3 → T4 → T5 → T6。T3 与 T4 都依赖 T2；T4 的 live 覆盖断言需要 T3 的 4.77.6 才能 17/17。

## Out of scope

- **跨链同址**：`reservesBySpoke` 目前只按地址作 key，不包含 chainId。若未来两个链复用同一 spoke 地址，reserve 会混组；当前 live 数据无此形态，且修改 key 形状会波及 `fallbackPositions` / `gapFallbackQuery` / `Index` 的调用契约，留给独立票。本 spec 只要求「每链内地址唯一」。
- **UI 展示 spoke 名称**：`spokeName` 不进入常规表格/卡片；module 前缀只服务失败诊断。若未来要展示，需单独定义产品文案。
- **RPC 预算优化**：不引入跨 spoke 合并、并发上限或按 reserve 数跳过；只保留既有「无 reserve 不查」。
- **测试网 module / 未来地址簿新增链**：`isV4Module` 的 testnet 过滤不变；新链由既有自动发现接管。
- **`selectModulesPerChain` 的「歧义 module 抛错」守卫**：union 后不再需要；删除，不保留一个无消费者的选择器。
- **冷却期例外的 CI 自动化**：不新增 workflow input 或豁免清单；`dev → main` PR 在 2026-11-18T00:32:49Z 前按门禁如实红。

## Runtime evidence

2026-11-16，staging API + `@aave-dao/aave-address-book@4.77.6`：

| 项目 | 实测 |
| -- | -- |
| `/markets` 总量 | 441 reserves / 124 V4 |
| chain 1 V4 | 93 reserves，17 个不同 spoke 地址，5 个不同 hub 地址 |
| union 后地址簿 | 17 spokes / 5 hubs（base 14 + Sentora 3） |
| payload → 地址簿覆盖（chain 1） | **17/17**，`missing: []` |
| payload → 地址簿覆盖（全链） | **25/25**（1:17 + 5042:3 + 8453:1 + 43114:4），`missing: []` |
| 同名标签 | `AaveV4Ethereum:BLUECHIP_SPOKE`、`AaveV4EthereumSentoraCurated:BLUECHIP_SPOKE` |
| fallback RPC | 17 multicalls / 296 calls（修前 13 / 244） |
| live `userPositionConsistency` | 最终全文件 4/4 通过，69.58s；chain 1 查询 17 spokes，0 chain errors；publicnode 超时由既有轮换接管 |

验证门：`typecheck` ✅、`lint` ✅（0 errors，74 个既有 warning）、`vitest` 4405 passed / 195 files、`scripts` node tests 270 passed、`build` ✅、`knip` ✅、`dup:check` ✅（76 clones，基线）、`check:pool-addresses-upstream` / `check:chain-registry-upstream` / `check:reserve-patches-upstream` / `check:hardcode-icons` ✅。

live 测试新增断言：`assertV4AddressBookCoversAllPayloadChains`（payload 的每个 spoke 在 4 条 V4 链上都存在于 `V4_SPOKE_ADDRESSES`）与 payload-based `assertV4QueriedSpokeCount`（chain 1 17 条被查询）均通过。中途一次整文件重跑出现 V3 Optimism 60s 超时与链 4326/143 错误，重跑转绿；失败不涉及 V4 断言，属公共 RPC 波动。
