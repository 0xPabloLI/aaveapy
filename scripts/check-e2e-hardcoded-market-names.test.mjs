#!/usr/bin/env node
/**
 * Behaviour tests for the e2e hardcoded-market-name guard.
 *
 * Row numbers refer to the Behavioral Scenarios matrix in
 * docs/specs/e2e-hardcoded-market-name-guard.md.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractChainVocabulary, findHardcodedChainNames } from './lib/e2e-market-name-literals.mjs';

const MAP_TEXT = `export const chainIconMap: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
  57073: 'ink',
  4326: 'megaeth',
};
`;

describe('extractChainVocabulary', () => {
  it('row 1: reads chain slugs from the map file text', () => {
    const vocab = extractChainVocabulary(MAP_TEXT);
    assert.deepEqual([...vocab].sort(), ['arbitrum', 'base', 'ethereum', 'ink', 'megaeth']);
  });

  it('row 2: tolerates an empty or unparseable map file', () => {
    assert.deepEqual([...extractChainVocabulary('')], []);
    assert.deepEqual([...extractChainVocabulary('no entries here')], []);
  });
});

describe('findHardcodedChainNames', () => {
  const vocab = extractChainVocabulary(MAP_TEXT);

  it('row 3: flags a chain literal inside a selector, with its line number', () => {
    const source = ['await page.goto("/");', 'const chip = page.locator(`button:has-text("Arbitrum")`).first();'].join(
      '\n',
    );
    const hits = findHardcodedChainNames(source, vocab);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 2);
    assert.deepEqual(hits[0].names, ['Arbitrum']);
  });

  it('row 4: flags getByText and getByRole name literals too', () => {
    const source = [
      "page.getByText('Base')",
      "page.getByRole('button', { name: /Ink/i })",
      'page.getByRole("tab", { name: "MegaETH" })',
    ].join('\n');
    const hits = findHardcodedChainNames(source, vocab);
    assert.deepEqual(
      hits.map((h) => h.line),
      [1, 2, 3],
    );
  });

  it('row 5: leaves data-driven selectors alone (variable, not literal)', () => {
    const source = 'const btn = page.getByRole("button", { name: new RegExp(escapeRegExp(alternateMarket), "i") });';
    assert.deepEqual(findHardcodedChainNames(source, vocab), []);
  });

  it('row 6: leaves candidate fallback lists alone — absence there is tolerated', () => {
    const source = ['const fallbackMarkets = [', "  'Arbitrum',", "  'Base',", '];'].join('\n');
    assert.deepEqual(findHardcodedChainNames(source, vocab), []);
  });

  it('row 7: leaves prose and comments alone', () => {
    const source = '// Arbitrum left /markets entirely on 2026-09-30, so pick from the DOM.';
    assert.deepEqual(findHardcodedChainNames(source, vocab), []);
  });

  it('row 8: matches whole words only, so "Database" is not the Base chain', () => {
    const source = 'page.getByText("Database")';
    assert.deepEqual(findHardcodedChainNames(source, vocab), []);
    const flagged = findHardcodedChainNames('page.getByText("Base")', vocab);
    assert.equal(flagged.length, 1);
  });

  it('row 9: an unlisted chain name is not flagged (vocabulary is the bar)', () => {
    assert.deepEqual(findHardcodedChainNames('page.getByText("Fantom")', vocab), []);
  });

  it('row 10: honours the inline allow marker', () => {
    const source = 'page.getByText("Base") // market-name-guard: allow — this label is a rate bucket';
    assert.deepEqual(findHardcodedChainNames(source, vocab), []);
  });

  it('row 11: kebab and camel neighbours are not hits', () => {
    assert.deepEqual(findHardcodedChainNames('page.locator("#base-rate")', vocab), []);
    assert.deepEqual(findHardcodedChainNames('page.getByText("Database size")', vocab), []);
  });
});
