import type { DiscoveryReserve } from './reserveDiscovery';

/**
 * Staging `/markets` fetch outcome — AAV-1352.
 *
 * The bug this module exists to kill: `fetchStagingReserves()` used to return
 * `[]` for three unrelated situations — "staging has no such reserve",
 * "HTTP 500", and "the network is down". Callers turned all three into
 * `test.skip(!reserve, 'No reserve …')`, so an entire spec file reported green
 * while verifying nothing.
 *
 * The outcome is therefore a tagged union (fetch failure is NOT an empty list),
 * and the skip/fail decision is a pure function so it can be unit-tested:
 * `docs/specs/aav-1352-staging-discovery-fetch-outcome.md`.
 *
 * No `@playwright/test` import here on purpose — vitest imports this module
 * directly (same shape as `./reserveDiscovery`).
 */

/** Per-attempt ceiling. A 141s response is past most assertion timeouts, so it
 * fails here instead of being waited on (ticket measurement, 2026-11-11). */
export const STAGING_FETCH_TIMEOUT_MS = 30_000;

/** One initial attempt plus one retry — a transient reset recovers, a real
 * outage still fails inside ~60s. */
export const STAGING_FETCH_ATTEMPTS = 2;

export const STAGING_FETCH_RETRY_DELAY_MS = 250;

/** The only escape hatch, mirroring AAV-1349's `E2E_SKIP`. */
export const UNREACHABLE_OPT_OUT_ENV = 'E2E_ALLOW_STAGING_UNREACHABLE';

export type FetchMeta = { attempts: number; elapsedMs: number };

/** Why this layer could not verify anything, with the evidence a triager needs. */
export type UnreachableMeta = FetchMeta & { detail: string; url: string };

export type ReservesFetchOutcome =
  | ({ status: 'ok'; reserves: DiscoveryReserve[]; url: string } & FetchMeta)
  | ({ status: 'unreachable' } & UnreachableMeta);

/**
 * What a caller's own selection logic concluded.
 *
 * `data-gap` is the legitimate "staging loaded fine and has nothing that
 * qualifies" case; `unreachable` means this layer could not verify anything.
 */
export type ReserveDiscovery<T> =
  { status: 'found'; value: T } | { status: 'data-gap' } | ({ status: 'unreachable' } & UnreachableMeta);

export type ReserveGate = { action: 'run' } | { action: 'skip'; reason: string } | { action: 'fail'; reason: string };

export type FetchReservesOptions = {
  url: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  attempts?: number;
  retryDelayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
};

function payloadProblem(json: unknown): string {
  if (json === null) return 'unexpected /markets payload: root is null';
  if (typeof json !== 'object') return `unexpected /markets payload: root is ${typeof json}`;
  const reserves = (json as { reserves?: unknown }).reserves;
  if (reserves === undefined) return 'unexpected /markets payload: missing reserves array';
  if (!Array.isArray(reserves)) return `unexpected /markets payload: reserves is ${typeof reserves}, not an array`;
  return '';
}

/**
 * Validate the `/markets` body and hand back the reserve array.
 *
 * An empty array is legitimate (a data gap downstream). A missing/non-array
 * `reserves` is schema drift — treated as "cannot verify", i.e. unreachable,
 * because silently reading it as `[]` is exactly the false-green this ticket
 * is about.
 */
export function classifyReservesPayload(json: unknown): DiscoveryReserve[] {
  const problem = payloadProblem(json);
  if (problem) throw new Error(problem);
  return (json as { reserves: DiscoveryReserve[] }).reserves;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

function attemptLabel(attempts: number): string {
  return `${attempts} attempt${attempts === 1 ? '' : 's'}`;
}

/** Fetch `/markets` with a per-attempt timeout and one retry. Never throws. */
export async function fetchReservesOutcome(options: FetchReservesOptions): Promise<ReservesFetchOutcome> {
  const {
    url,
    fetchImpl = fetch,
    timeoutMs = STAGING_FETCH_TIMEOUT_MS,
    attempts = STAGING_FETCH_ATTEMPTS,
    retryDelayMs = STAGING_FETCH_RETRY_DELAY_MS,
    now = Date.now,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    log = (line: string) => console.log(line),
  } = options;

  const startedAt = now();
  const total = Math.max(1, attempts);
  let detail = 'no attempt was made';

  for (let attempt = 1; attempt <= total; attempt += 1) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const resp = await fetchImpl(url, { signal });
      if (!resp.ok) {
        detail = `HTTP ${resp.status}`;
      } else {
        let body: unknown;
        try {
          body = await resp.json();
        } catch (error) {
          // Name the layer: a bare "Unexpected token '<'" reads like a code bug.
          throw new Error(`unexpected /markets payload: ${describeError(error)}`);
        }
        const reserves = classifyReservesPayload(body);
        const elapsedMs = now() - startedAt;
        log(
          `[e2e] staging /markets: ${reserves.length} reserve${reserves.length === 1 ? '' : 's'} in ${elapsedMs}ms (${attemptLabel(attempt)})`,
        );
        return { status: 'ok', reserves, url, attempts: attempt, elapsedMs };
      }
    } catch (error) {
      detail = signal.aborted ? `timeout after ${timeoutMs}ms` : describeError(error);
    }

    if (attempt < total) {
      log(`[e2e] staging /markets attempt ${attempt}/${total} failed: ${detail} — retrying`);
      await sleep(retryDelayMs);
    }
  }

  const elapsedMs = now() - startedAt;
  log(`[e2e] staging /markets unreachable after ${attemptLabel(total)} in ${elapsedMs}ms: ${detail} (${url})`);
  return { status: 'unreachable', detail, url, attempts: total, elapsedMs };
}

/**
 * Per-process cache. Both outcomes are cached: under `fullyParallel` one worker
 * loads several spec files, and re-running a 60s failure per file helps nobody.
 * Concurrent callers share one in-flight request.
 */
export function createReservesFetcher(options: FetchReservesOptions): { get(): Promise<ReservesFetchOutcome> } {
  let cached: ReservesFetchOutcome | null = null;
  let inFlight: Promise<ReservesFetchOutcome> | null = null;

  return {
    async get() {
      if (cached) return cached;
      if (!inFlight) {
        // `.finally` settles the in-flight slot whether the outcome resolved or
        // an injected `log`/`sleep` threw. `fetchReservesOutcome` itself does not
        // reject, so this is belt-and-braces against a poisoned promise being
        // handed to every later caller in the worker.
        inFlight = fetchReservesOutcome(options)
          .then((outcome) => {
            cached = outcome;
            return outcome;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    },
  };
}

/** Carry a failed fetch through to the discovery layer, meta included. */
export function unreachableDiscovery(
  outcome: Extract<ReservesFetchOutcome, { status: 'unreachable' }>,
): ReserveDiscovery<never> {
  // Return the outcome itself: both sides share `UnreachableMeta`, so a field
  // added there cannot be silently dropped on the way to the gate message.
  return outcome;
}

/** Map a fetch outcome plus the caller's derivation into a discovery result. */
export function toDiscovery<T>(
  outcome: ReservesFetchOutcome,
  derive: (reserves: DiscoveryReserve[]) => T[],
): ReserveDiscovery<T[]> {
  if (outcome.status === 'unreachable') return unreachableDiscovery(outcome);
  let values: T[];
  try {
    values = derive(outcome.reserves);
  } catch (error) {
    // The reservation payload passed the shape check but the caller's selection
    // logic still blew up. That is "this layer cannot verify", not "no data":
    // letting it escape would abort module load and take the hermetic stub
    // variant down with it.
    return unreachableDiscovery({
      status: 'unreachable',
      detail: `discovery derivation failed: ${describeError(error)}`,
      url: outcome.url,
      attempts: outcome.attempts,
      elapsedMs: outcome.elapsedMs,
    });
  }
  return values.length > 0 ? { status: 'found', value: values } : { status: 'data-gap' };
}

/** Decide what a spec should do with a discovery result. Pure. */
export function decideReserveGate<T>(
  discovery: ReserveDiscovery<T>,
  options: { dataGapReason: string; allowUnreachable: boolean },
): ReserveGate {
  if (discovery.status === 'found') return { action: 'run' };

  if (discovery.status === 'data-gap') {
    return {
      action: 'skip',
      // Scoped to /markets on purpose: side-data can independently fail and
      // disable the forecast gate, so no blanket "nothing failed" claim here.
      reason: `${options.dataGapReason} — staging /markets loaded fine (data gap, not a /markets fetch failure)`,
    };
  }

  const failure = `staging /markets unreachable (${discovery.detail}) after ${attemptLabel(discovery.attempts)} in ${discovery.elapsedMs}ms [${discovery.url}]`;
  if (options.allowUnreachable) {
    return {
      action: 'skip',
      reason: `${failure} — skipped because ${UNREACHABLE_OPT_OUT_ENV} is set (this run carries no live-data evidence)`,
    };
  }
  return {
    action: 'fail',
    reason: `${failure}. Live e2e discovery cannot verify anything, so this test FAILS instead of skipping. Fix egress/proxy for this host, or set ${UNREACHABLE_OPT_OUT_ENV}=1 to record an explicit skip.`,
  };
}

/**
 * The gate's effect, kept pure so "failure is a throw, not a skip" is testable
 * without a Playwright test context (AAV-1352 review: the adapter used to be
 * three lines nobody could assert on).
 */
export type GateEffect = { kind: 'none' } | { kind: 'throw'; error: Error } | { kind: 'skip'; reason: string };

export function gateEffect(gate: ReserveGate): GateEffect {
  if (gate.action === 'fail') return { kind: 'throw', error: new Error(gate.reason) };
  if (gate.action === 'skip') return { kind: 'skip', reason: gate.reason };
  return { kind: 'none' };
}

/** Only a deliberate `1` / `true` opts out; `0`, empty and everything else stay blocking. */
export function isUnreachableAllowed(env: Record<string, string | undefined>): boolean {
  const raw = env[UNREACHABLE_OPT_OUT_ENV];
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  return value === '1' || value === 'true';
}
