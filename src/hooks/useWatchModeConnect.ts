import { useCallback } from 'react'
import { useConnect } from 'wagmi'

type WatchModeConnector = {
  id: string
  setWatchAddress?: (address: `0x${string}`) => void
}

export function useWatchModeConnect() {
  const { connect, connectors } = useConnect()

  const connectWatchAddress = useCallback((address: `0x${string}`) => {
    const connector = connectors.find((item) => item.id === 'watchMode')
    const watchConnector = connector as WatchModeConnector | undefined

    if (!connector || typeof watchConnector?.setWatchAddress !== 'function') {
      throw new Error('Watch Mode connector is unavailable')
    }

    watchConnector.setWatchAddress(address)
    connect({ connector })
  }, [connect, connectors])

  return { connectWatchAddress }
}
