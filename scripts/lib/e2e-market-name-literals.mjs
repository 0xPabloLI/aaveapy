/**
 * Pure scanner behind `npm run check:e2e-market-names`.
 *
 * A market/chain name that the backend stops returning makes any *selector*
 * literal carrying it hang until timeout, which reads as flakiness rather than
 * as drift (Arbitrum left /markets entirely on 2026-09-30 and took a mobile
 * spec with it). Selector literals are the brittle form; candidate lists that
 * tolerate absence are not, so only the former are reported.
 *
 * The vocabulary comes from `src/lib/chainIconMap.ts`, which the upstream drift
 * checks already keep in sync, so this guard inherits an authoritative name set
 * instead of minting a second list that would itself go stale.
 */

const CHAIN_ENTRY = /^\s*\d+:\s*'([a-z0-9][a-z0-9-]*)'/gm;

/** Lines that reach the DOM: only these can carry a brittle name literal. */
const SELECTOR_LINE = /has-text\s*\(|getByText\s*\(|getByPlaceholder\s*\(|getByRole\s*\(|locator\s*\(/;

/** Escape hatch for a label that merely happens to spell a chain name. */
export const ALLOW_MARKER = 'market-name-guard: allow';

/**
 * Word-bounded, and not adjacent to `-` or a word char: "Database" is not the
 * Base chain and a `#base-rate` id is not a market chip.
 */
function wordPattern(slug) {
  const body = slug.replace(/-/g, '[- ]');
  return new RegExp(`(?<![\\w-])${body}(?![\\w-])`, 'i');
}

/**
 * @param {string} mapFileText contents of src/lib/chainIconMap.ts
 * @returns {Set<string>} chain slugs the app knows, lowercase
 */
export function extractChainVocabulary(mapFileText) {
  const slugs = new Set();
  for (const match of mapFileText.matchAll(CHAIN_ENTRY)) {
    slugs.add(match[1]);
  }
  return slugs;
}

/**
 * @param {string} source one file's text
 * @param {Set<string>} vocabulary from extractChainVocabulary
 * @returns {Array<{line: number, names: string[], snippet: string}>}
 */
export function findHardcodedChainNames(source, vocabulary) {
  const findings = [];

  source.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (!SELECTOR_LINE.test(line)) return;
    if (line.includes(ALLOW_MARKER)) return;

    const names = [];
    for (const slug of vocabulary) {
      const match = wordPattern(slug).exec(line);
      if (match && !names.includes(match[0])) names.push(match[0]);
    }
    if (names.length) {
      findings.push({ line: index + 1, names, snippet: trimmed.slice(0, 120) });
    }
  });

  return findings;
}
