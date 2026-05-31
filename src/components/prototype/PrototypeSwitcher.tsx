/**
 * PROTOTYPE — Variant switcher bar (floating bottom-center).
 * DELETE after prototype decision is captured.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PrototypeSwitcherProps {
  variants: string[];
  current: string;
  variantNames?: Record<string, string>;
  onSwitch: (variant: string) => void;
}

export default function PrototypeSwitcher({ variants, current, variantNames, onSwitch }: PrototypeSwitcherProps) {
  const currentIndex = variants.indexOf(current);

  const cycleLeft = useCallback(() => {
    const next = (currentIndex - 1 + variants.length) % variants.length;
    onSwitch(variants[next]);
  }, [currentIndex, variants, onSwitch]);

  const cycleRight = useCallback(() => {
    const next = (currentIndex + 1) % variants.length;
    onSwitch(variants[next]);
  }, [currentIndex, variants, onSwitch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); cycleLeft(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); cycleRight(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleLeft, cycleRight]);

  const label = variantNames?.[current] ?? '';

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-foreground/90 px-3 py-1.5 shadow-lg select-none">
      <button onClick={cycleLeft} className="p-1 rounded-full hover:bg-white/20 text-background transition-colors" aria-label="Previous variant">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-background ds-text-13 font-medium min-w-[80px] text-center">
        {current}{label ? ` — ${label}` : ''}
      </span>
      <button onClick={cycleRight} className="p-1 rounded-full hover:bg-white/20 text-background transition-colors" aria-label="Next variant">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
