/**
 * Maps onchain symbols to canonical display/search symbols.
 * Used by icon resolution (preloadUtils) and reserve patches.
 *
 * - Bridge prefixes/suffixes: 'USDT.e' → 'USDT' (Avalanche)
 * - Unicode variants:          'USD₮'    → 'USDT' (Celo)
 * - Wrapped/aliased tokens:    'miMATIC' → 'MAI'  (Polygon)
 *
 * Keys MUST match the exact onchain symbol casing (e.g. 'USDT.e', not 'usdt.e')
 * because lookup is performed on the raw symbol before lowercasing.
 */
export const SYMBOL_MAP: { [key: string]: string } = {
  BPTBALWETH: 'BPT_BAL_WETH',
  BPTWBTCWETH: 'BPT_WBTC_WETH',
  UNIAAVEWETH: 'UNI_AAVE_WETH',
  UNIBATWETH: 'UNI_BAT_WETH',
  UNICRVWETH: 'UNI_CRV_WETH',
  UNIDAIUSDC: 'UNI_DAI_USDC',
  UNIDAIWETH: 'UNI_DAI_WETH',
  UNILINKWETH: 'UNI_LINK_WETH',
  UNIMKRWETH: 'UNI_MKR_WETH',
  UNIRENWETH: 'UNI_REN_WETH',
  UNISNXWETH: 'UNI_SNX_WETH',
  UNIUNIWETH: 'UNI_UNI_WETH',
  UNIUSDCWETH: 'UNI_USDC_WETH',
  UNIWBTCUSDC: 'UNI_WBTC_USDC',
  UNIWBTCWETH: 'UNI_WBTC_WETH',
  UNIYFIWETH: 'UNI_YFI_WETH',
  fUSDT: 'USDT',
  // avalanche
  'DAI.e': 'DAI',
  'LINK.e': 'LINK',
  'WBTC.e': 'WBTC',
  'WETH.e': 'WETH',
  'AAVE.e': 'AAVE',
  'USDT.e': 'USDT',
  'USDC.e': 'USDC',
  'BTC.b': 'BTC',
  // polygon
  miMATIC: 'MAI',
  // metis
  'm.USDC': 'USDC',
  'm.USDT': 'USDT',
  'm.DAI': 'DAI',
  // celo
  'USD₮': 'USDT',
  'USD₮0': 'USDT0',
};
