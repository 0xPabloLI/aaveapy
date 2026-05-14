# Reserve Table Market/Hub Filtering

This note records the current filtering architecture around the reserves table and the recommended path for adding row-level hub filtering.

## Current structure

- Page-level filter state lives in `src/pages/Index.tsx`.
- Current active filters:
  - `searchQuery`
  - `selectedMarkets`
  - `selectedCategory`
- `filteredReserves` is derived once in `Index.tsx` and passed down to `ReservesTable`.
- `ReservesTable` does not own the filter model. It only:
  - renders filtered rows
  - keeps expanded-row state stable during filter changes
  - pins the clicked row back into view after a filter narrows the list
- Desktop market-chip click already follows the right direction:
  - row emits click intent
  - table preserves expansion / pin behavior
  - page updates filter state

## Existing hub data

Reserve items already expose:

- `hubId`
- `hubName`
- `hubAddress`

That means the feature does not need backend changes if the requirement is "click hub and keep only reserves from the same hub".

## Recommended implementation shape

Use a separate hub filter state instead of overloading `selectedMarkets`.

Recommended page state additions:

- `selectedHubIds: string[]` (stores `hubId`, not `hubName`)

Recommended filtering behavior in `Index.tsx`:

- Search remains first
- Market filter remains independent
- Hub filter is applied after market filter
- Category filter remains last

Hub matching should use `hubId` as the canonical key, not `hubName`, because:

- names are presentation-level
- ids are more stable
- duplicate names across future markets are less risky

**Implementation status**: `selectedHubs` in `Index.tsx` now stores `hubId` values. The `onSelectHub` callback receives `hubId`. The `FilterBar` receives `hubEntries: {id, name}[]` and uses `id` for selection logic while displaying `name`. Hub badge click guards require both `hubId` and `hubName` to be present before rendering the filterable button.

## UI options

### Option A: minimal change

- Make the hub badge in desktop/mobile rows clickable
- Clicking the badge toggles `selectedHubIds` to `[reserve.hubId]`
- Clicking the same hub again clears the hub filter
- No new top-level hub chips in `FilterBar`

Pros:

- smallest code surface
- preserves current page layout
- low regression risk

Cons:

- active hub filter is less discoverable
- clearing state depends on clicking the same row badge again or another reset path
- on mobile, the badge area is too tight and conflicts with the direct external-jump affordance

### Option B: recommended balanced version

- Same row-level clickable hub badge
- Add visible active hub chip(s) near the existing market filters
- Allow clearing from the filter bar

Pros:

- keeps the row-click flow intuitive
- active hub state is explicit
- easier to combine with existing market filters

Cons:

- touches `FilterBar`
- slightly larger test surface

### Option D: split desktop and mobile behavior

- Desktop hub badge is clickable for filtering
- Mobile hub badge remains primarily an external link to Aave hub page
- Mobile filtering is exposed somewhere with more room:
  - filter bar chip
  - row action menu
  - long-press / secondary action is not recommended for discoverability

Pros:

- preserves the strongest mobile user intent: direct navigation
- avoids turning a tiny badge into a mixed filter + link control
- lower accidental-tap risk

Cons:

- desktop and mobile behavior diverge
- requires a separate mobile-visible filter affordance

### Option C: unify row filters

- Introduce a generic row-filter intent model for both market and hub clicks
- Rename table-local "market filter pin" logic to generic "row filter pin"

Pros:

- cleaner semantics
- easier future extension if chain/protocol/version row filters are added

Cons:

- more refactor than feature work

## Recommended scope for first pass

Implement a hybrid of Option B and Option D:

- add `selectedHubIds` in `Index.tsx`
- add one new page callback `onSelectHub`
- keep market and hub states separate
- generalize the table's local "market chip click" pinning helper into a filter-agnostic helper
- keep matching canonical on `hubId`
- if a row has no `hubId`, do not make the badge filterable
- desktop: hub badge can trigger filtering
- mobile: hub badge should stay a direct external link when a hub URL exists
- mobile hub filtering should be triggered from a roomier surface, preferably the filter bar once a hub is chosen from desktop or from an explicit mobile filter affordance

## Files likely touched

- `src/pages/Index.tsx`
- `src/components/dashboard/ReservesTable.tsx`
- `src/components/dashboard/DesktopReserveRow.tsx`
- `src/components/dashboard/MobileReserveCard.tsx`
- `src/components/dashboard/FilterBar.tsx`
- related row/filter tests

## Risks

- `hubName` is visible on the row, but filtering must still key off `hubId`
- rows without `hubId` / `hubName` need a non-interactive fallback
- mobile space is constrained, so forcing identical behavior across desktop/mobile may reduce usability
- current table pinning logic is named around "market"; if left unchanged, the feature will work but the code will become misleading

## Mobile-specific decision

Given current card density, mobile should not overload the tiny hub badge with both of these jobs:

- filter same-hub reserves
- open the Aave hub page

Recommendation:

- keep the existing mobile hub badge as the outbound link
- make hub filter state visible and clearable in the filter bar
- if mobile needs row-originated hub filtering later, add it via a larger explicit control (for example a compact "Filter hub" action in `AssetActionMenu`), not by shrinking the existing link badge into a dual-purpose target

## Suggested implementation order

1. Add `selectedHubIds` and filtering in `Index.tsx`
2. Add `onSelectHub` plumbing from page to row components
3. Make desktop hub badge clickable
4. Make mobile hub badge clickable
5. Expose active hub state in `FilterBar`
6. Rename table-local pinning helpers from market-specific naming to filter-generic naming
7. Add regression tests for market filter + hub filter + repeated toggle
