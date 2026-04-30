# API base URLs (frontend, scripts, CI)

Single reference for **which hostname** each layer uses and **which env var** overrides it. Canonical string constants for Node live under `scripts/lib/default-api-bases.mjs`.

## Canonical URLs

| Constant / name | URL |
|-----------------|-----|
| Staging (public) | `https://staging-api.aaveapy.com/api` |
| Production (public) | `https://api.aaveapy.com/api` |

## Frontend (browser)

| Mechanism | Resolution |
|-----------|------------|
| Runtime | `import.meta.env.VITE_API_BASE_URL` → else **`src/lib/apiBase.ts`** default (**staging**) |
| Local file | `.env`, `.env.local`, etc. |

Production traffic in deployed sites is expected to set `VITE_API_BASE_URL` at build/deploy time.

## Vitest live API tests

| Env | Role |
|-----|------|
| `LIVE_TEST_API_BASE` | Preferred base for `apiSchemas.live.test.ts` |
| (fallback) | `DEFAULT_LIVE_API_BASE` in `apiSchemas.live.helpers.ts` — same value as `DEFAULT_STAGING_API_BASE` in scripts |

## GitHub Actions

| Variable (Repository **Variables**) | Injected as job env | Used by |
|-------------------------------------|---------------------|---------|
| `LIVE_TEST_API_BASE_CI` | Often `env.LIVE_TEST_API_BASE_CI` or mapped to `LIVE_TEST_API_BASE` in `ci.yml` | Live schema job, `hardcode-drift-check`, `hardcode-sync`, coingecko scripts |

If `LIVE_TEST_API_BASE_CI` is **unset**, workflows fall back to **staging** (same expression as `ci.yml`). Prefer setting it to a **Railway (or other) direct URL** when the public production or staging host blocks automated clients (403 / edge).

## Node scripts (`/markets` and similar)

| Script / area | Env / order | Default when unset |
|---------------|-------------|-------------------|
| `check-coingecko-platform-map-upstream.mjs`, `sync-coingecko-platform-map.mjs` | `LIVE_TEST_API_BASE_CI` → `VITE_API_BASE_URL` → constant | **Staging** (`DEFAULT_STAGING_API_BASE`) |
| `probe-live-api.mjs` | `LIVE_TEST_API_BASE` → constant | **Staging** |
| `sync-token-icons.mjs` | `SYNC_TOKEN_ICONS_MARKETS_API` (plus built-in list) | Production URL first in default list, then staging — see script header |

To compare against **production** from a laptop or CI that can reach it, set the relevant env var explicitly (e.g. `VITE_API_BASE_URL` or `LIVE_TEST_API_BASE_CI`).

## Related docs

- `docs/conventions/ci-live-schema-cloudflare.md` — Cloudflare / CI access to staging
- `docs/HARDCODE-AND-EXTERNAL-IMPORTS.md` — hardcode sync / drift checks
