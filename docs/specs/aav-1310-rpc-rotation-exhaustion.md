# AAV-1310 — RPC 轮换耗尽静默空成功修复(语义分流 + failedSources 显式报错)

> Status: implemented 2026-09-27 · Issue: [AAV-1310](https://linear.app/aaveapy/issue/AAV-1310) · Type: on-chain fallback error semantics fix(数据层)

## 背景与根因

`createClientWithRpcRotation(chainId)` 轮换耗尽**与「无 RPC 配置」共用同一个 `null`** 返回:

```ts
// rpcResilience.ts
export async function createClientWithRpcRotation(chainId: number): Promise<PublicClient | null> {
  const rpcUrls = getAllRpcUrls(chainId);
  if (rpcUrls.length === 0) return null;   // (A) registry 无此链 → 合理降级
  for (const url of rpcUrls) { ... try { return client } catch { continue } }
  return null;                             // (B) 轮换耗尽 → 基础设施故障,却被吞成 null
}
```

消费方把 `null` 统一当作「可降级空成功」,导致 RPC 波动时静默呈现确定性假数据:

| 消费方 | 文件 | 现状 |
|---|---|---|
| V3 仓位 | `aaveV3UserClient.ts:144` | `if (!publicClient) return { positions: [], accountSummary: null }` |
| V4 仓位 | `aaveV4UserClient.ts:181` | `if (!publicClient) return { positions: [], accountSummaries: [] }` |
| Health Factor | `useOnchainHealthFactor.ts:121,163,225` | `if (!client) return null`(HF 缺失,UI 有既有降级态) |

后果链(实测证据,2026-09-27 Celo 三 RPC 端点 >5s):

```
[rpc-rotation] https://celo.drpc.org failed for chain 42220: timed out after 3000ms
... ×3
errors: []          ← 全链失败却被吞(getV3UserPositionsMultiChain 的 allSettled 视为 fulfilled)
position count: 0   ← UI 显示「该链无仓位」≈$0,与「钱包真没仓位」不可区分
```

影响:
- fallback 层(AAV-1305 layer 1)在 RPC 波动时给出**错误的确定性答案**($0)而非降级提示。
- `userPositionConsistency.test.ts` 的 `errors` 断言被空成功绕过,测试诚实性受损(绿灯 ≠ 证据)。

## 设计(方案 1:RPC 轮换耗尽单独抛错,triage 已裁决)

核心:**把两种 `null` 语义拆开,只让地址缺省走空降级,RPC 轮换耗尽显式抛错**。

1. **`rpcResilience.ts`**:
   - 新增 `export class RpcRotationExhaustedError extends Error`,`message` 固定带 `RPC rotation exhausted for chain ${chainId}`;`type: 'rpc-rotation-exhausted'` 可判定字段。
   - `createClientWithRpcRotation` 保留签名 `Promise<PublicClient | null>`,但 `null` 语义**收紧为唯一含义 = 无 RPC 配置**(registry 无此链)。轮换耗尽改 `throw new RpcRotationExhaustedError(chainId)`。
   - 既有 `classifyRpcError` / `withTimeout` / `isInfrastructureFailure` 零改动。
2. **`aaveV3UserClient.ts` / `aaveV4UserClient.ts`**:
   - `if (!publicClient) return 空成功` **原样保留**(现在只对应 registry 无 RPC 的真实降级)。
   - 轮换耗尽 throw 自然向上传播 → `getV3UserPositionsMultiChain` / `getV4UserPositionsAllSpokes` 的 `allSettled` 捕到 → `errors` / `V4OnchainError` 非空。
   - `providerAddress/poolAddress` / `spokes` 缺省路径 **零改动**(地址缺省 ≠ RPC 故障)。
3. **`fallbackPositions.ts`**:零改动。`errors` 非空 → `failedSources.push(\`${prefix}-chain-${err.chainId}\`)`(V3)/`${prefix}-chain-${err.chainId}-spoke-${spokeName}`(V4)已存在,自动生效。
4. **`useOnchainHealthFactor.ts`**(HF 消费方同步对齐):
   - `fetchV3PoolHf`/`fetchV4SpokeHf` 将 client 创建纳入 try:仅 `RpcRotationExhaustedError` 被显式捕获 → 记 console.error 并返回既有 `null`(HF 缺失降级);其余错误 rethrow。
   - `fetchOnchainHfBaselines` 的 IIFE 同样仅捕获 `RpcRotationExhaustedError`(记日志 + skip 该链),其余 rethrow —— 但所有 IIFE 都在 `Promise.allSettled(fetchPromises)` 下,**任何非 exhaustion 错误最终被 allSettled 吸收,不会抛到 useQuery**(既有行为,非本次引入)。
   - 语义:轮换耗尽 = 可预期的降级(捕获并映射),其他异常 = allSettled 兜底(仍不崩溃)。
5. **`userPositionConsistency.test.ts`**:不引入新断言。既有 `errors` 断言在轮换故障时现在能红灯(修复前空成功绕过),回归覆盖由 V3/V4 单测承担。

**契约不变量**:`getV3UserPositionsMultiChain` / `getV4UserPositionsAllSpokes` 的 **errors 数组是唯一失败通道**(既有 `V3OnchainResponse.errors` / `V4OnchainResponse.errors`),本修复只保证「轮换耗尽的失败也进这个通道」,不改 errors 的字段形态。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/lib/userData/rpcResilience.ts` | 新增 `RpcRotationExhaustedError`;`createClientWithRpcRotation` 轮换耗尽从 `return null` 改 `throw` | Medium | 核心语义拆分;callers 收敛(4 处) |
| `src/lib/userData/aaveV3UserClient.ts` | `getV3UserPositionsOnChain` 无改动(throw 自然传播);`multichain` 已 allSettled 捕获 | Low | 行为修复点在 rpcResilience,消费方透传 |
| `src/lib/userData/aaveV4UserClient.ts` | `getV4UserPositionsOnChain` / `getV4UserPositionsAllSpokes` 无改动(throw 自然传播) | Low | 同上 |
| `src/hooks/useOnchainHealthFactor.ts` | HF 场景 client 创建纳入 try:仅 `RpcRotationExhaustedError` 捕获映射 `null` 降级,其余 rethrow(allSettled 兜底);`fetchOnchainHfBaselines` 因测试需引入导出(测试专用 export,生产无外部消费者) | Medium | 唯一需主动核对的消费方;HF 缺失态与现状一致 |
| 测试(`rpcResilience.test.ts` / `aaveV3UserClient.test.ts` / `aaveV4UserClient.test.ts` / `useOnchainHealthFactor.test.ts`) | 新增轮换耗尽断言路径;既有「无 RPC 配置返回 null」用例保留 | Low | 纯测试改动,补杀既有空成功绕过 |

**风险判定依据**:
- 修改是否影响现有功能?— 只影响「RPC 全部超时/失败」这一路径(修复前静默空 → 修复后报错)。正常 RPC 响应路径零改动。
- 下游消费者?— 3 个 producer 透传,`fallbackPositions` 零改动,HF 是唯一主动核对点。
- 最坏后果?— 若 throw 未被正确捕获:V3/V4 会被 allSettled 捕到进 errors(安全,本就设计);HF 若未兜住会抛到 useQuery 查询 error——但 HF 调用点已确认外层有 catch(allSettled 兜底),且兜底映射 null 保既有降级。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | `rpcUrls.length === 0`(registry 无 RPC) | 仍 `return null`,不抛(平滑降级) | High | automated test(`rpcResilience.test.ts` 真实实现全量覆盖;client 测试 mock null 仅断言消费方降级) | 语义拆分,mock `[]` 即此路 |
| 2 | 全部 RPC 超时/失败(轮换耗尽) | `throw RpcRotationExhaustedError`(`message` 含 chainId,`type` 可判定) | High | automated test(新增) | `createClientWithRpcRotation` 单测,`getAllRpcUrls` mock 多条全失败 |
| 3 | 部分 RPC 失败、最后一个成功 | 返回 client,不抛(轮换本身成功) | High | automated test(补充) | 循环 continue 语义保留 |
| 4 | V3 `getV3UserPositionsOnChain`(轮换耗尽,无外部 client) | throw 冒泡 → `getV3UserPositionsMultiChain.allSettled` → `errors` 含该 chainId | High | automated test(新增) | multichain 已 allSettled |
| 5 | V3 地址缺省(provider/pool undefined) | 仍空成功 `{positions:[], accountSummary:null}`,**不**走 errors | High | automated test(既有 degradation 用例) | 地址缺省 ≠ RPC 故障 |
| 6 | V4 `getV4UserPositionsOnChain`(轮换耗尽) | throw 冒泡 → `getV4UserPositionsAllSpokes` → `errors` 含 chainId+spokeName | High | automated test(新增) | allSettled 已兜 |
| 7 | V4 无 spokes(含未知链 999999) | 仍空成功 `{results:[], errors:[]}`,不抛 | High | automated test(既有 `getV4UserPositionsAllSpokes(999999, ...)` 用例) | spokes 缺省 ≠ RPC 故障 |
| 8 | `fetchFallbackPositions` V3 分支(errors 含链) | `failedSources.push('${prefix}-chain-${chainId}')` | High | automated test(pre-existing `gapFallbackQuery.test.ts` 'records V3 per-chain errors in failedSources' 用例) | 零改动,errors→failedSources 已有 |
| 9 | V4 分支(errors 含 spoke) | `failedSources.push('${prefix}-chain-${chainId}-spoke-${spokeName}')` | High | automated test(已有) | 同上 |
| 10 | HF 单链 V3/V4(轮换耗尽) | throw 被既有 catch 或 allSettled 兜住 → console.error,HF 缺失(既有 null),不抛到 useQuery | Medium | automated test(新增)+ static-type-lint | HF 缺失 ≥ 抛错崩溃,保既有降级 |
| 11 | 一致性测试回归 | `errors` 断言在轮换故障时正确红灯(修复前空成功绕过) | Medium | runtime-real-data(可选) | 不新增断言,依赖既有 errors 断言 + V3/V4 单测 |
| 12 | errors 字段契约 | `failedSources` / UI `partial` 降级展示复用既有通道,字段形态零变更 | Low | static-type-lint(tsc) | 不动 errors 结构 |
| 13 | 验证门 | lint + test + build + tsc 全绿 | Medium | static-type-lint(CI gate 四件套) | — |

## Tickets(tracer-bullet 依赖边)

- **T1**(red):`rpcResilience.test.ts` 新增轮换耗尽 throw 用例(矩阵 1/2/3)→ 预期 red
- **T2**(green):`rpcResilience.ts` 实现 `RpcRotationExhaustedError` + 轮换耗尽 throw(矩阵 1/2/3)→ red 变 green
- **T3**(green):V3/V4 单测新增「轮换耗尽 → errors 含 chainId」/「地址缺省仍空成功」用例(矩阵 4/5/6/7);fallback 测试补 errors→failedSources 生产(矩阵 8/9)
- **T4**(green):HF 调用点核对/兜底 + 单测(矩阵 10)
- **T5**:验证门四件套 + code review + commit + docs/Linear 更新(矩阵 11/12/13)

依赖边:T1 → T2 → T3 → T4 → T5(T3/T4 独立可并行,T5 收口)。矩阵行 11/12 由既有断言 + tsc 覆盖,不建独立 ticket。

## Out of scope

- **地址缺省改结构化失败**(provider/pool/spokes undefined → errors):本次只处理 RPC 轮换耗尽,地址缺省路径保留空成功(registry 无链是真实降级场景,不是故障)。
- V4/HF 单独排期:本次 V4/HF 随 V3 同期对齐(同一 `createClientWithRpcRotation` 消费方,不拆票)。
- `getAllRpcUrls` 返回空但实际链存在:registry 数据质量问题,属 chainDiscovery 域,另开票。
