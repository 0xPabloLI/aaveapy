# Generated API Schemas

**DO NOT EDIT** — This file is generated from `public/openapi.json` by `openapi-zod-client`.

## Regeneration

```bash
npm run schema:codegen
```

## Source

- Input: `public/openapi.json` (fetched from backend via `npm run openapi:fetch`)
- Tool: `openapi-zod-client`
- Flags: `--export-schemas --with-alias`
- Post-processing: `scripts/lib/patch-generated-schemas.mjs` rewrites two raw-output patterns that fail tsc under zod ^4 (recursive schema alias → `z.ZodTypeAny`, single-arg `z.record` → inject `z.string()` key). Unknown patterns pass through untouched — typecheck remains the gate. The file is exempt from prettier (see `.prettierignore`); the codegen chain's output is the formatting authority.

## CI Check

```bash
npm run schema:check
```

This verifies that the generated code is up to date with the committed `openapi.json`.
