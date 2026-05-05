/**
 * Shared helpers for rendering market chip labels across UI surfaces
 * (FilterBar, PortfolioPanel, etc.). Keeps a single source of truth for
 * how marketName / chainName map to user-facing labels.
 */
import { ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { getProtocolVersion } from '@/lib/protocolVersion';

/**
 * Sub-market label for an Ethereum market.
 * - V4: strip "AaveV4" prefix and split camelCase (AaveV4EthereumLido → "Ethereum Lido")
 * - V3: prefer canonical mapping in ETHEREUM_MARKET_NAMES, fall back to raw marketName
 */
export function getEthSubMarketLabel(marketName: string): string {
  const version = getProtocolVersion(marketName);
  if (version === 'v4') {
    const withoutPrefix = marketName.replace(/^AaveV4/i, '');
    return withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return ETHEREUM_MARKET_NAMES[marketName] ?? marketName;
}

/**
 * Market chip label used wherever a single chip needs to identify a market:
 * - Ethereum → sub-market label (e.g. "Core", "Prime", "Ethereum Lido")
 * - Other chains → the chain name itself (e.g. "Base", "Arbitrum")
 */
export function getMarketChipLabel(marketName: string, chainName: string): string {
  if (chainName !== 'Ethereum') return chainName;
  return getEthSubMarketLabel(marketName);
}

/** Whether a market should render the small "V4" badge alongside its label. */
export function isV4Market(marketName: string): boolean {
  return getProtocolVersion(marketName) === 'v4';
}

/**
 * Shared chip class for rendering a Hub label across surfaces
 * (PortfolioTokenRow desktop+mobile, SearchResultRow, etc.).
 * V4 markets use the brand magenta tint; others use muted neutral.
 */
export function getHubChipClass(isV4: boolean): string {
  return [
    'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-normal leading-none',
    isV4
      ? 'text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10'
      : 'text-muted-foreground/70 bg-muted/40',
  ].join(' ');
}
