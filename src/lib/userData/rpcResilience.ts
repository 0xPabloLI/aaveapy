import { createPublicClient, http, type PublicClient } from 'viem'
import { getAllRpcUrls } from './chainDiscovery'

export function isInfrastructureFailure(error: unknown): boolean {
  if (!error) return false
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('5xx') ||
    /5\d\d/.test(msg) ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('graphql') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  )
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

export function classifyRpcError(err: unknown): 'network' | 'contract' | 'unknown' {
  if (!(err instanceof Error)) return 'unknown'
  const msg = err.message.toLowerCase()
  if (msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('fetch failed') || msg.includes('network') || msg.includes('timeout')) return 'network'
  if (msg.includes('call_exception') || msg.includes('unpredictable_gas_limit') || msg.includes('revert')) return 'contract'
  return 'unknown'
}

export async function createClientWithRpcRotation(chainId: number): Promise<PublicClient | null> {
  const rpcUrls = getAllRpcUrls(chainId)
  if (rpcUrls.length === 0) return null

  for (const url of rpcUrls) {
    const chain = {
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [url] } },
    }
    const client = createPublicClient({ chain, transport: http(url), batch: { multicall: true } }) as PublicClient
    try {
      await withTimeout(client.getChainId(), 3000, `rpc-rotation-chain-${chainId}`)
      return client
    } catch (err) {
      const errorType = classifyRpcError(err)
      console.warn(`[rpc-rotation] ${url} failed for chain ${chainId} (${errorType}):`, err) // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      continue
    }
  }
  return null
}
