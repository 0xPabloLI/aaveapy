import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as addressBook from '@aave-dao/aave-address-book';
import { canonicalizeExpressionKey, extractExpressionKeys } from './reserve-patches-expr-keys.mjs';
import { collectRequiredIconSymbols } from './token-icon-symbols.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('canonicalizeExpressionKey', () => {
  it('rewrites the bridged-USDC rename on the three markets that moved to USDCe', () => {
    for (const market of ['AaveV3Arbitrum', 'AaveV3Optimism', 'AaveV3Polygon']) {
      assert.equal(
        canonicalizeExpressionKey(`${market}.ASSETS.USDC.UNDERLYING.toLowerCase()`),
        `${market}.ASSETS.USDCe.UNDERLYING.toLowerCase()`,
      );
    }
  });

  it('leaves USDC alone on markets where it is still the native asset', () => {
    // These markets never carried the bridged token under the name `USDC`, so
    // rewriting them would point the patch at a different token.
    for (const market of ['AaveV3Ethereum', 'AaveV3Base', 'AaveV3Avalanche', 'AaveV3Gnosis']) {
      const key = `${market}.ASSETS.USDC.UNDERLYING.toLowerCase()`;
      assert.equal(canonicalizeExpressionKey(key), key);
    }
  });

  it('does not alias USDCn, which is the native token rather than the bridged one', () => {
    // Verified by address: USDCe and USDCn differ on all three renamed markets.
    const key = 'AaveV3Arbitrum.ASSETS.USDCn.UNDERLYING.toLowerCase()';
    assert.equal(canonicalizeExpressionKey(key), key);
  });

  it('does not treat a market whose name extends a renamed market as that market', () => {
    const key = 'AaveV3ArbitrumSepolia.ASSETS.USDC.UNDERLYING.toLowerCase()';
    assert.equal(canonicalizeExpressionKey(key), key);
  });

  it('passes an unrecognised asset through so real drift stays visible', () => {
    const key = 'AaveV3Ethereum.ASSETS.SOMETHING_NEW.UNDERLYING.toLowerCase()';
    assert.equal(canonicalizeExpressionKey(key), key);
  });

  it('normalises whitespace before matching', () => {
    assert.equal(
      canonicalizeExpressionKey('AaveV3Arbitrum . ASSETS . USDC . UNDERLYING.toLowerCase()'),
      'AaveV3Arbitrum.ASSETS.USDCe.UNDERLYING.toLowerCase()',
    );
  });
});

describe('extractExpressionKeys', () => {
  it('canonicalises so the old and new spelling of one reserve compare equal', () => {
    const local = extractExpressionKeys(
      'const m = {\n  [AaveV3Arbitrum.ASSETS.USDCe.UNDERLYING.toLowerCase()]: {},\n};',
    );
    const upstream = extractExpressionKeys(
      'const m = {\n  [AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n};',
    );
    assert.deepEqual([...local], [...upstream]);
  });

  it('ignores literal address keys', () => {
    const keys = extractExpressionKeys("const m = {\n  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': {},\n};");
    assert.equal(keys.size, 0);
  });
});

describe('reservePatches expression keys resolve against the installed address book', () => {
  // Regression for issue #770. @aave-dao/aave-address-book renamed the bridged
  // USDC asset key from `USDC` to `USDCe` on Arbitrum/Optimism/Polygon. A stale
  // key makes the whole map throw "Cannot read properties of undefined (reading
  // 'UNDERLYING')", which took every Hardcode Sync run on dev, main and lovable
  // down for a month. The assertion is deliberately end-to-end — the real file
  // against the real package — so the next rename fails here rather than in CI.
  it('evaluates the real reservePatches.ts without throwing', () => {
    const reservePatchesContent = fs.readFileSync(path.join(ROOT, 'src/ui-config/reservePatches.ts'), 'utf8');
    const tokenSymbolMapContent = fs.readFileSync(path.join(ROOT, 'src/lib/tokenSymbolMap.ts'), 'utf8');

    const symbols = collectRequiredIconSymbols({
      reservePatchesContent,
      tokenSymbolMapContent,
      addressBookContext: addressBook,
    });

    // Bridged USDC's iconSymbol is `USDC`, so a map that resolved must have produced it.
    assert.ok(symbols.has('usdc'), 'bridged USDC icon symbol should be collected');
  });
});
