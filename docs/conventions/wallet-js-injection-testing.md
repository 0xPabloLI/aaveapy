# Wallet JS Injection for E2E Testing

> **Pattern**: Simulate wallet connection in Playwright E2E tests without CDP, browser extensions, or manual wallet interaction.

## Problem

Wallet-connected scenarios (on-chain HF, position import, "Viewing 0x…" button) require a connected wallet state. Traditional approaches have trade-offs:

| Method | Pros | Cons |
|--------|------|------|
| **CDP (Chrome DevTools Protocol)** | Full wallet simulation | Complex setup, external dependency, flaky |
| **Browser extension** | Real wallet behavior | Hard to automate, version drift |
| **JS Injection** | Simple, no deps, deterministic | Read-only (no signing) |

## Solution: JS Injection via `page.addInitScript`

`wagmi` persists connector state in `localStorage`. By injecting state before the page loads, the app auto-connects on mount — no UI clicks needed.

### How It Works

1. `watchModeConnector` (custom wagmi connector) reads `localStorage['wagmi.watchAddress']` on `connect()`.
2. `wagmi` stores connector state in `localStorage['wagmi.store']` (JSON array of `{ connectorId, ... }`).
3. On page load, `wagmi` auto-reconnects from persisted state.

### Injection Code

```typescript
import { WATCH_ADDRESS } from './test-wallets';

function injectWalletState(page: Page, address: string = WATCH_ADDRESS!) {
  return page.addInitScript((addr) => {
    // 1. Set watch address for watchModeConnector
    localStorage.setItem('wagmi.watchAddress', addr);

    // 2. Set wagmi store so auto-connect picks up watchMode connector
    const wagmiStore = [{
      connectorId: 'watchMode',
      accounts: [addr],
      chainId: 1,
    }];
    localStorage.setItem('wagmi.store', JSON.stringify(wagmiStore));
  }, address);
}

// Usage — must call BEFORE page.goto()
await injectWalletState(page);
await page.goto('/');
```

### Key Points

1. **Call before `page.goto()`**: `addInitScript` runs before any page JavaScript. If called after `goto()`, the app has already mounted without wallet state.

2. **`wagmi.store` format**: Array of connector state objects. `connectorId` must match the connector's `id` property (`'watchMode'` for our custom connector).

3. **Read-only**: `watchModeConnector` throws on any signing method (`personal_sign`, `wallet_sendTransaction`, etc.). Suitable for view-only scenarios (HF display, position import), not for transaction simulation.

## Common Pitfalls

### 1. Race Condition with Auto-Import

When the wallet connects, `useUserPositionsSdk` fires async position imports. If your test interacts with portfolio inputs before imports settle, React state may be in an intermediate state.

**Fix**: Wait for import completion toasts before interacting:

```typescript
// Wait for wallet auto-import to settle
await page.waitForSelector('text=/Wallet has no positions|Imported|Failed to load/', { timeout: 15000 });
```

### 2. Reload Re-Injection

`addInitScript` runs on every navigation/reload. If your test clears `localStorage` (e.g., testing disconnect), the script will re-inject wallet state on reload.

**Fix**: Use `sessionStorage` as a one-shot guard:

```typescript
await page.addInitScript((addr) => {
  if (sessionStorage.getItem('skipWalletInject') === 'true') return;
  localStorage.setItem('wagmi.watchAddress', addr);
  // ...
}, address);

// In disconnect test:
await page.evaluate(() => sessionStorage.setItem('skipWalletInject', 'true'));
await page.evaluate(() => localStorage.clear());
await page.reload();
```

### 3. React Controlled Inputs

`.fill()` may not trigger React's `onChange` properly on some controlled inputs. Use `.pressSequentially()` for reliability:

```typescript
// Instead of: await input.fill('10000');
await input.pressSequentially('10000');
```

### 4. Sequential Execution

Wallet-connected tests can overload the dev server when run in parallel. Use `--workers=1` for wallet test files:

```bash
npx playwright test e2e/onchain-hf-js-injection.spec.ts --workers=1
```

## Test Scenarios Covered

| Scenario | Description | Key Assertion |
|----------|-------------|---------------|
| Auto-connect | Wallet connects from `localStorage` on page load | "Viewing 0x…" button visible |
| Disconnect | Clearing `localStorage` disconnects wallet | "Connect wallet" button visible |
| Refresh persistence | Wallet stays connected across `page.reload()` | "Viewing 0x…" button visible after reload |
| HF display | On-chain HF fetches and displays with wallet | HF badge shows numeric value (not "—") |
| RPC requests | On-chain multicall fires for wallet address | Network requests to RPC endpoints |

## Related Files

- `src/lib/wagmi/watchModeConnector.ts` — Custom wagmi connector (read-only)
- `src/hooks/useWatchModeConnect.ts` — `connectWatchAddress()` function
- `e2e/test-wallets.ts` — Shared test wallet addresses (`WATCH_ADDRESS`)
- `src/lib/wagmi/config.ts` — Wagmi config with `watchModeConnector` registered

**Real injected-wallet connect tests** (walking the actual Connect modal → wagmi `injected()` lifecycle): use `e2e/eip1193-mock.ts`, which injects a mock EIP-1193 provider + EIP-6963 announcement via `addInitScript`. Contract and scenarios: `docs/specs/e2e-wallet-connect-injected.md`. Note: the injected connect modal is desktop-only today (RainbowKit mobile modal needs its `wallets` prop, see spec R2).

## Comparison with CDP

| Aspect | JS Injection | CDP |
|--------|-------------|-----|
| **Setup** | `addInitScript` (1 line) | Chrome launch + CDP session |
| **Dependencies** | None | Chrome binary, CDP protocol |
| **Signing** | Not supported | Supported (with mock wallet) |
| **Flakiness** | Low (deterministic) | Medium (timing-sensitive) |
| **CI** | Works everywhere | Requires Chrome |
| **Use case** | View-only (HF, positions) | Full wallet interaction |

**Recommendation**: Use JS injection for all view-only wallet tests. Only use CDP if you need transaction signing (rare in this app).
