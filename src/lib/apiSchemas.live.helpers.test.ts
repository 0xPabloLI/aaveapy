import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_API_BASE,
  formatLiveHttpError,
  resolveLiveApiBase,
} from './apiSchemas.live.helpers';

describe('resolveLiveApiBase', () => {
  it('defaults to staging even when frontend VITE_API_BASE_URL points to localhost', () => {
    expect(
      resolveLiveApiBase({
        VITE_API_BASE_URL: 'http://localhost:3001/api',
      })
    ).toBe(DEFAULT_LIVE_API_BASE);
  });

  it('prefers LIVE_TEST_API_BASE when explicitly provided', () => {
    expect(
      resolveLiveApiBase({
        LIVE_TEST_API_BASE: 'https://api.aaveapy.com/api',
        VITE_API_BASE_URL: 'http://localhost:3001/api',
      })
    ).toBe('https://api.aaveapy.com/api');
  });
});

describe('formatLiveHttpError', () => {
  it('includes endpoint, url, status, and response body snippet', () => {
    const message = formatLiveHttpError({
      bodySnippet: '{"error":"upstream unavailable"}',
      endpoint: '/markets',
      status: 503,
      statusText: 'Service Unavailable',
      url: 'https://staging-api.aaveapy.com/api/markets',
    });

    expect(message).toContain('/markets');
    expect(message).toContain('503');
    expect(message).toContain('Service Unavailable');
    expect(message).toContain('https://staging-api.aaveapy.com/api/markets');
    expect(message).toContain('upstream unavailable');
  });
});
