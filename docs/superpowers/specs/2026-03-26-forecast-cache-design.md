# Forecast Cache & Timeout Design

**Date:** 2026-03-26
**Status:** Approved

## Problem

Every app launch, resume, and location change triggers 6 parallel API calls to Open-Meteo (one per weather model) with no persistent cache. Users wait on every open, even when the forecast hasn't changed.

## Goals

- Eliminate network wait on launch when cached data is <1hr old and within 5km
- Show cached data immediately; refresh in the background
- Prevent a single slow model from hanging the entire fetch
- Keep all 6 weather models (ensemble accuracy is preserved)

## Non-Goals

- Progressive/streaming model rendering
- Service Worker / full offline support
- Reducing the number of models fetched

---

## Architecture

### 1. Cache Layer — `src/lib/services/forecastCache.ts` (new file)

Handles reading and writing a single forecast cache entry in localStorage.

**Cache entry shape:**
```typescript
interface ForecastCacheEntry {
  windGrid: Omit<WindGrid, 'times'> & { times: string[] }; // ISO strings, rehydrated to Date[] on read
  timestamp: number;       // Unix ms
  lat: number;
  lon: number;
  modelCount: number;
}
```

**Storage key:** `fpv-blast-forecast-cache` — a single slot. Alternating between two distant locations will invalidate and rewrite the same slot each time; this is a deliberate tradeoff to avoid unbounded storage growth.

**Serialization note:** `WindGrid.times` is `Date[]`, which JSON-serializes to ISO strings. The cache entry stores `times` as `string[]`. On read, `forecastCache.read()` reconstructs `Date[]` via `times.map(s => new Date(s))` before returning the entry. TypeScript callers always receive a proper `WindGrid` with `Date[]`.

Note: the original `Date` objects in `WindGrid.times` are produced by `decodeResponse` in `openMeteo.ts` using `new Date(s.replace('T', ' ') + ':00')`, which creates local-time `Date` instances. When stored to the cache and rehydrated via `new Date(isoString)`, the absolute UTC timestamp is preserved unchanged — `.getHours()` will return the correct local hour on the same device. No additional timezone conversion is needed in `forecastCache.read()`.

**Proximity check:** The cache uses a hardcoded 5km radius, independent of `Settings.refetchRadiusKm`. This is intentional — the cache proximity check is a staleness guard, not a user-configurable preference.

**Read logic:**
- Return entry if timestamp is <1hr old AND location is within 5km of current position (hardcoded)
- Otherwise return `null`

**Write logic:**
- Serialize (with `times` as ISO strings) and store after any successful network fetch
- Wrap in `try/catch` — `QuotaExceededError` and unavailable localStorage (e.g. private browsing) are silently ignored; the app degrades gracefully to no caching

All cache logic lives here, keeping `windStore` and `openMeteo` clean.

---

### 2. windStore changes — `src/lib/stores/windStore.ts`

Updated `fetchWind(lat, lon)` flow:

1. **Skip the in-memory 5km guard** — it is removed from the top of `fetchWind`. The cache is the primary freshness check. The guard was preventing background refreshes from firing on repeated `visibilitychange` calls at the same location.
2. Check `forecastCache.read(lat, lon)`
3. **Cache hit** → immediately set `windGrid` and `fetchState = { type: 'loaded', modelCount, fromCache: true }`; set `lastFetchLat/Lon` to the current `lat/lon` immediately (before launching the background refresh, so GPS-jitter calls during the refresh don't trigger duplicate fetches); then kick off the background network refresh
4. **Cache miss** → set `fetchState = { type: 'loading' }`, fetch normally
5. After successful network fetch → call `forecastCache.write(...)` before updating the store; update `lastFetchLat/Lon`

**Background refresh failure:** If the background network fetch fails (network error, all models timeout, or <2 models succeed), silently keep the stale cached data. Do not update `fetchState` to `failed` — the user is already seeing data and a sudden error state would be jarring. Do not update the cache timestamp, so the next app launch will attempt a fresh fetch rather than serving the now-older cache.

**Background refresh partial success:** If ≥2 models succeed, treat the background refresh as successful: update `windGrid`, update `fetchState = { type: 'loaded', modelCount: succeeded.length }` (no `fromCache`), and write the new result to the cache. This is the same threshold as the cache-miss path.

**In-memory dedup guard:** `lastFetchLat/Lon` remains in `windStore` but is now checked only to prevent duplicate in-flight fetches within a single session (e.g., rapid GPS jitter). It does not prevent the cache-hit background refresh from running.

**`FetchState` updated union shape** (in `types.ts`):
```typescript
type FetchState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loaded'; modelCount: number; fromCache?: boolean }
  | { type: 'failed'; message: string };
```

`fromCache` is only on the `loaded` branch. It is optional for backwards compatibility with any existing code that constructs `{ type: 'loaded', modelCount }` without the field.

---

### 3. Per-request timeout — `src/lib/services/openMeteo.ts`

Each `fetchModel()` call creates an `AbortController` and sets an 8-second timeout:

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 8000);
try {
  const res = await fetch(url, { signal: controller.signal });
  // ...
} finally {
  clearTimeout(timer);
}
```

Timed-out requests are treated as failures. `Promise.allSettled` already handles this gracefully — the app requires a minimum of 2 successful models, so up to 4 can fail without breaking the load.

---

## Data Flow (updated)

```
App launch / resume
       │
       ▼
fetchWind(lat, lon)
       │
       ├── forecastCache.read(lat, lon)
       │         │
       │    hit (<1hr, <5km) ──► set windGrid from cache
       │         │                set fetchState = loaded (fromCache)
       │         │                background refresh (silent)
       │         │
       │    miss ──────────────► set fetchState = loading
       │                         fetch 6 models (8s timeout each)
       │                         forecastCache.write(result)
       │                         set windGrid + fetchState = loaded
       │
       ▼
  UI renders immediately (cache hit) or after fetch (miss)
```

---

## Cache TTL & Invalidation

| Condition | Behavior |
|-----------|----------|
| Cache <1hr old, within 5km | Serve immediately, background refresh |
| Cache >1hr old | Treat as miss, show loading state |
| Location >5km from cache | Treat as miss, show loading state |
| Fetch fails and cache exists (cold start) | Keep showing cached data (no regression) |
| Background refresh fails (cache hit path) | Keep stale data visible; do not update cache timestamp; retry on next launch |

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/services/forecastCache.ts` | New — cache read/write logic |
| `src/lib/stores/windStore.ts` | Updated `fetchWind` flow; cache integration |
| `src/lib/services/openMeteo.ts` | Add `AbortController` timeout to `fetchModel` |
| `src/lib/types.ts` | Add `fromCache?: boolean` to `FetchState` loaded type |
