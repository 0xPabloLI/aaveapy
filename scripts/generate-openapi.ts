import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MarketsResponseSchema,
  SideDataMetaResponseSchema,
} from '../src/lib/apiSchemas.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = resolve(__dirname, '..', 'public');
const OUTPUT_FILE = resolve(PUBLIC_DIR, 'openapi.json');

export function generateOpenApiDocument(): Record<string, unknown> {
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
                  schema: MarketsResponseSchema.toJSONSchema({ io: 'input' }),
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
                  schema: SideDataMetaResponseSchema.toJSONSchema({ io: 'input' }),
                },
              },
            },
          },
        },
      },
    },
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