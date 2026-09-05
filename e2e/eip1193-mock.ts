/**
 * Shared mock EIP-1193 provider for wallet-connect E2E tests.
 *
 * Injects a fake MetaMask-style `window.ethereum` via `page.addInitScript`
 * BEFORE any page JavaScript runs, so wagmi's `injected()` connector detects
 * it at module init and RainbowKit lists a connectable wallet. This lets the
 * suite exercise the REAL injected-connector lifecycle (connect modal →
 * connected state → persistence → disconnect) with zero browser extensions,
 * zero userscripts, and zero network.
 *
 * Method surface mirrors what wagmi 3.x `injected()` actually calls
 * (see @wagmi/core connectors/injected.js); the minimal provider shape follows
 * `src/lib/wagmi/watchModeConnector.ts`. See
 * docs/specs/e2e-wallet-connect-injected.md for the full contract.
 */

import type { Page } from '@playwright/test';

import { WATCH_ADDRESS } from './test-wallets';

/** The init-script body — must be self-contained (serialized into the page). */
function eip1193MockScript(address: string) {
  // addInitScript re-runs on every navigation/reload; defining `ethereum`
  // twice throws, and a second provider would reset mid-session state.
  if (Object.getOwnPropertyDescriptor(window, 'ethereum')) return;

  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  // Authorization state mirrors a real wallet: `eth_accounts` returns [] until
  // the user approves (eth_requestAccounts / wallet_requestPermissions).
  // wagmi's reconnect-on-load gate calls eth_accounts, so this is what keeps
  // cold start disconnected. sessionStorage survives reloads (like a wallet's
  // per-site grant) but not fresh contexts, matching the reload-reconnect
  // scenario in the spec's matrix.
  const AUTH_KEY = 'e2e.eip1193Authorized';
  let authorized = sessionStorage.getItem(AUTH_KEY) === '1';
  const authorize = () => {
    authorized = true;
    sessionStorage.setItem(AUTH_KEY, '1');
  };
  const deauthorize = () => {
    authorized = false;
    sessionStorage.removeItem(AUTH_KEY);
  };

  const provider = {
    isMetaMask: true,
    async request({ method }: { method: string; params?: unknown[] }): Promise<unknown> {
      switch (method) {
        case 'eth_accounts':
          return authorized ? [address] : [];
        case 'eth_requestAccounts':
          authorize();
          return [address];
        case 'eth_chainId':
          return '0x1';
        case 'net_version':
          return '1';
        // shimDisconnect tries this before eth_requestAccounts; returning a
        // permission object keeps the connect flow on its happy path.
        case 'wallet_requestPermissions':
          authorize();
          return [{ parentCapability: 'eth_accounts', date: Date.now() }];
        case 'wallet_revokePermissions':
          deauthorize();
          return null;
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
          return null;
        default:
          throw Object.assign(
            new Error(`e2e mock provider does not support ${method}`),
            { code: 4200 },
          );
      }
    },
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    },
    removeListener(event: string, cb: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(cb);
    },
  };

  // Non-writable/non-configurable so app-side shims cannot clobber it.
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false,
  });

  // EIP-6963 multi-wallet discovery: wagmi/RainbowKit 2.x build the modal's
  // wallet list from announced providers, not from window.ethereum alone.
  // We run before page scripts, so the immediate announcement has no listener
  // yet — announce now (spec-compliant) and re-announce on each request.
  const info = {
    uuid: 'e2e-mock-metamask',
    name: 'MetaMask',
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    rdns: 'io.metamask',
  };
  const announce = () => {
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({ info, provider }),
      }),
    );
  };
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
}

/**
 * Register the mock provider injection. MUST be called before `page.goto()` —
 * init scripts only apply to navigations that happen after registration.
 * Returns the registration promise so callers can await it and guarantee
 * ordering.
 */
export function injectEip1193Mock(page: Page): Promise<void> {
  // `!` matches test-wallets.ts's own usage: WATCH_ADDRESS is env-overridable
  // in its type but always defined at runtime (DEFAULT_WATCH_ADDRESS fallback).
  return page.addInitScript(eip1193MockScript, WATCH_ADDRESS!);
}
