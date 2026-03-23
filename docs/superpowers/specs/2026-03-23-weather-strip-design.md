# Weather Strip — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Add a focused weather strip below the wind heatmap showing temperature and sky condition icons for the currently selected hour and the two hours before and after it. Support °C (default) and °F, selectable in Settings.

---

## Layout

The strip sits **outside** the `.chart-area` div, directly before `<TimeSlider>` in `App.svelte`. It shows **5 cells** centred on `hourOffset`:

```
[ hour-2 ]  [ hour-1 ]  [ NOW ]  [ hour+1 ]  [ hour+2 ]
```

Each cell contains:
1. Weather emoji (top)
2. Temperature value in selected unit (bottom)

The centre cell ("NOW") has a blue highlight background and a small "NOW" label above the emoji. The flanking cells render at reduced opacity (~0.5) to indicate they are context, not focus.

Indices are clamped to `[0, grid.times.length - 1]` — at the start or end of the forecast window the strip simply repeats the boundary value rather than going out of bounds.

---

## Architecture

### 1. `src/lib/types.ts`

Add:

```ts
export type TempUnit = 'celsius' | 'fahrenheit';
```

Add `tempUnit` to `Settings`:

```ts
export interface Settings {
  thresholdKmh: number;
  unit: WindUnit;
  appearance: AppAppearance;
  refetchRadiusKm: number;
  language: AppLanguage;
  tempUnit: TempUnit;   // NEW
}
```

Extend `WindGrid`:

```ts
export interface WindGrid {
  data: number[][];
  times: Date[];
  modelCount: number;
  temperature: number[];   // NEW — 168 entries, raw °C
  weatherCode: number[];   // NEW — 168 entries, WMO hourly codes
}
```

### 2. `src/lib/stores/settingsStore.ts`

Add `TempUnit` to the import from `'../types'`.

Add `tempUnit: 'celsius'` to `defaults()`:

```ts
function defaults(): Settings {
  return {
    thresholdKmh: 25,
    unit: 'kmh',
    appearance: 'auto',
    refetchRadiusKm: 5,
    language: 'auto',
    tempUnit: 'celsius',
  };
}
```

The existing `load()` spreads `defaults()` over stored values, so users with older persisted settings (no `tempUnit` key) correctly receive `'celsius'` as the default.

Add conversion helper (exported):

```ts
export function convertTemp(celsius: number, unit: TempUnit): number {
  return unit === 'fahrenheit' ? celsius * 9 / 5 + 32 : celsius;
}
```

### 3. `src/lib/services/openMeteo.ts`

In `buildUrl`, extend the `hourly` param:

```ts
hourly: 'wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,temperature_2m,weather_code',
```

In `decodeResponse`, extract the new fields:

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

### 4. `src/lib/services/windProcessor.ts`

Extend `ModelData`:

```ts
export interface ModelData {
  at10m:       number[];
  at80m:       number[];
  at120m:      number[];
  at180m:      number[];
  temperature: number[];   // NEW
  weatherCode: number[];   // NEW
}
```

Add an exported `mode` helper (exported so it can be unit-tested directly):

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

In `buildGrid`, declare accumulator arrays before the loop and push into them:

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

### 5. `src/lib/utils/weatherIcon.ts` — new file

`weatherIcon` is extracted to a standalone utility so it can be imported by both `WeatherStrip.svelte` and the test suite.

```ts
export function weatherIcon(code: number): string {
  if (code === 0)                                    return '☀️';
  if (code === 1)                                    return '🌤️';
  if (code === 2)                                    return '⛅';
  if (code === 3)                                    return '☁️';
  if (code === 45 || code === 48)                    return '🌫️';
  if (code >= 51 && code <= 57)                      return '🌦️';  // drizzle + freezing drizzle
  if (code >= 61 && code <= 67)                      return '🌧️';  // rain + freezing rain
  if (code >= 71 && code <= 77)                      return '🌨️';  // snow
  if (code >= 80 && code <= 82)                      return '🌦️';  // rain showers
  if (code === 85 || code === 86)                    return '🌨️';  // snow showers
  if (code === 95 || code === 96 || code === 99)     return '⛈️';  // thunderstorm
  return '🌡️';
}
```

WMO codes 56–57 (freezing drizzle) map to 🌦️; codes 66–67 (freezing rain) map to 🌧️.

### 6. `src/lib/components/WeatherStrip.svelte` — new file

```svelte
<script lang="ts">
  import { t } from '../i18n';
  import { convertTemp } from '../stores/settingsStore';
  import { weatherIcon } from '../utils/weatherIcon';
  import type { WindGrid, TempUnit } from '../types';

  // $t.now is used for the centre cell label (translated: 'NOW' / 'TERAZ')

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

### 7. `src/lib/i18n/en.ts`

Add `TempUnit` to the import from `'../types'`. Add to the `en` object:

```ts
temperature: 'Temperature',
tempUnits: { celsius: '°C', fahrenheit: '°F' } as Record<TempUnit, string>,
now: 'NOW',
```

### 8. `src/lib/i18n/pl.ts`

Add `TempUnit` to the import from `'../types'`. Add to the `pl` object:

```ts
temperature: 'Temperatura',
tempUnits: { celsius: '°C', fahrenheit: '°F' } as Record<TempUnit, string>,
now: 'TERAZ',
```

### 9. `src/lib/components/SettingsSheet.svelte`

Add `TempUnit` to the type import. Add `const tempUnits: TempUnit[] = ['celsius', 'fahrenheit']`.

Insert a new section between Language and Appearance:

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

### 10. Existing test files — update fixtures

Three test files construct `WindGrid` or `ModelData` objects manually. After the type extensions they must include the new fields or TypeScript compilation will fail.

**`src/tests/windGrid.test.ts`** — update `makeGrid`:

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

**`src/tests/openMeteo.test.ts`** — add fields to the `json` fixture:

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

Also add inside the `describe('decodeResponse', ...)` block:

```ts
it('parses temperature and weather code', () => {
  const r = decodeResponse(json);
  expect(r.temperature[0]).toBeCloseTo(12.0);
  expect(r.weatherCode[0]).toBe(1);
});
```

Also add a new `it` inside the existing `describe('buildUrl', ...)` block:

```ts
it('includes temperature and weather code variables', () => {
  const url = buildUrl(0, 0, 'best_match');
  expect(url).toContain('temperature_2m');
  expect(url).toContain('weather_code');
});
```

**`src/tests/windProcessor.test.ts`** — update `makeModelData`, and add `convertTemp` to the import in `settingsStore.test.ts`:

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

**`src/tests/windProcessor.test.ts`** — also update the two inline `ModelData` literals that don't use `makeModelData` (lines 68 and 74-75). Add `temperature` and `weatherCode` arrays to each:

Line 68:
```ts
const grid = buildGrid([{
  at10m: [10], at80m: [80], at120m: [120], at180m: [180],
  temperature: [15], weatherCode: [0],
}], times);
```

Lines 74-75:
```ts
const grid = buildGrid([
  { at10m: [10], at80m: [10], at120m: [10], at180m: [10], temperature: [15], weatherCode: [0] },
  { at10m: [20], at80m: [20], at120m: [20], at180m: [20], temperature: [15], weatherCode: [0] },
], times);
```

### 11. `src/App.svelte`

Import `WeatherStrip`. Insert outside the `.chart-area` wrapper div, directly before `<TimeSlider>`:

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

<TimeSlider ... />
```

---

## Data flow

```
Open-Meteo API (temperature_2m, weather_code)
  → decodeResponse → ModelData.temperature / .weatherCode
  → buildGrid → mode() / mean(removeOutliers())
  → WindGrid.temperature / .weatherCode
  → WeatherStrip props (hourOffset ± 2 window, clamped)
  → displayTemp(celsius) / weatherIcon(code) → render
```

---

## Error handling

- Missing API values (`null` / `undefined`) default to `0` before aggregation — same guard already used for wind speeds. For wind speed `0` means calm, which is accurate. For `weatherCode`, `0` means "clear sky" — a missing data point biases `mode()` toward optimism. This is an accepted trade-off (same pattern, simpler code).
- `mode([])` returns `0`; `weatherIcon(0)` returns `☀️` — no crash.
- Unknown WMO codes (not in the mapping) fall back to `🌡️`.
- `hourOffset` out of bounds is clamped to `[0, grid.times.length - 1]` — no array access error possible.
- Existing users with persisted settings missing `tempUnit` receive `'celsius'` via `defaults()` spread.

---

## Out of scope

- "Feels like" (apparent temperature)
- Precipitation amount or probability
- More than 5 cells in the focused panel
- Temperature in the summary strip cards

---

## Testing

Existing 47 tests must continue to pass. New unit tests required:

| What | Where | Cases |
|------|-------|-------|
| `mode()` | `windProcessor.test.ts` | empty array → 0; single value; clear majority; tie (any winner acceptable) |
| `weatherIcon()` | new `src/tests/weatherIcon.test.ts` | code 0→☀️, 3→☁️, 45→🌫️, 56→🌦️, 63→🌧️, 66→🌧️, 75→🌨️, 95→⛈️, unknown→🌡️ |
| `convertTemp()` | `settingsStore.test.ts` (add `convertTemp` to the import from `settingsStore`) | celsius identity (20→20); known °F (0°C→32°F, 100°C→212°F) |
| `buildGrid` extension | `windProcessor.test.ts` | output has `temperature` array of correct length; `weatherCode` array of correct length |
