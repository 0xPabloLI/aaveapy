import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as addressBook from '@bgd-labs/aave-address-book';
import { collectIconSymbolLogoHints, collectRequiredIconSymbols } from './token-icon-symbols.mjs';

const reservePatchesPath = path.resolve(process.cwd(), 'src/ui-config/reservePatches.ts');
const reservePatchesContent = fs.readFileSync(reservePatchesPath, 'utf8');

describe('collectRequiredIconSymbols', () => {
  it('includes runtime market symbols not present in static interface tokenlist (e.g. ACRED)', () => {
    const symbols = collectRequiredIconSymbols({
      reservePatchesContent,
      marketsRows: [
        {
          tokenAddress: '0x17418038ecF73BA4026c4f428547BF099706F27B',
          tokenSymbol: 'ACRED',
        },
      ],
      addressBookContext: addressBook,
    });

    expect(symbols.has('acred')).toBe(true);
  });

  it('prefers reservePatches iconSymbol by address over raw market symbol', () => {
    const symbols = collectRequiredIconSymbols({
      reservePatchesContent,
      marketsRows: [
        {
          tokenAddress: '0xaebf0bb9f57e89260d57f31af34eb58657d96ce0',
          tokenSymbol: 'PT-USDE-7MAY2026',
        },
      ],
      addressBookContext: addressBook,
    });

    expect(symbols.has('ptusde')).toBe(true);
    expect(symbols.has('pt-usde-7may2026')).toBe(false);
  });

  it('splits composite icon symbols into actual token icon lookup keys', () => {
    const symbols = collectRequiredIconSymbols({
      reservePatchesContent,
      marketsRows: [
        {
          tokenAddress: '0x0000000000000000000000000000000000000001',
          tokenSymbol: 'UNI_AAVE_WETH',
        },
      ],
      addressBookContext: addressBook,
    });

    expect(symbols.has('uni')).toBe(true);
    expect(symbols.has('aave')).toBe(true);
    expect(symbols.has('weth')).toBe(true);
    expect(symbols.has('uni_aave_weth')).toBe(false);
  });

  it('collects logoURI hints for icon symbols resolved by reserve patches', () => {
    const fixture = `
export const SYMBOL_MAP: { [key: string]: string } = {};
export function fetchIconSymbolAndName() {
  const underlyingAssetMap: Record<string, unknown> = {
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': { iconSymbol: 'FOO' },
  };
  return underlyingAssetMap;
}
`;

    const hints = collectIconSymbolLogoHints({
      reservePatchesContent: fixture,
      marketsRows: [],
      addressBookContext: {},
      tokenLogoByAddress: new Map([
        ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'https://example.com/foo.svg'],
      ]),
    });

    expect(hints.get('foo')).toBe('https://example.com/foo.svg');
  });
});
