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
        'relative inline-grid box-border align-middle rounded-full bg-muted/60 shadow-inner shadow-black/[0.02]',
        isChip ? 'h-[var(--ds-chip-h)] p-[2px]' : isVertical ? 'p-[3px]' : 'h-8 p-[3px]',
        'gap-0.5',
        className,
      )}
      style={
        isVertical
          ? { gridTemplateRows: `repeat(${options.length}, minmax(0, 1fr))` }
          : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
      }
    >
      {/* Sliding indicator */}
      <div
        className="pointer-events-none absolute rounded-full bg-card shadow-[0_1px_4px_rgb(var(--ds-shadow-rgb)/0.16),0_1px_2px_rgb(var(--ds-shadow-rgb)/0.10)] motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
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
              'relative z-10 box-border flex w-full items-center justify-center whitespace-nowrap rounded-full font-medium leading-none transition-colors duration-200',
              isChip ? 'min-w-[42px] px-2 text-[11px]' : 'min-w-[56px] px-3 text-[12px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isVertical ? 'h-full min-h-[28px]' : 'h-full',
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
