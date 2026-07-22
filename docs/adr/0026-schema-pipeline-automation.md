# ADR 0026: Schema Pipeline Automation — Backend-Driven Full-Chain Codegen

## Status

Accepted (Phase 1-2 of 3 complete; Phase 3 tracked in AAV-1216)

## Context

The frontend Zod schemas and TypeScript types in `src/lib/apiSchemas.ts` and `src/types/aave.ts` were entirely hand-written. The backend OpenAPI spec (`public/openapi.json`) was fetched from the backend but **not consumed** by frontend code — it existed only for Swagger UI and architecture-guard tests. This created a **bidirectional manual sync problem**:

1. **Backend**: `generate-openapi.ts` was hand-written with explicit property constants (`RESERVE_PROPERTIES`, `MERIT_CAMPAIGN_BREAKDOWN_PROPERTIES`, etc.). When a developer added a field to a TypeScript interface but forgot to update the spec, the spec became stale. Example: `borrowBlacklist` was defined in the backend `CampaignGroup` interface and serialized by the fetcher, but missing from the OpenAPI spec.

2. **Frontend**: Even when `public/openapi.json` was correct, frontend schemas remained hand-written. New backend fields required manual addition to `apiSchemas.ts` and `aave.ts`. The `field-canary.test.ts` caught renames, but missing fields silently passed.

3. **CI**: The `openapi-sync` workflow only synced `openapi.json` — it did not regenerate frontend code, so even a perfect spec didn't prevent frontend schema drift.

## Decision

Establish a **backend-driven full-chain automation pipeline**:

```
Backend TS interface
  → ts-json-schema-generator (backend gen:openapi)
  → static/openapi.json
  → frontend openapi:fetch (pulls to public/openapi.json)
  → openapi-zod-client (frontend schema:codegen)
  → src/generated/api/schemas.ts + types.ts
```

Zero manual sync at any stage.

### Backend (`aave-protocol-analysis` repo)

1. **Upgrade `generate-openapi.ts`**: Replace hand-written property constants with `ts-json-schema-generator` that reads API-layer TypeScript types (`MarketWithSpread`, `MarketsResponse`, `SideDataPayload`, etc.) and emits JSON Schema definitions. Response metadata (429/503 templates) remains hand-written — git history shows zero changes in 12 commits, validating the "schema auto-gen + metadata template" split.

2. **Shared contracts extraction**: Move `SideDataPayload` from inline `metaController.ts` to `@internal/aave-shared-contracts` so the generator can reference it. Remove `partial: boolean`; replace with `errors?: SideDataSubSourceErrors` (precise per-subsource error type).

3. **CI gate**: New `openapi-consistency` job — runs `gen:openapi` then `git diff --exit-code static/openapi.json`. Fails if spec is stale.

### Frontend (`aaveapy` repo)

4. **Introduce `openapi-zod-client`**: New `schema:codegen` script reads `public/openapi.json` and generates Zod schemas + TypeScript types to `src/generated/api/`. Generated code is committed to git (PR diff visibility + buildable without codegen tooling).

5. **CI upgrade**: `openapi-sync` workflow now runs `schema:codegen` after fetching spec, creating a PR that includes **both** `public/openapi.json` and `src/generated/api/`. Not auto-merged (generated changes may break compilation — requires human review).

6. **Migration strategy (3 phases)**:
   - **Phase 1** (✅ complete — AAV-1213): `src/generated/api/` exists alongside hand-written schemas. No business code imports generated code yet. `.passthrough()` tolerance will be applied in Phase 2 wrapper.
   - **Phase 2** (✅ complete — AAV-1214): `schemas.ts` / `apiSchemas.ts` become wrappers that re-export from generated + apply `.passthrough()`. Business code import paths unchanged. Deleted `scripts/generate-openapi.ts` (frontend reverse-generation, wrong direction) and related tests. `architecture-guard.test.ts` reads `public/openapi.json` instead of calling `generateOpenApiDocument()`. Added `schema-equivalence.test.ts` for transition safety.
   - **Phase 3** (AAV-1216, pending): Remove `.passthrough()`, delete hand-written schema definitions, business code imports generated directly.

### Key implementation details

- `ts-json-schema-generator` outputs `$ref: "#/definitions/Foo"` — must `rewriteRefs` to `"#/components/schemas/Foo"` for OpenAPI 3.1 compliance.
- Generic type names (`CampaignGroup<ApiMeritCampaignBreakdown>`) break `openapi-zod-client` — must `renameGenericTypes` to simple names (`ApiMeritCampaignGroup`) before emission.
- `ajv` must be installed as peer dependency for `openapi-zod-client`.

## Consequences

- **Positive**: Adding a field to a backend interface automatically propagates to OpenAPI spec → frontend Zod schema → frontend TypeScript type. No manual sync at any stage.
- **Positive**: `openapi-consistency` CI gate catches stale backend specs before merge.
- **Positive**: `schema:check` CI gate catches stale frontend generated code.
- **Negative**: `openapi-zod-client` has a small community — mitigated by pinning version + committing generated artifacts + CI diff check.
- **Negative**: Two-phase migration (`.passthrough()` → strict) adds temporary complexity in wrapper layer — justified by risk of spec incompleteness during transition.
- **Risk**: Generated Zod schemas may not match hand-written schemas exactly (e.g., optional vs required, enum vs string) — Phase 2 includes equivalence tests to catch mismatches before removing hand-written code.

## Related

- Spec: `docs/specs/schema-pipeline-automation.md`
- Parent issue: AAV-1209
- Completed tickets: AAV-1210, AAV-1211, AAV-1212, AAV-1213, AAV-1214, AAV-1215
- Pending tickets: AAV-1216 (Phase 3)

## Date

2026-07-21
