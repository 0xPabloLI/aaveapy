// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useChainDiscovery } from './useChainDiscovery'
import * as chainDiscovery from '@/lib/userData/chainDiscovery'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.restoreAllMocks()
  queryClient.clear()
})

describe('useChainDiscovery', () => {
  it('calls discoverUnregisteredChains when reserves arrive', async () => {
    const discoverSpy = vi.spyOn(chainDiscovery, 'discoverUnregisteredChains').mockResolvedValue()

    // Prefetch markets data
    await queryClient.prefetchQuery({
      queryKey: ['aave-markets'],
      queryFn: async () => ({
        reserves: [
          { chainId: 1, tokenSymbol: 'USDC', reserveId: '1:0x123' },
          { chainId: 137, tokenSymbol: 'USDT', reserveId: '137:0x456' },
        ],
      }),
    })

    renderHook(() => useChainDiscovery(), { wrapper })

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(discoverSpy).toHaveBeenCalledWith([1, 137])
  })

  it('does not call discovery when reserves are not loaded', async () => {
    const discoverSpy = vi.spyOn(chainDiscovery, 'discoverUnregisteredChains').mockResolvedValue()

    // Do not prefetch - simulate loading state
    renderHook(() => useChainDiscovery(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(discoverSpy).not.toHaveBeenCalled()
  })

  it('does not call discovery twice on multiple renders', async () => {
    const discoverSpy = vi.spyOn(chainDiscovery, 'discoverUnregisteredChains').mockResolvedValue()

    // Prefetch markets data
    await queryClient.prefetchQuery({
      queryKey: ['aave-markets'],
      queryFn: async () => ({
        reserves: [{ chainId: 10, tokenSymbol: 'DAI', reserveId: '10:0x789' }],
      }),
    })

    const { rerender } = renderHook(() => useChainDiscovery(), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(discoverSpy).toHaveBeenCalledTimes(1)

    rerender()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(discoverSpy).toHaveBeenCalledTimes(1)
  })
})
