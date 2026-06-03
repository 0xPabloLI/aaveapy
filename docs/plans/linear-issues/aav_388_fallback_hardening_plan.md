# AAV-388 Sub-Issues: Onchain Fallback Reliability Hardening

PRD: `docs/plans/prd-onchain-fallback-hardening.md`
ADR-0003, ADR-0004

## Issue 1: rpcResilience deep module

**Title**: AAV-388: rpcResilience deep module — isInfrastructureFailure + withTimeout + classifyRpcError
**Priority**: High
**Parent**: AAV-388
**Labels**: ready-for-agent
**Depends on**: none

Create `src/lib/userData/rpcResilience.ts` with three pure functions:

- `isInfrastructureFailure(error: unknown): boolean` — timeout/5xx/fetch/network/graphql → true; null/undefined → false; other Error → false
- `withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T>` — Promise.race with timeout rejection
- `classifyRpcError(err: unknown): 'network' | 'contract' | 'unknown'` — ETIMEDOUT/ECONNRESET/fetch → network; CALL_EXCEPTION/UNPREDICTABLE_GAS_LIMIT/revert → contract; else unknown

Tests: `src/lib/userData/rpcResilience.test.ts`
- isInfrastructureFailure: null, undefined, timeout Error, network Error, GraphQL Error, generic Error, non-Error
- withTimeout: resolves before timeout, rejects on timeout with label, cleans up timer on resolve, cleans up timer on reject
- classifyRpcError: network keywords, contract keywords, unknown

---

## Issue 2: RPC rotation

**Title**: AAV-388: RPC rotation — createClientWithRpcRotation replaces createClientWithRetry
**Priority**: High
**Parent**: AAV-388
**Labels**: ready-for-agent
**Depends on**: Issue 1

Refactor `aaveV3UserClient.ts` and `aaveV4UserClient.ts`:

- Rename `createClientWithRetry` → `createClientWithRpcRotation`
- Implement multi-URL rotation: iterate `getPublicRpcUrls(chainId)`, for each URL create client + `withTimeout(client.getChainId(), 3000)` connectivity check, return first successful; return null if all fail
- Import `withTimeout` from `rpcResilience.ts`

Tests per file:
- All URLs fail → returns null
- First URL succeeds → returns client (no unnecessary calls)
- First URL fails, second succeeds → returns second client
- Empty URL list → returns null

---

## Issue 3: V4 fallback multi-chain

**Title**: AAV-388: V4 fallback multi-chain — remove chainId=1 hardcode, iterate V4_SPOKE_ADDRESSES
**Priority**: High
**Parent**: AAV-388
**Labels**: ready-for-agent
**Depends on**: Issue 2

Refactor `fetchV4Fallback` in `useUserPositionsSdk.ts`:

- Replace `getV4UserPositionsAllSpokes(1, ...)` with iteration over `Object.keys(V4_SPOKE_ADDRESSES).map(Number)`
- Each chainId runs `getV4UserPositionsAllSpokes(chainId, ...)` in parallel via `Promise.allSettled`
- Wrap each call with `withTimeout(..., 15_000, 'onchain-v4')`
- Aggregate results and errors across chains

Tests:
- Single chain (Ethereum only) → same as before
- Multiple chains → parallel fetch, errors in one chain don't block others
- Timeout on one chain → partial results + failedSources

---

## Issue 4: V3/V4 independent fallback queries + cache strategy

**Title**: AAV-388: V3/V4 independent fallback queries + cache strategy
**Priority**: Medium
**Parent**: AAV-388
**Labels**: ready-for-agent
**Depends on**: Issue 1

Refactor `useUserPositionsSdk.ts`:

- Split single `fallbackQuery` into `v3FallbackQuery` and `v4FallbackQuery`
- Each: independent `queryKey`, `enabled` (v3SdkFailed / v4SdkFailed), `queryFn`, `staleTime: 30_000`, `gcTime: 5*60_000`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`
- Wrap queryFn with `withTimeout(..., 15_000, label)`
- Merge: sdkPositions + v3Fallback.data.positions + v4Fallback.data.positions; aggregate failedSources
- `isLoading`: sdkLoading || v3Fallback.isLoading || v4Fallback.isLoading
- `retry`: refetch both

Tests:
- V3 SDK fails, V4 OK → only v3FallbackQuery enabled, v4 not triggered
- V4 SDK fails, V3 OK → only v4FallbackQuery enabled, V3 data immediately available
- Both fail → both fallbacks run independently
- Cache: staleTime prevents refetch within 30s

---

## Issue 5: SDK failure detection接入

**Title**: AAV-388: SDK failure detection — isInfrastructureFailure replaces !!error
**Priority**: Medium
**Parent**: AAV-388
**Labels**: ready-for-agent
**Depends on**: Issue 1, Issue 4

Refactor `useUserPositionsSdk.ts`:

- Replace `v3SdkFailed = !!v3Supplies.error || !!v3Borrows.error` with `isInfrastructureFailure(v3Supplies.error) || isInfrastructureFailure(v3Borrows.error)`
- Same for v4SdkFailed
- Update `useWalletAutoImport.ts` if needed (it already consumes v3SdkFailed/v4SdkFailed as booleans, interface unchanged)

Tests:
- SDK error is timeout → fallback triggered
- SDK error is network → fallback triggered
- SDK error is warning-level (non-infrastructure) + data exists → fallback NOT triggered, SDK data used
- SDK error is null → no fallback

---

## Issue 6: Integration validation + AAV-388 closure

**Title**: AAV-388: Integration validation and close
**Priority**: Medium
**Parent**: AAV-388
**Labels**: ready-for-agent
**Depends on**: Issue 1-5

- Run full validation gate: `npm run lint && npm test && npm run build && npx tsc --noEmit`
- Verify fallback toast still works (`useWalletAutoImport` warning toast)
- Verify `DegradedResult` status='partial' flows correctly
- Close AAV-388 on Linear
- Update CONTEXT.md if any new terms emerged during implementation
