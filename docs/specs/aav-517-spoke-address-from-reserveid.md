# AAV-517 — onchain V4 仓位查询的 spoke 来源:地址簿 → reserveId

> Status: closed 2026-11-18（`26f0cb11`+`b6817cb6` 随 release PR #857 进 main，Linear Done） · Issue: [AAV-517](https://linear.app/aaveapy/issue/AAV-517) · 前置: AAV-1356（join key 改为地址）· Type: tech debt / data layer（非新增功能）

## 背景与根因

V4 仓位在 SDK 主路径失败时走 on-chain RPC 兜底。该兜底的「要查哪些 spoke」由 **地址簿** 决定：

```
getV4UserPositionsAllSpokes (src/lib/userData/aaveV4UserClient.ts:431)
  const spokes = getV4SpokeAddresses(chainId);   ← @aave-dao/aave-address-book
  if (!spokes) return { results: [], errors: [] };
  targeted = spokes.flatMap(spoke => reservesBySpoke[toV4SpokeKey(spoke.address)] ? ... : []);
```

而 `/markets` 的每条 V4 reserve 的 `reserveId` 第二段**已经是 spoke 地址**（AAV-1356 已把生产侧的 key 改成它）。两条事实因此成立：

1. **新 Spoke 部署要等 npm 发版才可查询**：地址簿没收录的 spoke，即使 `/markets` 已经有它的 reserve，兜底依然一条都不发。票面的原始痛点。
2. **地址簿缺失时整条链被短路**：`if (!spokes)` 让「地址簿没有这条链」等价于「这条链没有 V4 仓位」，而 payload 里的 reserve 被静默丢掉（零仓位零错误）。

地址簿在本路径上只剩两个用途：给 `spokeName` 提供诊断标签、以及给跨系统匹配提供 EIP-55 拼写。两者都不是「查询准入」。

还有第三条被地址簿**掩盖**的事实：`deriveV4ReservesBySpoke` 的 key 是**全链合并**的地址，一个 map 同时服务 1 / 5042 / 8453 / 43114。旧实现靠「地址簿按 chainId 取 spoke」隐式分链；一旦迭代源换成 map，chain 1 的调用会把其它链的 spoke 也拿去查——**这正是本轮 live 验证抓到的 8 个跨链失败**（3 + 1 + 4）。所以换源必须同时把链维度显式化：`V4ReserveInfo` 增加 `chainId`，读取前按链过滤。

## 设计

**单一事实源换位**：迭代源改为 `reservesBySpoke` 的 key（`deriveV4ReservesBySpoke` 已从 `reserveId` 的 spoke 段产出，小写 40-hex，AAV-1356），地址簿降级为**标签 + 校验**；同时把链维度从「地址簿的隐式过滤」改成「`V4ReserveInfo.chainId` 的显式过滤」。

```ts
const addressBook = new Map<string, V4SpokeEntry>();
for (const entry of getV4SpokeAddresses(chainId) ?? []) {
  const key = toV4SpokeKey(entry.address);
  if (key) addressBook.set(key, entry);
}

const targeted: { spoke: { name: string; address: `0x${string}` }; reserves: V4ReserveInfo[] }[] = [];
const seen = new Set<string>();
for (const [rawKey, reserves] of Object.entries(reservesBySpoke)) {
  const key = toV4SpokeKey(rawKey);
  if (!key || !reserves?.length || seen.has(key)) continue;   // 形状守卫 / 空组 / 同址异拼写
  const chainReserves = reserves.filter((info) => info.chainId === chainId);
  if (chainReserves.length === 0) continue;                    // 别的链的 reserve，不属于本次调用
  seen.add(key);
  const entry = addressBook.get(key);
  if (!entry) {
    console.warn(`[onchain-v4] spoke ${key} on chain ${chainId} is not in the address book; querying from reserveId (AAV-517)`);
  }
  targeted.push({ spoke: { name: entry?.name ?? shortSpokeLabel(key), address: key as `0x${string}` }, reserves: chainReserves });
}
```

规则：

1. **key 归一化仍走 `toV4SpokeKey`**（单一作者，AAV-1356 契约不变）：只接受 `0x` + 40 hex，小写为规范形式。
2. **同名不同址不再可能合并**：迭代单位是地址，`V4_SPOKE_ADDRESSES` 的 module 前缀歧义只影响标签，不影响查询集合。
3. **标签回退**：地址簿有条目 → 沿用条目名（`MAIN_SPOKE` / `AaveV4Ethereum:BLUECHIP_SPOKE`）；没有 → `shortSpokeLabel(地址)`（`0x1234…abcd`）。标签只进 `V4OnchainError.spokeName` → `failedSources`，不显示给用户。
4. **未知 spoke 只 warn 不 throw**：throw 会把地址簿依赖原样装回来，与本票目的相反；warn 让漂移可观测（与 AAV-1386 的「观察不阻断」同族）。
5. **保留 `Promise.allSettled` + 单个 `targeted` 数组**（AAV-1356 的结构性归属保证）：`settled[i]` 与标签一一对应，失败不会错位到邻座。
6. **删掉 `if (!spokes)` 短路**：地址簿无该链时仍按 payload 查询；两者皆空时返回空结果（不 throw、不创建 pool）。
7. **链维度显式化**：`deriveV4ReservesBySpoke` 的每条 entry 带 `chainId`（来自 `ReserveWithSpread.chainId`），读取时 `filter(chainId)`。key 仍是纯地址（AAV-1356 契约不变），链只是 entry 的属性。

**契约不变量**：

- `getV4UserPositionsAllSpokes` 参数类型、`V4OnchainResult` / `V4AccountSummary` / `V4OnchainError` 字段零变化；`V4ReserveInfo` 增加必填 `chainId`（内部类型，非 API 契约），所有下游签名同步。
- `spokeName` 语义仍是「诊断标签」；已知 spoke 的取值与改前逐字一致（回归面）。
- 失败粒度仍按 spoke：一个 spoke 的 multicall 全失败只进 `errors`，其余 spoke 照常返回。
- 空输入（`{}`、无 RPC 配置的链）不新增 RPC 调用。

**Out of scope**：不改 `deriveV4ReservesBySpoke` 的 key（生产侧已按地址，只给 entry 加 `chainId`）；不动地址簿 union 逻辑（AAV-1356 #2/#3/#4）；不改 fallback 触发条件与 `failedSources` 前缀格式。

## Modified Files Impact

| 文件 | 修改内容 | 风险 | 评估 |
| --- | --- | --- | --- |
| `src/lib/userData/aaveV4UserClient.ts` | `getV4UserPositionsAllSpokes` 迭代源换为 `reservesBySpoke`；新增 `shortSpokeLabel`；地址簿改为 label map + 缺失 warn | Medium | 单函数、单文件；查询集合从「地址簿∩payload」变成「payload」，只增不减（地址簿里的 spoke 若在 payload 中也必被查） |
| `src/lib/deriveOnchainConfig.ts` | 每条 `V4ReserveEntry` 增加 `chainId`（key 不变）；导出 `V4ReserveEntry` 类型 | Medium | 生产侧唯一作者；消费侧靠它分链 |
| `src/lib/userData/fallbackPositions.ts` / `gapFallbackQuery.ts` / `hooks/useUserPositionsSdk.ts` | 透传签名补 `chainId`（结构类型同步，无逻辑改动） | Low | `typecheck` 覆盖 |
| `src/lib/userData/aaveV4UserClient.test.ts` | 新增 S2–S8、S10–S11、S14 用例；既有 AAV-1356 用例保持 | Low | 新用例锚定矩阵行 |
| `src/test/userPositionConsistency.test.ts` | **退役**地址簿覆盖硬断言（AAV-1356 #2/#3 的 live 检查）：AAV-517 后地址簿不再决定查询集合，payload spoke 未进地址簿是「发版待跟上」而非缺陷；覆盖门改由既有的 payload 断言 `assertV4QueriedSpokeCount` 承担 | Low | 仅在 `WALLET_ADDRESS` 存在时运行；删除的是会与新行为直接矛盾的断言，不是覆盖率 |
| `docs/DOCS-INDEX.md` / `docs/issue-roadmap.md` | 登记 spec、更新票状态 | Low | 文档 |

最坏后果：payload 里出现**不存在**的 40-hex 地址 ⇒ 多发一次 multicall，返回全 failure 后按 AAV-1314 进 `errors`，其余 spoke 不受影响。不会产生错误仓位归属（地址是最细粒度 key）。

跨链误读的代价更高（向别的链才存在的地址发 multicall，必然整组失败），因此链维度必须是 entry 的必填字段而不是可选字段：漏填会在 `typecheck` 层被拦，不会静默发错请求。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 地址簿收录的 spoke + payload 有 reserve（现状） | 查询 1 次，`spokeName` 与改前逐字一致 | High | automated test（真实 `V4_SPOKE_ADDRESSES` 生成 payload） | 回归门：改前后同名 |
| S2 | payload 有、地址簿**没有**的 spoke（新部署形态） | 仍然查询；标签 = `0x1234…abcd`；warn 一次 | High | automated test（合成地址） | 本票的核心行为 |
| S3 | 地址簿无该链（`getV4SpokeAddresses` undefined）+ payload 有 reserve | 仍查询（旧实现返回空） | High | automated test（chain 5042 / 999999） | 删除短路后的直接断言 |
| S4 | key 不是 40-hex（`'Main'` / `'MAIN_SPOKE'` / 短地址） | 跳过，零 RPC，零 errors | High | automated test（AAV-1356 的 name-key 用例保留） | `toV4SpokeKey` 形状守卫 |
| S5 | 同址两种拼写（大小写各一条 key） | 只查询 1 次（去重） | Medium | automated test | `seen` 归一化去重 |
| S6 | 未知 spoke 的 multicall 全失败 | 该 spoke 进 `errors`，标签为短地址；其余 spoke 正常返回 | Medium | automated test（`makeMockClient` 定向 failure） | `targeted` 结构性归属 + allSettled |
| S7 | 空 `reservesBySpoke` / reserve 数组为空 | 零查询、零 errors，不创建 pool | Medium | 既有用例 | 循环前的 `!reserves?.length` 门 |
| S8 | 已知 spoke 但 payload 无 reserve | 不查询（与改前一致） | Low | 既有用例 `skips spokes not in reservesBySpoke` | 迭代源只在 payload |
| S9 | 地址簿与 payload 的 spoke 地址集合完全一致 | 查询数 = payload 去重数 = 地址簿条数（AAV-1356 live 断言仍成立） | Medium | live test（`WALLET_ADDRESS`） | `assertV4QueriedSpokeCount` 以 payload 为地面真值 |
| S13 | payload 有 spoke、地址簿没有（发版滞后） | **live 测试不再报错**；生产侧只 warn。地址簿覆盖从「硬门」降级为「不变量已迁移」 | High | 代码注释 + 本节 | 旧断言会与本票目的直接矛盾，故退役 |
| S14 | chain 1 的调用拿到**全链共享**的 `reservesBySpoke`（含 5042/8453/43114 的 entry） | 只向 chain 1 的 spoke 发 multicall；其它链的地址一条都不查 | High | automated test + 2026-11-18 live 首跑（8 个短地址 error）→ 修复后复跑 4/4 绿 | `reserves.filter(info.chainId === chainId)`；`V4ReserveInfo.chainId` 必填 |
| S15 | 有调用点构造 entry 时漏填 `chainId` | `typecheck` 拒绝 | Medium | `npx tsc --noEmit` | 必填字段 + 下游签名同步 |
| S10 | 地址簿条目存在但 key 大小写不同 | 命中同一标签（`toV4SpokeKey` 归一） | Low | automated test | 与 S5 同源 |
| S11 | 未知 spoke 在同一链出现多次（同址） | 只 warn 一次（按地址去重后） | Low | automated test | `seen` 先于 warn |
| S12 | `pool` 未注入、`client` 未注入 | 仍创建 session pool 并查询（行为不变） | Low | 既有用例（无 client 的 chain 1 用例） | 创建顺序不变 |

## User Stories

1. 作为维护者，我希望 Aave 新部署一个 Spoke 后，前端 on-chain 兜底立刻能查它，而不必等 `aave-address-book` 发版。
2. 作为维护者，我希望地址簿与链上真实部署漂移时有一条可观测的 warn，而不是静默少查一条 spoke。
3. 作为用户，我希望兜底读到的仓位与我持仓的 spoke 一一对应，不会因为地址簿没收录就显示 $0。
4. 作为用户，我希望 `Wallet data incomplete` 的失败源标签仍能指认到具体 spoke（已知的用常量名、未知的用短地址）。
5. 作为开发者，我希望改动的契约面为零：调用点、结果类型、fallback 触发条件都不动。

## Code Review（双轴，2026-11-18）

**Standards**（依据 `AGENTS.md` / `docs/conventions` + Fowler smell baseline）：

- 硬违规：0。改动是单函数内的数据源换位，无重复逻辑、无跨文件散弹、无 speculative 参数。
- 判断项 1：`shortSpokeLabel` 的 `slice(0, 6)` / `slice(-4)` 是裸数字。接受——docstring 直接给出目标形态（`0x1234…abcd`），抽常量只会把可读性降到零。
- 判断项 2：`targeted` 的结构类型内联在局部注解里。接受——只在函数体内出现一次，命名类型不会带来额外约束力。
- 已被工具覆盖的部分（类型、格式、未使用变量）交给 `typecheck` / `eslint` / `prettier`，不重复人审。

**Spec**（对照本文件矩阵）：

- S1–S13 全部有落点（S1/S7/S8/S12 由既有用例承担并已验证绿）；无「只有断言没有实现」的行。
- 无 scope creep：`deriveV4ReservesBySpoke`、地址簿 union、`failedSources` 前缀、fallback 触发条件均未动。
- 唯一偏离初稿：S13（地址簿覆盖的 live 硬断言退役）——初稿曾计划「改断言方向为 ≥ payload」，实施时判定该断言本身会与本票目的冲突（地址簿滞后时误报缺陷），改为直接退役并在本文件记录。

## 产品视角（交付时落到票的交付记录）

- 要解决的用户可见问题：新 Spoke 上线后地址簿未发版时，V4 on-chain 兜底静默返回空仓位。
- 现在看到的变化：无可见变化（诊断标签在未知 spoke 时变成短地址）；差异只在「本该有仓位却显示 $0」的场景消失。
- 没有变的行为：已知 spoke 的标签、失败源前缀、空输入、RPC 轮换与降级语义。
