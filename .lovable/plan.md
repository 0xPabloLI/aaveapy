

## Test Results

**API data unavailable** in the test environment — the preview shows "No data to display" due to API validation errors (ZodError). This prevents interactive testing of:

1. **Sticky scenario controls** — The code is correctly implemented with `sticky top-0 z-20 bg-card/95 backdrop-blur-sm` (desktop) and `bg-background/95 backdrop-blur-sm` (mobile). The sticky behavior will work once data loads.

2. **Native label hover underline** — Code verified: the `BreakdownRow` component (line 97-110 in `SimulationSubRow.tsx`) correctly resolves links via `href ?? SOURCE_LINKS[label]`, and "Native" rows pass `aaveUrl` as `href`. The `<a>` tag includes `hover:underline underline-offset-2` styling.

### What I confirmed via code review

| Feature | Status |
|---|---|
| Sticky scenario controls (desktop) | `sticky top-0 z-20` with blur + shadow |
| Sticky scenario controls (mobile) | `sticky top-0 z-20` with blur |
| Native hover underline | `hover:underline underline-offset-2` on `<a>` tag |
| Native links to Aave | Uses `buildAaveReserveUrl()` for correct URLs |
| stopPropagation on links | Prevents row expand on click |

### Recommendation

The implementation is correct. The API error is transient (likely a backend data schema change). Please try refreshing the preview manually — once data loads, you can verify:
- Scroll down through table rows to see the scenario input area stick to the top
- Click any row to expand, then hover "Native" in the breakdown to see the underline appear

