import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollExpandedSimulationIntoView } from './scrollExpandedSimulationIntoView';

class FakeElement {
  nextElementSibling: Element | null = null;

  constructor(
    private readonly rect: { top: number; bottom: number; height: number },
  ) {}

  getBoundingClientRect() {
    return {
      x: 0,
      y: this.rect.top,
      width: 0,
      left: 0,
      right: 0,
      top: this.rect.top,
      bottom: this.rect.bottom,
      height: this.rect.height,
      toJSON: () => ({}),
    } as DOMRect;
  }
}

describe('scrollExpandedSimulationIntoView', () => {
  const originalHTMLElement = globalThis.HTMLElement;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it('pins desktop rows against the full sticky stack height, not the stack current viewport bottom', () => {
    const scenario = new FakeElement({ top: 760, bottom: 800, height: 40 });
    const thead = new FakeElement({ top: 800, bottom: 850, height: 20 });
    const row = new FakeElement({ top: 1037, bottom: 1098, height: 61 });

    globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
    globalThis.window = {
      innerHeight: 1200,
      scrollBy: vi.fn(),
    } as unknown as Window & typeof globalThis;
    globalThis.document = {
      querySelector: (selector: string) => {
        if (selector === '[data-reserves-sticky-scenario]') return scenario;
        if (selector === '[data-reserves-sticky-thead]') return thead;
        if (selector === 'tr[data-reserve-id="reserve-a"]') return row;
        return null;
      },
    } as Document;

    scrollExpandedSimulationIntoView('reserve-a', {
      mode: 'pin-main-row-top',
      instant: true,
    });

    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 969,
      behavior: 'auto',
    });
  });
});
