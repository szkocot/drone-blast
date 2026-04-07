// src/lib/stores/windStore.ts
import { writable, get } from 'svelte/store';
import type { WindGrid, FetchState } from '../types';
import { MODELS } from '../types';
import { fetchModel, WeatherApiRateLimitError, WeatherApiUnavailableError } from '../services/openMeteo';
import { buildGrid } from '../services/windProcessor';
import { read as cacheRead, readStale as cacheReadStale, write as cacheWrite } from '../services/forecastCache';
import { currentTranslations } from '../i18n';

export const windGrid     = writable<WindGrid | null>(null);
export const fetchState   = writable<FetchState>({ type: 'idle' });
export const hourOffset   = writable<number>(0);
export const locationName = writable<string>('');

let lastFetchLat: number | null = null;
let lastFetchLon: number | null = null;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function forecastFailureMessage(results: PromiseSettledResult<Awaited<ReturnType<typeof fetchModel>>>[]): string {
  const sawRateLimit = results.some(
    (result) => result.status === 'rejected' && result.reason instanceof WeatherApiRateLimitError,
  );
  const sawUnavailable = results.some(
    (result) => result.status === 'rejected' && result.reason instanceof WeatherApiUnavailableError,
  );
  if (sawRateLimit) return currentTranslations().forecastRateLimit;
  if (sawUnavailable) return currentTranslations().forecastUnavailable;
  return currentTranslations().forecastConnection;
}

async function doNetworkFetch(lat: number, lon: number): Promise<void> {
  const results = await Promise.allSettled(
    MODELS.map(model => fetchModel(lat, lon, model))
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchModel>>> => r.status === 'fulfilled')
    .map(r => r.value);

  // Spec: if background refresh fails (< 2 models), silently keep stale cache data.
  // Deliberately skip cacheWrite so the cache timestamp is NOT updated —
  // the next app launch will treat the cache as expired and retry the network fetch.
  if (succeeded.length < 2) return;

  const times = succeeded[0].times;
  const grid = buildGrid(succeeded, times);
  cacheWrite(lat, lon, grid, succeeded.length);
  windGrid.set(grid);
  fetchState.set({ type: 'loaded', modelCount: succeeded.length });
}

export async function fetchWind(lat: number, lon: number): Promise<void> {
  // In-session dedup guard: prevents duplicate in-flight fetches from GPS jitter
  if (lastFetchLat !== null && lastFetchLon !== null) {
    if (distanceKm(lastFetchLat, lastFetchLon, lat, lon) < 5 && get(windGrid) !== null) return;
  }

  const cached = cacheRead(lat, lon);

  if (cached) {
    // Cache hit: render immediately, update dedup guard, refresh in background
    windGrid.set(cached.windGrid);
    fetchState.set({ type: 'loaded', modelCount: cached.modelCount, fromCache: true });
    lastFetchLat = lat;
    lastFetchLon = lon;
    doNetworkFetch(lat, lon).catch(() => {}); // silent background refresh
    return;
  }

  // Cache miss: show loading state and wait for network
  fetchState.set({ type: 'loading' });
  lastFetchLat = lat;
  lastFetchLon = lon;

  const results = await Promise.allSettled(
    MODELS.map(model => fetchModel(lat, lon, model))
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchModel>>> => r.status === 'fulfilled')
    .map(r => r.value);

  if (succeeded.length < 2) {
    const stale = cacheReadStale(lat, lon);
    if (stale) {
      windGrid.set(stale.windGrid);
      fetchState.set({ type: 'loaded', modelCount: stale.modelCount, fromCache: true });
      return;
    }

    fetchState.set({ type: 'failed', message: forecastFailureMessage(results) });
    return;
  }

  const times = succeeded[0].times;
  const grid = buildGrid(succeeded, times);
  cacheWrite(lat, lon, grid, succeeded.length);
  windGrid.set(grid);
  fetchState.set({ type: 'loaded', modelCount: succeeded.length });
}
