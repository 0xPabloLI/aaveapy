import { injected } from 'wagmi/connectors'

export function watchModeConnector() {
  return injected({
    id: 'watchMode',
    name: 'Watch Mode',
  })
}
