import { describe, expect, it, vi } from 'vitest';
import { captureError, isSentryEnabled, scrubSentryEvent } from '@/lib/sentry';

describe('sentry', () => {
  it('stays disabled without a DSN (tests/local dev)', () => {
    expect(isSentryEnabled()).toBe(false);
  });

  it('captureError is a safe no-op when disabled', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      captureError(new Error('boom'), { wallet: '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314' }),
    ).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('scrubSentryEvent redacts PII in extras and request', () => {
    const event = {
      extra: {
        wallet: '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314',
        note: 'user@example.com hit a 500',
      },
      request: {
        url: 'https://api.aaveapy.com/api/markets?api_key=sk123',
      },
    } as unknown as Parameters<typeof scrubSentryEvent>[0];

    const scrubbed = scrubSentryEvent(event) as { extra?: Record<string, string>; request?: Record<string, string> };
    const extra = scrubbed.extra ?? {};
    const request = scrubbed.request ?? {};
    expect(extra.wallet).toBe('0x4D1c…5314');
    expect(extra.note).toContain('[REDACTED_EMAIL]');
    expect(request.url).toContain('api_key=[REDACTED]');
    expect(request.url).not.toContain('sk123');
  });
});
