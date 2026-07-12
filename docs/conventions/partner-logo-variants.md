# Partner Logo Dark/Light Variants

Partner incentive logos (Merkl, ACI, Brevis, Tydro, etc.) use a **dual-variant** pattern for dark/light theme visibility.

## File Naming

| Variant | Suffix | Use When |
| --- | --- | --- |
| Light background | `-black.svg` | `resolvedTheme !== 'dark'` |
| Dark background | `-white.svg` | `resolvedTheme === 'dark'` |

## Rendering Pattern

Follow `IncentiveTooltip.tsx` as reference:

```tsx
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';
const src = isDark
  ? '/icons/partners/tydro-white.svg'
  : '/icons/partners/tydro-black.svg';
```

## SVG Fill Rules (Critical)

### Black variant (`-black.svg`)

**Never** put `fill="none"` on root `<svg>` unless **every** child `<path>` has an explicit `fill` attribute. Otherwise paths inherit `none` → invisible on light backgrounds.

| Pattern | Example | Correct? |
| --- | --- | --- |
| No `fill` on root, no `fill` on path | `merkl-black.svg`, `aci-black.svg` | ✅ Inherits default `fill="black"` |
| `fill="none"` on root, explicit `fill` on path | `brevis-black.svg` (`fill="#2B303B"`) | ✅ Explicit fill wins |
| `fill="none"` on root, **no** `fill` on path | ~~`tydro-black.svg` (broken)~~ | ❌ Inherits `none` → invisible |

**Prefer the simpler pattern**: omit `fill` on root entirely.

### White variant (`-white.svg`)

Root `fill="none"` is fine **if** paths have explicit `fill` (e.g. `fill="#F8F6F1"`). This is the Figma-export default and works correctly.

## Icon-only vs Wordmark

When a partner logo has a recognizable icon shape (circle, glyph), prefer **icon-only** SVGs over wordmarks (icon + text). This:
- Keeps visual consistency with circular token icons
- Avoids tiny unreadable text at small sizes
- Simplifies SVG structure (single path)

To convert wordmark → icon-only: remove text `<path>` elements, adjust `viewBox` to the icon bounding box.

## Related

- Issue: [AAV-634](https://linear.app/aaveapy/issue/AAV-634/tydro-logo-invisible-on-light-theme-fillnone-root-element-pattern)
- Reference implementation: `src/components/dashboard/IncentiveTooltip.tsx`
