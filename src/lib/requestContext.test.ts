import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTracing, newRequestId } from '@/lib/requestContext';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('newRequestId', () => {
  it('returns unique ids', () => {
    const [a, b] = [newRequestId(), newRequestId()];
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[\w-]+$/);
  });
});

describe('fetchWithTracing', () => {
  it('propagates X-Request-ID header and returns the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await fetchWithTracing('https://api.example.com/api/markets');

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Request-ID']).toBeTruthy();
  });

  it('merges caller headers without clobbering them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchWithTracing('https://api.example.com/api/markets', {
      headers: { Accept: 'application/json' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json');
    expect(headers['X-Request-ID']).toBeTruthy();
  });

  it('logs a warning with request id when the API returns an error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await fetchWithTracing('https://api.example.com/api/meta/side-data');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = warnSpy.mock.calls[0][0] as string;
    // Test env uses the logger's compact format: `[LEVEL] msg {ctx-json}`.
    expect(line).toContain('api request failed');
    const parsed = JSON.parse(line.slice(line.indexOf('{'))) as {
      path: string;
      requestId: string;
      status: number;
    };
    expect(parsed.path).toBe('/api/meta/side-data');
    expect(parsed.requestId).toBeTruthy();
    expect(parsed.status).toBe(503);
  });

  it('logs and rethrows network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(fetchWithTracing('https://api.example.com/api/markets')).rejects.toThrow('Failed to fetch');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0][0] as string;
    expect(line).toContain('api request network error');
    const parsed = JSON.parse(line.slice(line.indexOf('{'))) as { requestId: string };
    expect(parsed.requestId).toBeTruthy();
  });
});
