// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'tinyglobby';

/**
 * Regression guard: no component should use reserve.supplyDisabled or
 * reserve.borrowDisabled directly. Always use isSupplyDisabled(reserve) /
 * isBorrowDisabled(reserve) from @/lib/reserveStatus.
 *
 * Background:
 *   The mutual exclusion rule in the backend means protocol-restricted
 *   reserves (frozen/paused/inactive) do NOT send supplyDisabled/borrowDisabled.
 *   Checking only the raw field misses protocol-level restrictions, causing
 *   missing dimming effects and incorrect disabled state in UI components.
 *
 * Safe pattern:
 *   import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
 *   isSupplyDisabled(reserve)   // accounts for protocol + product flags
 *   isBorrowDisabled(reserve)   // accounts for protocol + product flags
 *
 * Dangerous pattern (caught by this test):
 *   reserve.supplyDisabled      // misses frozen/paused/inactive
 *   reserve.borrowDisabled      // misses frozen/paused/inactive
 */

const SRC_DIR = resolve(__dirname, '..');

const TSX_FILES = globSync(['components/**/*.tsx', 'hooks/**/*.ts', 'pages/**/*.tsx'], {
  cwd: SRC_DIR,
  absolute: false,
});

// Files that may legitimately reference the field name in type definitions,
// schema validation, tests, or documentation.
const ALLOWLIST = new Set([
  'types/aave.ts',                    // type definition
  'lib/apiSchemas.ts',                // Zod schema
  'lib/apiSchemas.test.ts',          // schema test
  'lib/reserveStatus.ts',            // helper implementation
  'lib/reserveStatus.test.ts',       // helper tests
  'test/reserve-status-helper-regression.test.ts', // this file
]);

describe('No direct reserve.supplyDisabled / reserve.borrowDisabled in components', () => {
  const filesToCheck = TSX_FILES.filter((f) => !ALLOWLIST.has(f));

  for (const file of filesToCheck) {
    const src = readFileSync(resolve(SRC_DIR, file), 'utf8');

    it(`${file}: no direct reserve.supplyDisabled`, () => {
      // Allow supplyDisabled as a variable name or prop definition, but NOT
      // as a property access on a reserve object.
      const matches = src.match(/reserve\??\.supplyDisabled/g);
      expect(matches).toBeNull();
    });

    it(`${file}: no direct reserve.borrowDisabled`, () => {
      const matches = src.match(/reserve\??\.borrowDisabled/g);
      expect(matches).toBeNull();
    });
  }
});