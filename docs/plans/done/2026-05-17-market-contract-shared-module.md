# Market-Contract Shared Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the `/markets` zod contract and Node script validation into `src/shared/market-contract/`, so frontend runtime, OpenAPI generation, and selected scripts use the same schema.

**Architecture:** Phase 1 only. Move markets schemas into a browser/Node-safe shared module, keep `src/lib/apiSchemas.ts` as the frontend-compatible public export, and add a Node script bridge for strict `/markets` validation. Do not unify frontend cache fallback with script retry semantics in this pass.

**Tech Stack:** TypeScript, zod, Vite, Vitest, Node ESM with `--experimental-strip-types`.

---

## Decisions

- Use relative `.ts` specifiers for any module executed by Node `--experimental-strip-types`; do not use `@/` aliases there.
- Keep frontend behavior unchanged: `fetchMarkets` still owns cache fallback and `sanitizeDeficitWithoutPrice`.
- Keep script behavior strict: schema mismatch should fail scripts instead of silently accepting fallback shapes like `{ data: [] }`.
- Touch only `/markets` consumers with real reserve parsing: `sync-token-icons`, `sync-coingecko-platform-map`, and `check-coingecko-platform-map-upstream`.
- Leave lower-ROI fetch/core unification as future work.

---

## Task 1: Create Shared Markets Schema Module

**Files:**
- Create: `src/shared/market-contract/schemas.ts`
- Create: `src/shared/market-contract/index.ts`

**Steps:**

1. Copy the markets-related schemas from `src/lib/apiSchemas.ts` into `src/shared/market-contract/schemas.ts`:
   - `MeritIncentiveSchema`
   - `MerklCampaignBreakdownSchema`
   - `MerklOpportunityGroupSchema`
   - `BrevisCampaignBreakdownSchema`
   - `BrevisIncentiveSchema`
   - internal `BrevisRawIncentiveSchema`
   - `ReserveWithSpreadSchema`
   - `MarketsResponseSchema`

2. Inline the `IncentiveMessage` type in `schemas.ts` instead of importing from `@/types/aave`, because Node script execution cannot resolve Vite aliases.

3. Create `src/shared/market-contract/index.ts` with barrel exports:

```typescript
export {
  MarketsResponseSchema,
  ReserveWithSpreadSchema,
  MeritIncentiveSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisIncentiveSchema,
  BrevisCampaignBreakdownSchema,
} from './schemas.ts';
```

4. Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

5. Commit:

```bash
git add src/shared/market-contract/
git commit -m "feat: add shared markets schema module"
```

---

## Task 2: Re-Export Shared Schemas From `apiSchemas.ts`

**Files:**
- Modify: `src/lib/apiSchemas.ts`
- Test: existing `src/lib/apiSchemas.test.ts`
- Test: existing `scripts/generate-openapi.test.ts`

**Steps:**

1. Remove markets schema definitions from `src/lib/apiSchemas.ts`.

2. Re-export markets schemas with a relative `.ts` path, not `@/shared/...`:

```typescript
export {
  MarketsResponseSchema,
  ReserveWithSpreadSchema,
  MeritIncentiveSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisIncentiveSchema,
  BrevisCampaignBreakdownSchema,
} from '../shared/market-contract/schemas.ts';
```

3. Keep non-markets schemas in `src/lib/apiSchemas.ts`:
   - `CoingeckoFdvResponseSchema`
   - `CoingeckoCategoriesResponseSchema`
   - `SideDataMetaResponseSchema`

4. Run:

```bash
npm run openapi:generate
npx vitest run src/lib/apiSchemas.test.ts scripts/generate-openapi.test.ts
npm run lint && npm test && npm run build && npx tsc --noEmit
```

Expected: ALL PASS. `openapi:generate` confirms Node can still import `apiSchemas.ts`.

5. Commit:

```bash
git add src/lib/apiSchemas.ts public/openapi.json
git commit -m "refactor: re-export markets schemas from shared module"
```

---

## Task 3: Add Node Bridge And Validate `sync-token-icons`

**Files:**
- Create: `scripts/lib/market-fetch.ts`
- Create: `scripts/lib/market-fetch.test.ts`
- Modify: `scripts/sync-token-icons.mjs`
- Modify: `package.json`

**Steps:**

1. Create `scripts/lib/market-fetch.ts`:
   - `import type { z } from 'zod';`
   - `import { MarketsResponseSchema } from '../../src/shared/market-contract/schemas.ts';`
   - export `fetchAndValidateMarkets(url)`
   - fetch JSON
   - throw `HTTP <status>` with `status` and `url` on non-OK response
   - run `MarketsResponseSchema.safeParse(raw)`
   - throw `Markets schema validation failed: ...` with `url` on schema failure
   - return `{ rows: parsed.data.reserves, snapshot: parsed.data.snapshot }`

2. Add `scripts/lib/market-fetch.test.ts`:
   - happy path: valid `{ snapshot, reserves }` returns one row
   - failure path: legacy `{ data: [] }` rejects with `Markets schema validation failed`

3. Replace `fetchMarketsFromUrl` in `scripts/sync-token-icons.mjs`:

```javascript
async function fetchMarketsFromUrl(url) {
  const { fetchAndValidateMarkets } = await import('./lib/market-fetch.ts');
  const { rows } = await fetchAndValidateMarkets(url);
  return rows;
}
```

4. Update `package.json`:

```json
"sync-token-icons": "node --experimental-strip-types scripts/sync-token-icons.mjs"
```

5. Run:

```bash
npx vitest run scripts/lib/market-fetch.test.ts
npm run sync-token-icons -- --check
npm run lint && npm test && npm run build && npx tsc --noEmit
```

Expected: ALL PASS.

6. Commit:

```bash
git add scripts/lib/market-fetch.ts scripts/lib/market-fetch.test.ts scripts/sync-token-icons.mjs package.json
git commit -m "feat: validate token icon markets with shared schema"
```

---

## Task 4: Validate CoinGecko Platform Map Scripts

**Files:**
- Modify: `scripts/sync-coingecko-platform-map.mjs`
- Modify: `scripts/check-coingecko-platform-map-upstream.mjs`
- Modify: `package.json`

**Steps:**

1. In both scripts, update `loadMarketChainIds()` to call the bridge:

```javascript
async function loadMarketChainIds() {
  const { fetchAndValidateMarkets } = await import('./lib/market-fetch.ts');
  const { rows } = await fetchAndValidateMarkets(`${getApiBase()}/markets`);
  const chainIds = new Set();
  for (const item of rows) {
    if (typeof item?.chainId === 'number' && Number.isFinite(item.chainId) && item.chainId > 0) {
      chainIds.add(item.chainId);
    }
  }
  return Array.from(chainIds).sort((a, b) => a - b);
}
```

2. Keep generic CoinGecko `fetchJson` logic local for now; it is unrelated to `/markets` validation.

3. Update `package.json`:

```json
"sync:coingecko-platform-map": "node --experimental-strip-types scripts/sync-coingecko-platform-map.mjs"
```

4. Run:

```bash
npm run sync:coingecko-platform-map
npm run check:coingecko-platform-map-upstream
npm run lint && npm test && npm run build && npx tsc --noEmit
```

Expected: ALL PASS.

5. Commit:

```bash
git add scripts/sync-coingecko-platform-map.mjs scripts/check-coingecko-platform-map-upstream.mjs package.json
git commit -m "feat: validate coingecko market chain ids with shared schema"
```

---

## Final Validation

Run the repository gate after all tasks:

```bash
npm run lint
npm test
npm run build
npx tsc --noEmit
```

Additional contract checks:

```bash
npm run sync-token-icons -- --check
npm run sync:coingecko-platform-map
npm run check:coingecko-platform-map-upstream
npm run test:live:staging
```

Expected: ALL PASS. If live staging is blocked by Cloudflare/403, follow `docs/conventions/ci-live-schema-cloudflare.md` and record the exact failure.

---

## Other Abstraction Review

Worth considering after Phase 1:

- `scripts/sync-coingecko-platform-map.mjs` and `scripts/check-coingecko-platform-map-upstream.mjs` duplicate `normalizeApiBase`, `getApiBase`, `fetchJson`, `loadCoingeckoPlatformMap`, `parseLocalHardcodedMap`, `isCiMarkets403`, and `loadMarketChainIds`. If these scripts keep changing, extract `scripts/lib/coingecko-platform-map.mjs` with shared read/compare primitives, leaving only "write changes" vs "report drift" in the entrypoints.
- API base defaults are repeated across `src/lib/apiBase.ts`, `src/lib/apiSchemas.live.helpers.ts`, and `scripts/lib/default-api-bases.mjs`. A shared TS constant would help, but only after deciding how Node scripts should consume TS consistently. For now, comments and tests are enough.
- Generic script `fetchJson` helpers are duplicated in several scripts, but error semantics differ. Extract only when two touched scripts need the same timeout/retry/logging behavior.

Do not abstract now:

- `src/hooks/useAaveMarkets.ts` cache fallback should stay frontend-owned. Scripts should fail strictly on contract drift.
- `sanitizeDeficitWithoutPrice` should stay in `src/lib/cache.ts`; it is frontend display/cache cleanup, not API contract validation.
- Do not infer `src/types/aave.ts` from zod schemas in this pass. That is a broad type migration with much larger blast radius than the schema/fetch extraction.

---

## Future Work

Only if more `/markets` consumers appear, add `src/shared/market-contract/fetch.ts` with a pure `fetchMarketsRows({ url, signal })`. Frontend can wrap it with cache fallback, and scripts can wrap it with retry/multi-endpoint behavior. Do not force both environments into one error-handling policy.
