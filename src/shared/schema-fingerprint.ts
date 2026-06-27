// Schema fingerprint — baked into the JS bundle at build time
// so the frontend can immediately invalidate stale cached data
// on page load, without waiting for an API response.
//
// When the backend API response shape changes, the backend snapshot
// test (apiSchemaFingerprint.test.ts) will fail. Update this value
// to match the new fingerprint from the test output.
export const SCHEMA_FP = '541bf2ebdf0c';
