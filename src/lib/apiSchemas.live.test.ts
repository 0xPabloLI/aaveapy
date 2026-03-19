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
 *   RUN_LIVE_TESTS=true npx vitest run src/lib/apiSchemas.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  MarketsResponseSchema,
  SideDataMetaResponseSchema,
} from './apiSchemas';

const API_BASE = process.env.VITE_API_BASE_URL || 'https://staging-api.aaveapy.com/api';
const TIMEOUT = 15_000;

describe.skipIf(!process.env.RUN_LIVE_TESTS)('Live API schema validation', () => {
  it(
    '/markets response matches MarketsResponseSchema',
    async () => {
      const res = await fetch(`${API_BASE}/markets`);
      expect(res.ok).toBe(true);

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
      const res = await fetch(`${API_BASE}/meta/side-data`);
      expect(res.ok).toBe(true);

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
