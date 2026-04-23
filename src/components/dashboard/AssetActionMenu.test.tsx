// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetActionMenu from './AssetActionMenu';

const TOKEN_SYMBOL = 'USDC';
// Placeholder ERC-20 address for tests. Matches the existing convention used
// by DesktopReserveRow.test.tsx / MobileReserveCard.test.tsx.
const TOKEN_ADDRESS = '0x' + '0'.repeat(39) + '1';
const MARKET_NAME = 'AaveV3Ethereum';

function setup(overrides: Partial<Parameters<typeof AssetActionMenu>[0]> = {}) {
  return render(
    <AssetActionMenu
      tokenSymbol={TOKEN_SYMBOL}
      tokenAddress={TOKEN_ADDRESS}
      marketName={MARKET_NAME}
      isMobile={false}
      {...overrides}
    />,
  );
}

describe('AssetActionMenu (desktop)', () => {
  afterEach(() => cleanup());

  it('renders the trigger but no portal content until opened', () => {
    setup();
    expect(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`)).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a portaled menu with the expected items when the trigger is clicked', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));

    const menu = await screen.findByRole('menu', {
      name: `Asset actions for ${TOKEN_SYMBOL}`,
    });
    expect(menu).toBeInTheDocument();
    // The menu lives in a portal (document.body), not inside the trigger tree.
    expect(menu.parentElement).toBe(document.body);

    expect(screen.getByText('Open on Aave')).toBeInTheDocument();
    expect(screen.getByText('View token on explorer')).toBeInTheDocument();
    expect(screen.getByText('Copy address')).toBeInTheDocument();
  });

  it('positions the popover with inline fixed styles (top/left/width)', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));

    const menu = await screen.findByRole('menu', {
      name: `Asset actions for ${TOKEN_SYMBOL}`,
    });
    expect(menu).toHaveStyle({ position: 'fixed', width: '220px' });
    expect(Number.parseFloat(menu.style.top)).not.toBeNaN();
    expect(Number.parseFloat(menu.style.left)).not.toBeNaN();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('menu');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('menu');

    // Dispatch mousedown directly on body since user.click on document.body
    // does not reliably bubble through happy-dom in all versions.
    fireEvent.mouseDown(container.ownerDocument.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('returns null when tokenAddress is missing', () => {
    setup({ tokenAddress: null });
    expect(
      screen.queryByLabelText(`Asset actions for ${TOKEN_SYMBOL}`),
    ).not.toBeInTheDocument();
  });

  it('copies the token address to the clipboard when "Copy address" is clicked', async () => {
    // Happy-dom may or may not provide navigator.clipboard depending on the
    // version. Provide a spy-able stub either way.
    const clipboardContainer = globalThis.navigator as unknown as {
      clipboard?: { writeText: (s: string) => Promise<void> };
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    if (!clipboardContainer.clipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
    }
    const spy = vi
      .spyOn(globalThis.navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);

    try {
      const user = userEvent.setup();
      setup();

      await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
      await screen.findByRole('menu');

      await user.click(screen.getByText('Copy address'));

      expect(spy).toHaveBeenCalledWith(TOKEN_ADDRESS);
    } finally {
      spy.mockRestore();
      writeText.mockReset();
    }
  });
});

describe('AssetActionMenu (mobile)', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    // framer-motion reads matchMedia in happy-dom for reduced-motion checks
    if (!globalThis.matchMedia) {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: () => ({
          matches: false,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
  });

  it('renders a bottom sheet in a portal when opened on mobile', async () => {
    const user = userEvent.setup();
    setup({ isMobile: true });

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));

    const dialog = await screen.findByRole('dialog', {
      name: /asset-action-sheet-title|/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Open on Aave')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('closes the bottom sheet when the Close button is pressed', async () => {
    const user = userEvent.setup();
    setup({ isMobile: true });

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('dialog');

    await user.click(screen.getByLabelText('Close'));

    // The close animation exit takes one tick; flush it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AssetActionMenu (V3 vs V4 links)', () => {
  afterEach(() => cleanup());

  it('does not render "View asset page" for V3 assets', async () => {
    const user = userEvent.setup();
    const V3_MARKET = 'AaveV3Ethereum';
    setup({ marketName: V3_MARKET });

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('menu');

    expect(screen.queryByText('View asset page')).not.toBeInTheDocument();
  });

  it('renders "View asset page" for V4 assets using pro.aave.com URL', async () => {
    const user = userEvent.setup();
    const V4_MARKET = 'AaveV4Ethereum';
    const CHAIN_NAME = 'Ethereum';
    const V4_TOKEN = TOKEN_ADDRESS;
    setup({ marketName: V4_MARKET, chainName: CHAIN_NAME, tokenAddress: V4_TOKEN });

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('menu');

    const viewAssetLink = screen.getByText('View asset page').closest('a');
    expect(viewAssetLink).toBeInTheDocument();
    expect(viewAssetLink?.getAttribute('href')).toContain('pro.aave.com');
    expect(viewAssetLink?.getAttribute('href')).toContain('explore/asset');
    // pro.aave.com URLs use chain ID (1 for Ethereum) not chain name
    expect(viewAssetLink?.getAttribute('href')).toContain('/1/');
  });
});
