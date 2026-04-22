# V4 reserveId Uniqueness Fix

Status: **implemented**
Date: 2026-04-22

## Problem

V4 multi-hub markets can list the same underlying token in multiple hubs (e.g. USDT exists in both the **Core** and **Prime** hubs of the Bluechip market). The current backend `reserveId` format does not include hub information, producing **duplicate keys**:

```
AaveV4Bluechip:1:0xdac17f958d2ee523a2206206994597c13d831ec7  → USDT in Core
AaveV4Bluechip:1:0xdac17f958d2ee523a2206206994597c13d831ec7  → USDT in Prime  (DUPLICATE)
```

**Affected markets (as of 2026-04-22):**

| Market | Token | Hubs |
|--------|-------|------|
| AaveV4Bluechip | USDT | Core, Prime |
| AaveV4Bluechip | USDC | Core, Prime |
| AaveV4EthenaEcosystem | USDT | Core, Plus |
| AaveV4EthenaEcosystem | USDC | Core, Plus |

**Frontend symptoms:** duplicate rows in table, simulation state collisions, stale tooltips/scroll on filter toggle.

## Current Format

```
{Version}{Market}:{chainId}:{tokenAddress}
```

| Version | Example | Unique? |
|---------|---------|---------|
| V3 | `AaveV3Ethereum:1:0xabc...` | ✅ Yes (no hubs) |
| V4 single-hub | `AaveV4Main:1:0xabc...` | ✅ Yes (only Core hub) |
| V4 multi-hub | `AaveV4Bluechip:1:0xabc...` | ❌ No |

## Proposed Format

Append `:hubName` to all V4 `reserveId` values. V3 stays unchanged.

```
{Version}{Market}:{chainId}:{tokenAddress}:{hubName}
```

Examples:

```
# V3 — no change
AaveV3Ethereum:1:0xdac17f958d2ee523a2206206994597c13d831ec7

# V4 single-hub — still appends hubName for consistency
AaveV4Main:1:0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9:Core

# V4 multi-hub — now unique
AaveV4Bluechip:1:0xdac17f958d2ee523a2206206994597c13d831ec7:Core
AaveV4Bluechip:1:0xdac17f958d2ee523a2206206994597c13d831ec7:Prime  ← different key
```

### Why hubName (not hubId)?

- `hubName` is short and human-readable (`Core`, `Prime`, `Plus`) — easy to debug in logs, DOM, and DevTools.
- `hubId` is a long base64 string (`MTo6MHhDY2E4NTJCYzQw...`) — noisy and unhelpful for debugging.
- `hubName` is already unique within a market (a market can't have two hubs named "Core").

### Why always append for V4, not only multi-hub?

- Avoids a future breaking change if a single-hub market adds a second hub.
- Keeps the rule simple: **V4 reserveId always has 4 segments, V3 always has 3.**

## Backend Changes

One change: wherever `reserveId` is constructed for V4 reserves, append `:${hubName}`.

Pseudo-code:
```
// Before
reserveId = `${marketName}:${chainId}:${tokenAddress}`

// After (V4 only)
reserveId = `${marketName}:${chainId}:${tokenAddress}:${hubName}`
```

### Validation

After deploying, the following must hold:

```bash
# No duplicate reserveIds in the API response
curl -s https://staging-api.aaveapy.com/api/markets | python3 -c "
import json, sys, collections
data = json.load(sys.stdin)
ids = [r['reserveId'] for r in data['reserves']]
dups = [i for i, c in collections.Counter(ids).items() if c > 1]
assert not dups, f'Duplicate reserveIds: {dups}'
print(f'OK: {len(ids)} reserves, all unique')
"
```

## Frontend Changes (after backend deploys)

1. **Revert `getReserveKey` hack** — remove the `hubId` concatenation workaround, return to `reserveId.trim()`:

```ts
// src/lib/reserveKey.ts — revert to simple form
export const getReserveKey = (reserve: ReserveKeySource): string => {
  return reserve.reserveId.trim();
};
```

2. **Update `ReserveKeySource` type** — back to `Pick<ReserveWithSpread, 'reserveId'>`.

3. **Update `getReserveSimulationId` type** — back to `Pick<ReserveWithSpread, 'reserveId'>`.

4. **Update tests** in `reserveKey.test.ts` to use the new V4 format.

5. **localStorage cache invalidation** — the existing cache may hold old-format reserveIds. This is self-healing: the next successful API fetch overwrites the cache. No manual migration needed.

## Contract

- `reserveId` remains the **sole canonical identity key** for reserves on the frontend.
- Frontend treats it as an **opaque string** — never parses or splits it.
- No other fields (`hubId`, `tokenAddress`, `marketName`) are used for keying or deduplication.
- The existing `aaveProReserveId` field is unaffected; it continues to serve only as a pro.aave.com deep-link parameter.
