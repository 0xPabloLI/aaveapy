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
  /** Custom active text color class (defaults to ds-text-emerald-600) */
  activeTextClassName?: string;
  /** Layout orientation (default: horizontal) */
  orientation?: 'horizontal' | 'vertical';
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
  activeTextClassName = 'ds-text-emerald-600',
  orientation = 'horizontal',
}: SegmentedToggleProps<T>) {
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
        'relative inline-flex rounded-lg bg-muted/60 p-0.5',
        isVertical ? 'flex-col gap-0.5' : 'items-center gap-0.5',
        className,
      )}
    >
      {/* Sliding indicator */}
      <div
        className="absolute rounded-md bg-card shadow-sm border border-border/40 pointer-events-none motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
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
              'relative z-10 flex items-center justify-center rounded-md ds-text-12 font-medium transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isVertical ? 'flex-1 px-3 py-0.5' : 'px-3 h-[1.5rem]',
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
