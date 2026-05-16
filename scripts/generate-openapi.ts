import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MarketsResponseSchema,
  SideDataMetaResponseSchema,
  ReserveWithSpreadSchema,
  MeritIncentiveSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisCampaignBreakdownSchema,
  BrevisIncentiveSchema,
} from '../src/lib/apiSchemas.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = resolve(__dirname, '..', 'public');
const OUTPUT_FILE = resolve(PUBLIC_DIR, 'openapi.json');

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
    SideDataMetaResponse: SideDataMetaResponseSchema.toJSONSchema({ io: 'input' }),
    Reserve: ReserveWithSpreadSchema.toJSONSchema({ io: 'input' }),
    MeritIncentive: MeritIncentiveSchema.toJSONSchema({ io: 'input' }),
    MerklCampaignBreakdown: MerklCampaignBreakdownSchema.toJSONSchema({ io: 'input' }),
    MerklOpportunityGroup: MerklOpportunityGroupSchema.toJSONSchema({ io: 'input' }),
    BrevisCampaignBreakdown: BrevisCampaignBreakdownSchema.toJSONSchema({ io: 'input' }),
    BrevisIncentive: BrevisIncentiveSchema.toJSONSchema({ io: 'input' }),
  };

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

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^\.[\\/]/, ''));
if (isMain) {
  writeOpenApiDocument();
  console.log(`Generated ${OUTPUT_FILE}`);
}