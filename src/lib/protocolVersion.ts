export type ProtocolVersion = 'v3' | 'v4';
export type ProtocolVersionFilter = 'all' | ProtocolVersion;

/**
 * Determine the Aave protocol version from a marketName.
 * Convention: marketName starts with 'AaveV3' or 'AaveV4' (case-insensitive).
 * Defaults to 'v3' for unknown / legacy values.
 */
export function getProtocolVersion(marketName: string | null | undefined): ProtocolVersion {
  if (!marketName) return 'v3';
  const lower = marketName.toLowerCase();
  if (lower.startsWith('aavev4')) return 'v4';
  return 'v3';
}

export function getProtocolVersionLabel(version: ProtocolVersion): string {
  return version === 'v4' ? 'V4' : 'V3';
}
