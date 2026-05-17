import { describe, expect, it } from 'vitest';
import { generateOpenApiDocument } from './generate-openapi';

describe('generateOpenApiDocument', () => {
  it('produces a valid OpenAPI 3.1 document with info, servers, paths', () => {
    const doc = generateOpenApiDocument();

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toBeDefined();
    expect(doc.info?.title).toBe('AaveAPY API');
    expect(doc.info?.version).toBe('1.0.0');
    expect(doc.servers).toBeInstanceOf(Array);
    expect(doc.servers?.length).toBeGreaterThan(0);
    expect(doc.paths).toBeDefined();
  });

  it('defines GET /markets endpoint with $ref to MarketsResponse', () => {
    const doc = generateOpenApiDocument();

    const path = doc.paths?.['/markets'] as Record<string, unknown>;
    expect(path).toBeDefined();
    expect(path?.get).toBeDefined();
    const response200 = (path?.get as Record<string, unknown>)?.responses?.['200'] as Record<string, unknown>;
    expect(response200).toBeDefined();
    const schema = (response200?.content?.['application/json'] as Record<string, unknown>)?.schema as Record<string, unknown>;
    expect(schema?.$ref).toBe('#/components/schemas/MarketsResponse');
  });

  it('defines GET /meta/side-data endpoint with $ref to SideDataMetaResponse', () => {
    const doc = generateOpenApiDocument();

    const path = doc.paths?.['/meta/side-data'] as Record<string, unknown>;
    expect(path).toBeDefined();
    expect(path?.get).toBeDefined();
    const response200 = (path?.get as Record<string, unknown>)?.responses?.['200'] as Record<string, unknown>;
    expect(response200).toBeDefined();
    const schema = (response200?.content?.['application/json'] as Record<string, unknown>)?.schema as Record<string, unknown>;
    expect(schema?.$ref).toBe('#/components/schemas/SideDataMetaResponse');
  });

  it('has MarketsResponse schema in components.schemas with snapshot and reserves', () => {
    const doc = generateOpenApiDocument();

    const schemas = (doc.components as Record<string, unknown>)?.schemas as Record<string, unknown>;
    expect(schemas?.MarketsResponse).toBeDefined();
    const marketsResponse = schemas?.MarketsResponse as Record<string, unknown>;
    expect(marketsResponse?.properties).toBeDefined();
    const props = marketsResponse?.properties as Record<string, unknown>;
    expect(props?.snapshot).toBeDefined();
    expect(props?.reserves).toBeDefined();
  });

  it('has all named schemas in components.schemas', () => {
    const doc = generateOpenApiDocument();

    const schemas = (doc.components as Record<string, unknown>)?.schemas as Record<string, unknown>;
    expect(schemas).toBeDefined();
    const keys = Object.keys(schemas ?? {});
    expect(keys).toContain('MarketsResponse');
    expect(keys).toContain('SideDataMetaResponse');
    expect(keys).toContain('Reserve');
    expect(keys).toContain('MeritIncentive');
    expect(keys).toContain('MerklCampaignBreakdown');
    expect(keys).toContain('MerklOpportunityGroup');
    expect(keys).toContain('BrevisCampaignBreakdown');
    expect(keys).toContain('BrevisIncentive');
  });

  it('contains no unresolved $defs references', () => {
    const doc = generateOpenApiDocument();
    const docJson = JSON.stringify(doc);
    expect(docJson).not.toContain('#/$defs/');
  });

  it('all $ref targets resolve to existing schemas', () => {
    const doc = generateOpenApiDocument();
    const schemas = (doc.components as Record<string, unknown>)?.schemas as Record<string, unknown>;
    const schemaKeys = new Set(Object.keys(schemas ?? {}));

    const refs = new Set<string>();
    const collectRefs = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (typeof record.$ref === 'string') {
        refs.add(record.$ref);
      }
      for (const value of Object.values(record)) {
        if (typeof value === 'object' && value !== null) collectRefs(value);
      }
    };
    collectRefs(doc);

    for (const ref of refs) {
      const m = ref.match(/^#\/components\/schemas\/(.+)$/);
      if (m) {
        expect(schemaKeys.has(m[1]),
          `Unresolved $ref: ${ref} (target '${m[1]}' not in components.schemas)`
        ).toBe(true);
      }
    }
  });

  it('MeritIncentive.message is inlined, not an orphan $ref', () => {
    const doc = generateOpenApiDocument();
    const schemas = (doc.components as Record<string, unknown>)?.schemas as Record<string, unknown>;
    const meritIncentive = schemas?.MeritIncentive as Record<string, unknown>;
    const props = meritIncentive?.properties as Record<string, unknown>;
    const message = props?.message as Record<string, unknown>;
    expect(message?.$ref).toBeUndefined();
    expect(message?.anyOf).toBeDefined();
  });

  it('response bodies use $ref not inline schema', () => {
    const doc = generateOpenApiDocument();

    const mktsSchema = (doc.paths as Record<string, unknown>)?.['/markets'] as Record<string, unknown>;
    const sideSchema = (doc.paths as Record<string, unknown>)?.['/meta/side-data'] as Record<string, unknown>;

    const getMkts = (mktsSchema?.get as Record<string, unknown>)?.responses?.['200']
      ?.content?.['application/json']?.schema as Record<string, unknown>;
    expect(getMkts?.$ref).toBe('#/components/schemas/MarketsResponse');
    expect(getMkts?.type).toBeUndefined();

    const getSide = (sideSchema?.get as Record<string, unknown>)?.responses?.['200']
      ?.content?.['application/json']?.schema as Record<string, unknown>;
    expect(getSide?.$ref).toBe('#/components/schemas/SideDataMetaResponse');
    expect(getSide?.type).toBeUndefined();
  });
});