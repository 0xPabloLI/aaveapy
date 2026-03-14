# UI Interaction Patterns

A reusable reference for consistent interaction design across web applications.

## 1. Cursor Types

| Cursor | Tailwind Class | Use Case |
|--------|----------------|----------|
| Arrow (auto) | `cursor-auto` | Auto-show tooltips, static text, non-interactive elements (lets browser decide naturally) |
| Hand (pointer) | `cursor-pointer` | Buttons, links, click-to-show tooltips, any clickable element |
| Not allowed | `cursor-not-allowed` | Disabled buttons, unavailable actions |
| Text selection | `cursor-text` | Editable text fields, selectable content |
| Grab | `cursor-grab` | Draggable items (before drag) |
| Grabbing | `cursor-grabbing` | During drag operation |
| Wait | `cursor-wait` | Loading states (use sparingly) |
| Progress | `cursor-progress` | Background loading (user can still interact) |

### Platform-Specific Overrides

For hybrid components (different behavior on mobile vs desktop):

```tsx
// Mobile: click to show (pointer), Desktop: hover auto-show (auto)
className="cursor-pointer md:cursor-auto"
```

## 2. Tooltip Interaction Patterns

### Auto-Show Tooltips (Hover to Reveal)

- **Trigger**: Mouse hover (desktop) or long-press (mobile)
- **Cursor**: `cursor-auto` (lets browser decide naturally, typically shows arrow)
- **Delay**: 150-300ms (recommended: 200ms) to prevent accidental triggers
- **Hover feedback**: Subtle visual change (scale, background, opacity)

```tsx
// Global delay configuration (Radix UI)
<TooltipProvider delayDuration={200}>
  {children}
</TooltipProvider>

// Trigger element
<div className="cursor-auto hover:bg-muted/70 hover:scale-[1.12] transition-all duration-150">
  {content}
</div>
```

### Click-to-Show Tooltips/Popovers

- **Trigger**: Click/tap
- **Cursor**: `cursor-pointer`
- **Delay**: None (immediate)
- **Hover feedback**: Stronger visual change (ring, deeper background)

```tsx
<button className="cursor-pointer ring-1 hover:ring-2 hover:bg-accent/20 active:scale-95 transition-all">
  {content}
</button>
```

### Hybrid Tooltips (Mobile: Click, Desktop: Hover)

```tsx
const isMobile = useIsMobile();

<button
  onClick={isMobile ? handleToggle : undefined}
  onMouseEnter={!isMobile ? handleOpen : undefined}
  onMouseLeave={!isMobile ? handleClose : undefined}
  className="cursor-pointer md:cursor-auto"
>
  {content}
</button>
```

## 3. Hover Animation Patterns

### Intensity Levels

| Level | Effects | Use Case |
|-------|---------|----------|
| **Subtle** | `hover:opacity-90`, `hover:scale-102` | Text links, passive indicators |
| **Light** | `hover:bg-muted/40`, `hover:scale-105` | Auto-show tooltip triggers |
| **Medium** | `hover:bg-muted/60`, `hover:scale-110` | Icon buttons, small interactive elements |
| **Strong** | `hover:ring-2`, `hover:bg-accent/25`, `active:scale-95` | Primary buttons, click-to-show triggers |

### Recommended Combinations

**Auto-show tooltip trigger:**
```tsx
className="hover:bg-muted/60 hover:scale-110 transition-all duration-150"
```

**Click-to-show badge:**
```tsx
className="ring-1 hover:ring-2 hover:bg-accent/25 active:scale-95 transition-all duration-150"
```

**Icon button:**
```tsx
className="hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
```

### Transition Timing

| Duration | Use Case |
|----------|----------|
| `duration-100` | Micro-interactions (active states) |
| `duration-150` | Hover effects, small elements |
| `duration-200` | Standard interactions |
| `duration-300` | Larger animations, modals |

## 4. Visual Consistency Rules

### Color Inheritance

- **Auxiliary indicators match adjacent text**: Progress rings, status icons placed next to values should use `currentColor` or inherit from parent.
- **Semantic colors override inheritance**: Warning (amber), error (red), success (green) states can diverge from adjacent text to convey status.

```tsx
// Progress ring matches text color
<span className="text-foreground">
  14M/15M
  <ProgressRing color="currentColor" /> {/* Inherits text-foreground */}
</span>

// Warning state overrides
<ProgressRing color={percentage >= 80 ? 'amber-500' : 'currentColor'} />
```

### Size Relationships

| Element | Sizing Rule |
|---------|-------------|
| Inline icons | 0.8-1.0× adjacent text size |
| Progress indicators | 0.8-0.9× adjacent text size |
| Action icons | Match or slightly larger than text |
| Decorative icons | 1.0-1.5× text size |

## 5. Disabled States

### Visual Treatment

```tsx
// Disabled text/value
className="text-muted-foreground cursor-not-allowed"

// Disabled with auto-show explanation tooltip
<Tooltip>
  <TooltipTrigger asChild>
    <span className="text-muted-foreground cursor-auto">
      {value}
    </span>
  </TooltipTrigger>
  <TooltipContent>Feature unavailable</TooltipContent>
</Tooltip>

// Disabled button
className="opacity-50 cursor-not-allowed pointer-events-none"
```

### Cursor for Disabled Elements

| Scenario | Cursor |
|----------|--------|
| Disabled with explanation tooltip | `cursor-auto` (tooltip still works) |
| Disabled with no interaction | `cursor-not-allowed` |
| Visually disabled, prevents click | `pointer-events-none` |

## 6. Loading & Progress States

### Skeleton Loading

```tsx
className="animate-pulse bg-muted rounded"
```

### Progress Indicators

| Type | Use Case |
|------|----------|
| Spinner | Indeterminate, short waits |
| Progress bar | Determinate, file uploads |
| Progress ring | Compact spaces, inline with values |
| Skeleton | Content loading, layout preservation |

## 7. Accessibility Checklist

- [ ] All interactive elements have visible focus states (`focus-visible:ring-2`)
- [ ] Color is not the only indicator of state (add icons, text, patterns)
- [ ] Touch targets are at least 44×44px on mobile
- [ ] Hover states have equivalent focus states for keyboard users
- [ ] Tooltips are accessible via keyboard (focus triggers)
- [ ] Reduced motion preference is respected (`motion-reduce:transition-none`)

```tsx
// Focus-visible for keyboard navigation only
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Respect reduced motion
className="transition-all motion-reduce:transition-none"
```

## 8. Dark Mode Considerations

- Test all hover effects in both light and dark modes
- Ensure sufficient contrast for disabled states
- Background hover colors may need different opacities per theme

```tsx
// Theme-aware hover
className="hover:bg-muted/60 dark:hover:bg-muted/40"
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ TOOLTIP TYPE        │ CURSOR          │ DELAY  │ HOVER │
├─────────────────────┼─────────────────┼────────┼───────┤
│ Auto-show (hover)   │ cursor-auto     │ 200ms  │ Light │
│ Click-to-show       │ cursor-pointer  │ 0ms    │ Strong│
│ Hybrid (mobile/dt)  │ pointer→auto    │ varies │ Medium│
│ Disabled + tooltip  │ cursor-auto     │ 200ms  │ None  │
└─────────────────────────────────────────────────────────┘
```
