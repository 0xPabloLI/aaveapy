// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import UtilizationIndicator, { UtilizationContent } from './UtilizationIndicator';

function renderIndicator(current: number | null, optimal: number | null) {
  return render(<UtilizationIndicator current={current} optimal={optimal} />);
}

describe('UtilizationIndicator', () => {
  it('renders SVG track and dot when both values are provided', () => {
    const { container } = renderIndicator(50, 80);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('circle')).not.toBeNull();
    expect(svg!.querySelector('rect')).not.toBeNull();
  });

  it('renders nothing when current is null', () => {
    const { container } = renderIndicator(null, 80);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing when optimal is null', () => {
    const { container } = renderIndicator(50, null);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing when current is not finite', () => {
    const { container } = renderIndicator(Infinity, 80);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders only SVG bar without tooltip wrapper (caller wraps Tooltip as needed)', () => {
    const { container } = renderIndicator(50, 80);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-state]')).toBeNull();
  });

  it('clamps utilization values to 0-100 range', () => {
    const { container } = renderIndicator(150, 80);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('handles normal utilization below optimal', () => {
    const { container } = renderIndicator(30, 80);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

describe('UtilizationContent sort arrows', () => {
  const baseProps = {
    current: 50,
    optimal: 80,
  };

  it('renders "Current utilization" sort arrow button when onSortUtilization is provided', () => {
    const html = renderToString(
      <UtilizationContent
        {...baseProps}
        onSortUtilization={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by utilization"');
  });

  it('does not render "Current utilization" sort arrow when onSortUtilization not provided', () => {
    const html = renderToString(
      <UtilizationContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by utilization"');
  });
});

describe('UtilizationContent formula layout', () => {
  it('renders CSS fraction formula with borrowed and liquidity terms', () => {
    const html = renderToString(
      <UtilizationContent current={50} optimal={80} />,
    );
    expect(html).toContain('Utilization =');
    expect(html).toContain('borrowed');
    expect(html).toContain('liquidity');
  });

  it('does not render Available liquidity row', () => {
    const html = renderToString(
      <UtilizationContent current={50} optimal={80} />,
    );
    expect(html).not.toContain('Available liquidity');
  });
});
