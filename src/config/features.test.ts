import { describe, it, expect } from 'vitest';
import { features } from './features';

describe('features', () => {
  it('should export snapshot as boolean', () => {
    expect(typeof features.snapshot).toBe('boolean');
  });

  it('should have snapshot disabled by default', () => {
    expect(features.snapshot).toBe(false);
  });
});
