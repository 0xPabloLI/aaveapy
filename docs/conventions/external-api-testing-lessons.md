# External API Integration Testing Lessons

Consolidated from AAV-761 (chainDiscovery 404 root cause). These lessons apply to all frontend integrations with third-party APIs.

## Don't Mock What You Don't Own

Unit tests that mock `fetch` returning `ok: true` + JSON cannot discover that an API URL doesn't exist. Only real HTTP calls can verify endpoint existence.

**Rule**: Mock internal functions and state (what you own). For third-party APIs (what you don't own), use schema validation (zod/Joi) instead of mocks — both real responses and mock data must satisfy the same schema.

## Contract Tests Are Mandatory for External APIs

Unit tests with mocked fetch are necessary (speed, isolation), but external API integrations must also have contract tests — runnable on CI or manually — that verify with real `fetch`:

1. URL is reachable
2. Response format matches expected schema
3. CORS allows browser-side calls

Contract tests don't need to run every time, but they must exist and be runnable.

## API URLs Must Be Based on Official Documentation

`/chains/{id}.json` path patterns may look reasonable but were never confirmed by official docs. When adding external API integrations, verify endpoint existence via official documentation before writing code.

## 404 Ambiguity: "Chain Not Found" vs "API Unreachable"

A 404 can mean "chain not indexed" or "API endpoint doesn't exist" — same status code, different semantics. When all chains return 404, suspect the API itself rather than individual chains.

## Related Files

- `src/lib/chainDiscovery.ts` — Chain metadata fetching
- `src/test/chainDiscovery.test.ts` — Unit tests (mocked fetch)
