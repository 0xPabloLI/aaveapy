import { describe, expect, it } from 'vitest';

import { hasMissingWalletData } from './walletSyncNotice';

/**
 * AAV-1393 matrix M1–M7. `sdk-*-fallback` only says "the SDK layer was bypassed",
 * so it must not trigger the incomplete-data notice; anything else must.
 */
describe('hasMissingWalletData', () => {
  it('W1 ignores the v3 fallback marker alone', () => {
    expect(hasMissingWalletData(['sdk-v3-fallback'])).toBe(false);
  });

  it('W2 ignores the v4 fallback marker alone', () => {
    expect(hasMissingWalletData(['sdk-v4-fallback'])).toBe(false);
  });

  it('W3 reports incomplete when a real onchain read failed next to the marker', () => {
    expect(hasMissingWalletData(['sdk-v3-fallback', 'onchain-v3-chain-10'])).toBe(true);
  });

  it('W4 reports incomplete for a gap-chain read failure', () => {
    expect(hasMissingWalletData(['gap-v3-chain-42220'])).toBe(true);
  });

  it('W5 reports incomplete for a whole-layer failure label', () => {
    expect(hasMissingWalletData(['onchain-v3'])).toBe(true);
  });

  it('W6 reports complete for an empty list', () => {
    expect(hasMissingWalletData([])).toBe(false);
  });

  it('W7 reports incomplete for an unknown future label (fail open)', () => {
    expect(hasMissingWalletData(['sdk-v4-fallback', 'brand-new-source'])).toBe(true);
  });
});
