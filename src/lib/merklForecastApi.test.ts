import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMerklForecastStates } from './merklForecastApi';

describe('fetchMerklForecastStates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches batch forecast states in a single request', async () => {
    const json = vi.fn().mockResolvedValue({
      items: [
        { campaignId: '1', plannedDaily: 1, requiredDaily: 1 },
        { campaignId: '2', plannedDaily: 2, requiredDaily: 2 },
      ],
      errors: [],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMerklForecastStates(['1', '2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/campaigns/forecast-states?ids=1%2C2');
    expect(result.items).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('calls the default batch endpoint when ids are omitted', async () => {
    const json = vi.fn().mockResolvedValue({
      items: [],
      errors: [],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchMerklForecastStates();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/campaigns/forecast-states');
    expect(fetchMock.mock.calls[0][0]).not.toContain('ids=');
  });

  it('dedupes concurrent batch requests for the same id set', async () => {
    let resolveJson: ((value: unknown) => void) | null = null;
    const json = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJson = resolve;
        })
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json,
    });
    vi.stubGlobal('fetch', fetchMock);

    const p1 = fetchMerklForecastStates(['9', '10']);
    const p2 = fetchMerklForecastStates(['10', '9']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(resolveJson).toBeTypeOf('function');
    resolveJson?.({
      requested: 2,
      items: [],
      errors: [],
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.items).toHaveLength(0);
    expect(r2.items).toHaveLength(0);
  });
});
