import { useCallback } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { bumpRefetch } from '../lib/userData/refetchEvent'

type WatchModeConnector = {
  id: string
  setWatchAddress?: (address: `0x${string}`) => void
}

export function useWatchModeConnect() {
  const { connectAsync, connectors } = useConnect()
  const { connector: activeConnector } = useAccount()

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
      // wagmi never propagates a 'change' event and downstream hooks
      // (`useUserPositionsSdk`, urql V3/V4 queries, RQ fallback) all see the
      // same args/key references and skip refetch. Route through
      // `refetchEvent` so re-submit is unified with F5 / Refresh button and
      // consumers can `invalidateQueries` / `refetchQueries` from one place.
      // See ADR-0015.
      bumpRefetch('watch-reentry')
      return
    }

    try {
      await connectAsync({ connector })
    } catch (err) {
      if (err instanceof Error && /Connector already connected/i.test(err.message)) return
      throw err
    }
  }, [activeConnector?.id, connectAsync, connectors])

  return { connectWatchAddress }
}
