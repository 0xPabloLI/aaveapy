export const getApyColorClass = (value: number | null) => {
  if (value === null) return 'text-muted-foreground';
  if (value >= 15) return 'ds-text-emerald-600';
  if (value >= 10) return 'ds-text-emerald-500';
  if (value >= 5) return 'ds-text-teal-500-70';
  if (value >= 2) return 'ds-text-teal-400-70';
  if (value >= 1) return 'ds-text-cyan-500-70';
  return 'text-muted-foreground/70';
};

export const getApyAccentClasses = (value: number | null) => {
  if (value === null) {
    return {
      text: 'text-muted-foreground',
      chip: 'bg-muted text-muted-foreground/70 ring-border/70 hover:bg-muted/80',
    };
  }
  if (value >= 15) {
    return {
      text: 'ds-text-emerald-600-70',
      chip: 'ds-bg-emerald-500-10 ds-text-emerald-600-70 ds-ring-emerald-500-15 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.2)]',
    };
  }
  if (value >= 10) {
    return {
      text: 'ds-text-emerald-500-70',
      chip: 'ds-bg-emerald-500-10 ds-text-emerald-500-70 ds-ring-emerald-500-15 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.2)]',
    };
  }
  if (value >= 5) {
    return {
      text: 'ds-text-teal-500-70',
      chip: 'ds-bg-teal-500-10 ds-text-teal-500-70 ds-ring-teal-500-15 hover:bg-[rgb(var(--ds-teal-500-rgb)/0.2)]',
    };
  }
  if (value >= 2) {
    return {
      text: 'ds-text-teal-400-70',
      chip: 'ds-bg-teal-400-10 ds-text-teal-400-70 ds-ring-teal-400-15 hover:bg-[rgb(var(--ds-teal-400-rgb)/0.2)]',
    };
  }
  return {
    text: 'ds-text-cyan-500-70',
    chip: 'ds-bg-cyan-500-10 ds-text-cyan-500-70 ds-ring-cyan-500-15 hover:bg-[rgb(var(--ds-cyan-500-rgb)/0.2)]',
  };
};

export const getAccentBorderClass = (value: number | null) => {
  if (value === null) return 'border-l-[4px] border-l-border/60';
  if (value >= 15) return 'border-l-[4px] border-l-[rgb(var(--ds-emerald-600-rgb)/0.7)]';
  if (value >= 10) return 'border-l-[4px] border-l-[rgb(var(--ds-emerald-500-rgb)/0.7)]';
  if (value >= 5) return 'border-l-[4px] border-l-[rgb(var(--ds-teal-500-rgb)/0.7)]';
  if (value >= 2) return 'border-l-[4px] border-l-[rgb(var(--ds-teal-400-rgb)/0.7)]';
  if (value >= 1) return 'border-l-[4px] border-l-[rgb(var(--ds-cyan-500-rgb)/0.7)]';
  return 'border-l-[4px] border-l-[rgb(var(--ds-cyan-500-rgb)/0.5)]';
};

export const getAccentTextClass = (value: number | null) => {
  if (value === null) return 'text-muted-foreground';
  if (value >= 15) return 'ds-text-emerald-600';
  if (value >= 10) return 'ds-text-emerald-500';
  if (value >= 5) return 'ds-text-teal-500-70';
  if (value >= 2) return 'ds-text-teal-400-70';
  return 'ds-text-cyan-500-70';
};

export const getAccentBgClass = (value: number | null) => {
  if (value === null) return 'bg-muted/40';
  if (value >= 10) return 'ds-bg-emerald-500-10';
  if (value >= 5) return 'ds-bg-teal-500-10';
  if (value >= 2) return 'ds-bg-teal-400-10';
  return 'ds-bg-cyan-500-10';
};

export const getSpreadColorClass = (value: number | null, index: number = 0, total: number = 5) => {
  if (value === null) return 'text-muted-foreground';
  const intensity = 1 - (index / Math.max(total - 1, 1));

  if (intensity >= 0.8) {
    return 'bg-gradient-to-r from-purple-700 via-purple-600 to-purple-600 text-transparent bg-clip-text';
  }
  if (intensity >= 0.6) {
    return 'bg-gradient-to-r from-purple-600 via-purple-500 to-fuchsia-500 text-transparent bg-clip-text';
  }
  if (intensity >= 0.4) {
    return 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-fuchsia-500 text-transparent bg-clip-text';
  }
  if (intensity >= 0.2) {
    return 'bg-gradient-to-r from-fuchsia-500 via-fuchsia-400 to-pink-500 text-transparent bg-clip-text';
  }
  return 'bg-gradient-to-r from-fuchsia-400 via-pink-400 to-pink-400 text-transparent bg-clip-text';
};

export const getSpreadAccentClass = (value: number | null, index: number = 0, total: number = 5) => {
  if (value === null) return 'text-muted-foreground';
  const intensity = 1 - (index / Math.max(total - 1, 1));
  if (intensity >= 0.8) return 'ds-text-purple-600-70';
  if (intensity >= 0.6) return 'ds-text-purple-500-70';
  if (intensity >= 0.4) return 'text-fuchsia-500/70';
  if (intensity >= 0.2) return 'text-fuchsia-400/70';
  return 'ds-text-pink-400-70';
};
