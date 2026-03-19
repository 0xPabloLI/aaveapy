/**
 * Live API schema validation tests.
 *
 * These tests fetch real API endpoints and validate responses against
 * Zod schemas — the single source of truth for API contracts.
 *
 * If any test fails, it means the schema in apiSchemas.ts is out of sync
 * with the actual API response, and ALL consumers (hooks, scripts, types)
 * need to be updated.
 *
 * Gated behind `RUN_LIVE_TESTS=true` so `npm test` stays deterministic
 * and network-independent.
 *
 * Run explicitly:
 *   npm run test:live
 */
import { describe, expect, it } from 'vitest';
import {
  MarketsResponseSchema,
  SideDataMetaResponseSchema,
} from './apiSchemas';
import {
  formatLiveHttpError,
  resolveLiveApiBase,
} from './apiSchemas.live.helpers';

const API_BASE = resolveLiveApiBase();
const TIMEOUT = 15_000;

async function readBodySnippet(res: Response): Promise<string> {
  const body = await res.text();
  return body.slice(0, 400);
}

describe.skipIf(!process.env.RUN_LIVE_TESTS)('Live API schema validation', () => {
  it(
    '/markets response matches MarketsResponseSchema',
    async () => {
      const endpoint = '/markets';
      const url = `${API_BASE}${endpoint}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(
          formatLiveHttpError({
            bodySnippet: await readBodySnippet(res),
            endpoint,
            status: res.status,
            statusText: res.statusText,
            url,
          })
        );
      }

      const raw = await res.json();
      const parsed = MarketsResponseSchema.safeParse(raw);

      if (!parsed.success) {
        console.error('Schema mismatch details:', JSON.stringify(parsed.error.issues, null, 2));
        console.error('Actual top-level keys:', Object.keys(raw));
      }

      expect(parsed.success).toBe(true);
    },
    TIMEOUT,
  );

  it(
    '/meta/side-data response matches SideDataMetaResponseSchema',
    async () => {
      const endpoint = '/meta/side-data';
      const url = `${API_BASE}${endpoint}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(
          formatLiveHttpError({
            bodySnippet: await readBodySnippet(res),
            endpoint,
            status: res.status,
            statusText: res.statusText,
            url,
          })
        );
      }

      const raw = await res.json();
      const parsed = SideDataMetaResponseSchema.safeParse(raw);

      if (!parsed.success) {
        console.error('Schema mismatch details:', JSON.stringify(parsed.error.issues, null, 2));
        console.error('Actual top-level keys:', Object.keys(raw));
      }

      expect(parsed.success).toBe(true);
    },
    TIMEOUT,
  );
});
