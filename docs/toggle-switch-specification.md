# Toggle & Switch UI Specification

## Overview

This document defines the unified patterns for toggle/switch controls across the application. All new implementations should follow these patterns for consistency.

## Toggle Pattern Types

### 1. Segmented Control (Binary/Multi-option Toggle)

Use for switching between 2-3 mutually exclusive modes/options.

**Examples:** APR/APY toggle, USD/Token mode toggle

**Styling Spec:**

```css
/* Container */
.segmented-container {
  display: flex;
  align-items: center;
  gap: 0.125rem;           /* gap-0.5 */
  background: bg-muted/60;
  border-radius: 0.5rem;   /* rounded-lg */
  padding: 0.125rem;       /* p-0.5 */
  border: 1px solid border-border/40;
}

/* Selected Option */
.segmented-option-selected {
  background: bg-card;
  color: text-foreground;  /* or ds-text-emerald-600 for emphasis */
  box-shadow: shadow-sm;
  border: 1px solid border-border/60;
  border-radius: 0.375rem; /* rounded-md */
}

/* Unselected Option */
.segmented-option-unselected {
  background: transparent;
  color: text-muted-foreground;
  border-radius: 0.375rem;
}

/* Unselected Hover */
.segmented-option-unselected:hover {
  color: text-foreground;
  background: bg-card/50;
}
```

**Tailwind Classes:**

```tsx
// Container
className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40"

// Selected
className="px-3 py-1 rounded-md ds-text-12 font-semibold bg-card text-foreground shadow-sm border border-border/60"

// Unselected  
className="px-3 py-1 rounded-md ds-text-12 font-semibold text-muted-foreground hover:text-foreground hover:bg-card/50"
```

---

### 2. Filter Chips (Single-select Category)

Use for filtering content by a single category selection.

**Examples:** Token category filter (All, Stables, ETH, BTC, Pendle)

**Styling Spec:**

```tsx
// Selected
className="inline-flex items-center justify-center h-7 px-2 rounded-md ds-text-11 font-medium bg-card text-foreground shadow-sm border border-border/60"

// Unselected
className="inline-flex items-center justify-center h-7 px-2 rounded-md ds-text-11 font-medium bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/40"
```

**Key Characteristics:**
- Subtle background differentiation
- No brand color for selection (uses neutral `bg-card`)
- Consistent with other controls (form inputs, buttons)

---

### 3. Multi-select Chips (Markets)

Use for selecting multiple items from a set.

**Examples:** Market filter chips

**Styling Spec:**

```tsx
// Selected (with brand accent for multi-select clarity)
className="ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm"

// Unselected
className="ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium text-foreground/80 border border-border hover:text-foreground"
```

**Key Characteristics:**
- Brand color accent helps distinguish "multiple selected" state
- Border-only approach keeps visual weight low

---

### 4. Icon Toggle Button

Use for binary state toggles with icon representation.

**Examples:** Theme toggle (light/dark)

**Styling Spec:**

```tsx
className="relative h-9 w-9 rounded-full text-interactive transition-colors duration-200 
  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

**Key Characteristics:**
- Icon changes to represent state (Sun/Moon)
- Circular shape for distinction from action buttons
- Uses tooltip for state clarification

---

## Background Color Transition Summary

| Component Type | Unselected | Selected | Hover (Unselected) |
|---------------|------------|----------|-------------------|
| Segmented Control | transparent | `bg-card` | `bg-card/50` |
| Filter Chip (Single) | `bg-card/50` | `bg-card` | `bg-card/80` |
| Filter Chip (Multi) | transparent | border only | `bg-muted/40` |
| Icon Button | `bg-muted/60` | N/A | `bg-muted/80` |

---

## Typography

| Component | Font Size | Font Weight |
|-----------|-----------|-------------|
| Segmented Control | `ds-text-12` | semibold (600) |
| Filter Chips | `ds-text-11` | medium (500) |
| Icon Toggle | N/A (icon only) | N/A |

---

## Component Locations

- `AprApyToggle.tsx` - Segmented control reference implementation
- `FilterBar.tsx` - Chip filters reference
- `ScenarioControls.tsx` - Segmented control for USD/Token mode
- `ThemeToggle.tsx` - Icon toggle reference

---

## Migration Notes

When updating existing toggles:

1. **ScenarioControls USD/Token** - Should use segmented control pattern (not single button)
2. **FilterBar categories** - Already updated to subtle `bg-card` selection
3. **FilterBar markets** - Keep brand color for multi-select clarity
