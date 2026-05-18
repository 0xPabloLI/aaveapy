// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '@/components/ui/tooltip';
import UtilizationIndicator, { UtilizationContent } from './UtilizationIndicator';

function renderIndicator(current: number | null, optimal: number | null) {
  return render(
    <TooltipProvider>
      <UtilizationIndicator current={current} optimal={optimal} />
    </TooltipProvider>,
  );
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

  it('always wraps SVG in a Tooltip (disableTooltip prop has been removed)', () => {
    const { container } = renderIndicator(50, 80);
    const tooltipTrigger = container.querySelector('[data-state]');
    expect(tooltipTrigger).not.toBeNull();
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