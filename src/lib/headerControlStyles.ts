/**
 * Shared design tokens for header controls (FAQ link, wallet button,
 * theme toggle, clock popover, etc.).
 *
 * Centralizes sizes, spacing, fonts and hover/focus treatment so every
 * control in the header stays visually consistent. Underlying values
 * resolve to CSS variables defined in `src/index.css` (`--ds-control-h`,
 * `--ds-space-*`, `--ds-text-*`) so theming/density changes flow through
 * automatically.
 *
 * See `docs/design/header-controls.md` for token → pixel mapping.
 */

/** Icon size used inside every header control (matches `ds-text-14`). */
export const HEADER_CONTROL_ICON_CLASS = 'w-4 h-4'

/** Smaller icon used for trailing affordances (chevrons, dots, popover items). */
export const HEADER_CONTROL_AFFORDANCE_ICON_CLASS = 'w-3.5 h-3.5'

/** Gap between icon and label inside a header control. */
export const HEADER_CONTROL_INNER_GAP_CLASS = 'gap-[var(--ds-space-1)]'

/**
 * Shared focus ring — `ring-2 ring-ring` with `ring-offset-2 ring-offset-background`,
 * matches the clock popover, ThemeToggle and every other header control.
 */
export const HEADER_CONTROL_FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Mobile circular icon button — used for FAQ, clock popover, wallet,
 * and theme toggle on small viewports. Renders at `--ds-control-h`
 * square with a soft card surface and border.
 */
export const HEADER_CONTROL_MOBILE_CLASS = [
  'flex items-center justify-center',
  'w-[var(--ds-control-h)] h-[var(--ds-control-h)] rounded-full',
  'bg-card/60 border border-border/40 text-muted-foreground',
  'hover:bg-muted/60 hover:border-border',
  'touch-manipulation transition-colors',
  HEADER_CONTROL_FOCUS_RING_CLASS,
].join(' ')

/**
 * Desktop inline text button — used for wallet Connect / View address,
 * FAQ link, and similar header actions. Sized to align with neighbours.
 */
export const HEADER_CONTROL_DESKTOP_CLASS = [
  'flex items-center',
  HEADER_CONTROL_INNER_GAP_CLASS,
  'rounded-md px-[var(--ds-space-2)] py-[var(--ds-space-1)] ds-text-14',
  'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
  'transition-colors',
  HEADER_CONTROL_FOCUS_RING_CLASS,
].join(' ')

/**
 * Desktop variant used when the control reflects an active/connected
 * state — same geometry as the inline button, but foreground-colored.
 */
export const HEADER_CONTROL_DESKTOP_ACTIVE_CLASS = [
  'flex items-center',
  HEADER_CONTROL_INNER_GAP_CLASS,
  'rounded-md px-[var(--ds-space-2)] py-[var(--ds-space-1)] ds-text-14',
  'text-foreground hover:bg-muted/60',
  'transition-colors',
  HEADER_CONTROL_FOCUS_RING_CLASS,
].join(' ')

/** Spacing between sibling header controls (desktop). */
export const HEADER_CONTROL_GROUP_GAP_CLASS = 'gap-[var(--ds-space-1)]'

/** Row inside a header-control popover (Connect / View address / Disconnect). */
export const HEADER_CONTROL_POPOVER_ITEM_CLASS = [
  'w-full flex items-center gap-[var(--ds-space-2)]',
  'rounded-sm px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-11',
  'hover:bg-muted/60',
].join(' ')
