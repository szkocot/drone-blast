import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { write } from '../lib/services/forecastCache';
import type { WindGrid } from '../lib/types';

function makeGrid(overrides: Partial<WindGrid> = {}): WindGrid {
  return {
    data: [[10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44]],
    times: [new Date('2026-03-26T10:00:00Z')],
    modelCount: 4,
    temperature: [15],
    weatherCode: [1],
    windGust: [20],
    ...overrides,
  };
}

async function loadWindStore(options?: {
  fetchModelImpl?: (model: string) => Promise<unknown>;
}) {
  vi.resetModules();

  class MockWeatherApiRateLimitError extends Error {}
  class MockWeatherApiUnavailableError extends Error {}

  const fetchModel = vi.fn(async (_lat: number, _lon: number, model: string) => {
    if (options?.fetchModelImpl) {
      return options.fetchModelImpl(model);
    }
    throw new Error(`unexpected fetch for ${model}`);
  });

  vi.doMock('../lib/services/openMeteo', () => ({
    fetchModel,
    WeatherApiRateLimitError: MockWeatherApiRateLimitError,
    WeatherApiUnavailableError: MockWeatherApiUnavailableError,
  }));

  vi.doMock('../lib/services/windProcessor', () => ({
    buildGrid: vi.fn(() => makeGrid()),
  }));

  vi.doMock('../lib/i18n', () => ({
    currentTranslations: () => ({
      forecastRateLimit: 'rate limited',
      forecastConnection: 'connection failed',
      forecastUnavailable: 'forecast service unavailable',
    }),
  }));

  const windStore = await import('../lib/stores/windStore');

  return {
    ...windStore,
    fetchModel,
    MockWeatherApiRateLimitError,
    MockWeatherApiUnavailableError,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('fetchWind', () => {
  it('falls back to stale cached data when the network fetch fails on startup', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    write(50, 20, makeGrid(), 4);
    vi.setSystemTime(now + 60 * 60 * 1000 + 1);

    const { fetchWind, fetchState, windGrid } = await loadWindStore();

    await fetchWind(50, 20);

    expect(get(fetchState)).toEqual({ type: 'loaded', modelCount: 4, fromCache: true });
    expect(get(windGrid)?.times[0]).toBeInstanceOf(Date);
  });

  it('shows an upstream outage message when all model fetches fail with service errors', async () => {
    const { fetchWind, fetchState, MockWeatherApiUnavailableError } = await loadWindStore({
      fetchModelImpl: async () => {
        throw new MockWeatherApiUnavailableError('502');
      },
    });

    await fetchWind(50, 20);

    expect(get(fetchState)).toEqual({
      type: 'failed',
      message: 'forecast service unavailable',
    });
  });
});
