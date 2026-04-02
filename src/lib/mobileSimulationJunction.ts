export const MOBILE_SIMULATION_JUNCTION_GEOMETRY = {
  bridgeTop: 'calc(-1 * var(--ds-space-2) - 4px)',
  bridgeHeight: 'calc(var(--ds-space-2) + 5px)',
  filletTop: 'calc(-1 * var(--ds-space-2) - 4px)',
  filletWidth: '17',
  filletHeight: '13',
} as const;

export function getMobileSimulationJunctionFilletPaths(bridgeOnExpandedColumn: boolean): {
  fillPath: string;
  strokePath: string;
} {
  if (bridgeOnExpandedColumn) {
    return {
      fillPath: 'M 0 0 L 0 13 L 17 13 L 17 12 L 8.5 12 A 8 8 0 0 1 0.5 4 L 0.5 0 L 0 0 Z',
      strokePath: 'M 0.5 0 L 0.5 4.5 A 8 8 0 0 0 8.5 12.5 L 17 12.5',
    };
  }

  return {
    fillPath: 'M 17 0 L 17 13 L 0 13 L 0 12 L 8.5 12 A 8 8 0 0 0 16.5 4 L 16.5 0 L 17 0 Z',
    strokePath: 'M 16.5 0 L 16.5 4.5 A 8 8 0 0 1 8.5 12.5 L 0 12.5',
  };
}
