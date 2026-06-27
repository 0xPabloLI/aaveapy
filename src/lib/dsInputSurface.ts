import { cn } from '@/lib/utils';

export type DsInputSurfaceVariant = 'neutral' | 'supply' | 'borrow' | 'magenta';

const neutralFocus =
  'focus-visible:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.25)]';

/** Supply / Borrow / Search (filled): card surface while focused; lane border + ring (tint shows after blur). */
function cnDsLaneFocusOverlay(focusBorder: string, focusVisibleRing: string): string {
  return cn('focus:!bg-card focus:text-foreground', focusBorder, focusVisibleRing);
}

const supplyFocus = cnDsLaneFocusOverlay(
  'focus:!border-emerald-600',
  'focus-visible:!ring-emerald-500/30',
);
const borrowFocus = cnDsLaneFocusOverlay(
  'focus:!border-[rgb(var(--ds-brand-cyan-rgb))]',
  'focus-visible:!ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]',
);

const emptyNeutralBorder =
  'border-border/60 !bg-transparent text-muted-foreground/90 placeholder:text-muted-foreground/40';

/** Same `--border` token as `border-border/*`; theme stores space-separated HSL components. */
const neutralFilledSurface =
  'border-border/80 !bg-[hsl(var(--border)/0.22)] text-foreground';

/** Filter search: **filled** border + fill use the same RGB token; while **focused**, match scenario inputs (`focus:bg-card`). */
const magentaFilledSurface =
  'border-[rgb(var(--ds-brand-magenta-rgb)/0.72)] ds-bg-brand-magenta-10 text-foreground';

const magentaFilledFocus = cnDsLaneFocusOverlay(
  'focus:!border-[rgb(var(--ds-brand-magenta-rgb))]',
  'focus-visible:!ring-[rgb(var(--ds-brand-magenta-rgb)/0.25)]',
);

/**
 * Text inputs: **empty** → no fill, **neutral** border (`border-border/…`); no supply/borrow **hue** on
 * the border until there is a value. **Has value** → neutral uses `border` tint; **magenta** (search token)
 * uses brand magenta border + `ds-bg-brand-magenta-10` (tint shows once **blurred**, like supply/borrow);
 * supply/borrow keep lane tints with the same focus rule.
 * Use with controlled `value` + `hasValue === value.trim() !== ''`.
 */
export function cnDsInputSurface(hasValue: boolean, variant: DsInputSurfaceVariant = 'neutral'): string {
  const shell =
    'rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-0';

  if (variant === 'neutral') {
    return cn(
      shell,
      hasValue
        ? cn(neutralFilledSurface, neutralFocus)
        : cn(emptyNeutralBorder, neutralFocus),
    );
  }

  if (variant === 'magenta') {
    return cn(
      shell,
      hasValue
        ? cn(magentaFilledSurface, magentaFilledFocus)
        : cn(emptyNeutralBorder, neutralFocus),
    );
  }

  if (variant === 'supply') {
    return cn(
      shell,
      hasValue
        ? cn('border-emerald-500/75 ds-bg-emerald-500-10 text-foreground', supplyFocus)
        : cn(emptyNeutralBorder, supplyFocus),
    );
  }

  return cn(
    shell,
    hasValue
      ? cn(
          'border-[rgb(var(--ds-brand-cyan-rgb)/0.72)] ds-bg-brand-cyan-10 text-foreground',
          borrowFocus,
        )
      : cn(emptyNeutralBorder, borrowFocus),
  );
}

/**
 * Neutral rounded shell around an inline input (e.g. FDV chip): same empty / filled rule as
 * {@link cnDsInputSurface} neutral variant.
 */
export function cnDsInputNeutralWell(hasValue: boolean): string {
  return cn(
    'rounded-md border outline-none transition-colors',
    'focus-within:border-[rgb(var(--ds-brand-magenta-rgb))] focus-within:ring-2 focus-within:ring-[rgb(var(--ds-brand-magenta-rgb)/0.25)] focus-within:ring-offset-0',
    hasValue ? 'border-border/80 bg-[hsl(var(--border)/0.22)]' : 'border-border/60 bg-transparent',
  );
}
