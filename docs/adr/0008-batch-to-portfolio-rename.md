# ADR-008: Batch → Portfolio Terminology Rename

## Status

Accepted

## Context

The UI used "Batch" as the user-facing term for multi-reserve simulation mode (e.g. "Batch" toggle label, "Build your batch portfolio" empty state). Internally, the code already used `Portfolio*` naming (SimulationMode = `'single' | 'portfolio'`, PortfolioPanel, PortfolioTokenRow, etc.). This mismatch between UI text and code naming was confusing and inconsistent with DeFi ecosystem conventions where "portfolio" is the standard term for aggregate multi-asset positions.

## Decision

Rename all remaining "Batch" references to "Portfolio" across:

1. **UI text**: toggle labels, empty states, toast messages, aria-labels
2. **Code exports**: `BATCH_THEME` → `PORTFOLIO_THEME`, `BATCH_RESERVE_ADD_BUTTON_CLASSES` → `PORTFOLIO_RESERVE_ADD_BUTTON_CLASSES`
3. **File names**: `batchTheme.ts` → `portfolioTheme.ts`, e2e `portfolio-batch-mobile-spacing.spec.ts` → `portfolio-mobile-spacing.spec.ts`
4. **Comments/test descriptions**: all inline comments and `describe`/`it` names
5. **Documentation**: ADR-0005 title, CONTEXT.md terminology, docs/design/\*, docs/conventions/\*, docs/rate-calculation.md, docs/plans/

### Excluded (not renamed)

- `rpcResilience.ts` viem `batch: { multicell }` — RPC batching, different domain
- `seoApi.ts` / `useSeoData.ts` Semrush batch API — external API parameter, not our terminology
- `docs/TERMINOLOGY.md` "forecast batch cache" — React Query module caching/deduplication, technical term
- `docs/conventions/commit-cadence.md` "攒 batch" — colloquial metaphor for batching commits, not user-facing

## Consequences

### Positive
- Terminology consistent across code, UI, and documentation
- Aligned with DeFi ecosystem convention ("portfolio" for multi-asset positions)
- No semantic change — purely a rename with zero behavior impact

### Negative
- None — this is a surface-level rename with no architectural impact

## Related Issues

AAV-466
