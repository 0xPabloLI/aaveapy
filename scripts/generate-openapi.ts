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

function flattenSchemaDefs(doc: Record<string, unknown>): Record<string, unknown> {
  const defSchemas = new Map<string, unknown>();
  const keyToName = new Map<string, string>();

  const collect = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
    if (record.$defs && typeof record.$defs === 'object') {
      for (const [key] of Object.entries(record.$defs as Record<string, unknown>)) {
        const name = `IncentiveMessage${defSchemas.size > 0 ? '_' + defSchemas.size : ''}`;
        defSchemas.set(name, (record.$defs as Record<string, unknown>)[key]);
        keyToName.set(key, name);
      }
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) collect(value);
    }
  };

  collect(doc.paths);

  if (defSchemas.size === 0) return doc;

  const cloned = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  const fix = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
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

  fix(cloned);

  if (!cloned.components) cloned.components = {};
  const schemas: Record<string, unknown> = {};
  for (const [k, v] of defSchemas) schemas[k] = v;
  (cloned.components as Record<string, unknown>).schemas = schemas;
  fix(schemas);

  return cloned;
}

export function generateOpenApiDocument(): Record<string, unknown> {
  const doc = {
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

  return flattenSchemaDefs(doc);
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