/**
 * Centralized Batch mode brand tokens.
 * Update these classes to retheme batch-related UI consistently.
 */
export const BATCH_THEME = {
  text: 'ds-text-blue-500',
  textMuted: 'text-[rgb(var(--ds-blue-500-rgb)/0.7)]',
  bgSoft: 'ds-bg-blue-500-10',
  bgSubtle: 'bg-[rgb(var(--ds-blue-500-rgb)/0.05)]',
  border: 'border-[rgb(var(--ds-blue-500-rgb)/0.4)]',
  ringSoft: 'ring-[rgb(var(--ds-blue-500-rgb)/0.2)]',
  switchCheckedBg: 'data-[state=checked]:!bg-[rgb(var(--ds-blue-500-rgb))]',
} as const;

export const BATCH_RESERVE_ADD_BUTTON_CLASSES = {
  selected: `${BATCH_THEME.bgSoft} ${BATCH_THEME.border} ${BATCH_THEME.text}`,
  unselected: `border-border/60 text-muted-foreground/40 hover:${BATCH_THEME.border} hover:${BATCH_THEME.text}`,
} as const;
