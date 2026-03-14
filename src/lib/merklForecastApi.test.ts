import { afterEach, describe, expect, it, vi } from 'vitest';

import { __resetMerklForecastApiCacheForTests, fetchMerklForecastStates } from './merklForecastApi';

const buildSideDataResponse = (
  forecastItems: Array<{ campaignId: string; plannedDaily?: number; requiredDaily?: number }> = [],
  forecastErrors: Array<{ campaignId: string; message: string }> = []
) => ({
  generatedAt: '2026-03-13T00:00:00.000Z',
  partial: false,
  forecast: {
    items: forecastItems,
    errors: forecastErrors,
    staleTimeMs: 600000,
  },
});

describe('fetchMerklForecastStates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    __resetMerklForecastApiCacheForTests();
  });

  it('fetches forecast from side-data and filters by campaign ids', async () => {
    const json = vi.fn().mockResolvedValue(
      buildSideDataResponse([
        { campaignId: '1', plannedDaily: 1, requiredDaily: 1 },
        { campaignId: '2', plannedDaily: 2, requiredDaily: 2 },
        { campaignId: '3', plannedDaily: 3, requiredDaily: 3 },
      ])
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMerklForecastStates(['1', '2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/meta/side-data');
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.campaignId)).toEqual(['1', '2']);
    expect(result.errors).toHaveLength(0);
  });

  it('returns all forecast items when ids are omitted', async () => {
    const json = vi.fn().mockResolvedValue(
      buildSideDataResponse([
        { campaignId: '1', plannedDaily: 1 },
        { campaignId: '2', plannedDaily: 2 },
      ])
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMerklForecastStates();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/meta/side-data');
    expect(result.items).toHaveLength(2);
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
    resolveJson?.(buildSideDataResponse([{ campaignId: '9' }, { campaignId: '10' }]));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.items).toHaveLength(2);
    expect(r2.items).toHaveLength(2);
  });
});
