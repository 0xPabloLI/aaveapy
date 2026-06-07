/**
 * Centralized Portfolio mode brand tokens.
 * Update these classes to retheme portfolio-related UI consistently.
 */
export const PORTFOLIO_THEME = {
  text: 'ds-text-blue-500',
  textMuted: 'text-[rgb(var(--ds-blue-500-rgb)/0.7)]',
  bgSoft: 'ds-bg-blue-500-10',
  bgSubtle: 'bg-[rgb(var(--ds-blue-500-rgb)/0.05)]',
  border: 'border-[rgb(var(--ds-blue-500-rgb)/0.4)]',
  ringSoft: 'ring-[rgb(var(--ds-blue-500-rgb)/0.2)]',
  switchCheckedBg: 'data-[state=checked]:!bg-[rgb(var(--ds-blue-500-rgb))]',
  /** Trash / Remove button hover — stays in the portfolio brand palette. */
  trashHoverText: 'hover:ds-text-blue-500',
  trashHoverBg: 'hover:ds-bg-blue-500-10',
} as const;

export const PORTFOLIO_RESERVE_ADD_BUTTON_CLASSES = {
  selected: `${PORTFOLIO_THEME.bgSoft} ${PORTFOLIO_THEME.border} ${PORTFOLIO_THEME.text}`,
  unselected: `border-border/60 text-muted-foreground/40 hover:${PORTFOLIO_THEME.border} hover:${PORTFOLIO_THEME.text}`,
} as const;
