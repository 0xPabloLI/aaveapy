import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const OUTPUT_FILE = resolve(ROOT, 'public/openapi.json');

const originalContent = existsSync(OUTPUT_FILE)
  ? readFileSync(OUTPUT_FILE, 'utf-8')
  : null;

afterAll(() => {
  if (originalContent !== null) {
    writeFileSync(OUTPUT_FILE, originalContent, 'utf-8');
  }
});

describe('generate-openapi: no side effects on import', () => {
  it('importing generate-openapi.ts does not write openapi.json', () => {
    const before = existsSync(OUTPUT_FILE)
      ? readFileSync(OUTPUT_FILE, 'utf-8')
      : null;

    const result = execFileSync('node', [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `import { generateOpenApiDocument } from './scripts/generate-openapi.ts';
       const doc = generateOpenApiDocument();
       console.log('HAS_SCHEMAS:', !!doc.components?.schemas);`,
    ], { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });

    expect(result).toContain('HAS_SCHEMAS:');

    const after = existsSync(OUTPUT_FILE)
      ? readFileSync(OUTPUT_FILE, 'utf-8')
      : null;

    expect(after).toBe(before);
  });

  it('openapi:generate CLI script writes openapi.json', () => {
    const result = execFileSync('node', [
      '--experimental-strip-types',
      './scripts/generate-openapi-cli.ts',
    ], { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });

    expect(result).toContain('Generated');
    expect(existsSync(OUTPUT_FILE)).toBe(true);
  });
});
