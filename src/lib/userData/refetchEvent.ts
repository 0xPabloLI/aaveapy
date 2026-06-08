/**
 * Module-scope emitter for "user wants a fresh positions load" signals.
 *
 * Three trigger paths funnel through `bumpRefetch()`:
 * 1. F5 / page reload — React tree remounts, all queries re-init (no explicit bump needed)
 * 2. Refresh button (if present) — UI onClick
 * 3. Watch Mode re-submit (same or different address) — `useWatchModeConnect` reentry branch
 *
 * Downstream consumers (e.g. `useUserPositionsSdk`) subscribe via `subscribeRefetch()`
 * and react by invalidating RQ cache + refetching urql queries.
 *
 * **Why module-scope and not React state / Context / prop:**
 * - Bypasses wagmi `useSyncExternalStore` `Object.is` filtering (same-address reentry
 *   does not trigger a React re-render, so props/state never reach consumers)
 * - Bypasses `useMemo` reference stability (urql/RQ don't see a "value changed" signal)
 * - Three trigger paths share one invalidation code path, no drift
 *
 * Listener exceptions are isolated so a single faulty listener does not break the rest.
 * See ADR-0015 for design rationale.
 */

export type RefetchSource = 'f5' | 'button' | 'watch-reentry' | 'auto'

export interface RefetchEvent {
  source: RefetchSource
}

export type RefetchListener = (event: RefetchEvent) => void

const listeners = new Set<RefetchListener>()

/**
 * Fan out a refresh signal to all current listeners.
 * Listener exceptions are caught and logged; remaining listeners still fire.
 */
export function bumpRefetch(source: RefetchSource): void {
  for (const listener of listeners) {
    try {
      listener({ source })
    } catch (err) {
      console.error('[refetchEvent] listener failed for source', source, err)
    }
  }
}

/**
 * Subscribe a listener. Returns an unsubscribe function.
 * Idempotent for the same function reference (Set semantics).
 */
export function subscribeRefetch(listener: RefetchListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Test-only: remove all listeners.
 * Production code should never need this — use the unsubscribe function returned
 * from `subscribeRefetch` instead.
 */
export function _resetRefetchListeners(): void {
  listeners.clear()
}
