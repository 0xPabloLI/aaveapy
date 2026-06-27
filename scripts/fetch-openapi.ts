/**
 * Fetch the canonical OpenAPI spec from the backend API.
 *
 * Replaces the Zod-based generation. The backend is the source of truth
 * for the API contract; the frontend spec is a mirror.
 *
 * Usage:
 *   npm run openapi:fetch          # fetch from production
 *   LIVE_API_BASE=https://staging-api.aaveapy.com/api npm run openapi:fetch
 *
 * CI check (detects backend drift):
 *   npm run openapi:check
 *   (fetches spec + diffs against committed openapi.json; exits 1 on drift)
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.LIVE_API_BASE || 'https://api.aaveapy.com/api';
const SPEC_URL = `${API_BASE}/docs/openapi.json`;
const OUTPUT_FILE = resolve(__dirname, '..', 'public', 'openapi.json');

async function main() {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL}...`);
  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    process.exit(1);
  }

  const json = await res.json();

  // Validate it looks like an OpenAPI spec
  if (!json.openapi || !json.paths || !json.components) {
    console.error('Response does not look like an OpenAPI 3.x spec');
    process.exit(1);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  console.log(`Wrote OpenAPI ${json.openapi} spec to ${OUTPUT_FILE}`);
  console.log(`  Endpoints: ${Object.keys(json.paths).join(', ')}`);
  console.log(`  Schemas: ${Object.keys(json.components.schemas).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});