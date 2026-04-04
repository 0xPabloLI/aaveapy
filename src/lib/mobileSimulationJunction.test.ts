import { describe, expect, it } from 'vitest';

import {
  MOBILE_SIMULATION_JUNCTION_GEOMETRY,
  getMobileSimulationJunctionFilletPaths,
} from './mobileSimulationJunction';

describe('mobile simulation junction geometry', () => {
  it('uses the documented bridge overlap values', () => {
    expect(MOBILE_SIMULATION_JUNCTION_GEOMETRY.bridgeTop).toBe('calc(-1 * var(--ds-space-2) - 4px)');
    expect(MOBILE_SIMULATION_JUNCTION_GEOMETRY.bridgeHeight).toBe('calc(var(--ds-space-2) + 5px)');
    expect(MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletTop).toBe('calc(-1 * var(--ds-space-2) - 4px)');
    expect(MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletWidth).toBe('17');
    expect(MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletHeight).toBe('13');
  });

  it('draws the fillet stroke from y=0 for continuous border', () => {
    const left = getMobileSimulationJunctionFilletPaths(true);
    const right = getMobileSimulationJunctionFilletPaths(false);

    expect(left.strokePath).toContain('M 0.5 0');
    expect(right.strokePath).toContain('M 16.5 0');
  });
});
