/**
 * Shared helpers for rendering market chip labels across UI surfaces
 * (FilterBar, PortfolioPanel, etc.). Keeps a single source of truth for
 * how marketName / chainName map to user-facing labels.
 */
import { ETHEREUM_MARKET_NAMES, type ReserveWithSpread } from '@/types/aave';
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
    'inline-flex items-center rounded-full px-1.5 py-0.5 ds-text-9 !leading-none font-normal',
    isV4
      ? 'text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10'
      : 'text-muted-foreground/70 bg-muted/40',
  ].join(' ');
}

/**
 * Shared market label rendering for reserves table and top opportunities.
 *  - V4 markets: extract suffix from marketName (e.g., "AaveV4EthereumLido" → "Ethereum Lido")
 *  - V3 Ethereum: use canonical mapped names (Core, Prime, etc.)
 *  - V3 non-Ethereum: extract suffix from marketName (e.g., "AaveV3Base" → "Base")
 *    This ensures consistency with V4 and supports future sub-markets.
 */
export function getReserveMarketDisplayName(
  market: Pick<ReserveWithSpread, 'chainName' | 'marketName'>
): string {
  if (market.marketName?.startsWith('AaveV4')) {
    const withoutPrefix = market.marketName.replace(/^AaveV4/i, '');
    return withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
    return ETHEREUM_MARKET_NAMES[market.marketName];
  }

  if (market.marketName?.startsWith('AaveV3')) {
    const withoutPrefix = market.marketName.replace(/^AaveV3/i, '');
    return withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  return market.chainName;
}
