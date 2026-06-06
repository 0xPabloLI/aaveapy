import { useCallback } from 'react'
import { useAccount, useConnect } from 'wagmi'

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

    watchConnector.setWatchAddress(address)

    if (activeConnector?.id === 'watchMode') return

    try {
      await connectAsync({ connector })
    } catch (err) {
      if (err instanceof Error && /Connector already connected/i.test(err.message)) return
      throw err
    }
  }, [activeConnector?.id, connectAsync, connectors])

  return { connectWatchAddress }
}
