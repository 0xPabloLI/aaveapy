import { cn } from '@/lib/utils';

export type DsInputSurfaceVariant = 'neutral' | 'supply' | 'borrow';

const neutralFocus =
  'focus-visible:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.25)]';
const supplyFocus =
  'focus:!border-emerald-600 focus:bg-card focus:text-foreground focus-visible:!ring-emerald-500/30';
const borrowFocus =
  'focus:!border-[rgb(var(--ds-brand-cyan-rgb))] focus:bg-card focus:text-foreground focus-visible:!ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]';

/**
 * Text inputs: **empty** → transparent fill, border only; **has value** → fill is the same color
 * family as the border (low-opacity tint of `border` / emerald / brand cyan).
 * Use with controlled `value` + `hasValue === value.trim() !== ''`.
 */
export function cnDsInputSurface(hasValue: boolean, variant: DsInputSurfaceVariant = 'neutral'): string {
  const shell =
    'rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-0';

  if (variant === 'neutral') {
    return cn(
      shell,
      hasValue
        ? cn('border-border/80 bg-border/[0.14] text-foreground', neutralFocus)
        : cn(
            'border-border/60 !bg-transparent text-muted-foreground/90 placeholder:text-muted-foreground/40',
            neutralFocus,
          ),
    );
  }

  if (variant === 'supply') {
    return cn(
      shell,
      hasValue
        ? cn('border-emerald-500/75 ds-bg-emerald-500-10 text-foreground', supplyFocus)
        : cn(
            'border-emerald-500/45 !bg-transparent text-muted-foreground/90 placeholder:text-muted-foreground/40',
            supplyFocus,
          ),
    );
  }

  return cn(
    shell,
    hasValue
      ? cn(
          'border-[rgb(var(--ds-brand-cyan-rgb)/0.72)] ds-bg-brand-cyan-10 text-foreground',
          borrowFocus,
        )
      : cn(
          'border-[rgb(var(--ds-brand-cyan-rgb)/0.45)] !bg-transparent text-muted-foreground/90 placeholder:text-muted-foreground/40',
          borrowFocus,
        ),
  );
}

/**
 * Neutral rounded shell around an inline input (e.g. FDV chip): same empty / filled rule as
 * {@link cnDsInputSurface} neutral variant.
 */
export function cnDsInputNeutralWell(hasValue: boolean): string {
  return cn(
    'rounded-md border transition-colors',
    hasValue ? 'border-border/80 bg-border/[0.14]' : 'border-border/60 bg-transparent',
  );
}
