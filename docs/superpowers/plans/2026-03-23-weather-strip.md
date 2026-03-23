# Weather Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused 5-cell weather strip (icon + temperature, ±2 hours around slider) below the heatmap, with °C/°F toggle in Settings.

**Architecture:** Extend the existing Open-Meteo fetch to include `temperature_2m` and `weather_code`, aggregate through `buildGrid` into `WindGrid`, then render in a new `WeatherStrip.svelte` component. Temperature unit lives in `Settings` alongside the existing wind unit.

**Tech Stack:** Svelte 4, TypeScript, Vitest, Open-Meteo free API, WMO weather codes.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `TempUnit`, extend `Settings` + `WindGrid` |
| `src/lib/stores/settingsStore.ts` | Modify | Add `tempUnit` default + `convertTemp` helper |
| `src/lib/services/openMeteo.ts` | Modify | Request `temperature_2m`, `weather_code` from API |
| `src/lib/services/windProcessor.ts` | Modify | Extend `ModelData`, add `mode()`, update `buildGrid` |
| `src/lib/utils/weatherIcon.ts` | **Create** | Pure WMO code → emoji mapping |
| `src/lib/components/WeatherStrip.svelte` | **Create** | 5-cell strip component |
| `src/lib/i18n/en.ts` | Modify | Add `now`, `temperature`, `tempUnits` keys |
| `src/lib/i18n/pl.ts` | Modify | Polish translations for new keys |
| `src/lib/components/SettingsSheet.svelte` | Modify | Add °C/°F segmented control |
| `src/App.svelte` | Modify | Import and place `WeatherStrip` |
| `src/tests/settingsStore.test.ts` | Modify | Tests for `convertTemp` |
| `src/tests/windProcessor.test.ts` | Modify | Update fixtures + tests for `mode()`, `buildGrid` |
| `src/tests/openMeteo.test.ts` | Modify | Update fixture + tests for new URL params + decode fields |
| `src/tests/windGrid.test.ts` | Modify | Update `makeGrid` fixture |
| `src/tests/weatherIcon.test.ts` | **Create** | Tests for `weatherIcon()` |

---

## Task 1: TempUnit type + settings store

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/stores/settingsStore.ts`
- Modify: `src/tests/settingsStore.test.ts`

- [ ] **Step 1: Write failing tests for `convertTemp`**

Open `src/tests/settingsStore.test.ts`. Add `convertTemp` to the existing import:

```ts
import { convertFromKmh, convertToKmh, thresholdStep, convertTemp } from '../lib/stores/settingsStore';
```

Add a new describe block at the bottom of the file:

```ts
describe('convertTemp', () => {
  it('returns celsius unchanged', () => {
    expect(convertTemp(20, 'celsius')).toBeCloseTo(20);
  });
  it('converts 0°C to 32°F', () => {
    expect(convertTemp(0, 'fahrenheit')).toBeCloseTo(32);
  });
  it('converts 100°C to 212°F', () => {
    expect(convertTemp(100, 'fahrenheit')).toBeCloseTo(212);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/tests/settingsStore.test.ts
```

Expected: FAIL — `convertTemp` is not exported.

- [ ] **Step 3: Add `TempUnit` to `src/lib/types.ts`**

After the existing type declarations, add:

```ts
export type TempUnit = 'celsius' | 'fahrenheit';
```

Add `tempUnit: TempUnit` to the `Settings` interface (after `language`):

```ts
export interface Settings {
  thresholdKmh: number;
  unit: WindUnit;
  appearance: AppAppearance;
  refetchRadiusKm: number;
  language: AppLanguage;
  tempUnit: TempUnit;
}
```

- [ ] **Step 4: Update `src/lib/stores/settingsStore.ts`**

Change the import on line 3 to include `TempUnit`:

```ts
import type { Settings, WindUnit, TempUnit } from '../types';
```

Add `tempUnit: 'celsius'` to `defaults()`:

```ts
function defaults(): Settings {
  return { thresholdKmh: 25, unit: 'kmh', appearance: 'auto', refetchRadiusKm: 5, language: 'auto', tempUnit: 'celsius' };
}
```

Add `convertTemp` after the existing helpers:

```ts
export function convertTemp(celsius: number, unit: TempUnit): number {
  return unit === 'fahrenheit' ? celsius * 9 / 5 + 32 : celsius;
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run src/tests/settingsStore.test.ts
```

Expected: all tests pass (including pre-existing ones).

- [ ] **Step 6: Run full suite**

```bash
npx vitest run
```

Expected: all tests pass. (TypeScript will not complain yet — `WindGrid` still has its old shape; it's extended in Task 2.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/stores/settingsStore.ts src/tests/settingsStore.test.ts
git commit -m "feat: add TempUnit type, tempUnit setting, convertTemp helper"
```

---

## Task 2: Data pipeline — API + processor + test fixtures

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/services/openMeteo.ts`
- Modify: `src/lib/services/windProcessor.ts`
- Modify: `src/tests/openMeteo.test.ts`
- Modify: `src/tests/windProcessor.test.ts`
- Modify: `src/tests/windGrid.test.ts`

> **Order matters:** extend `WindGrid` and `ModelData` types first, then update test fixtures (which now fail TypeScript), then implement the services. All changes in this task are committed together to avoid a broken intermediate state.

- [ ] **Step 1: Write failing tests for `mode()` and new `buildGrid` outputs**

Open `src/tests/windProcessor.test.ts`. Add `mode` to the import:

```ts
import {
  removeOutliers, mean, interpolate, buildGrid, mode
} from '../lib/services/windProcessor';
```

Add a new describe block after the `interpolate` block:

```ts
describe('mode', () => {
  it('returns 0 for empty array', () => {
    expect(mode([])).toBe(0);
  });
  it('returns single value', () => {
    expect(mode([3])).toBe(3);
  });
  it('returns most frequent value', () => {
    expect(mode([1, 2, 2, 3])).toBe(2);
  });
  it('returns a winner on tie (any value acceptable)', () => {
    const result = mode([1, 2]);
    expect([1, 2]).toContain(result);
  });
});
```

Also add inside the existing `describe('buildGrid', ...)` block, after the existing `it` blocks:

```ts
it('includes temperature array of correct length', () => {
  const times = [new Date(), new Date(Date.now() + 3600000)];
  const grid = buildGrid([makeModelData(10)], times);
  expect(grid.temperature).toHaveLength(2);
});

it('includes weatherCode array of correct length', () => {
  const times = [new Date(), new Date(Date.now() + 3600000)];
  const grid = buildGrid([makeModelData(10)], times);
  expect(grid.weatherCode).toHaveLength(2);
});
```

- [ ] **Step 2: Write failing tests for `openMeteo` changes**

Open `src/tests/openMeteo.test.ts`. Inside the existing `describe('buildUrl', ...)` block, add:

```ts
it('includes temperature and weather code variables', () => {
  const url = buildUrl(0, 0, 'best_match');
  expect(url).toContain('temperature_2m');
  expect(url).toContain('weather_code');
});
```

- [ ] **Step 3: Run tests — expect failure**

```bash
npx vitest run src/tests/windProcessor.test.ts src/tests/openMeteo.test.ts
```

Expected: FAIL — `mode` not exported, `temperature`/`weatherCode` not on grid, URL missing new params.

- [ ] **Step 4: Extend `WindGrid` in `src/lib/types.ts`**

Replace the `WindGrid` interface:

```ts
export interface WindGrid {
  data: number[][];
  times: Date[];
  modelCount: number;
  temperature: number[];
  weatherCode: number[];
}
```

- [ ] **Step 5: Update test fixtures to satisfy the new `WindGrid` type**

In `src/tests/windGrid.test.ts`, update `makeGrid`:

```ts
function makeGrid(value: number, hours = 48): WindGrid {
  return {
    data: Array.from({ length: hours }, () => Array(18).fill(value)),
    times: Array.from({ length: hours }, (_, i) => new Date(Date.now() + i * 3600000)),
    modelCount: 6,
    temperature: Array(hours).fill(15),
    weatherCode: Array(hours).fill(0),
  };
}
```

In `src/tests/openMeteo.test.ts`, update the `json` fixture inside `describe('decodeResponse', ...)`:

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
  }
};
```

Also add inside `describe('decodeResponse', ...)`:

```ts
it('parses temperature and weather code', () => {
  const r = decodeResponse(json);
  expect(r.temperature[0]).toBeCloseTo(12.0);
  expect(r.weatherCode[0]).toBe(1);
});
```

In `src/tests/windProcessor.test.ts`, update `makeModelData`:

```ts
const makeModelData = (val: number) => ({
  at10m:       Array(2).fill(val),
  at80m:       Array(2).fill(val * 2),
  at120m:      Array(2).fill(val * 3),
  at180m:      Array(2).fill(val * 4),
  temperature: Array(2).fill(20),
  weatherCode: Array(2).fill(0),
});
```

Also update the two inline `ModelData` literals that don't use `makeModelData`.

Line 68 (height interpolation test):
```ts
const grid = buildGrid([{
  at10m: [10], at80m: [80], at120m: [120], at180m: [180],
  temperature: [15], weatherCode: [0],
}], times);
```

Lines 74-75 (averages multiple models test):
```ts
const grid = buildGrid([
  { at10m: [10], at80m: [10], at120m: [10], at180m: [10], temperature: [15], weatherCode: [0] },
  { at10m: [20], at80m: [20], at120m: [20], at180m: [20], temperature: [15], weatherCode: [0] },
], times);
```

- [ ] **Step 6: Extend `ModelData` and update `openMeteo.ts`**

In `src/lib/services/windProcessor.ts`, extend `ModelData`:

```ts
export interface ModelData {
  at10m:       number[];
  at80m:       number[];
  at120m:      number[];
  at180m:      number[];
  temperature: number[];
  weatherCode: number[];
}
```

In `src/lib/services/openMeteo.ts`, replace the `hourly` value in `buildUrl`:

```ts
hourly: 'wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,temperature_2m,weather_code',
```

Replace the `return` in `decodeResponse`:

```ts
return {
  times,
  at10m:       h.wind_speed_10m   as number[],
  at80m:       h.wind_speed_80m   as number[],
  at120m:      h.wind_speed_120m  as number[],
  at180m:      h.wind_speed_180m  as number[],
  temperature: h.temperature_2m   as number[],
  weatherCode: h.weather_code     as number[],
};
```

- [ ] **Step 7: Add `mode()` and update `buildGrid` in `windProcessor.ts`**

Add the exported `mode` function after the existing `mean` function:

```ts
export function mode(values: number[]): number {
  if (values.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}
```

Replace `buildGrid` with the updated version:

```ts
export function buildGrid(models: ModelData[], times: Date[]): WindGrid {
  const hourCount = times.length;
  const data: number[][] = [];
  const temperature: number[] = [];
  const weatherCode: number[] = [];

  for (let t = 0; t < hourCount; t++) {
    const avg10  = mean(removeOutliers(models.map(m => m.at10m[t]  ?? 0)));
    const avg80  = mean(removeOutliers(models.map(m => m.at80m[t]  ?? 0)));
    const avg120 = mean(removeOutliers(models.map(m => m.at120m[t] ?? 0)));
    const avg180 = mean(removeOutliers(models.map(m => m.at180m[t] ?? 0)));

    const row: number[] = [];
    for (let hIdx = 0; hIdx < 18; hIdx++) {
      const heightM = (hIdx + 1) * 10;
      row.push(interpolateWind(heightM, avg10, avg80, avg120, avg180));
    }
    data.push(row);

    temperature.push(mean(removeOutliers(models.map(m => m.temperature[t] ?? 0))));
    weatherCode.push(mode(models.map(m => m.weatherCode[t] ?? 0)));
  }

  return { data, times, modelCount: models.length, temperature, weatherCode };
}
```

- [ ] **Step 8: Run all tests — expect pass**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/services/openMeteo.ts src/lib/services/windProcessor.ts \
        src/tests/openMeteo.test.ts src/tests/windProcessor.test.ts src/tests/windGrid.test.ts
git commit -m "feat: extend data pipeline with temperature and weather code"
```

---

## Task 3: `weatherIcon` utility

**Files:**
- Create: `src/lib/utils/weatherIcon.ts`
- Create: `src/tests/weatherIcon.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/weatherIcon.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { weatherIcon } from '../lib/utils/weatherIcon';

describe('weatherIcon', () => {
  it('clear sky', ()     => expect(weatherIcon(0)).toBe('☀️'));
  it('mainly clear', ()  => expect(weatherIcon(1)).toBe('🌤️'));
  it('partly cloudy', () => expect(weatherIcon(2)).toBe('⛅'));
  it('overcast', ()      => expect(weatherIcon(3)).toBe('☁️'));
  it('fog', ()           => expect(weatherIcon(45)).toBe('🌫️'));
  it('freezing drizzle', () => expect(weatherIcon(56)).toBe('🌦️'));
  it('rain', ()          => expect(weatherIcon(63)).toBe('🌧️'));
  it('freezing rain', () => expect(weatherIcon(66)).toBe('🌧️'));
  it('snow', ()          => expect(weatherIcon(75)).toBe('🌨️'));
  it('thunderstorm', ()  => expect(weatherIcon(95)).toBe('⛈️'));
  it('unknown code', ()  => expect(weatherIcon(999)).toBe('🌡️'));
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/tests/weatherIcon.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/utils/weatherIcon.ts`**

```ts
export function weatherIcon(code: number): string {
  if (code === 0)                                return '☀️';
  if (code === 1)                                return '🌤️';
  if (code === 2)                                return '⛅';
  if (code === 3)                                return '☁️';
  if (code === 45 || code === 48)                return '🌫️';
  if (code >= 51 && code <= 57)                  return '🌦️';
  if (code >= 61 && code <= 67)                  return '🌧️';
  if (code >= 71 && code <= 77)                  return '🌨️';
  if (code >= 80 && code <= 82)                  return '🌦️';
  if (code === 85 || code === 86)                return '🌨️';
  if (code === 95 || code === 96 || code === 99) return '⛈️';
  return '🌡️';
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/tests/weatherIcon.test.ts
```

Expected: 11/11 pass.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/weatherIcon.ts src/tests/weatherIcon.test.ts
git commit -m "feat: add weatherIcon utility with WMO code mapping"
```

---

## Task 4: WeatherStrip component + i18n + Settings + App wiring

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/pl.ts`
- Create: `src/lib/components/WeatherStrip.svelte`
- Modify: `src/lib/components/SettingsSheet.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Add i18n keys to `src/lib/i18n/en.ts`**

Change the import line (line 2) to include `TempUnit`:

```ts
import type { WindUnit, AppAppearance, AppLanguage, TempUnit } from '../types';
```

Add three keys to the `en` object (after the existing `languageNames` key):

```ts
temperature: 'Temperature',
tempUnits: { celsius: '°C', fahrenheit: '°F' } as Record<TempUnit, string>,
now: 'NOW',
```

- [ ] **Step 2: Add i18n keys to `src/lib/i18n/pl.ts`**

Change the import line to include `TempUnit`:

```ts
import type { WindUnit, AppAppearance, AppLanguage, TempUnit } from '../types';
```

Add three keys to the `pl` object (after `languageNames`):

```ts
temperature: 'Temperatura',
tempUnits: { celsius: '°C', fahrenheit: '°F' } as Record<TempUnit, string>,
now: 'TERAZ',
```

- [ ] **Step 3: Run the full test suite — expect pass**

```bash
npx vitest run
```

Expected: all tests pass. (The `Translations` type is derived as `typeof en`, so TypeScript will verify `pl` has the new keys automatically.)

- [ ] **Step 4: Create `src/lib/components/WeatherStrip.svelte`**

```svelte
<!-- src/lib/components/WeatherStrip.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { convertTemp } from '../stores/settingsStore';
  import { weatherIcon } from '../utils/weatherIcon';
  import type { WindGrid, TempUnit } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let unit: TempUnit;

  $: maxIdx = grid.times.length - 1;
  $: indices = [-2, -1, 0, 1, 2].map(d =>
    Math.max(0, Math.min(maxIdx, hourOffset + d))
  );

  function displayTemp(celsius: number): string {
    return convertTemp(celsius, unit).toFixed(0) + (unit === 'fahrenheit' ? '°F' : '°C');
  }
</script>

<div class="strip">
  {#each indices as idx, i}
    <div class="cell" class:active={i === 2} class:dim={i !== 2}>
      {#if i === 2}<span class="now-label">{$t.now}</span>{/if}
      <span class="icon">{weatherIcon(grid.weatherCode[idx])}</span>
      <span class="temp">{displayTemp(grid.temperature[idx])}</span>
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 5px 10px;
    border-radius: 10px;
    min-width: 52px;
    gap: 2px;
  }

  .cell.active {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .cell.dim {
    opacity: 0.5;
    border: 1px solid transparent;
  }

  .now-label {
    font-size: 9px;
    font-weight: 700;
    color: var(--blue);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .icon { font-size: 18px; line-height: 1; }
  .temp { font-size: 11px; font-weight: 700; color: var(--text); }
</style>
```

- [ ] **Step 5: Update `src/lib/components/SettingsSheet.svelte`**

Change the type import (line 5) to include `TempUnit`:

```ts
import type { Settings, WindUnit, AppAppearance, AppLanguage, TempUnit } from '../types';
```

After the `const languages` declaration, add:

```ts
const tempUnits: TempUnit[] = ['celsius', 'fahrenheit'];
```

Insert a new section between the Language section and the Appearance section:

```svelte
<div class="section">
  <div class="section-label">{$t.temperature}</div>
  <div class="seg-group">
    {#each tempUnits as tu}
      <button class:active={settings.tempUnit === tu}
              on:click={() => onChange({ tempUnit: tu })}>
        {$t.tempUnits[tu]}
      </button>
    {/each}
  </div>
</div>
```

- [ ] **Step 6: Update `src/App.svelte`**

Add the import after the existing component imports:

```ts
import WeatherStrip from './lib/components/WeatherStrip.svelte';
```

In the main UI template, insert `<WeatherStrip>` outside the `.chart-area` div, directly before `<TimeSlider>`:

```svelte
<div class="chart-area">
  <HeatmapCanvas
    grid={$windGrid}
    hourOffset={$hourOffset}
    thresholdKmh={$settingsStore.thresholdKmh}
  />
</div>

<WeatherStrip
  grid={$windGrid}
  hourOffset={$hourOffset}
  unit={$settingsStore.tempUnit}
/>

<TimeSlider
  grid={$windGrid}
  hourOffset={$hourOffset}
  thresholdKmh={$settingsStore.thresholdKmh}
  onChange={v => hourOffset.set(v)}
/>
```

- [ ] **Step 7: Run the full test suite — expect pass**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Build to verify no TypeScript errors**

```bash
npx vite build
```

Expected: build completes with 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/pl.ts \
        src/lib/components/WeatherStrip.svelte \
        src/lib/components/SettingsSheet.svelte \
        src/App.svelte
git commit -m "feat: add WeatherStrip component with temperature and weather icons"
```
