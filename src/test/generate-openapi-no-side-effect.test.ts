import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const OUTPUT_FILE = resolve(ROOT, 'public/openapi.json');

function snapshotAndRestore(action: () => void): void {
  const before = existsSync(OUTPUT_FILE)
    ? readFileSync(OUTPUT_FILE, 'utf-8')
    : null;
  try {
    action();
  } finally {
    if (before !== null) {
      writeFileSync(OUTPUT_FILE, before, 'utf-8');
    }
  }
}

describe('generate-openapi: no side effects on import', () => {
  it('importing generate-openapi.ts does not write openapi.json', () => {
    let output = '';
    snapshotAndRestore(() => {
      const before = existsSync(OUTPUT_FILE)
        ? readFileSync(OUTPUT_FILE, 'utf-8')
        : null;

      output = execFileSync('node', [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `import { generateOpenApiDocument } from './scripts/generate-openapi.ts';
         const doc = generateOpenApiDocument();
         console.log('HAS_SCHEMAS:', !!doc.components?.schemas);`,
      ], { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });

      const after = existsSync(OUTPUT_FILE)
        ? readFileSync(OUTPUT_FILE, 'utf-8')
        : null;

      expect(after).toBe(before);
    });

    expect(output).toContain('HAS_SCHEMAS:');
  });

  it('openapi:generate CLI script writes openapi.json', () => {
    let output = '';
    snapshotAndRestore(() => {
      output = execFileSync('node', [
        '--experimental-strip-types',
        './scripts/generate-openapi-cli.ts',
      ], { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });

      expect(output).toContain('Generated');
      expect(existsSync(OUTPUT_FILE)).toBe(true);
    });
  });
});
