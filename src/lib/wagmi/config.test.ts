import { describe, expect, it } from 'vitest';
import { wagmiConfig } from './config';
import { mainnet } from 'wagmi/chains';

type ConnectorWithRkDetails = {
  id: string;
  rkDetails?: { isRainbowKitConnector?: boolean };
};

describe('wagmi/config', () => {
  describe('wagmiConfig', () => {
    it('uses mainnet as the only chain', () => {
      const configChainIds = wagmiConfig.chains.map((c) => c.id);
      expect(configChainIds).toEqual([mainnet.id]);
    });

    it('has at least one connector', () => {
      expect(wagmiConfig.connectors.length).toBeGreaterThanOrEqual(1);
    });

    it('includes watchMode connector', () => {
      const ids = wagmiConfig.connectors.map((c) => c.id);
      expect(ids).toContain('watchMode');
    });
  });

  // RainbowKit's mobile modal (MobileOptions) only renders connectors carrying
  // `rkDetails.isRainbowKitConnector` — plain wagmi connectors leave the mobile
  // wallet list empty. Desktop additionally merges EIP-6963 connectors, which
  // is why it worked without this contract. See AAV-1282 /
  // docs/specs/aav-1282-mobile-connect-modal-rainbowkit-wallets.md.
  describe('wallet modal visibility (AAV-1282)', () => {
    // wagmi types connectors as a readonly tuple; only `rkDetails` matters here.
    const connectorsOf = (): readonly ConnectorWithRkDetails[] =>
      wagmiConfig.connectors as unknown as readonly ConnectorWithRkDetails[];

    it('every modal-listed connector carries rkDetails.isRainbowKitConnector', () => {
      const modalListed = connectorsOf().filter((c) => c.id !== 'watchMode');
      expect(modalListed.length).toBeGreaterThan(0);
      for (const connector of modalListed) {
        expect(
          connector.rkDetails?.isRainbowKitConnector,
          `connector "${connector.id}" must be created via connectorsForWallets — ` +
            'RainbowKit mobile modal only renders rkDetails-marked connectors',
        ).toBe(true);
      }
    });

    it('watchMode stays a plain connector (excluded from both modals by design)', () => {
      const watchMode = connectorsOf().find((c) => c.id === 'watchMode');
      expect(watchMode).toBeDefined();
      expect(watchMode?.rkDetails).toBeUndefined();
    });
  });
});
