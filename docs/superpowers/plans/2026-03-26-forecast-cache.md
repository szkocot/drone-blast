# Forecast Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1-hour localStorage forecast cache and per-request 8-second timeout so the app shows data instantly on relaunch and never hangs on a slow weather model.

**Architecture:** A new `forecastCache.ts` service handles all localStorage read/write logic. `windStore.ts` checks the cache first — on a hit it shows cached data immediately and refreshes in the background; on a miss it fetches normally. Each `fetchModel()` call in `openMeteo.ts` gets an `AbortController` timeout.

**Tech Stack:** TypeScript, Svelte 5 writable stores, Vitest (jsdom), localStorage API, AbortController

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `fromCache?: boolean` to `FetchState` loaded variant |
| `src/lib/services/forecastCache.ts` | Create | localStorage read/write; TTL and proximity checks |
| `src/lib/services/openMeteo.ts` | Modify | Add 8-second `AbortController` timeout to `fetchModel` |
| `src/lib/stores/windStore.ts` | Modify | Integrate cache into `fetchWind`; remove top-level 5km guard |
| `src/tests/forecastCache.test.ts` | Create | Unit tests for cache read/write/TTL/proximity/round-trip |
| `src/tests/openMeteo.test.ts` | Create | Add timeout test for `fetchModel` |

---

### Task 1: Update FetchState type

**Files:**
- Modify: `src/lib/types.ts:52`

Note: Task 1 is a type-only change. TypeScript types cannot be independently unit-tested with Vitest — there is no runtime value to assert against. The "failing test" step is therefore replaced by `npm run check` both before and after the change, which confirms that (a) the type change compiles, and (b) all existing callers of `FetchState` remain valid (the new `fromCache` field is optional so no existing `{ type: 'loaded', modelCount }` construction breaks).

- [ ] **Step 1: Update the `loaded` variant**

Replace line 52 in `src/lib/types.ts`:

```typescript
// Before:
  | { type: 'loaded'; modelCount: number }

// After:
  | { type: 'loaded'; modelCount: number; fromCache?: boolean }
```

Full updated union (lines 49-53):

```typescript
export type FetchState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loaded'; modelCount: number; fromCache?: boolean }
  | { type: 'failed'; message: string };
```

- [ ] **Step 2: Verify no type errors**

```bash
npm run check
```

Expected: exits with no errors. If existing code sets `{ type: 'loaded', modelCount }` without `fromCache`, that's fine — the field is optional.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add fromCache flag to FetchState loaded variant"
```

---

### Task 2: Add AbortController timeout to fetchModel (TDD)

**Files:**
- Modify: `src/lib/services/openMeteo.ts:37-41`
- Modify: `src/tests/openMeteo.test.ts` (append only — do NOT recreate this file)

`src/tests/openMeteo.test.ts` already exists with 8 passing tests for `buildUrl` and `decodeResponse`. Do not touch those tests. Only append the new `fetchModel timeout` describe block and add the missing `fetchModel` import.

- [ ] **Step 1: Write the failing timeout test**

In `src/tests/openMeteo.test.ts`:

1. Add `vi, afterEach` to the existing vitest import line:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
```

2. Add `fetchModel` to the existing service import line:
```typescript
import { buildUrl, decodeResponse, fetchModel } from '../lib/services/openMeteo';
```

3. Append this block at the end of the file:
```typescript
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchModel timeout', () => {
  it('rejects after 8 seconds when fetch does not respond', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {}))); // never resolves

    const promise = fetchModel(0, 0, 'best_match');
    vi.advanceTimersByTime(8001);

    await expect(promise).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/tests/openMeteo.test.ts
```

Expected: `fetchModel timeout` test FAILS (no timeout mechanism exists yet). The `buildUrl` and `decodeResponse` tests should pass.

- [ ] **Step 3: Add AbortController timeout to fetchModel**

In `src/lib/services/openMeteo.ts`, replace the `fetchModel` function (lines 37-41):

```typescript
export async function fetchModel(lat: number, lon: number, model: string): Promise<DecodedModel> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(buildUrl(lat, lon, model), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeResponse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/tests/openMeteo.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/openMeteo.ts src/tests/openMeteo.test.ts
git commit -m "feat: add 8-second AbortController timeout to fetchModel"
```

---

### Task 3: Create forecastCache.ts (TDD)

**Files:**
- Create: `src/lib/services/forecastCache.ts`
- Create: `src/tests/forecastCache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/forecastCache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { read, write } from '../lib/services/forecastCache';
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

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('read', () => {
  it('returns null when cache is empty', () => {
    expect(read(50, 20)).toBeNull();
  });

  it('returns null when cache is older than 1 hour', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    write(50, 20, makeGrid(), 4);
    vi.setSystemTime(now + 60 * 60 * 1000 + 1); // 1hr + 1ms later
    expect(read(50, 20)).toBeNull();
  });

  it('returns null when current location is more than 5km away', () => {
    write(50, 20, makeGrid(), 4);
    // Cache written for Kraków (50, 20); reading from Warsaw (~252km away)
    expect(read(52.23, 21.01)).toBeNull();
  });

  it('returns the cached entry when fresh and within 5km', () => {
    write(50, 20, makeGrid(), 4);
    const result = read(50, 20);
    expect(result).not.toBeNull();
    expect(result!.modelCount).toBe(4);
  });

  it('returns times as Date objects, not strings', () => {
    write(50, 20, makeGrid(), 4);
    const result = read(50, 20);
    expect(result!.windGrid.times[0]).toBeInstanceOf(Date);
  });

  it('preserves the absolute timestamp through serialization round-trip', () => {
    const original = makeGrid();
    const originalMs = original.times[0].getTime();
    write(50, 20, original, 4);
    const result = read(50, 20);
    expect(result!.windGrid.times[0].getTime()).toBe(originalMs);
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    expect(read(50, 20)).toBeNull();
  });
});

describe('write', () => {
  it('does not throw when localStorage.setItem throws (QuotaExceededError)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError'); });
    expect(() => write(50, 20, makeGrid(), 4)).not.toThrow();
  });

  it('overwrites previous entry (single slot)', () => {
    write(50, 20, makeGrid({ modelCount: 3 }), 3);
    write(50, 20, makeGrid({ modelCount: 6 }), 6);
    const result = read(50, 20);
    expect(result!.modelCount).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/tests/forecastCache.test.ts
```

Expected: all tests FAIL with "Cannot find module '../lib/services/forecastCache'".

- [ ] **Step 3: Implement forecastCache.ts**

Create `src/lib/services/forecastCache.ts`:

```typescript
import type { WindGrid } from '../types';

const CACHE_KEY = 'fpv-blast-forecast-cache';
const TTL_MS = 60 * 60 * 1000; // 1 hour
const PROXIMITY_KM = 5;

interface StoredEntry {
  windGrid: Omit<WindGrid, 'times'> & { times: string[] };
  timestamp: number;
  lat: number;
  lon: number;
  modelCount: number;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function read(lat: number, lon: number): { windGrid: WindGrid; modelCount: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: StoredEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp >= TTL_MS) return null;
    if (distanceKm(entry.lat, entry.lon, lat, lon) >= PROXIMITY_KM) return null;
    return {
      windGrid: { ...entry.windGrid, times: entry.windGrid.times.map(s => new Date(s)) },
      modelCount: entry.modelCount,
    };
  } catch {
    return null;
  }
}

export function write(lat: number, lon: number, windGrid: WindGrid, modelCount: number): void {
  try {
    const entry: StoredEntry = {
      windGrid: { ...windGrid, times: windGrid.times.map(d => d.toISOString()) },
      timestamp: Date.now(),
      lat,
      lon,
      modelCount,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or unavailable localStorage — degrade gracefully
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/tests/forecastCache.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/forecastCache.ts src/tests/forecastCache.test.ts
git commit -m "feat: add localStorage forecast cache with 1-hour TTL and 5km proximity guard"
```

---

### Task 4: Integrate cache into windStore

**Files:**
- Modify: `src/lib/stores/windStore.ts`

No unit tests — Svelte stores require the full DOM environment and the app's integration is covered by existing e2e tests (`e2e/`). A build check and type check are the verification steps.

- [ ] **Step 1: Replace windStore.ts**

Replace the entire contents of `src/lib/stores/windStore.ts`:

```typescript
// src/lib/stores/windStore.ts
import { writable, get } from 'svelte/store';
import type { WindGrid, FetchState } from '../types';
import { MODELS } from '../types';
import { fetchModel } from '../services/openMeteo';
import { buildGrid } from '../services/windProcessor';
import { read as cacheRead, write as cacheWrite } from '../services/forecastCache';

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
    fetchState.set({ type: 'failed', message: 'Could not load forecast — check your connection.' });
    return;
  }

  const times = succeeded[0].times;
  const grid = buildGrid(succeeded, times);
  cacheWrite(lat, lon, grid, succeeded.length);
  windGrid.set(grid);
  fetchState.set({ type: 'loaded', modelCount: succeeded.length });
}
```

- [ ] **Step 2: Run type check**

```bash
npm run check
```

Expected: no errors. If TypeScript complains about `fromCache` on `FetchState`, confirm Task 1 was completed.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS (forecastCache, openMeteo, plus existing settingsStore, sliderNavigation, etc.).

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/windStore.ts
git commit -m "feat: integrate forecast cache into windStore with stale-while-revalidate"
```

---

## Verification Checklist

After all tasks:

- [ ] `npm test` passes with no failures
- [ ] `npm run check` exits clean
- [ ] Manual: open app fresh → spinner → data loads → close → reopen → data appears instantly (no spinner)
- [ ] Manual: wait 61 minutes (or set device clock forward) → reopen → spinner appears (cache expired)
- [ ] Manual: disable network → close → reopen → stale data is still visible (no crash, no failed state)
