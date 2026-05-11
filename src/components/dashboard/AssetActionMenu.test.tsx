// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetActionMenu from './AssetActionMenu';

const TOKEN_SYMBOL = 'USDC';
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

  it('renders the trigger but no menu content until opened', () => {
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

    expect(screen.getByText('Open on Aave')).toBeInTheDocument();
    expect(screen.getByText('View token on explorer')).toBeInTheDocument();
    expect(screen.getByText('Copy address')).toBeInTheDocument();
  });

  it('renders the menu via Radix Popover with align=start and sideOffset=6', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));

    const menu = await screen.findByRole('menu', {
      name: `Asset actions for ${TOKEN_SYMBOL}`,
    });
    expect(menu).toBeInTheDocument();
    const popoverContent = menu.closest('[data-radix-popper-content-root]') ?? menu.parentElement;
    expect(popoverContent).toBeInTheDocument();
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
    setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('menu');

    await user.click(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles open/closed on repeated trigger clicks', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`);

    await user.click(trigger);
    await screen.findByRole('menu');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('sets aria-haspopup="menu" on the trigger for accessibility', () => {
    setup();
    const trigger = screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`);
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('renders PopoverContent with align=start to match Market column positioning', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    const menu = await screen.findByRole('menu');

    const popoverContent = menu.closest('[data-radix-popper-content-root]');
    expect(popoverContent).toBeInTheDocument();
    expect(popoverContent?.getAttribute('data-align')).toBe('start');
    expect(popoverContent?.getAttribute('data-side')).toBe('bottom');
  });

  it('returns null when tokenAddress is missing', () => {
    setup({ tokenAddress: null });
    expect(
      screen.queryByLabelText(`Asset actions for ${TOKEN_SYMBOL}`),
    ).not.toBeInTheDocument();
  });

  it('copies the token address to the clipboard when "Copy address" is clicked', async () => {
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

  it('renders Aave and Tydro protocol logos as trailing icons on their menu items', async () => {
    const user = userEvent.setup();
    setup({ marketName: 'AaveV3Ink' });

    await user.click(screen.getByLabelText(`Asset actions for ${TOKEN_SYMBOL}`));
    await screen.findByRole('menu');

    const aaveItem = screen.getByText('Open on Aave').closest('a');
    const aaveLogo = aaveItem?.querySelector('img[alt="Aave"]');
    expect(aaveLogo).toBeInTheDocument();
    expect(aaveLogo?.getAttribute('src')).toBe('/icons/tokens/aave.svg');

    const tydroItem = screen.getByText('Open on Tydro').closest('a');
    const tydroLogo = tydroItem?.querySelector('img[alt="Tydro"]');
    expect(tydroLogo).toBeInTheDocument();
    expect(tydroLogo?.getAttribute('src')).toBe('/icons/partners/inktoken.svg');
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
    expect(viewAssetLink?.getAttribute('href')).toContain('/1/');
  });
});
