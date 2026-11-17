import { describe, expect, it } from 'vitest';

import {
  STAGING_FETCH_ATTEMPTS,
  STAGING_FETCH_TIMEOUT_MS,
  UNREACHABLE_OPT_OUT_ENV,
  classifyReservesPayload,
  createReservesFetcher,
  decideReserveGate,
  fetchReservesOutcome,
  gateEffect,
  isUnreachableAllowed,
  toDiscovery,
  type ReserveDiscovery,
  type ReservesFetchOutcome,
} from '../../e2e/stagingReservesFetch';

/**
 * AAV-1352 — staging `/markets` fetch outcome must be type-distinguishable.
 *
 * The defect: `fetchStagingReserves()` returned `[]` for "no such reserve",
 * "HTTP 500" and "network down" alike, so a whole spec file reported green
 * while verifying nothing. Rows F1-F11 pin the fetch layer, G1-G6 the gate
 * that callers apply (spec: docs/specs/aav-1352-staging-discovery-fetch-outcome.md).
 */

const URL = 'https://staging.example/api/markets';

/** Minimal Response stand-in — the module only reads `ok` / `status` / `json()`. */
function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

function quiet() {
  return { sleep: async () => {}, log: () => {} };
}

function asUnreachable(outcome: ReservesFetchOutcome): Extract<ReservesFetchOutcome, { status: 'unreachable' }> {
  if (outcome.status !== 'unreachable') throw new Error(`expected unreachable, got ${outcome.status}`);
  return outcome;
}

function asOk(outcome: ReservesFetchOutcome): Extract<ReservesFetchOutcome, { status: 'ok' }> {
  if (outcome.status !== 'ok') throw new Error(`expected ok, got ${outcome.status}: ${outcome.detail}`);
  return outcome;
}

const UNREACHABLE_DISCOVERY: ReserveDiscovery<never> = {
  status: 'unreachable',
  detail: 'HTTP 503',
  url: URL,
  attempts: 2,
  elapsedMs: 1234,
};

describe('fetchReservesOutcome — payload classification', () => {
  it('F1: 200 with reserves is ok and keeps the payload', async () => {
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => okResponse({ reserves: [{ reserveId: 'a' }, { reserveId: 'b' }] })) as typeof fetch,
      ...quiet(),
    });
    expect(outcome.status).toBe('ok');
    expect(asOk(outcome).reserves).toHaveLength(2);
    expect(asOk(outcome).attempts).toBe(1);
  });

  it('F2: 200 with an empty reserves array is ok, not unreachable', async () => {
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => okResponse({ reserves: [] })) as typeof fetch,
      ...quiet(),
    });
    expect(outcome.status).toBe('ok');
    expect(asOk(outcome).reserves).toEqual([]);
  });

  it.each([
    ['missing reserves key', {}],
    ['reserves is not an array', { reserves: 'nope' }],
    ['root is null', null],
    ['root is an array', []],
  ])('F3: %s is unreachable (schema drift cannot be verified either)', async (_label, body) => {
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => okResponse(body)) as typeof fetch,
      ...quiet(),
    });
    expect(outcome.status).toBe('unreachable');
    expect(asUnreachable(outcome).detail).toContain('payload');
  });
});

describe('fetchReservesOutcome — retries and failure shapes', () => {
  it('F4: HTTP 500 is retried, then reported as unreachable', async () => {
    let calls = 0;
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => {
        calls += 1;
        return errorResponse(500);
      }) as typeof fetch,
      ...quiet(),
    });
    expect(calls).toBe(STAGING_FETCH_ATTEMPTS);
    expect(outcome.status).toBe('unreachable');
    expect(asUnreachable(outcome).detail).toContain('500');
    expect(asUnreachable(outcome).attempts).toBe(STAGING_FETCH_ATTEMPTS);
  });

  it('F5: a rejected fetch carries the underlying message', async () => {
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => {
        throw new Error('getaddrinfo ENOTFOUND staging.example');
      }) as typeof fetch,
      ...quiet(),
    });
    expect(asUnreachable(outcome).detail).toContain('ENOTFOUND');
    expect(asUnreachable(outcome).attempts).toBe(STAGING_FETCH_ATTEMPTS);
    expect(asUnreachable(outcome).url).toBe(URL);
  });

  it('F6: a transient first-attempt failure recovers on the retry', async () => {
    let calls = 0;
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => {
        calls += 1;
        if (calls === 1) throw new Error('ECONNRESET');
        return okResponse({ reserves: [{ reserveId: 'a' }] });
      }) as typeof fetch,
      ...quiet(),
    });
    expect(outcome.status).toBe('ok');
    expect(asOk(outcome).attempts).toBe(2);
  });

  it('F7: a hanging request is cut off by the per-attempt timeout', async () => {
    const outcome = await fetchReservesOutcome({
      url: URL,
      timeoutMs: 20,
      attempts: 1,
      // Never resolves on its own; rejects only when the abort signal fires.
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted by signal')));
        })) as unknown as typeof fetch,
      ...quiet(),
    });
    expect(outcome.status).toBe('unreachable');
    expect(asUnreachable(outcome).detail.toLowerCase()).toContain('timeout');
    expect(STAGING_FETCH_TIMEOUT_MS).toBeGreaterThan(20);
  });

  it('F8: malformed JSON is unreachable, not an empty payload', async () => {
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () =>
        ({ ok: true, status: 200, json: async () => JSON.parse('<html>') }) as unknown as Response) as typeof fetch,
      ...quiet(),
    });
    const failure = asUnreachable(outcome);
    expect(failure.detail).toContain('payload');
    expect(failure.detail).not.toContain('ENOTFOUND');
  });

  it('F12: elapsedMs comes from the injected clock', async () => {
    // A fake clock keeps the assertion deterministic (and proves the field is
    // wired, not just typed).
    let clock = 1_000;
    const outcome = await fetchReservesOutcome({
      url: URL,
      fetchImpl: (async () => {
        clock += 42;
        return okResponse({ reserves: [] });
      }) as typeof fetch,
      now: () => clock,
      ...quiet(),
    });
    expect(asOk(outcome).elapsedMs).toBe(42);
  });
});

describe('createReservesFetcher — per-process caching', () => {
  it('F9: caches a successful outcome (no second request)', async () => {
    let calls = 0;
    const fetcher = createReservesFetcher({
      url: URL,
      fetchImpl: (async () => {
        calls += 1;
        return okResponse({ reserves: [{ reserveId: 'a' }] });
      }) as typeof fetch,
      ...quiet(),
    });
    await fetcher.get();
    await fetcher.get();
    expect(calls).toBe(1);
  });

  it('F10: caches a failed outcome (no second round of retries)', async () => {
    let calls = 0;
    const fetcher = createReservesFetcher({
      url: URL,
      fetchImpl: (async () => {
        calls += 1;
        return errorResponse(503);
      }) as typeof fetch,
      ...quiet(),
    });
    await fetcher.get();
    const second = await fetcher.get();
    expect(calls).toBe(STAGING_FETCH_ATTEMPTS);
    expect(second.status).toBe('unreachable');
  });

  it('F11: logs the success line with count, duration and attempt count', async () => {
    const lines: string[] = [];
    const fetcher = createReservesFetcher({
      url: URL,
      fetchImpl: (async () => okResponse({ reserves: [{ reserveId: 'a' }] })) as typeof fetch,
      sleep: async () => {},
      log: (line: string) => lines.push(line),
    });
    await fetcher.get();
    const successLine = lines.find((line) => line.includes('staging /markets'));
    expect(successLine, `expected a staging /markets log line, got ${JSON.stringify(lines)}`).toBeDefined();
    expect(successLine).toContain('1 reserve');
    expect(successLine).toContain('ms');
    expect(successLine).toContain('attempt');
  });
});

describe('decideReserveGate — data gap vs unreachable', () => {
  const dataGap = 'No reserve with incentives + ltv > 0 on staging';

  it('G1: a found reserve runs', () => {
    expect(
      decideReserveGate({ status: 'found', value: 1 }, { dataGapReason: dataGap, allowUnreachable: false }),
    ).toEqual({ action: 'run' });
  });

  it('G2: a data gap skips and says it is not a fetch failure', () => {
    const gate = decideReserveGate({ status: 'data-gap' }, { dataGapReason: dataGap, allowUnreachable: false });
    expect(gate.action).toBe('skip');
    if (gate.action !== 'skip') throw new Error('unreachable');
    expect(gate.reason).toContain(dataGap);
    expect(gate.reason).toContain('/markets loaded fine');
  });

  it('G3: unreachable fails by default, with detail, attempts, duration, url and the fix', () => {
    const gate = decideReserveGate(UNREACHABLE_DISCOVERY, { dataGapReason: dataGap, allowUnreachable: false });
    expect(gate.action).toBe('fail');
    if (gate.action !== 'fail') throw new Error('unreachable');
    expect(gate.reason).toContain('unreachable');
    expect(gate.reason).toContain('HTTP 503');
    expect(gate.reason).toContain('2 attempt');
    expect(gate.reason).toContain('1234ms');
    expect(gate.reason).toContain(URL);
    expect(gate.reason).toContain(UNREACHABLE_OPT_OUT_ENV);
  });

  it('G4: an explicit opt-out turns it into a skip that still names the cause', () => {
    const gate = decideReserveGate(UNREACHABLE_DISCOVERY, { dataGapReason: dataGap, allowUnreachable: true });
    expect(gate.action).toBe('skip');
    if (gate.action !== 'skip') throw new Error('unreachable');
    expect(gate.reason).toContain('unreachable');
    expect(gate.reason).toContain(`${UNREACHABLE_OPT_OUT_ENV} is set`);
    expect(gate.reason).not.toContain(dataGap);
  });
});

describe('isUnreachableAllowed — the opt-out must be typed deliberately', () => {
  it.each([
    ['1', true],
    ['true', true],
    [' TRUE ', true],
    ['0', false],
    ['', false],
    ['yes', false],
    [undefined, false],
  ])('G5: %j => %s', (value, expected) => {
    expect(isUnreachableAllowed({ [UNREACHABLE_OPT_OUT_ENV]: value as string | undefined })).toBe(expected);
  });
});

describe('toDiscovery — fetch outcome to scenario discovery', () => {
  it('G6a: non-empty derivation is found', () => {
    const discovery = toDiscovery(
      { status: 'ok', reserves: [{ reserveId: 'a' }], url: URL, attempts: 1, elapsedMs: 5 },
      (reserves) => reserves.map((r) => r.reserveId as string),
    );
    expect(discovery).toEqual({ status: 'found', value: ['a'] });
  });

  it('G6b: empty derivation is a data gap', () => {
    const discovery = toDiscovery({ status: 'ok', reserves: [], url: URL, attempts: 1, elapsedMs: 5 }, () => []);
    expect(discovery).toEqual({ status: 'data-gap' });
  });

  it('G6c: unreachable passes detail/url/attempts/duration through', () => {
    const discovery = toDiscovery(
      { status: 'unreachable', detail: 'HTTP 500', url: URL, attempts: 2, elapsedMs: 99 },
      () => [],
    );
    expect(discovery).toEqual({ status: 'unreachable', detail: 'HTTP 500', url: URL, attempts: 2, elapsedMs: 99 });
  });
});

describe('toDiscovery — derivation failures are not silent', () => {
  it('G6d: a throwing derive is unreachable, not an escaping module-load error', () => {
    const discovery = toDiscovery(
      { status: 'ok', reserves: [{ reserveId: 'a' }], url: URL, attempts: 1, elapsedMs: 5 },
      () => {
        throw new TypeError("Cannot read properties of undefined (reading 'replace')");
      },
    );
    expect(discovery.status).toBe('unreachable');
    if (discovery.status !== 'unreachable') throw new Error('unreachable');
    expect(discovery.detail).toContain('derivation failed');
    expect(discovery.detail).toContain('replace');
    expect(discovery.url).toBe(URL);
  });
});

describe('gateEffect — what the adapter actually does', () => {
  it('G7a: fail is a throw (never a skip, never test.fail)', () => {
    const effect = gateEffect({ action: 'fail', reason: 'boom' });
    expect(effect.kind).toBe('throw');
    if (effect.kind !== 'throw') throw new Error('unreachable');
    expect(effect.error).toBeInstanceOf(Error);
    expect(effect.error.message).toBe('boom');
  });

  it('G7b: skip carries the reason', () => {
    expect(gateEffect({ action: 'skip', reason: 'why' })).toEqual({ kind: 'skip', reason: 'why' });
  });

  it('G7c: run is a no-op', () => {
    expect(gateEffect({ action: 'run' })).toEqual({ kind: 'none' });
  });
});

describe('end to end — fetch outcome to gate action', () => {
  const dataGapReason = 'nothing qualifiable';

  async function gateFor(fetchImpl: typeof fetch) {
    const outcome = await fetchReservesOutcome({ url: URL, fetchImpl, ...quiet() });
    const discovery = toDiscovery(outcome, (reserves) => reserves);
    return decideReserveGate(discovery, { dataGapReason, allowUnreachable: false });
  }

  it('G8a: a failed fetch ends in fail, not skip', async () => {
    const gate = await gateFor((async () => {
      throw new Error('ENETUNREACH');
    }) as typeof fetch);
    expect(gate.action).toBe('fail');
  });

  it('G8b: an empty payload ends in skip, not fail', async () => {
    const gate = await gateFor((async () => okResponse({ reserves: [] })) as typeof fetch);
    expect(gate.action).toBe('skip');
  });

  it('G8c: a populated payload ends in run', async () => {
    const gate = await gateFor((async () => okResponse({ reserves: [{ reserveId: 'a' }] })) as typeof fetch);
    expect(gate.action).toBe('run');
  });
});

describe('classifyReservesPayload — direct contract', () => {
  it('returns the array verbatim and rejects non-arrays', () => {
    expect(classifyReservesPayload({ reserves: [{ reserveId: 'a' }] })).toHaveLength(1);
    expect(() => classifyReservesPayload({ reserves: {} })).toThrow(/payload/);
  });
});
