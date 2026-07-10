/**
 * Generate OpenAPI 3.1.0 spec from Zod schemas.
 *
 * Usage:
 *   npm run openapi:generate
 *
 * Prerequisites:
 *   - Zod v4 schemas defined in `src/lib/apiSchemas.ts`
 *   - `tsx` available (dev dependency)
 *
 * Output:
 *   - `public/openapi.json` — OpenAPI 3.1.0 specification
 *
 * CI check (detects schema drift):
 *   npm run openapi:check
 *   (generates spec + diffs against committed openapi.json; exits 1 on drift)
 *
 * When to re-generate:
 *   After any change to Zod schemas in `src/lib/apiSchemas.ts`,
 *   run `npm run openapi:generate` and commit the updated `public/openapi.json`.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MarketsResponseSchema,
  MarketsErrorResponseSchema,
  SideDataMetaResponseSchema,
  ReserveWithSpreadSchema,
  MeritCampaignGroupSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisCampaignBreakdownSchema,
  BrevisIncentiveSchema,
} from '../src/lib/apiSchemas.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = resolve(__dirname, '..', 'public');
export const OUTPUT_FILE = resolve(PUBLIC_DIR, 'openapi.json');

function inlineLazyRefs(schema: Record<string, unknown>): void {
  const defs = schema.$defs as Record<string, unknown> | undefined;
  if (!defs) return;

  const replaceRefs = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.$ref === 'string') {
      const m = record.$ref.match(/^#\/\$defs\/(.+)$/);
      if (m && defs[m[1]]) {
        const expanded: Record<string, unknown> = JSON.parse(JSON.stringify(defs[m[1]]));
        const truncateRecursive = (n: unknown): void => {
          if (!n || typeof n !== 'object') return;
          const r = n as Record<string, unknown>;
          if (typeof r.$ref === 'string' && /^#\/\$defs\//.test(r.$ref)) {
            delete r.$ref;
          }
          for (const v of Object.values(r)) {
            if (typeof v === 'object' && v !== null) truncateRecursive(v);
          }
        };
        truncateRecursive(expanded);
        delete record.$ref;
        Object.assign(record, expanded);
      }
    }
    if (record === schema.$defs) return;
    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) replaceRefs(value);
    }
  };

  replaceRefs(schema);
  delete schema.$defs;
}

function extractNestedDefsInPlace(schemas: Record<string, unknown>): void {
  const defs = new Map<string, unknown>();
  const keyToName = new Map<string, string>();

  const collect = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (record.$defs && typeof record.$defs === 'object') {
      for (const [key] of Object.entries(record.$defs as Record<string, unknown>)) {
        if (keyToName.has(key)) continue;
        const name = `IncentiveMessage${defs.size > 0 ? '_' + defs.size : ''}`;
        defs.set(name, (record.$defs as Record<string, unknown>)[key]);
        keyToName.set(key, name);
      }
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) collect(value);
    }
  };

  collect(schemas);

  if (defs.size === 0) return;

  const fix = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.$ref === 'string') {
      const m = record.$ref.match(/^#\/\$defs\/(.+)$/);
      if (m && keyToName.has(m[1])) {
        record.$ref = `#/components/schemas/${keyToName.get(m[1])}`;
      }
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) fix(value);
    }
    delete record.$defs;
  };

  fix(schemas);

  const extracted: Record<string, unknown> = {};
  for (const [k, v] of defs) extracted[k] = v;
  fix(extracted);
  Object.assign(schemas, extracted);
}

export function generateOpenApiDocument(): Record<string, unknown> {
  const schemas: Record<string, unknown> = {
    MarketsResponse: MarketsResponseSchema.toJSONSchema({ io: 'input' }),
    MarketsErrorResponse: MarketsErrorResponseSchema.toJSONSchema({ io: 'input' }),
    SideDataMetaResponse: SideDataMetaResponseSchema.toJSONSchema({ io: 'input' }),
    Reserve: ReserveWithSpreadSchema.toJSONSchema({ io: 'input' }),
    MeritCampaignGroup: MeritCampaignGroupSchema.toJSONSchema({ io: 'input' }),
    MerklCampaignBreakdown: MerklCampaignBreakdownSchema.toJSONSchema({ io: 'input' }),
    MerklOpportunityGroup: MerklOpportunityGroupSchema.toJSONSchema({ io: 'input' }),
    BrevisCampaignBreakdown: BrevisCampaignBreakdownSchema.toJSONSchema({ io: 'input' }),
    BrevisIncentive: BrevisIncentiveSchema.toJSONSchema({ io: 'input' }),
  };

  for (const key of Object.keys(schemas)) {
    inlineLazyRefs(schemas[key] as Record<string, unknown>);
  }

  extractNestedDefsInPlace(schemas);

  return {
    openapi: '3.1.0',
    info: {
      title: 'AaveAPY API',
      version: '1.0.0',
      description: 'Aave market data and yield analysis API',
    },
    servers: [
      { url: 'https://staging-api.aaveapy.com/api', description: 'Staging' },
      { url: 'https://api.aaveapy.com/api', description: 'Production' },
    ],
    paths: {
      '/markets': {
        get: {
          operationId: 'getMarkets',
          summary: 'Get all markets with reserve data',
          responses: {
            '200': {
              description: 'Market snapshot and reserve array',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/MarketsResponse' },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded (120 requests/min per IP)',
              headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until retry' } },
            },
            '503': {
              description: 'Service unavailable — data not ready or too stale',
              headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until retry (10=loading, 60=stale)' } },
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/MarketsErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/meta/side-data': {
        get: {
          operationId: 'getMetaSideData',
          summary: 'Get metadata including categories, FDV, and forecast',
          responses: {
            '200': {
              description: 'Side data response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SideDataMetaResponse' },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded (120 requests/min per IP)',
              headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until retry' } },
            },
            '503': {
              description: 'Service unavailable — data not ready or too stale',
              headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until retry (10=loading, 60=stale)' } },
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/MarketsErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: { schemas },
  } as Record<string, unknown>;
}

export function writeOpenApiDocument(): void {
  const doc = generateOpenApiDocument();
  writeFileSync(OUTPUT_FILE, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
}
