// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservesLayoutRefs } from './useReservesLayoutRefs';

type IOEntryCallback = (entries: { isIntersecting: boolean }[]) => void;

class FakeIntersectionObserver {
  static lastInstance: FakeIntersectionObserver | null = null;
  callback: IOEntryCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(callback: IOEntryCallback) {
    this.callback = callback;
    FakeIntersectionObserver.lastInstance = this;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {
    /* no-op */
  }
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

class FakeResizeObserver {
  static lastInstance: FakeResizeObserver | null = null;
  callback: () => void;
  observed: Element[] = [];
  disconnected = false;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.lastInstance = this;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {
    /* no-op */
  }
}

beforeEach(() => {
  FakeIntersectionObserver.lastInstance = null;
  FakeResizeObserver.lastInstance = null;
  (globalThis as unknown as { IntersectionObserver: typeof FakeIntersectionObserver }).IntersectionObserver =
    FakeIntersectionObserver;
  (globalThis as unknown as { ResizeObserver: typeof FakeResizeObserver }).ResizeObserver =
    FakeResizeObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReservesLayoutRefs', () => {
  it('returns five refs initialized to null and tableInView=false', () => {
    const { result } = renderHook(() => useReservesLayoutRefs({ isMobile: false }));

    expect(result.current.mobileTableRef.current).toBeNull();
    expect(result.current.desktopTableCardRef.current).toBeNull();
    expect(result.current.desktopTableBottomAnchorRef.current).toBeNull();
    expect(result.current.desktopStickyScenarioRef.current).toBeNull();
    expect(result.current.desktopStickyTheadRef.current).toBeNull();
    expect(result.current.tableInView).toBe(false);
  });

  it('does not create an IntersectionObserver when the active target ref is null', () => {
    renderHook(() => useReservesLayoutRefs({ isMobile: false }));
    expect(FakeIntersectionObserver.lastInstance).toBeNull();
  });

  it('observes the desktop card and updates tableInView when intersection fires', () => {
    const card = document.createElement('div');
    const { result } = renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      // Assign before effects run on the next render commit
      r.desktopTableCardRef.current = card;
      return r;
    });

    // Force re-render so the effect re-runs with the assigned ref
    act(() => {
      FakeIntersectionObserver.lastInstance?.disconnect();
    });

    // Re-mount with ref already attached
    const { result: result2, unmount } = renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      r.desktopTableCardRef.current = card;
      return r;
    });

    // Effect ran once on initial mount when ref was null; now manually re-attach
    expect(result2.current.tableInView).toBe(false);

    act(() => {
      FakeIntersectionObserver.lastInstance?.trigger(true);
    });
    // tableInView reflects most recent intersection event
    expect(result2.current.tableInView).toBe(true);

    act(() => {
      FakeIntersectionObserver.lastInstance?.trigger(false);
    });
    expect(result2.current.tableInView).toBe(false);

    unmount();
    expect(FakeIntersectionObserver.lastInstance?.disconnected).toBe(true);
    // unused locals
    void result;
  });

  it('disconnects the IntersectionObserver on unmount', () => {
    const card = document.createElement('div');
    const { unmount } = renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      r.desktopTableCardRef.current = card;
      return r;
    });
    unmount();
    expect(FakeIntersectionObserver.lastInstance?.disconnected).toBe(true);
  });

  it('does not create a ResizeObserver in mobile mode', () => {
    renderHook(() => useReservesLayoutRefs({ isMobile: true }));
    expect(FakeResizeObserver.lastInstance).toBeNull();
  });

  it('publishes sticky-scenario-height and clears it on unmount (desktop)', () => {
    const card = document.createElement('div');
    const scenarioEl = document.createElement('div');
    // Stub getBoundingClientRect so heights are deterministic.
    scenarioEl.getBoundingClientRect = () =>
      ({ height: 40 }) as unknown as DOMRect;

    const { unmount } = renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      r.desktopTableCardRef.current = card;
      r.desktopStickyScenarioRef.current = scenarioEl;
      return r;
    });

    // The effect's `apply` runs synchronously after the ref is attached on the
    // initial render commit. To re-run with the now-attached refs we trigger
    // a manual remount.
    const { unmount: u2 } = renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      r.desktopTableCardRef.current = card;
      r.desktopStickyScenarioRef.current = scenarioEl;
      return r;
    });

    expect(card.style.getPropertyValue('--reserves-sticky-scenario-height')).toBe('40px');
    // No thead → expanded-main-row-top not set
    expect(card.style.getPropertyValue('--reserves-expanded-main-row-top')).toBe('');

    u2();
    expect(card.style.getPropertyValue('--reserves-sticky-scenario-height')).toBe('');
    expect(FakeResizeObserver.lastInstance?.disconnected).toBe(true);

    unmount();
  });

  it('sets scenario-height to 0px when isPortfolioMode is true (desktop)', () => {
    const card = document.createElement('div');
    const scenarioEl = document.createElement('div');
    scenarioEl.getBoundingClientRect = () => ({ height: 40 }) as unknown as DOMRect;
    const theadEl = document.createElement('thead');
    theadEl.getBoundingClientRect = () => ({ height: 24 }) as unknown as DOMRect;

    renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false, isPortfolioMode: true });
      r.desktopTableCardRef.current = card;
      r.desktopStickyScenarioRef.current = scenarioEl;
      r.desktopStickyTheadRef.current = theadEl;
      return r;
    });

    renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false, isPortfolioMode: true });
      r.desktopTableCardRef.current = card;
      r.desktopStickyScenarioRef.current = scenarioEl;
      r.desktopStickyTheadRef.current = theadEl;
      return r;
    });

    expect(card.style.getPropertyValue('--reserves-sticky-scenario-height')).toBe('0px');
    expect(card.style.getPropertyValue('--reserves-expanded-main-row-top')).toBe('24px');
  });

  it('publishes expanded-main-row-top when thead height > 0', () => {
    const card = document.createElement('div');
    const scenarioEl = document.createElement('div');
    scenarioEl.getBoundingClientRect = () => ({ height: 30 }) as unknown as DOMRect;
    const theadEl = document.createElement('thead');
    theadEl.getBoundingClientRect = () => ({ height: 24 }) as unknown as DOMRect;

    renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      r.desktopTableCardRef.current = card;
      r.desktopStickyScenarioRef.current = scenarioEl;
      r.desktopStickyTheadRef.current = theadEl;
      return r;
    });

    // Force a second mount so the effect runs with all refs already attached.
    renderHook(() => {
      const r = useReservesLayoutRefs({ isMobile: false });
      r.desktopTableCardRef.current = card;
      r.desktopStickyScenarioRef.current = scenarioEl;
      r.desktopStickyTheadRef.current = theadEl;
      return r;
    });

    expect(card.style.getPropertyValue('--reserves-sticky-scenario-height')).toBe('30px');
    expect(card.style.getPropertyValue('--reserves-expanded-main-row-top')).toBe('54px');
  });
});
