// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Design token definition verification.
 *
 * Phase 2 adds control height tokens to index.css :root.
 * Phase 3 adds ring tooltip max-width token.
 * These tests verify token existence and correct values.
 */

const CSS_PATH = resolve(__dirname, '../index.css');
const cssSrc = readFileSync(CSS_PATH, 'utf8');

function tokenDefined(name: string): boolean {
  const re = new RegExp(name.replace('--', '\\-\\-') + '\\s*:');
  return re.test(cssSrc);
}

// ─── Phase 2: control height tokens ─────────────────────────────

describe('Phase 2: control height tokens in index.css :root', () => {
  it('--ds-control-h is defined (h-8 replacement)', () => {
    expect(tokenDefined('--ds-control-h')).toBe(true);
  });

  it('--ds-control-h value is 2rem', () => {
    const match = cssSrc.match(/--ds-control-h\s*:\s*(2rem)/);
    expect(match).not.toBeNull();
  });

  it('--ds-button-sm-h is defined (h-9 replacement)', () => {
    expect(tokenDefined('--ds-button-sm-h')).toBe(true);
  });

  it('--ds-button-sm-h value is 2.25rem', () => {
    const match = cssSrc.match(/--ds-button-sm-h\s*:\s*(2\.25rem)/);
    expect(match).not.toBeNull();
  });

  it('--ds-button-lg-h is defined (h-11 replacement)', () => {
    expect(tokenDefined('--ds-button-lg-h')).toBe(true);
  });

  it('--ds-button-lg-h value is 2.75rem', () => {
    const match = cssSrc.match(/--ds-button-lg-h\s*:\s*(2\.75rem)/);
    expect(match).not.toBeNull();
  });
});

// ─── Phase 3: ring tooltip max-width token ──────────────────────

describe('Phase 3: ring tooltip max-width token in index.css :root', () => {
  it('--ds-ring-tooltip-max-w is defined', () => {
    expect(tokenDefined('--ds-ring-tooltip-max-w')).toBe(true);
  });

  it('--ds-ring-tooltip-max-w value is 220px', () => {
    const match = cssSrc.match(/--ds-ring-tooltip-max-w\s*:\s*(220px)/);
    expect(match).not.toBeNull();
  });
});