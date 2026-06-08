import { useCallback } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'

type WatchModeConnector = {
  id: string
  setWatchAddress?: (address: `0x${string}`) => void
}

export function useWatchModeConnect() {
  const { connectAsync, connectors } = useConnect()
  const { connector: activeConnector } = useAccount()
  const queryClient = useQueryClient()

  const connectWatchAddress = useCallback(async (address: `0x${string}`) => {
    const connector = connectors.find((item) => item.id === 'watchMode')
    const watchConnector = connector as WatchModeConnector | undefined

    if (!connector || typeof watchConnector?.setWatchAddress !== 'function') {
      throw new Error('Watch Mode connector is unavailable')
    }

    const isReentry = activeConnector?.id === 'watchMode'
    watchConnector.setWatchAddress(address)

    if (isReentry) {
      // Re-entry: the user re-submitted an address while Watch Mode is already
      // active. `setWatchAddress` is a no-op when the address is unchanged, so
      // wagmi never propagates a 'change' event and React Query's
      // `['user-positions', address]` cache key stays the same — leaving the
      // user with a silent, unresponsive UI and stale positions. Force a
      // refetch so the action is observable and positions reload.
      await queryClient.invalidateQueries({ queryKey: ['user-positions', address] })
      return
    }

    try {
      await connectAsync({ connector })
    } catch (err) {
      if (err instanceof Error && /Connector already connected/i.test(err.message)) return
      throw err
    }
  }, [activeConnector?.id, connectAsync, connectors, queryClient])

  return { connectWatchAddress }
}
