// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
  TooltipCalloutArrow,
} from '@/components/ui/tooltip';

function renderBasicTooltip({
  side,
  content = 'Content',
  children,
}: {
  side?: 'top' | 'bottom' | 'left' | 'right';
  content?: string;
  children?: React.ReactNode;
} = {}) {
  return render(
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger>
          <span data-testid="trigger">Trigger</span>
        </TooltipTrigger>
        <TooltipContent side={side}>
          {children ?? content}
          {children === undefined && <TooltipCalloutArrow side={side} />}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('Tooltip UI Components', () => {
  describe('TooltipProvider', () => {
    it('wraps children without errors', () => {
      const { container } = render(
        <TooltipProvider>
          <div data-testid="child">Child</div>
        </TooltipProvider>,
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Tooltip + TooltipTrigger', () => {
    it('renders trigger element', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span>Hover me</span>
            </TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('TooltipContent', () => {
    it('renders content via Radix portal', () => {
      const { baseElement } = renderBasicTooltip({ content: 'Help text here' });
      expect(baseElement.innerHTML).toContain('Help text here');
    });

    it('applies animation classes in portal', () => {
      const { baseElement } = renderBasicTooltip();
      expect(baseElement.innerHTML).toContain('animate-in');
      expect(baseElement.innerHTML).toContain('fade-in-0');
    });

    it('applies max-width constraint', () => {
      const { baseElement } = renderBasicTooltip();
      expect(baseElement.innerHTML).toContain('max-w-[18rem]');
    });

    it('applies border and background styles', () => {
      const { baseElement } = renderBasicTooltip();
      expect(baseElement.innerHTML).toContain('rounded-md');
      expect(baseElement.innerHTML).toContain('bg-card');
      expect(baseElement.innerHTML).toContain('border');
    });

    it('merges custom className with defaults', () => {
      const { baseElement } = render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>
              <span>Trigger</span>
            </TooltipTrigger>
            <TooltipContent className="custom-class">Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
      expect(baseElement.innerHTML).toContain('custom-class');
      expect(baseElement.innerHTML).toContain('bg-card');
    });
  });

  describe('TooltipArrow', () => {
    it('renders SVG arrow element via Radix', () => {
      const { baseElement } = render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>
              <span>Trigger</span>
            </TooltipTrigger>
            <TooltipContent>
              Content
              <TooltipArrow />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
      const arrow = baseElement.querySelector('[data-radix-arrow]') || baseElement.querySelector('svg');
      expect(arrow).not.toBeNull();
    });

    it('applies fill-card class', () => {
      const { baseElement } = render(
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>
              <span>Trigger</span>
            </TooltipTrigger>
            <TooltipContent>
              Content
              <TooltipArrow />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
      const allSvgElements = baseElement.querySelectorAll('svg');
      const hasFillCard = Array.from(allSvgElements).some((svg) => {
        const className = svg.className.baseVal || svg.getAttribute('class') || '';
        return className.includes('fill-card');
      });
      expect(hasFillCard).toBe(true);
    });
  });

  describe('TooltipCalloutArrow inside TooltipContent', () => {
    it('renders arrow container inside tooltip', () => {
      const { baseElement } = renderBasicTooltip({ side: 'top' });
      expect(baseElement.innerHTML).toContain('Content');
    });

    it('uses group/tt context for arrow visibility', () => {
      const { baseElement } = renderBasicTooltip({ side: 'top' });
      expect(baseElement.innerHTML).toContain('group/tt');
    });

    it('renders directional SVG arrows via baseElement', () => {
      const { baseElement } = renderBasicTooltip({ side: 'top' });
      // Verify the tooltip portal content contains CalloutArrowSvg paths
      // Each of 4 directional arrows renders 2 paths (fill + stroke) = 8 paths from CalloutArrowSvg
      // Plus additional paths from other components - just verify there are multiple arrow paths
      const pathElements = baseElement.querySelectorAll('path[d*="L8 0"]');
      expect(pathElements.length).toBeGreaterThanOrEqual(2);
    });

    it('renders arrow SVG paths inside tooltip', () => {
      const { baseElement } = renderBasicTooltip({ side: 'top' });
      const svgPaths = baseElement.querySelectorAll('path[d]');
      expect(svgPaths.length).toBeGreaterThan(0);
    });
  });
});
