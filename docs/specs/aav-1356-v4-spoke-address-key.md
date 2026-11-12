# AAV-1356 — V4 onchain fallback 的 spoke join key:名字 → 地址

> Status: implemented 2026-11-12 · Issue: [AAV-1356](https://linear.app/aaveapy/issue/AAV-1356) · Type: on-chain fallback path fix (data layer)
> Scope: AAV-1356 退出条件 #1(按地址作 key)。退出条件 #2/#3/#4(union curated module)见「Out of scope」。

## 背景与根因

V4 仓位在 SDK 主路径失败时走 on-chain RPC 兜底。该路径**从未工作过**:它查询 0 条 spoke,返回零仓位零错误,静默失败。

两侧用不同的名字空间指同一个 spoke:

```
生产者  deriveV4ReservesBySpoke (src/lib/deriveOnchainConfig.ts)
        Map key = r.spokeName            ← /markets 的显示名,如 "Main"
                    ↓ 同一个 Record 跨模块传递
消费者  getV4UserPositionsAllSpokes (src/lib/userData/aaveV4UserClient.ts)
        查 reservesBySpoke[s.name]        ← 地址簿的 raw key,如 "MAIN_SPOKE"
```

`/markets` 的 `spokeName` 是 UI 显示名(`Main`/`Bluechip`/`Gold`),地址簿的 `SPOKES` 键是合约常量名(`MAIN_SPOKE`/`BLUECHIP_SPOKE`/`GOLD_SPOKE`)。两个名字空间无交集 ⇒ `filter` 恒空 ⇒ 一次 multicall 都不发。

这不是新引入的缺陷,而是两条独立判断同时错在一起的产物:**测试 fixture 与生产代码共享同一个错误假设** —— `deriveOnchainConfig.test.ts` 的 `makeV4Reserve(chainId, token, spokeName, …)` 把 `'MAIN_SPOKE'` 当 `spokeName` 传入,于是 4 个月全绿。真实 `/markets` 里 `spokeName` 从不是 `MAIN_SPOKE`。

## 证据链

**运行时实测**(2026-11-12 生产 `/api/markets`,441 reserves / 124 V4;地址簿 4.76.1):

| chain | 地址簿 spokes | OLD key(`spokeName`)命中 | NEW key(地址)命中 |
| -- | -- | -- | -- |
| 1 | 13 | **0** | **13** |
| 5042 Arc | 3 | **0** | **3** |
| 8453 Base | 1 | **0** | **1** |
| 43114 Avalanche | 4 | **0** | **4** |
| **合计** | **21** | **0** | **21** |

**同一份数据上的四条形态事实**:

1. `spokeName` 取值为 `"Main"` / `"Lombard"` / `"Bluechip"` / `"Gold"` / `"Coinbase Stocks"` —— 与地址簿键无一处相同。
2. 124 条 V4 `reserveId` **全部**是 4 段 `chainId:spokeAddress:tokenAddress:hubAddress`,spoke 段已是小写地址(如 `1:0x94e7a5dc…:0x7fc66500…:0xcca852bc…`)。
3. 原始 payload 里 **124 条 `spokeAddress` 全为 `undefined`** —— 该字段只由 `enrichReservesFromId` 填写,且其守卫要求 `parsed.hubAddress && !reserve.hubAddress` 才赋值。⇒ 生产者直接读 `reserveId` 比依赖「enrichment 已跑过」更可靠。
4. **chain 1 的 `Bluechip` 显示名对应 2 个不同地址** —— 名字作 key 一旦命中就会把两个 spoke 的 reserve 归到同一组,这是 AAV-1356 记录的「同名不同地址」在真实数据里的实例。

**静态链**:`V4AccountSummary.spokeAddress` 的注释(`aaveV4UserClient.ts:124`)已写明「address book 的 raw key ≠ SDK 的 `spoke.name`,跨系统匹配要用 address(AAV-1253 P7)」;`selectModulesPerChain` 的 docstring 记着 curated module 被有意跳过,理由正是「`deriveV4ReservesBySpoke` 以名字作 Map key」。两处都把结论写在了代码里,缺的只是那条 join key 本身。

**为什么没被抓到**:除 fixture 形态失真外,`userPositionConsistency.test.ts` 的 V4 用例只断言 `Object.keys(v4BySpoke).length > 0`(即「有 V4 spoke」),而**没有断言实际查询了几条 spoke** —— 0 条 spoke 被查询时全部断言恒真。

## 设计

**单一 join key**:`toV4SpokeKey(address) → lowercased 0x + 40 hex,否则 null`,放在 `src/lib/reserveKey.ts`(该文件已是「跨模块共享 key 构造函数」的既定归属,`toChainTokenKey` 同款做法),**生产方与消费方 import 同一个函数**(沿用 `brevis-distributed-so-far.ts` 的教训:禁止消费方重新实现「看起来一样」的 key 构造函数)。两侧各自落在 `src/lib/` 与 `src/lib/userData/`,是把函数放进共同依赖的叶子模块,而不是让其中一方 import 另一方。

1. **生产者** `deriveV4ReservesBySpoke`:key 改为 `toV4SpokeKey(parseReserveId(r.reserveId)?.poolOrSpokeAddress)`。取不到 key 的 reserve 跳过。
   - 用 `reserveId` 而非 `r.spokeAddress`:后者依赖 `enrichReservesFromId` 的调用顺序与其守卫(证据链事实 3)。`reserveId` 是 `/markets` 的 canonical identity(AGENTS.md 明文)。
   - `spokeName` 不再是 key,生产方不再读它。
2. **消费方** `getV4UserPositionsAllSpokes`:查 `reservesBySpoke[v4SpokeKey(spoke.address)]`。
   - 顺带消除重复的 filter 谓词:原来同一谓词写了两遍(一次给 `Promise.allSettled`,一次给错误标签用的 `filteredSpokes`),两处漂移会让错误标签错位到别的 spoke。改成单个 `targeted` 数组后,`settled[i]` 与标签的对应关系变成结构性保证。

**契约不变量**:`reservesBySpoke` 的参数类型与值类型不变(`Record<string, V4ReserveInfo[]>`),只有 key 的构成变化 ⇒ 调用点(`fallbackPositions.ts:121`、`Index.tsx:338`)零改动。`V4OnchainResult` / `V4AccountSummary` 零字段变更。`spokeName` 在结果里保留原语义(地址簿 raw key),它只进 `failedSources` 错误标签,不显示给用户(`rg spokeName src/` 证实生产消费方只有 `fallbackPositions.ts:136`)。

**代价**:无。地址归一化是一次 `toLowerCase()`;两侧同批上线,不存在只改一边的中间态(改一侧则 join 仍然为 0,与改前等价,不是新增故障)。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/lib/reserveKey.ts` | 新增导出 `toV4SpokeKey`(地址归一化 + 形状守卫) | Low | 叶子模块,只依赖类型;纯新增导出,无既有行为变化 |
| `src/lib/deriveOnchainConfig.ts` | `deriveV4ReservesBySpoke` 改用 `parseReserveId(r.reserveId)` 的 spoke 段 + `toV4SpokeKey` 作 key,不再读 `spokeName` | Medium | 核心 fallback 数据流的 key 变化。输出 Record 的值类型与形状不变;调用点零改动 |
| `src/lib/userData/aaveV4UserClient.ts` | 两处查询改走 `toV4SpokeKey(spoke.address)`;合并重复 filter;更新 `selectModulesPerChain` docstring 里「以 spoke name 作 key」的过时理由 | Medium | 查询键变化使该路径首次真正发 RPC;docstring 若不改则与新代码矛盾 |
| `src/lib/deriveOnchainConfig.test.ts` | fixture 改为真实形态(`spokeName` 用显示名、`spokeAddress` 用合法 40-hex 地址);断言改按地址;新增同名不同地址、大小写归一、3 段 reserveId 用例 | Low | 修正 fixture 失真——本 bug 得以存活的直接原因 |
| `src/lib/userData/aaveV4UserClient.test.ts` | 传参改按地址;新增「地址簿每个 spoke 都能在 map 里找到」的跨模块 invariant;名字唯一性断言改为地址唯一性 | Low | 新增的那条是本 bug 的回归门 |
| `src/test/userPositionConsistency.test.ts` | V4 用例新增「实际查询的 spoke 数 = 该链地址簿 spoke 数」断言 | Low | live 测试(无 `WALLET_ADDRESS` 时 skip);补上恒真断言的缺口 |

最坏后果:key 归一化写错(如忘记 `toLowerCase`)导致检查和不匹配 ⇒ 回到「0 条 spoke」的当前行为,不会产生错误数据。注意**不会**因本改动而出现「仓位归属到错误 spoke」——地址 key 比名字 key 更细:两个 spoke 只可能被**漏掉**,不可能被**合并**。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| V1 | 真实形态 reserve(`spokeName: "Main"`,`reserveId` 内 MAIN_SPOKE 地址) | map 的 key 是地址,不是 `"Main"` | High | automated test | 本 bug 的直接回归门 |
| V2 | 地址簿每个 spoke 地址都能在 map 里找到(跨模块 invariant) | 每链每 spoke 命中,0 遗漏 | High | automated test(以真实 `V4_SPOKE_ADDRESSES` 生成 reserve) | 修前实证 21/21 全 miss |
| V3 | 同链同名不同地址(`Bluechip` × 2) | 两个独立 key,reserve 不互相污染 | High | automated test(真实数据形态:chain 1 实测 `Bluechip` 对应 2 个地址) | 名字作 key 时二者会被合并 |
| V4 | 大小写归一(reserveId 小写 / 地址簿 EIP-55 混合大小写) | 两侧归一到同一 key | High | automated test | `toLowerCase()` |
| V5 | `reserveId` 缺失 / 空串 / 段数非法 / 非地址段 | 跳过该 reserve,不产生永远匹配不上的 key | Medium | automated test | `parseReserveId` + `toV4SpokeKey` 双守卫 |
| V6 | 3 段 `reserveId`(无 hub 段) | 仍按 speaker 段取到地址并归组(`enrichReservesFromId` 在这种情况下**不填** `spokeAddress`) | Medium | automated test | 生产者直接读 `reserveId` |
| V7 | V3 reserve 混入 | 被 `getProtocolVersion` 排除,不产生 key | Medium | automated test(既有用例) | — |
| V8 | `aaveProReserveId` 缺失 / 无法解码 | 跳过(既有行为) | Medium | automated test(既有用例) | — |
| V9 | 空输入 / 无 V4 reserve | 返回 `{}` | Low | automated test(既有用例) | — |
| V10 | 消费方:该链无地址簿 module | 返回 `{results: [], errors: []}` | Low | automated test(既有用例) | — |
| V11 | 消费方:spoke 无 reserve | 不发 RPC,不进结果也不进错误 | Medium | automated test(既有用例,改按地址) | — |
| V12 | 消费方:该链有 reserve 的 spoke 全被查询 | 查询数 = 地址簿 spoke 数(修前为 0) | High | automated test(回归门) | — |
| V13 | 单条 spoke RPC 失败(轮换耗尽) | 错误进 `errors` 且 `spokeName` 归属**正确的那条** spoke(不因 filter 合并而错位) | High | automated test(既有 AAV-1310 用例) | 单一 `targeted` 数组使下标对应成结构性保证 |
| V14 | 部分 spoke 失败 | 成功侧结果保留,失败侧进 `errors`(`allSettled` 既有语义) | Medium | automated test(既有用例) | — |
| V15 | 下游契约 | `reservesBySpoke` 参数类型不变;调用点零改动;`spokeName` 不进入任何用户可见文案 | Medium | static-type-lint(tsc)+ `rg spokeName src/` 复核 | — |
| V16 | live 数据端到端 | staging `/markets` + 真实地址簿:每链 `Object.keys(v4BySpoke)` 覆盖该链全部地址簿 spoke 地址 | High | runtime-real-data(`WALLET_ADDRESS` + RPC 跑 `userPositionConsistency`) | 需 RPC 可用;无 wallet 时 skip |
| V17 | 验证门 | lint + typecheck + vitest + build 全绿 | Medium | static-type-lint(CI gate) | — |

## Tickets（tracer-bullet 依赖边）

- **T1**(red):`deriveOnchainConfig.test.ts` fixture 改真实形态 + V1/V3/V4/V5/V6 用例 → 预期 red
- **T2**(green):`reserveKey.ts` 的 `toV4SpokeKey` + `deriveV4ReservesBySpoke` 实现 → T1 转 green,V7/V8/V9 既有用例保持 green
- **T3**(red→green):`aaveV4UserClient.test.ts` 传参改按地址 + V2/V12 跨模块 invariant → 修消费方 → green
- **T4**:`userPositionConsistency.test.ts` 补 V16 查询数断言
- **T5**:V17 验证门 + code review + commit + docs/Linear 更新

依赖边:T1 → T2 → T3 → T4 → T5(T2 与 T3 改不同文件,但 T3 的 invariant 依赖 T2 的实现)。

## Out of scope(AAV-1356 退出条件 #2/#3/#4)

curated module 仍未 union。本修复后每链覆盖 = 基础 module 的 spoke:

- chain 1:`/markets` 有 17 个 spoke 地址,基础 module 13 个,4 个不在其中(`RLUSD Yield`、`OUSD Yield`、`Bluechip` curated `0xa37e7c…`、`Gold Correlated` `0x115af1…`)。
- 联合 `AaveV4EthereumSentoraCurated` 后 chain 1 → 16 个,仍差 1 个(`Gold Correlated` 不在任何 module 里)。
- 真做了 union 才需要的三件事:改 `selectModulesPerChain` 的「确定性选一个 + 歧义抛错」契约(该守卫是 `2a84e99c` 刚加的)、把「名字在链内唯一」的测试换成「地址唯一」、决定同名不同地址在 `failedSources` 标签里如何区分(退出条件 #2)。RPC 代价:chain 1 多 3 条 spoke 的 multicall,**仅在兜底激活时**。

本修复把该路径从 0/21 变为 21/21;union 是它之上 +3 的独立增益,按票面保留待裁。
