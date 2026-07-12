import { MarketsResponseSchema } from '../../src/shared/market-contract/schemas.ts';

export async function fetchAndValidateMarkets(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status: number; url: string };
    err.status = res.status;
    err.url = url;
    throw err;
  }
  const raw = await res.json();
  const parsed = MarketsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error(
      `Markets schema validation failed: ${parsed.error.message}`
    ) as Error & { url: string };
    err.url = url;
    throw err;
  }
  return { rows: parsed.data.reserves, snapshot: parsed.data.snapshot };
}