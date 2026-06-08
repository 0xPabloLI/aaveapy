import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  bumpRefetch,
  subscribeRefetch,
  _resetRefetchListeners,
  type RefetchSource,
} from './refetchEvent'

describe('refetchEvent', () => {
  beforeEach(() => {
    _resetRefetchListeners()
  })

  describe('subscribe + bump', () => {
    it('invokes the listener once with the correct source when bumped', () => {
      const listener = vi.fn()
      subscribeRefetch(listener)

      bumpRefetch('watch-reentry')

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ source: 'watch-reentry' })
    })

    it('passes the source through unchanged for all RefetchSource values', () => {
      const listener = vi.fn()
      subscribeRefetch(listener)

      const sources: RefetchSource[] = ['f5', 'button', 'watch-reentry', 'auto']
      for (const source of sources) {
        bumpRefetch(source)
      }

      expect(listener).toHaveBeenCalledTimes(sources.length)
      expect(listener.mock.calls.map(([arg]) => arg.source)).toEqual(sources)
    })
  })

  describe('multiple subscribers', () => {
    it('invokes all listeners in subscription order when bumped', () => {
      const callOrder: string[] = []
      const listenerA = vi.fn(() => callOrder.push('A'))
      const listenerB = vi.fn(() => callOrder.push('B'))
      const listenerC = vi.fn(() => callOrder.push('C'))

      subscribeRefetch(listenerA)
      subscribeRefetch(listenerB)
      subscribeRefetch(listenerC)

      bumpRefetch('button')

      expect(callOrder).toEqual(['A', 'B', 'C'])
    })

    it('does not fire callbacks for listeners that have not subscribed', () => {
      const subscribed = vi.fn()
      const unsubscribed = vi.fn()

      subscribeRefetch(subscribed)

      bumpRefetch('auto')

      expect(subscribed).toHaveBeenCalledTimes(1)
      expect(unsubscribed).not.toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('stops invoking a listener after its returned unsubscribe is called', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeRefetch(listener)

      bumpRefetch('watch-reentry')
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      bumpRefetch('watch-reentry')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('only unsubscribes the specific listener it was returned for', () => {
      const listenerA = vi.fn()
      const listenerB = vi.fn()
      const unsubscribeA = subscribeRefetch(listenerA)
      subscribeRefetch(listenerB)

      unsubscribeA()
      bumpRefetch('button')

      expect(listenerA).not.toHaveBeenCalled()
      expect(listenerB).toHaveBeenCalledTimes(1)
    })

    it('is safe to call the unsubscribe function multiple times', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeRefetch(listener)

      unsubscribe()
      expect(() => unsubscribe()).not.toThrow()

      bumpRefetch('f5')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('exception isolation', () => {
    it('continues invoking remaining listeners when one throws', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const listenerA = vi.fn(() => {
        throw new Error('boom from A')
      })
      const listenerB = vi.fn()
      const listenerC = vi.fn(() => {
        throw new Error('boom from C')
      })

      subscribeRefetch(listenerA)
      subscribeRefetch(listenerB)
      subscribeRefetch(listenerC)

      bumpRefetch('watch-reentry')

      expect(listenerA).toHaveBeenCalledTimes(1)
      expect(listenerB).toHaveBeenCalledTimes(1)
      expect(listenerC).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  describe('idempotent subscribe', () => {
    it('invokes the same function reference only once per bump when subscribed twice', () => {
      const listener = vi.fn()
      subscribeRefetch(listener)
      subscribeRefetch(listener)

      bumpRefetch('auto')

      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('_resetRefetchListeners', () => {
    it('removes all listeners so subsequent bumps are no-ops', () => {
      const listenerA = vi.fn()
      const listenerB = vi.fn()
      subscribeRefetch(listenerA)
      subscribeRefetch(listenerB)

      _resetRefetchListeners()
      bumpRefetch('button')

      expect(listenerA).not.toHaveBeenCalled()
      expect(listenerB).not.toHaveBeenCalled()
    })
  })

  describe('bump with no listeners', () => {
    it('is a safe no-op', () => {
      expect(() => bumpRefetch('auto')).not.toThrow()
    })
  })
})

// keep a reference to afterEach to satisfy linters if needed
afterEach(() => {
  _resetRefetchListeners()
})
