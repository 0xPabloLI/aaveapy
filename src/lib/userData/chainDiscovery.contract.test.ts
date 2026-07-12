/**
 * Contract tests for external chain list APIs consumed by chainDiscovery.ts.
 *
 * These tests verify that the bulk endpoints we depend on are reachable,
 * return valid JSON arrays, and contain expected chain data.
 *
 * If any test fails, it means the external API has changed or is down,
 * and chainDiscovery.ts bulk fetch logic may need updating.
 *
 * Gated behind `RUN_LIVE_TESTS=true` so `npm test` stays deterministic
 * and network-independent.
 *
 * Run explicitly:
 *   RUN_LIVE_TESTS=true npx vitest run src/lib/userData/chainDiscovery.contract.test.ts
 */
import { describe, expect, it } from 'vitest'

const RUN_LIVE = process.env.RUN_LIVE_TESTS === 'true'
const TIMEOUT = 15_000

describe.skipIf(!RUN_LIVE)('chainDiscovery contract: external API endpoints', () => {
  it('chainid.network/chains.json returns a non-empty array with chainId field', async () => {
    const res = await fetch('https://chainid.network/chains.json', { signal: AbortSignal.timeout(TIMEOUT) })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]).toHaveProperty('chainId')
    expect(typeof data[0].chainId).toBe('number')
  })

  it('chainid.network/chains.json contains Ethereum mainnet (chainId=1)', async () => {
    const res = await fetch('https://chainid.network/chains.json', { signal: AbortSignal.timeout(TIMEOUT) })
    const data = await res.json()
    const eth = data.find((c: { chainId: number }) => c.chainId === 1)
    expect(eth).toBeDefined()
    expect(eth.name).toBe('Ethereum Mainnet')
    expect(Array.isArray(eth.rpc)).toBe(true)
    expect(eth.rpc.length).toBeGreaterThan(0)
  })

  it('chainlist.org/rpcs.json returns a non-empty array with chainId field', async () => {
    const res = await fetch('https://chainlist.org/rpcs.json', { signal: AbortSignal.timeout(TIMEOUT) })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]).toHaveProperty('chainId')
    expect(typeof data[0].chainId).toBe('number')
  })

  it('chainlist.org/rpcs.json contains Ethereum mainnet (chainId=1) with RPC URLs', async () => {
    const res = await fetch('https://chainlist.org/rpcs.json', { signal: AbortSignal.timeout(TIMEOUT) })
    const data = await res.json()
    const eth = data.find((c: { chainId: number }) => c.chainId === 1)
    expect(eth).toBeDefined()
    expect(Array.isArray(eth.rpc)).toBe(true)
    expect(eth.rpc.length).toBeGreaterThan(0)
  })
})
