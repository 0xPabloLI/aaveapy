// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipCalloutArrow,
  CalloutArrowSvg,
} from '@/components/ui/tooltip';

describe('Arrow Components', () => {
  describe('CalloutArrowSvg', () => {
    it('renders with default dimensions (16x9)', () => {
      const { container } = render(<CalloutArrowSvg />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(2);
    });

    it('renders fill path', () => {
      const { container } = render(<CalloutArrowSvg />);
      const fillPath = container.querySelector('path[fill="hsl(var(--card))"]');
      expect(fillPath).not.toBeNull();
    });

    it('renders stroke path with correct attributes', () => {
      const { container } = render(<CalloutArrowSvg />);
      const strokePath = container.querySelector('path[stroke="hsl(var(--border) / 0.6)"]');
      expect(strokePath).not.toBeNull();
      expect(strokePath!.getAttribute('stroke-width')).toBe('1');
      expect(strokePath!.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('generates correct triangle points for default size', () => {
      const { container } = render(<CalloutArrowSvg width={16} height={9} />);
      const fillPath = container.querySelector('path[fill]');
      expect(fillPath).not.toBeNull();
      expect(fillPath!.getAttribute('d')).toBe('0 9 L8 0 L16 9');
    });

    it('uses custom fill color when provided', () => {
      const { container } = render(<CalloutArrowSvg fill="red" />);
      const fillPath = container.querySelector('path[fill="red"]');
      expect(fillPath).not.toBeNull();
    });

    it('uses custom stroke color when provided', () => {
      const { container } = render(<CalloutArrowSvg stroke="blue" />);
      const strokePath = container.querySelector('path[stroke="blue"]');
      expect(strokePath).not.toBeNull();
    });

    it('respects custom width and height', () => {
      const { container } = render(<CalloutArrowSvg width={20} height={10} />);
      const fillPath = container.querySelector('path[fill]');
      expect(fillPath!.getAttribute('d')).toBe('0 10 L10 0 L20 10');
    });

    it('renders two paths (fill + stroke)', () => {
      const { container } = render(<CalloutArrowSvg />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(2);
    });
  });

  describe('TooltipCalloutArrow', () => {
    function renderCalloutArrow() {
      return render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>
              <span>Trigger</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Content
              <TooltipCalloutArrow side="top" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
    }

    it('renders four directional arrow SVGs', () => {
      const { baseElement } = renderCalloutArrow();
      const sides = ['top', 'bottom', 'left', 'right'] as const;
      sides.forEach((side) => {
        const arrows = baseElement.querySelectorAll(`svg[data-arrow-side="${side}"]`);
        expect(arrows.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('uses pointer-events-none on all arrows', () => {
      const { baseElement } = renderCalloutArrow();
      const arrows = baseElement.querySelectorAll('svg.callout-arrow');
      arrows.forEach((arrow) => {
        const className = arrow.className.baseVal || arrow.getAttribute('class') || '';
        expect(className).toContain('pointer-events-none');
      });
    });

    it('uses z-20 for proper layering', () => {
      const { baseElement } = renderCalloutArrow();
      const arrows = baseElement.querySelectorAll('svg.callout-arrow');
      arrows.forEach((arrow) => {
        const className = arrow.className.baseVal || arrow.getAttribute('class') || '';
        expect(className).toContain('z-20');
      });
    });

    it('renders correct viewBox for horizontal arrows (16x9)', () => {
      const { baseElement } = renderCalloutArrow();
      const horizontalArrows = baseElement.querySelectorAll('svg.callout-arrow[viewBox="0 0 16 9"]');
      expect(horizontalArrows.length).toBeGreaterThanOrEqual(2);
    });

    it('renders correct viewBox for vertical arrows (9x16)', () => {
      const { baseElement } = renderCalloutArrow();
      const verticalArrows = baseElement.querySelectorAll('svg.callout-arrow[viewBox="0 0 9 16"]');
      expect(verticalArrows.length).toBeGreaterThanOrEqual(2);
    });

    it('uses group-data-[side=top]/tt for top arrow visibility', () => {
      const { baseElement } = renderCalloutArrow();
      const arrows = baseElement.querySelectorAll('svg.callout-arrow');
      const topArrow = Array.from(arrows).find((arrow) => {
        const className = arrow.className.baseVal || arrow.getAttribute('class') || '';
        return className.includes('group-data-[side=top]/tt');
      });
      expect(topArrow).not.toBeNull();
    });

    it('uses group-data-[side=bottom]/tt for bottom arrow visibility', () => {
      const { baseElement } = renderCalloutArrow();
      const arrows = baseElement.querySelectorAll('svg.callout-arrow');
      const bottomArrow = Array.from(arrows).find((arrow) => {
        const className = arrow.className.baseVal || arrow.getAttribute('class') || '';
        return className.includes('group-data-[side=bottom]/tt');
      });
      expect(bottomArrow).not.toBeNull();
    });

    it('uses group-data-[side=left]/tt for left arrow visibility', () => {
      const { baseElement } = renderCalloutArrow();
      const arrows = baseElement.querySelectorAll('svg.callout-arrow');
      const leftArrow = Array.from(arrows).find((arrow) => {
        const className = arrow.className.baseVal || arrow.getAttribute('class') || '';
        return className.includes('group-data-[side=left]/tt');
      });
      expect(leftArrow).not.toBeNull();
    });

    it('uses group-data-[side=right]/tt for right arrow visibility', () => {
      const { baseElement } = renderCalloutArrow();
      const arrows = baseElement.querySelectorAll('svg.callout-arrow');
      const rightArrow = Array.from(arrows).find((arrow) => {
        const className = arrow.className.baseVal || arrow.getAttribute('class') || '';
        return className.includes('group-data-[side=right]/tt');
      });
      expect(rightArrow).not.toBeNull();
    });

    it('ignores side prop for back-compat (side prop is intentionally ignored)', () => {
      const { baseElement: baseElement1 } = render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>
              <span>Trigger</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Content
              <TooltipCalloutArrow side="top" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const { baseElement: baseElement2 } = render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>
              <span>Trigger</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Content
              <TooltipCalloutArrow side="top" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(baseElement1.querySelectorAll('svg.callout-arrow').length).toBeGreaterThanOrEqual(4);
      expect(baseElement2.querySelectorAll('svg.callout-arrow').length).toBeGreaterThanOrEqual(4);
    });
  });
});
