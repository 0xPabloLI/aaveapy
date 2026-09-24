#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchGeneratedSchemas } from './lib/patch-generated-schemas.mjs';

// Fixture mirrors the exact raw openapi-zod-client output that broke the
// openapi-sync bot (AAV-1298): recursive MarketsResponse + single-arg z.record.
const BROKEN_RAW = `import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core';
import { z } from 'zod';

type MarketsResponse = MarketsResponse;

const MarketsResponse: z.ZodType<MarketsResponse> = z.lazy(() => MarketsResponse);
const SideDataPayload = z.object({
  campaignAccess: z
    .object({
      campaigns: z.record(
        z.object({
          chainId: z.number(),
          whitelist: z.array(z.string()),
        }),
      ),
      updatedAt: z.string(),
    })
    .optional(),
});
`;

describe('patchGeneratedSchemas', () => {
  it('fixes recursive alias: drops self-referencing type, uses z.ZodTypeAny', () => {
    const { code, changed } = patchGeneratedSchemas(BROKEN_RAW);
    assert.equal(changed, true);
    assert.match(code, /const MarketsResponse: z\.ZodTypeAny = z\.lazy\(\(\) => MarketsResponse\);/);
    assert.doesNotMatch(code, /type MarketsResponse = MarketsResponse;/);
  });

  it('injects z.string() key into single-arg z.record (multi-line nested)', () => {
    const { code } = patchGeneratedSchemas(BROKEN_RAW);
    assert.match(code, /campaigns: z\.record\(\s*z\.string\(\),\s*z\.object\(\{/);
  });

  it('fixes inline single-arg z.record', () => {
    const { code } = patchGeneratedSchemas('const m = z.record(z.object({ a: z.number() }));');
    assert.equal(code, 'const m = z.record(z.string(), z.object({ a: z.number() }));');
  });

  it('leaves already-correct z.record untouched (idempotent)', () => {
    const good =
      'const a = z.record(z.string(), z.object({ a: z.number() }));\nconst b = z.record(z.number(), z.string());';
    const { code, changed } = patchGeneratedSchemas(good);
    assert.equal(changed, false);
    assert.equal(code, good);
  });

  it('no-op on input without known broken patterns', () => {
    const { code, changed, changes } = patchGeneratedSchemas('const x = z.object({ a: z.string() });\n');
    assert.equal(changed, false);
    assert.equal(code, 'const x = z.object({ a: z.string() });\n');
    assert.deepEqual(changes, []);
  });

  it('fixes every occurrence, not just the first', () => {
    const src = [
      'type A = A;',
      '',
      'const A: z.ZodType<A> = z.lazy(() => A);',
      'const r1 = z.record(z.object({ a: 1 }));',
      'const r2 = z.record(z.object({ b: 2 }));',
    ].join('\n');
    const { code } = patchGeneratedSchemas(src);
    assert.doesNotMatch(code, /type A = A;/);
    assert.match(code, /z\.record\(z\.string\(\), z\.object\(\{ a: 1 \}\)\)/);
    assert.match(code, /z\.record\(z\.string\(\), z\.object\(\{ b: 2 \}\)\)/);
  });

  it('handles nested z.record (record of record)', () => {
    const { code } = patchGeneratedSchemas('const m = z.record(z.record(z.object({ a: 1 })));');
    assert.equal(code, 'const m = z.record(z.string(), z.record(z.string(), z.object({ a: 1 })));');
  });

  it('ignores z.record-like text inside string literals', () => {
    const src = "const d = schema.describe('call z.record(z.object({})) here');";
    const { code, changed } = patchGeneratedSchemas(src);
    assert.equal(changed, false);
    assert.equal(code, src);
  });

  it('wiring guard: schema:codegen chain includes the patcher', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(pkg.scripts['schema:codegen'], /patch-generated-schemas\.mjs/);
  });
});
