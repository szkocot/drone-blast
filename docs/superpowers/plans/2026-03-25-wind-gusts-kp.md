# Wind Gusts Row + Kp Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wind gusts row below the existing WeatherStrip temperature row, and a Kp index badge that expands to a 3-day bar-chart forecast from NOAA.

**Architecture:** Wind gusts flow through the existing Open-Meteo → windProcessor → WindGrid pipeline with a new `windGust` field. Kp data is fetched separately from NOAA SWPC via a new `kpService` + `kpStore`. Both land in `WeatherStrip`, which grows a gusts row and a collapsible Kp panel.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest, Open-Meteo API, NOAA SWPC API (free, no key)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/types.ts` | Modify | Add `windGust` to `WindGrid`; add `KpEntry`, `KpData` |
| `src/lib/services/openMeteo.ts` | Modify | Request `wind_gusts_10m`; decode `windGust` |
| `src/lib/services/windProcessor.ts` | Modify | Add `windGust` to `ModelData`; aggregate in `buildGrid` |
| `src/lib/services/kpService.ts` | Create | Fetch + parse NOAA planetary-k-index-forecast |
| `src/lib/stores/kpStore.ts` | Create | Svelte writable store; expose `fetchKp()` |
| `src/lib/i18n/en.ts` | Modify | Add `gustsAt10m`, `kpQuiet`, `kpActive`, `kpStorm`, `kpForecast` |
| `src/lib/i18n/pl.ts` | Modify | Same keys in Polish |
| `src/lib/components/WeatherStrip.svelte` | Modify | New props; gusts row; Kp badge + collapsible panel |
| `src/App.svelte` | Modify | Call `fetchKp()` on mount; pass new props to `WeatherStrip` |
| `src/tests/windGrid.test.ts` | Modify | Add `windGust` to `makeGrid` fixture |
| `src/tests/windProcessor.test.ts` | Modify | Add `windGust` to all `ModelData` fixtures; add `windGust` assertions |
| `src/tests/openMeteo.test.ts` | Modify | Add `wind_gusts_10m` to fixture; add URL and parse assertions |
| `src/tests/kpService.test.ts` | Create | Unit tests for NOAA response parsing |

---

## Task 1: Update types and fix fixture compilation

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/tests/windGrid.test.ts`
- Modify: `src/tests/windProcessor.test.ts`

This task adds the new type fields and updates all existing test fixtures so they compile with the extended types. No behaviour changes yet — all existing tests must still pass after this task.

- [ ] **Step 1: Extend `WindGrid` and add Kp types in `src/lib/types.ts`**

Replace the `WindGrid` interface and add below it:

```ts
export interface WindGrid {
  data: number[][];   // [timeIndex 0..167][heightIndex 0..17] = km/h
  times: Date[];      // 168 entries
  modelCount: number;
  temperature: number[];
  weatherCode: number[];
  windGust: number[];  // NEW — 168 entries, km/h at 10m
}

export interface KpEntry {
  time: Date;
  kp: number;
}

export type KpData = KpEntry[];
```

- [ ] **Step 2: Add `windGust` to `makeGrid` in `src/tests/windGrid.test.ts`**

```ts
function makeGrid(value: number, hours = 48): WindGrid {
  return {
    data: Array.from({ length: hours }, () => Array(18).fill(value)),
    times: Array.from({ length: hours }, (_, i) => new Date(Date.now() + i * 3600000)),
    modelCount: 6,
    temperature: Array(hours).fill(15),
    weatherCode: Array(hours).fill(0),
    windGust: Array(hours).fill(0),   // NEW
  };
}
```

- [ ] **Step 3: Add `windGust` to all `ModelData` literals in `src/tests/windProcessor.test.ts`**

Update `makeModelData`:

```ts
const makeModelData = (val: number) => ({
  at10m:       Array(2).fill(val),
  at80m:       Array(2).fill(val * 2),
  at120m:      Array(2).fill(val * 3),
  at180m:      Array(2).fill(val * 4),
  temperature: Array(2).fill(20),
  weatherCode: Array(2).fill(0),
  windGust:    Array(2).fill(val),   // NEW
});
```

Update the inline literal at line 86 (height index 1 test):

```ts
const grid = buildGrid([{
  at10m: [10], at80m: [80], at120m: [120], at180m: [180],
  temperature: [15], weatherCode: [0],
  windGust: [12],   // NEW
}], times);
```

Update the two inline literals at lines 95–98 (averages multiple models test):

```ts
const grid = buildGrid([
  { at10m: [10], at80m: [10], at120m: [10], at180m: [10], temperature: [15], weatherCode: [0], windGust: [10] },
  { at10m: [20], at80m: [20], at120m: [20], at180m: [20], temperature: [15], weatherCode: [0], windGust: [20] },
], times);
```

- [ ] **Step 4: Run tests to verify all existing tests still pass**

```bash
npm test
```

Expected: all existing tests pass (TypeScript must compile; no test logic has changed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/tests/windGrid.test.ts src/tests/windProcessor.test.ts
git commit -m "feat: add windGust to WindGrid type and KpEntry/KpData types"
```

---

## Task 2: Wind gusts in openMeteo service (TDD)

**Files:**
- Modify: `src/tests/openMeteo.test.ts`
- Modify: `src/lib/services/openMeteo.ts`

- [ ] **Step 1: Add `wind_gusts_10m` to the test fixture and write failing assertions**

In `src/tests/openMeteo.test.ts`, update the `json` fixture object to add the new field:

```ts
const json = {
  hourly: {
    time: ['2026-03-23T00:00', '2026-03-23T01:00'],
    wind_speed_10m:  [10.5, 11.0],
    wind_speed_80m:  [20.5, 21.0],
    wind_speed_120m: [25.0, 26.0],
    wind_speed_180m: [30.0, 31.0],
    temperature_2m:  [12.0, 13.0],
    weather_code:    [1, 2],
    wind_gusts_10m:  [15.0, 16.0],   // NEW
  }
};
```

Add two new test cases inside the existing `describe` blocks:

```ts
// inside describe('buildUrl', ...)
it('includes wind_gusts_10m variable', () => {
  expect(buildUrl(0, 0, 'best_match')).toContain('wind_gusts_10m');
});

// inside describe('decodeResponse', ...)
it('parses wind gusts', () => {
  const r = decodeResponse(json);
  expect(r.windGust[0]).toBeCloseTo(15.0);
  expect(r.windGust[1]).toBeCloseTo(16.0);
});
```

- [ ] **Step 2: Run tests to verify the new assertions fail**

```bash
npm test -- openMeteo
```

Expected: 2 new test failures (`wind_gusts_10m` not in URL, `windGust` undefined on decoded response).

- [ ] **Step 3: Implement in `src/lib/services/openMeteo.ts`**

In `buildUrl`, change the `hourly` param:

```ts
hourly: 'wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,temperature_2m,weather_code,wind_gusts_10m',
```

In `decodeResponse`, add `windGust` to the return object:

```ts
return {
  times,
  at10m:       h.wind_speed_10m   as number[],
  at80m:       h.wind_speed_80m   as number[],
  at120m:      h.wind_speed_120m  as number[],
  at180m:      h.wind_speed_180m  as number[],
  temperature: h.temperature_2m   as number[],
  weatherCode: h.weather_code     as number[],
  windGust:    h.wind_gusts_10m   as number[],   // NEW
};
```

- [ ] **Step 4: Run all tests to verify pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/openMeteo.ts src/tests/openMeteo.test.ts
git commit -m "feat: add wind_gusts_10m to Open-Meteo service"
```

---

## Task 3: Wind gusts in windProcessor (TDD)

**Files:**
- Modify: `src/tests/windProcessor.test.ts`
- Modify: `src/lib/services/windProcessor.ts`

- [ ] **Step 1: Write failing assertions in `src/tests/windProcessor.test.ts`**

Add two new `it` cases inside the existing `describe('buildGrid', ...)` block:

```ts
it('includes windGust array of correct length', () => {
  const times = [new Date(), new Date(Date.now() + 3600000)];
  const grid = buildGrid([makeModelData(10)], times);
  expect(grid.windGust).toHaveLength(2);
});

it('averages windGust across models', () => {
  const times = [new Date()];
  const grid = buildGrid([
    { at10m: [10], at80m: [10], at120m: [10], at180m: [10], temperature: [15], weatherCode: [0], windGust: [10] },
    { at10m: [20], at80m: [20], at120m: [20], at180m: [20], temperature: [15], weatherCode: [0], windGust: [20] },
  ], times);
  expect(grid.windGust[0]).toBeCloseTo(15);
});
```

- [ ] **Step 2: Run tests to verify the new assertions fail**

```bash
npm test -- windProcessor
```

Expected: 2 failures — `windGust` does not exist on `WindGrid` return value yet.

- [ ] **Step 3: Implement in `src/lib/services/windProcessor.ts`**

Add `windGust` to `ModelData`:

```ts
export interface ModelData {
  at10m:       number[];
  at80m:       number[];
  at120m:      number[];
  at180m:      number[];
  temperature: number[];
  weatherCode: number[];
  windGust:    number[];   // NEW
}
```

In `buildGrid`, declare the accumulator before the loop, push inside it, and include in return:

```ts
export function buildGrid(models: ModelData[], times: Date[]): WindGrid {
  const hourCount = times.length;
  const data: number[][] = [];
  const temperature: number[] = [];
  const weatherCode: number[] = [];
  const windGust: number[] = [];   // NEW

  for (let t = 0; t < hourCount; t++) {
    // ... existing code ...
    temperature.push(mean(removeOutliers(models.map(m => m.temperature[t] ?? 0))));
    weatherCode.push(mode(models.map(m => m.weatherCode[t] ?? 0)));
    windGust.push(mean(removeOutliers(models.map(m => m.windGust[t] ?? 0))));   // NEW
  }

  return { data, times, modelCount: models.length, temperature, weatherCode, windGust };
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/windProcessor.ts src/tests/windProcessor.test.ts
git commit -m "feat: add windGust aggregation to windProcessor"
```

---

## Task 4: Kp service (TDD)

**Files:**
- Create: `src/tests/kpService.test.ts`
- Create: `src/lib/services/kpService.ts`

The NOAA endpoint returns a JSON array-of-arrays. The first row is a header `["time_tag","kp","observed","noaa_scale"]`. Subsequent rows are like `["2026-03-25 00:00:00","1.33","observed",""]`. Times are UTC.

- [ ] **Step 1: Write `src/tests/kpService.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseKpResponse } from '../lib/services/kpService';

describe('parseKpResponse', () => {
  const validResponse = [
    ['time_tag', 'kp', 'observed', 'noaa_scale'],
    ['2026-03-25 00:00:00', '1.33', 'observed', ''],
    ['2026-03-25 03:00:00', '2.67', 'predicted', ''],
    ['2026-03-25 06:00:00', '5.00', 'predicted', 'G1'],
  ];

  it('skips the header row', () => {
    expect(parseKpResponse(validResponse)).toHaveLength(3);
  });

  it('parses time strings to Date objects', () => {
    const result = parseKpResponse(validResponse);
    expect(result[0].time).toBeInstanceOf(Date);
    expect(result[0].time.getUTCFullYear()).toBe(2026);
  });

  it('parses kp strings to numbers', () => {
    const result = parseKpResponse(validResponse);
    expect(result[0].kp).toBeCloseTo(1.33);
    expect(result[2].kp).toBeCloseTo(5.0);
  });

  it('returns empty array for empty input', () => {
    expect(parseKpResponse([])).toEqual([]);
  });

  it('filters out rows with NaN kp', () => {
    const bad = [
      ['time_tag', 'kp', 'observed', 'noaa_scale'],
      ['2026-03-25 00:00:00', 'bad', 'observed', ''],
      ['2026-03-25 03:00:00', '2.00', 'observed', ''],
    ];
    expect(parseKpResponse(bad)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- kpService
```

Expected: fails — module not found.

- [ ] **Step 3: Create `src/lib/services/kpService.ts`**

```ts
// src/lib/services/kpService.ts
import type { KpEntry } from '../types';

const NOAA_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

// Exported for testing — accepts the raw parsed JSON array
export function parseKpResponse(rows: string[][]): KpEntry[] {
  return rows
    .slice(1)  // skip header row
    .map(([timeTag, kp]) => ({
      time: new Date(timeTag.replace(' ', 'T') + 'Z'),
      kp:   parseFloat(kp),
    }))
    .filter(e => !isNaN(e.kp));
}

export async function fetchKpForecast(): Promise<KpEntry[]> {
  const res = await fetch(NOAA_URL);
  if (!res.ok) throw new Error(`Kp fetch failed: HTTP ${res.status}`);
  return parseKpResponse(await res.json());
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/kpService.ts src/tests/kpService.test.ts
git commit -m "feat: add kpService with NOAA forecast parsing"
```

---

## Task 5: Kp store

**Files:**
- Create: `src/lib/stores/kpStore.ts`

No unit test — the store is a thin wrapper over `fetchKpForecast`. Tested end-to-end in the browser.

- [ ] **Step 1: Create `src/lib/stores/kpStore.ts`**

```ts
// src/lib/stores/kpStore.ts
import { writable } from 'svelte/store';
import type { KpData } from '../types';
import { fetchKpForecast } from '../services/kpService';

export const kpStore = writable<KpData | null>(null);

export async function fetchKp(): Promise<void> {
  try {
    kpStore.set(await fetchKpForecast());
  } catch {
    kpStore.set(null);
  }
}
```

- [ ] **Step 2: Run tests and type-check**

```bash
npm test && npm run check
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/kpStore.ts
git commit -m "feat: add kpStore with fetchKp action"
```

---

## Task 6: i18n strings

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/pl.ts`

The `Translations` type (`src/lib/i18n/types.ts`) is inferred from `en`, so adding keys to `en.ts` automatically extends the type. Adding to `pl.ts` with `: Translations` annotation ensures both locales stay in sync.

- [ ] **Step 1: Add new strings to `src/lib/i18n/en.ts`**

Add these five keys to the `en` object (e.g. after `legendNoFly`):

```ts
gustsAt10m: 'Gusts @ 10m',
kpQuiet:    'Quiet',
kpActive:   'Active',
kpStorm:    'Storm',
kpForecast: 'Kp forecast — 3 days',
```

- [ ] **Step 2: Add same keys to `src/lib/i18n/pl.ts`**

```ts
gustsAt10m: 'Porywy @ 10m',
kpQuiet:    'Spokojnie',
kpActive:   'Aktywnie',
kpStorm:    'Burza',
kpForecast: 'Prognoza Kp — 3 dni',
```

- [ ] **Step 3: Run type-check to confirm no missing translation keys**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/pl.ts
git commit -m "feat: add i18n strings for gusts row and Kp index"
```

---

## Task 7: WeatherStrip component

**Files:**
- Modify: `src/lib/components/WeatherStrip.svelte`

This task rewrites WeatherStrip to add three new props, the gusts row, and the Kp badge with collapsible panel.

**New props (3 additions + 1 rename):**
- Rename existing prop `unit: TempUnit` → `tempUnit: TempUnit` for clarity. Note: `settingsStore.tempUnit` already exists in the Settings interface — this is a valid rename, just requires updating App.svelte in Task 8.
- `windUnit: WindUnit` — user's wind speed unit for conversion + display
- `thresholdKmh: number` — user's threshold for colour coding gusts
- `kpData: KpData | null` — from kpStore; null when fetch failed

**No `windGust` prop** — the component already receives `grid: WindGrid` which now contains `grid.windGust`. Read directly from there.

**Shared scroll:** Both the weather row and the gusts row must scroll together. Achieve this by making each "column" a single flex item containing both cells stacked vertically, inside one shared `overflow-x: auto` container. This way there is only one scroll container.

**Helpers needed:**
- `displayGust(kmh)` — converts to windUnit, returns formatted string (e.g. `"18 km/h"`)
- `kpLabel(kp)` — returns `$t.kpQuiet` / `$t.kpActive` / `$t.kpStorm`
- `kpColor(kp)` — returns CSS colour string (green/yellow/red)
- `currentKp` reactive — finds entry in `kpData` closest to `Date.now()`

**Kp bar chart:** Bar heights proportional to `kp / 9`. Day separators where consecutive entries span a UTC midnight.

- [ ] **Step 1: Replace `src/lib/components/WeatherStrip.svelte` with the new implementation**

```svelte
<!-- src/lib/components/WeatherStrip.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { convertTemp, convertFromKmh, windColor } from '../stores/settingsStore';
  import { weatherIcon } from '../utils/weatherIcon';
  import type { WindGrid, TempUnit, WindUnit, KpData } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let tempUnit: TempUnit;
  export let windUnit: WindUnit;
  export let thresholdKmh: number;
  export let kpData: KpData | null;

  let showKpPanel = false;

  $: start = Math.max(0, hourOffset);
  $: indices = Array.from({ length: 24 }, (_, i) => Math.min(start + i, grid.times.length - 1));

  function displayTemp(celsius: number): string {
    return convertTemp(celsius, tempUnit).toFixed(0) + (tempUnit === 'fahrenheit' ? '°F' : '°C');
  }

  function displayGust(kmh: number): string {
    const val = convertFromKmh(kmh, windUnit).toFixed(0);
    const label = windUnit === 'kmh' ? 'km/h' : windUnit === 'ms' ? 'm/s' : 'kn';
    return `${val} ${label}`;
  }

  function kpLabel(kp: number): string {
    if (kp <= 3) return $t.kpQuiet;
    if (kp <= 5) return $t.kpActive;
    return $t.kpStorm;
  }

  function kpColor(kp: number): string {
    if (kp <= 3) return 'var(--green)';
    if (kp <= 5) return 'var(--yellow)';
    return 'var(--red)';
  }

  $: currentKp = kpData && kpData.length > 0
    ? kpData.reduce((best, e) =>
        Math.abs(e.time.getTime() - Date.now()) < Math.abs(best.time.getTime() - Date.now())
          ? e : best
      )
    : null;

  function isNewDay(index: number): boolean {
    if (!kpData || index === 0) return false;
    const prev = kpData[index - 1].time;
    const curr = kpData[index].time;
    return prev.getUTCDate() !== curr.getUTCDate();
  }
</script>

<div class="strip">

  <!-- Header: weather label + Kp badge -->
  <div class="strip-header">
    <span class="section-label">{$t.gustsAt10m}</span>
    {#if kpData !== null}
      <button class="kp-badge" class:expanded={showKpPanel} on:click={() => showKpPanel = !showKpPanel}>
        Kp {currentKp ? currentKp.kp.toFixed(0) : '—'}
        {#if currentKp} — <span style="color: {kpColor(currentKp.kp)}">{kpLabel(currentKp.kp)}</span>{/if}
        <span class="chevron">{showKpPanel ? '▴' : '▾'}</span>
      </button>
    {:else}
      <span class="kp-badge no-data">Kp —</span>
    {/if}
  </div>

  <!-- Kp forecast panel (collapsible) -->
  {#if showKpPanel && kpData && kpData.length > 0}
    <div class="kp-panel">
      <div class="kp-panel-title">{$t.kpForecast}</div>
      <div class="kp-bars">
        {#each kpData as entry, i}
          {#if isNewDay(i)}
            <div class="day-sep"></div>
          {/if}
          <div class="kp-bar-wrap" class:kp-now={entry === currentKp}>
            <span class="kp-num" style="color: {kpColor(entry.kp)}">{entry.kp.toFixed(0)}</span>
            <div
              class="kp-bar"
              style="height: {Math.max(4, (entry.kp / 9) * 100)}%; background: {kpColor(entry.kp)}; opacity: 0.5"
            ></div>
            <span class="kp-time">{entry === currentKp ? 'now' : entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!--
    Shared scroll container: both rows scroll together because they are
    children of a single overflow-x:auto parent. Each column contains a
    weather cell stacked above a gust cell.
  -->
  <div class="rows-scroll">
    {#each indices as idx, i}
      <div class="col">
        <!-- Weather cell (top) -->
        <div class="cell" class:active={i === 0}>
          {#if i === 0}<span class="now-label">{$t.now}</span>{/if}
          <span class="icon">{weatherIcon(grid.weatherCode[idx])}</span>
          <span class="temp">{displayTemp(grid.temperature[idx])}</span>
        </div>
        <!-- Gust cell (bottom) -->
        <div class="cell gust-cell" class:active={i === 0}
             style="background: {windColor(grid.windGust[idx], thresholdKmh)}">
          <span class="gust-val">{displayGust(grid.windGust[idx])}</span>
        </div>
      </div>
    {/each}
  </div>

</div>

<style>
  .strip {
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .strip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px 2px;
  }

  .section-label {
    font-size: 8px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kp-badge {
    font-size: 9px;
    font-weight: 700;
    background: transparent;
    border: 1px solid rgba(96, 165, 250, 0.3);
    color: var(--blue);
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .kp-badge.no-data {
    cursor: default;
    opacity: 0.4;
    border-color: var(--border);
    color: var(--text-muted);
  }

  .chevron { font-size: 8px; }

  /* Kp panel */
  .kp-panel {
    background: rgba(30, 58, 95, 0.2);
    border-top: 1px solid rgba(96, 165, 250, 0.15);
    padding: 6px 8px 8px;
  }

  .kp-panel-title {
    font-size: 8px;
    font-weight: 700;
    color: var(--blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .kp-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 44px;
  }

  .kp-bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 1px;
    height: 100%;
    border-radius: 2px;
  }

  .kp-bar-wrap.kp-now {
    background: rgba(59, 130, 246, 0.15);
    border-radius: 3px;
  }

  .kp-bar {
    width: 100%;
    border-radius: 2px 2px 0 0;
    min-height: 4px;
  }

  .kp-num { font-size: 7px; font-weight: 700; line-height: 1; }
  .kp-time { font-size: 6px; color: var(--text-muted); line-height: 1; }

  .day-sep {
    width: 1px;
    height: 100%;
    background: var(--border);
    flex-shrink: 0;
    align-self: stretch;
  }

  /* Shared scroll container — single overflow-x:auto wraps both rows */
  .rows-scroll {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 3px 6px 4px;
    scrollbar-width: none;
  }

  .rows-scroll::-webkit-scrollbar { display: none; }

  /* Each column holds a weather cell + gust cell stacked vertically */
  .col {
    flex: 0 0 34px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 34px;
    scroll-snap-align: start;
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 3px 2px;
    border-radius: 5px;
  }

  .cell.active {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .now-label {
    font-size: 8px;
    font-weight: 700;
    color: var(--blue);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .icon { font-size: 14px; line-height: 1; }
  .temp { font-size: 10px; font-weight: 700; color: var(--text); }

  .gust-cell { border-radius: 5px; }
  .gust-val  { font-size: 9px; font-weight: 700; color: var(--text); }

  @media (min-width: 640px) {
    .rows-scroll {
      gap: 0;
      overflow-x: visible;
      padding: 2px 0 4px;
    }

    .col {
      flex: 1 0 0;
      min-width: 0;
      scroll-snap-align: none;
    }

    .cell {
      gap: 1px;
      padding: 2px 2px;
    }
  }
</style>
```

> **Note:** The component interface here intentionally differs from the spec's draft. The spec sketched a separate `windGust: number[]` prop and kept `unit: TempUnit` — this plan reads `grid.windGust` directly (simpler) and renames `unit` → `tempUnit` to avoid collision with `windUnit`. The plan's Task 8 wiring is the authoritative reference; ignore the spec's `App.svelte` snippet.

> **No commit in this task** — `WeatherStrip.svelte` is committed together with `App.svelte` in Task 8, Step 5.

- [ ] **Step 2: Run type-check**

```bash
npm run check
```

Expected: errors about missing `windUnit`, `thresholdKmh`, `kpData` and renamed `tempUnit` prop in `App.svelte`. These are fixed in Task 8.

---

## Task 8: App.svelte wiring + final verification

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Import `kpStore` and `fetchKp` in `src/App.svelte`**

Add to the import block:

```ts
import { kpStore, fetchKp } from './lib/stores/kpStore';
```

- [ ] **Step 2: Call `fetchKp()` in `onMount`**

The `onMount` callback currently calls `requestLocation()`. Add `fetchKp()` alongside it:

```ts
onMount(() => {
  requestLocation();
  fetchKp();   // NEW
  _lastFetchedKey = ...
  ...
});
```

- [ ] **Step 3: Update the `<WeatherStrip>` usage**

Replace the existing `<WeatherStrip ...>` with (note: `unit` prop renamed to `tempUnit`; `windGust` is NOT passed because the component reads it from `grid.windGust` directly):

```svelte
<WeatherStrip
  grid={$windGrid}
  hourOffset={$hourOffset}
  tempUnit={$settingsStore.tempUnit}
  windUnit={$settingsStore.unit}
  thresholdKmh={$settingsStore.thresholdKmh}
  kpData={$kpStore}
/>
```

- [ ] **Step 4: Run type-check and all tests**

```bash
npm run check && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/lib/components/WeatherStrip.svelte src/lib/stores/kpStore.ts
git commit -m "feat: add wind gusts row and Kp index badge to WeatherStrip"
```

---

## Verification Checklist

After all tasks are complete, verify in the browser:

- [ ] Gusts row appears below the temperature row, scrolls in sync
- [ ] Gust cell colours change relative to the wind threshold
- [ ] Kp badge shows current Kp value and quiet/active/storm label
- [ ] Tapping badge opens the bar chart panel; tapping again closes it
- [ ] Bar chart shows ~24 entries with day separators; current slot highlighted
- [ ] When NOAA fetch fails (test by blocking the URL in devtools), badge shows `Kp —` with no expand
- [ ] Switching wind unit in Settings updates the gusts row label (km/h → m/s → kn)
- [ ] App works in both Polish and English locales
