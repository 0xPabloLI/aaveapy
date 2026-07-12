# ADR-0015: Unified Refresh Trigger via `refetchEvent` Module-Scope Emitter

## Status

Proposed (2026-06-08). Targets AAV-643 PARTIAL → DONE and closes AAV-679.

## Context

### Original Bug (AAV-641/643)

Watch Mode 已激活时,用户重新输入同一(或不同)地址 → 系统无反应,仓位不重新拉取。
- AAV-641 (Canceled, 2026-06-07 23:18, 中文):"Watch mode: 地址在刷新后消失且无法重新填入"
- AAV-643 (Done PARTIAL, 2026-06-07 23:29, English):"address disappears after refresh, re-entering address has no effect"
- AAV-679 (Todo, 2026-06-08 03:52, follow-up):"refetch production positions on Watch Mode re-submit"

### Symptom Chain (as originally framed)

```
User re-submits address
  ↓
useWatchModeConnect (reentry 分支)
  ↓ queryClient.invalidateQueries(['user-positions', address])   ← 死 key
return
  ↓
useAccount() / useWallet() → address 引用不变(同地址, wagmi 内部 Object.is 过滤)
  ↓
useUserPositionsSdk → v3SdkArgs/v4SdkArgs useMemo 依赖未变 → 同一引用
  ↓
useV3UserSupplies / useV4UserSupplies (urql) → 同一 args 引用 → 不 refetch
useQuery(['user-positions-onchain-fallback', ...]) → 同一 key 引用 → 不 refetch
  ↓
用户看到 stale positions
```

### Root Cause (after zoom-out)

The framing "urql doesn't refetch" is misleading. The deeper issue is that **we have no way to express "the user wants a refresh"** distinct from "the address changed". The system's only signal is `useAccount().address`, and when that doesn't change (same address re-submit), no downstream hook sees a "new value" — which is correct behavior in isolation, but fails to capture user intent.

The system does have a working refresh concept (F5, page reload — all hooks re-init). But re-submitting an address is treated as an independent code path (`useWatchModeConnect.isReentry`) that **forgot** to trigger refresh.

### Why current approaches fail

| 方案 | 问题 |
|---|---|
| React state / prop nonce (`refetchTrigger`) | wagmi 同地址 reentry 不会触发 React re-render,prop 永远传不到消费端 |
| urql `useMemo` 引用变化 | `Object.is` 引用比较不可靠;即使变了,urql 内部对 variables 做 deep equal,同变量仍然不 refetch |
| `location.reload()` | 违反 CONTEXT.md "保留 manual 仓位" 规则(ADR-0014: snapshots 是 in-memory only) |
| 改 `watchModeConnector.setWatchAddress` 强制 emit | hack wagmi 内部,可能影响正常 connect/disconnect 路径 |

## Decision

**引入一个 module-scope 的 `refetchEvent` emitter,所有 "强制刷新仓位" 触发路径都走它。**

### 模块设计

```typescript
// src/lib/userData/refetchEvent.ts
type RefetchListener = (info: { source: RefetchSource }) => void

export type RefetchSource = 'f5' | 'button' | 'watch-reentry' | 'auto'

const listeners = new Set<RefetchListener>()

export function bumpRefetch(source: RefetchSource): void {
  for (const listener of listeners) {
    try {
      listener({ source })
    } catch (err) {
      console.error('[refetchEvent] listener failed', err)
    }
  }
}

export function subscribeRefetch(listener: RefetchListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 测试用
export function _resetRefetchListeners(): void {
  listeners.clear()
}
```

### 三个触发路径

1. **F5 / 整页 reload**:`refetchEvent` 不需要显式 emit,React tree 重新 mount → 所有 query hook 走初始 fetch → 自然 refetch。
2. **Refresh 按钮(若未来存在)**:`onClick={() => bumpRefetch('button')}`
3. **Watch Mode re-submit**:`useWatchModeConnect` reentry 分支调 `bumpRefetch('watch-reentry')`(替代当前死的 `invalidateQueries(['user-positions', address])`)

### 一个消费端

`useUserPositionsSdk` 内部 `useEffect` 订阅 `refetchEvent`,收到 bump 时:

```typescript
useEffect(() => {
  return subscribeRefetch(({ source }) => {
    // 1) RQ fallback invalidation
    queryClient.invalidateQueries({
      queryKey: ['user-positions-onchain-fallback', address ?? 'no-wallet'],
    })

    // 2) urql SDK refetch (通过 @aave/react 暴露的 client)
    const aaveClient = getAaveClient()   // 新增 helper,见下文
    if (aaveClient) {
      void aaveClient.refetchQueries(/* V3 + V4 operations */)
    }
  })
}, [address, queryClient])
```

### 关键子决策

#### 1. 如何调 urql 的 `refetchQueries`?

`@aave/react` 包通过 `<AaveProvider>` 提供 urql client。**当前没暴露 client 给我们**。
- **选项 A**:包装一个 `getAaveClient()` helper 读取 `<AaveProvider>` 内部的 React context(需要 `@aave/react` 内部有这个 hook)
- **选项 B**:包装一个 `useAaveClient()` hook,消费端用 hook 拿到 client
- **选项 C**:`@aave/react` 内部有 `useUserReservesQuery` 的 `requestPolicy: 'cache-and-network'`,我们传一个 nonce 进去,让 args 引用变化触发 refetch

**倾向**:先 B;如果 A 没有,降级到 C;最终 C 失败再考虑直接 hack urql client。

具体选型在实现阶段验证 `@aave/react` 实际暴露的 API 后定。

#### 2. RQ 路径:`useUserPositions` 死代码要不要一起删?

**要**。它是零 production caller(只 `WalletLoadState` type-only import)。`useUserPositionsSdk` 内部 RQ fallback 用的是不同的 key(`['user-positions-onchain-fallback', ...]`,line 224)。删 `useUserPositions.ts` 是纯清理。

#### 3. 测试粒度

- **单元测试**:`refetchEvent` 的 subscribe/bump/unsubscribe 行为、`useWatchModeConnect` reentry 调 `bumpRefetch('watch-reentry')` 而非死的 invalidate
- **集成测试**:`useUserPositionsSdk` 收到 bump 时,验证 RQ invalidate + urql refetch 都被调(用 mock urql client + spy queryClient)
- **E2E** (Playwright):重提交地址 → 验证看到新 positions(可用 `expect.poll` 等待 loading → success 状态转换)

## Consequences

### 正面

- **统一抽象**:三条 refresh 触发路径走同一段 invalidation 代码,不留边角 case
- **绕开 wagmi 过滤**:`refetchEvent` 是 imperative signal,不依赖 React re-render / `useSyncExternalStore` 的 `Object.is` 比较
- **保留用户状态**:不动 in-memory `PortfolioState`(`source: 'manual'` 仓位不丢)
- **可扩展**:未来加任何 "强制刷数据" 场景(snapshot 过期、token 列表变更、错误重试超时)都走同一个 `bumpRefetch()`
- **可测试**:`refetchEvent` 是纯 module-scope,无 React 依赖,可用 `vi.mock` 或直接 import 测试

### 负面

- **新增 module-scope 状态**:违反 "all state lives in React" 原则,但 trade-off 值得
- **listener 必须无副作用 + 异常隔离**:在 `bumpRefetch` 里包 try/catch(已纳入实现)
- **urql client 接入点需要探索**:`@aave/react` 当前没暴露,需要先验证
- **测试 vitest 框架对 module-scope emitter 需要 `vi.resetModules()` 隔离**:每个测试前 `_resetRefetchListeners()`

## Alternatives Considered

### A. 在 useWatchModeConnect 内直接 `client.refetchQueries()`

需要拿 urql client → 通过 React context 或 `import { client } from '@aave/react'`。**否决理由**:只覆盖 urql,不动 RQ fallback;且 hook 层耦合底层 cache 实现,违反"hook 只读 store、不写"的关注点分离。

### B. prop drilling `refetchTrigger` nonce

`useWatchModeConnect` 暴露 `reentryNonce` → `Index.tsx` 接到 → 传给 `useUserPositionsSdk`。**否决理由**:同地址 reentry 时 wagmi 不 re-render,`useWatchModeConnect` 内部的 `useState` 不会触发值传到 props,接收端永远看不到变化。

### C. `location.reload()`

**否决理由**:违反 ADR-0014 "snapshots are in-memory only"——会清掉 `source: 'manual'` 仓位。CONTEXT.md "Wallet Address Switch Behavior" 明确要求保留。

### D. 改 `watchModeConnector.setWatchAddress` 强制 emit

**否决理由**:hack wagmi 内部事件系统;可能影响正常 connect/disconnect 路径;且 wagmi 内部 `Object.is` 过滤可能在更下游的 hook 层,改 connector 解决不了 React tree 之上没人感知的问题。

### E. 给用户加显式 Refresh 按钮

**否决理由**(用户已确认):现有 F5 + 未来可能加的按钮已足够,re-submit 应按 refresh 处理,不应让用户多学一个 affordance。

## Implementation Sketch

```typescript
// src/lib/userData/refetchEvent.ts
// (见上文 "模块设计" 节)

// src/hooks/useWatchModeConnect.ts  (改动 isReentry 分支)
if (isReentry) {
  watchConnector.setWatchAddress(address)  // 保留以触发 wagmi change 事件(给新地址场景)
  bumpRefetch('watch-reentry')             // 替代死的 invalidateQueries
  return
}

// src/hooks/useUserPositionsSdk.ts  (新增 effect)
useEffect(() => {
  return subscribeRefetch(() => {
    void queryClient.invalidateQueries({
      queryKey: ['user-positions-onchain-fallback', address ?? 'no-wallet'],
    })
    const client = getAaveClient()  // TBD: 实现细节
    if (client) {
      void client.refetchQueries(/* V3 + V4 */)
    }
  })
}, [address, queryClient])
```

## Cleanup (in-scope)

1. **删除 `src/hooks/useUserPositions.ts`** — 零 production caller,只 type-only import `WalletLoadState`
2. **删除 `useWatchModeConnect.ts:33` 死的 `invalidateQueries(['user-positions', address])`**
3. **更新 `docs/archive/2026-06-07-wallet-positions.md`**:AAV-643 状态从 PARTIAL → DONE,删去 AAV-679 follow-up 引用
4. **关闭 Linear AAV-679**

## Open Questions (resolve during implementation)

1. `@aave/react` 内部如何暴露 urql client?(决定 `getAaveClient()` 实现路径)
2. urql `refetchQueries` 的 query identifier 是什么?(决定传什么参数)
3. `bumpRefetch('f5')` 是否需要显式调?(F5 是 React tree 重新 mount,自然 refetch,可能不需要 explicit bump;但保留 `source` 标识便于 logging)

## References

- AAV-641 (Canceled): https://linear.app/aaveapy/issue/AAV-641
- AAV-643 (Done PARTIAL): https://linear.app/aaveapy/issue/AAV-643
- AAV-679 (Todo, to be closed): https://linear.app/aaveapy/issue/AAV-679
- ADR-0003: Onchain Fallback Reactive Architecture
- ADR-0014: PortfolioReserveEntry per-reserve data model
- `docs/archive/2026-06-07-wallet-positions.md` (AAV-641/643 follow-up documentation)
