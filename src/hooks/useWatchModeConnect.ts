import { useCallback } from 'react'
import { useConnect } from 'wagmi'

type WatchModeConnector = {
  id: string
  setWatchAddress?: (address: `0x${string}`) => void
}

export function useWatchModeConnect() {
  const { connectAsync, connectors } = useConnect()

  const connectWatchAddress = useCallback(async (address: `0x${string}`) => {
    const connector = connectors.find((item) => item.id === 'watchMode')
    const watchConnector = connector as WatchModeConnector | undefined

    if (!connector || typeof watchConnector?.setWatchAddress !== 'function') {
      throw new Error('Watch Mode connector is unavailable')
    }

    watchConnector.setWatchAddress(address)
    await connectAsync({ connector })
  }, [connectAsync, connectors])

  return { connectWatchAddress }
}
