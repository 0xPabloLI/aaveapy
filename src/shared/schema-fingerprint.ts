// Schema fingerprint — baked into the JS bundle at build time
// so the frontend can immediately invalidate stale cached data
// on page load, without waiting for an API response.
//
// When the backend API response shape changes, the backend snapshot
// test (apiSchemaFingerprint.test.ts) will fail. Update this value
// to match the new fingerprint from the test output.
//
// Current value matches the backend's generated
// packages/aave-shared-config/schema-fingerprint.ts. The previous value
// (2d1059421baf) was three months stale — it predates AAV-1289, which retired
// the Merit fields from the payload on 2026-09-16 (AAV-1346).
export const SCHEMA_FP = '0f60c7e06ff5';
