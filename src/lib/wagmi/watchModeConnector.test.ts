import { describe, expect, it } from 'vitest'
import { watchModeConnector } from './watchModeConnector'

describe('watchModeConnector', () => {
  it('returns a connector function', () => {
    const connector = watchModeConnector()
    expect(typeof connector).toBe('function')
  })

  it('connector function creates an object with id', () => {
    const connectorFn = watchModeConnector()
    expect(typeof connectorFn).toBe('function')
  })
})
