import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedToggleOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string = string> {
  options: SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Custom active text color class (defaults to text-foreground per spec §5.1) */
  activeTextClassName?: string;
  /** Layout orientation (default: horizontal) */
  orientation?: 'horizontal' | 'vertical';
  /** Match height/typography to ds-chip for inline alignment */
  size?: 'default' | 'chip';
}

interface IndicatorStyle {
  width: number;
  height: number;
  transform: string;
}

export function SegmentedToggle<T extends string = string>({
  options,
  value,
  onChange,
  className,
  activeTextClassName = 'text-foreground',
  orientation = 'horizontal',
  size = 'default',
}: SegmentedToggleProps<T>) {
  const isChip = size === 'chip';
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<IndicatorStyle>({
    width: 0,
    height: 0,
    transform: 'translateX(0px) translateY(0px)',
  });
  const isVertical = orientation === 'vertical';

  const updateIndicator = useCallback(() => {
    const activeIndex = options.findIndex((opt) => opt.value === value);
    if (activeIndex === -1) return;

    const activeBtn = buttonRefs.current[activeIndex];
    const track = trackRef.current;
    if (!activeBtn || !track) return;

    const trackRect = track.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    const left = btnRect.left - trackRect.left;
    const top = btnRect.top - trackRect.top;
    setIndicator({
      width: btnRect.width,
      height: btnRect.height,
      transform: isVertical
        ? `translateX(${left}px) translateY(${top}px)`
        : `translateX(${left}px) translateY(${top}px)`,
    });
  }, [value, options, isVertical]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const ro = new ResizeObserver(() => {
      updateIndicator();
    });
    ro.observe(track);
    window.addEventListener('resize', updateIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative inline-grid box-border align-middle bg-muted/60 shadow-inner shadow-black/[0.02]',
        // Vertical uses softer rounded-2xl (matches card aesthetic);
        // horizontal stays as rounded-full (pill).
        isVertical ? 'rounded-2xl' : 'rounded-full',
        isChip
          ? isVertical
            ? 'p-[var(--ds-seg-chip-track-pad)]'
            : 'h-[var(--ds-chip-h)] p-[var(--ds-seg-chip-track-pad)]'
          : isVertical
            ? 'p-[var(--ds-seg-track-pad)]'
            : 'h-[var(--ds-seg-track-h)] p-[var(--ds-seg-track-pad)]',
        'gap-[var(--ds-seg-gap)]',
        className,
      )}
      style={
        isVertical
          ? { gridTemplateRows: `repeat(${options.length}, minmax(0, 1fr))` }
          : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
      }
      role="radiogroup"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          'pointer-events-none absolute bg-card shadow-[0_1px_4px_rgb(var(--ds-shadow-rgb)/0.16),0_1px_2px_rgb(var(--ds-shadow-rgb)/0.10)] motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out',
          // Indicator radius mirrors the track: tighter rounded-xl for
          // vertical (so the pill nests inside the rounded-2xl track),
          // full pill for horizontal.
          isVertical ? 'rounded-xl' : 'rounded-full',
        )}
        style={{
          width: indicator.width,
          height: indicator.height,
          transform: indicator.transform,
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}
        aria-hidden
      />

      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 box-border flex w-full items-center justify-center whitespace-nowrap font-medium leading-none transition-colors duration-200',
              // Match button radius to indicator so focus ring & hover hit areas align.
              isVertical ? 'rounded-xl' : 'rounded-full',
              // In vertical mode allow the button to shrink to track width;
              // horizontal keeps a pill min-width so two segments don't collapse.
              isVertical
                ? isChip
                  ? 'min-w-0 px-[var(--ds-seg-chip-seg-pad-x)] text-[11px] h-full min-h-[var(--ds-chip-h)]'
                  : 'min-w-0 px-[var(--ds-seg-seg-pad-y-pad-x)] text-[12px] h-full min-h-[var(--ds-seg-seg-min-h)]'
                : isChip
                  ? 'min-w-[var(--ds-seg-chip-seg-min-w)] px-[var(--ds-seg-chip-seg-pad-x)] text-[11px] h-full'
                  : 'min-w-[var(--ds-seg-seg-min-w)] px-[var(--ds-seg-seg-pad-x)] text-[12px] h-full',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isActive ? `font-semibold ${activeTextClassName}` : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
