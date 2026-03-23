import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_API_BASE,
  formatLiveHttpError,
  isLikelyCloudflareChallenge,
  resolveLiveApiBase,
  shouldSoftFailLiveSchema,
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

describe('isLikelyCloudflareChallenge', () => {
  it('returns true for a 403 cloudflare challenge page snippet', () => {
    const bodySnippet = '<html><title>Just a moment...</title><div>cloudflare</div></html>';
    expect(isLikelyCloudflareChallenge(403, bodySnippet)).toBe(true);
  });

  it('returns false for non-403 statuses', () => {
    expect(isLikelyCloudflareChallenge(500, 'just a moment')).toBe(false);
  });

  it('returns false for ordinary 403 responses', () => {
    expect(isLikelyCloudflareChallenge(403, '{"error":"forbidden"}')).toBe(false);
  });
});

describe('shouldSoftFailLiveSchema', () => {
  it('defaults to soft-fail mode', () => {
    expect(shouldSoftFailLiveSchema({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it('disables soft-fail mode when LIVE_TEST_STRICT=true', () => {
    expect(
      shouldSoftFailLiveSchema({ LIVE_TEST_STRICT: 'true' } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});
