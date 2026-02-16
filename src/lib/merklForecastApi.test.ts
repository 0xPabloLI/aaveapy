import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMerklForecastStates } from './merklForecastApi';

describe('fetchMerklForecastStates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches batch forecast states in a single request', async () => {
    const json = vi.fn().mockResolvedValue({
      requested: 2,
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
      requested: 0,
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
});
