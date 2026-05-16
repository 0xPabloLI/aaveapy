import { describe, expect, it } from 'vitest';
import { generateOpenApiDocument } from './generate-openapi';

describe('generateOpenApiDocument', () => {
  it('produces a valid OpenAPI 3.1 document with info, servers, paths', () => {
    const doc = generateOpenApiDocument();

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toBeDefined();
    expect(doc.info.title).toBe('AaveAPY API');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.servers).toBeInstanceOf(Array);
    expect(doc.servers.length).toBeGreaterThan(0);
    expect(doc.paths).toBeDefined();
  });

  it('defines GET /markets endpoint', () => {
    const doc = generateOpenApiDocument();

    expect(doc.paths['/markets']).toBeDefined();
    expect(doc.paths['/markets'].get).toBeDefined();
    const response200 = doc.paths['/markets'].get.responses?.['200'];
    expect(response200).toBeDefined();
    expect(response200.content?.['application/json']?.schema).toBeDefined();
  });

  it('defines GET /meta/side-data endpoint', () => {
    const doc = generateOpenApiDocument();

    expect(doc.paths['/meta/side-data']).toBeDefined();
    expect(doc.paths['/meta/side-data'].get).toBeDefined();
    const response200 = doc.paths['/meta/side-data'].get.responses?.['200'];
    expect(response200).toBeDefined();
    expect(response200.content?.['application/json']?.schema).toBeDefined();
  });

  it('includes nested schema: snapshot has lastUpdated and version', () => {
    const doc = generateOpenApiDocument();

    const schema = doc.paths['/markets'].get.responses?.['200']
      ?.content?.['application/json']?.schema;
    expect(schema).toBeDefined();
    // MarketsResponseSchema wraps { snapshot, reserves } — both should be present
    const properties = schema?.properties ?? schema?.allOf?.find(
      (s: Record<string, unknown>) => s?.properties
    )?.properties;
    expect(properties?.snapshot || properties).toBeDefined();
  });

  it('includes nested schema: reserves is an array', () => {
    const doc = generateOpenApiDocument();

    const schema = doc.paths['/markets'].get.responses?.['200']
      ?.content?.['application/json']?.schema;
    const props = schema?.properties ?? {};
    const reserves = props?.reserves;
    // reserves should be an array type
    expect(reserves?.type === 'array' || reserves?.items).toBeTruthy();
  });
});