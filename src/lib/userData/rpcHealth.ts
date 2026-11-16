/**
 * Session-scoped RPC health bookkeeping (AAV-1387).
 *
 * `createClientWithRpcRotation` can only prove that a node answers
 * `eth_chainId`. A node that passes that probe but rejects real batch reads
 * (e.g. fastnode answers `413 Payload Too Large` once the `aggregate3`
 * payload grows past ~4KB) used to be selected forever: every wallet sync
 * paid a failed batch and no other endpoint was ever tried.
 *
 * This module remembers which URLs failed a *read* in the current session so
 * later reads skip them. Marks are deliberately not persisted: a page reload
 * is a clean slate, and a URL regains trust the moment it serves a read.
 */

const unhealthyRpcUrlsByChain = new Map<number, Set<string>>();

function bucket(chainId: number): Set<string> {
  let set = unhealthyRpcUrlsByChain.get(chainId);
  if (!set) {
    set = new Set<string>();
    unhealthyRpcUrlsByChain.set(chainId, set);
  }
  return set;
}

export function markRpcUnhealthy(chainId: number, url: string): void {
  bucket(chainId).add(url);
}

/** Drops the demotion mark — the URL served a read again. */
export function clearRpcUnhealthy(chainId: number, url: string): void {
  unhealthyRpcUrlsByChain.get(chainId)?.delete(url);
}

export function isRpcUnhealthy(chainId: number, url: string): boolean {
  return unhealthyRpcUrlsByChain.get(chainId)?.has(url) ?? false;
}

/**
 * Returns the URLs worth trying: demoted ones are dropped, curated order is
 * kept. When every URL is demoted the full list comes back unchanged —
 * demoting the only reachable node would lock the chain out for the rest of
 * the session, so the next successful read clears the marks instead.
 */
export function selectRpcUrlsByHealth(chainId: number, rpcUrls: readonly string[]): string[] {
  const unhealthy = unhealthyRpcUrlsByChain.get(chainId);
  if (!unhealthy || unhealthy.size === 0) return [...rpcUrls];
  const healthy = rpcUrls.filter((url) => !unhealthy.has(url));
  return healthy.length > 0 ? healthy : [...rpcUrls];
}

export function resetRpcHealthCache(): void {
  unhealthyRpcUrlsByChain.clear();
}
