// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ReservesTableDesktopSkeleton from './ReservesTableDesktopSkeleton';

describe('ReservesTableDesktopSkeleton', () => {
  afterEach(() => cleanup());

  it('renders 10 skeleton rows', () => {
    const { container } = render(<table><tbody><ReservesTableDesktopSkeleton /></tbody></table>);
    const rows = container.querySelectorAll('tr');
    expect(rows.length).toBe(10);
  });

  it('each row contains gradient skeleton elements for visual loading effect', () => {
    const { container } = render(<table><tbody><ReservesTableDesktopSkeleton /></tbody></table>);
    const rows = container.querySelectorAll('tr');
    for (const row of rows) {
      const gradientSkeletons = row.querySelectorAll('.from-primary\\/15');
      expect(gradientSkeletons.length).toBeGreaterThan(0);
    }
  });

  it('renders without throwing', () => {
    expect(() => render(<table><tbody><ReservesTableDesktopSkeleton /></tbody></table>)).not.toThrow();
  });
});
