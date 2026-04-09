# API Contract Checklist

When a backend API makes breaking changes, ensure all frontend consumers and scripts are synchronized.

## Automated Defenses

Set up these automated safety nets so API format mismatches are caught without manual file-by-file inspection:

| Defense | Trigger | Detection |
|---------|---------|-----------|
| Runtime schema validation | Every page load | Runtime `safeParse()` on API response → schema mismatch = page error |
| Live API tests | CI on push / scheduled | Test suite hits real API with Zod schemas → drift = CI red |
| Mock tests | Every CI build | Validate mock payloads against the same Zod schemas |
| Script parsers | Scheduled CI | Scripts that consume API responses fail on unexpected shape |

**Core principle**: A single Zod schema file is the source of truth. Both runtime validation and tests reference it. Schema drift → runtime failure + CI red → impossible to miss.

## Manual Steps (only when actively changing an API)

1. Inspect real API response structure (e.g. `curl` + `jq`/`python3`).
2. Update the Zod schema — all consumers that import it follow automatically.
3. Run live API tests, mock tests, and script checks.
4. Global search for renamed/removed field names across `src/` and `scripts/`.

## Affected File Categories

When a primary API response format changes, these categories need sync:

| Category | Examples | Auto-detected? |
|----------|----------|----------------|
| Zod schemas | Schema definition file | ✅ live test |
| TypeScript types | Interface/type definitions | ✅ compiler |
| Data hooks | Runtime `safeParse` consumers | ✅ runtime |
| Test mocks | Mock payload fixtures | ✅ CI test |
| CI/sync scripts | Scripts parsing API responses | ✅ script checks |
| Page consumers | Components rendering API data | ✅ TypeScript |
| Cache layer | Cache read/write wrappers | ✅ type propagation |

## Lessons Learned Template

Record API migration incidents here for future reference:

- **Date**: YYYY-MM-DD
- **Change**: What field/structure changed
- **Symptom**: How the break manifested
- **Root cause**: Why automated checks missed it (if they did)
- **Fix**: What was updated
- **New defense added**: What prevention was added

## Key Identity Contract

If your API has a canonical identity field (e.g. a unique `id`), document it:

- The canonical key field is: `___`
- Frontend keying logic should use it directly
- Do not introduce composite fallback paths
