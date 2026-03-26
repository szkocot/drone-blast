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
  windGrid: WindGrid;
  timestamp: number;       // Unix ms
  lat: number;
  lon: number;
  modelCount: number;
}
```

**Storage key:** `fpv-blast-forecast-cache`

**Read logic:**
- Return entry if timestamp is <1hr old AND location is within 5km of current position
- Otherwise return `null`

**Write logic:**
- Serialize and store after any successful network fetch

All cache logic lives here, keeping `windStore` and `openMeteo` clean.

---

### 2. windStore changes — `src/lib/stores/windStore.ts`

Updated `fetchWind(lat, lon)` flow:

1. Check `forecastCache.read(lat, lon)`
2. **Cache hit** → immediately set `windGrid` and `fetchState = { type: 'loaded', modelCount, fromCache: true }`; kick off background refresh (no loading spinner shown)
3. **Cache miss** → set `fetchState = { type: 'loading' }`, fetch normally
4. After successful network fetch → call `forecastCache.write(...)` before updating the store

The existing in-memory 5km guard (`lastFetchLat/Lon`) is kept as a secondary check to prevent redundant in-session fetches after the cache has already been refreshed.

`FetchState` gains an optional `fromCache: boolean` field for future UI use (e.g. a subtle "refreshing" indicator).

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
| Fetch fails and cache exists | Keep showing cached data (no regression) |

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/services/forecastCache.ts` | New — cache read/write logic |
| `src/lib/stores/windStore.ts` | Updated `fetchWind` flow; cache integration |
| `src/lib/services/openMeteo.ts` | Add `AbortController` timeout to `fetchModel` |
| `src/lib/types.ts` | Add `fromCache?: boolean` to `FetchState` loaded type |
