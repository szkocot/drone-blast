# Location Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Auto/Custom location mode — in Auto mode the app uses GPS as today; in Custom mode the user picks a location on a full-screen MapLibre GL map with a search box, and that location persists across launches.

**Architecture:** `LocationMode` and `CustomLocation` are added to the `Settings` interface (persisted via existing `localStorage` mechanism). A new full-screen `LocationPicker.svelte` overlay uses MapLibre GL (OpenFreeMap tiles) with a fixed centre-pin and `moveend`-based coordinate reading. `App.svelte` controls when the picker is shown and rewrites `requestLocation()` to branch on mode.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest, MapLibre GL (`maplibre-gl`), OpenFreeMap tiles, Nominatim geocoding API (no key required).

---

## File map

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `LocationMode`, `CustomLocation`; extend `Settings` |
| `src/lib/stores/settingsStore.ts` | Export `defaults()`; add `locationMode`, `customLocation` defaults |
| `src/lib/services/geocoder.ts` | Add `GeoResult` interface + `forwardGeocode()` |
| `src/lib/i18n/en.ts` | Add location-related translation keys |
| `src/lib/i18n/pl.ts` | Add location-related translation keys (Polish) |
| `src/lib/components/LocationPicker.svelte` | **New** — full-screen map overlay component |
| `src/lib/components/SettingsSheet.svelte` | Add `onOpenPicker` prop + Location section |
| `src/App.svelte` | `showLocationPicker` state, reactive guard, rewrite `requestLocation()` |
| `src/tests/settingsStore.test.ts` | Tests for new `defaults()` fields |
| `src/tests/geocoder.test.ts` | **New** — tests for `forwardGeocode()` |

---

### Task 1: Types + settings store

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/stores/settingsStore.ts`
- Test: `src/tests/settingsStore.test.ts`

- [ ] **Step 1: Write failing tests for new defaults**

Open `src/tests/settingsStore.test.ts`. Add `defaults` to the **existing import line at the top** of the file (line 4):

```ts
import { convertFromKmh, convertToKmh, thresholdStep, windColor, haversineKm, convertTemp, defaults } from '../lib/stores/settingsStore';
```

Then add at the bottom of the file:

```ts
describe('defaults', () => {
  it('locationMode defaults to auto', () => {
    expect(defaults().locationMode).toBe('auto');
  });
  it('customLocation defaults to null', () => {
    expect(defaults().customLocation).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --run src/tests/settingsStore.test.ts
```

Expected: FAIL — `defaults` is not exported / `locationMode` does not exist.

- [ ] **Step 3: Add types to `src/lib/types.ts`**

After the existing type aliases (line 6, after `TempUnit`), add:

```ts
export type LocationMode = 'auto' | 'custom';

export interface CustomLocation {
  lat: number;
  lon: number;
  name: string;
}
```

Extend `Settings` (replace the existing interface):

```ts
export interface Settings {
  thresholdKmh: number;
  unit: WindUnit;
  appearance: AppAppearance;
  refetchRadiusKm: number;
  language: AppLanguage;
  tempUnit: TempUnit;
  locationMode: LocationMode;
  customLocation: CustomLocation | null;
}
```

- [ ] **Step 4: Update `src/lib/stores/settingsStore.ts`**

Change the import to include the new types:

```ts
import type { Settings, WindUnit, TempUnit, LocationMode, CustomLocation } from '../types';
```

Change `function defaults()` to `export function defaults()`:

```ts
export function defaults(): Settings {
  return {
    thresholdKmh: 25,
    unit: 'kmh',
    appearance: 'auto',
    refetchRadiusKm: 5,
    language: 'auto',
    tempUnit: 'celsius',
    locationMode: 'auto',
    customLocation: null,
  };
}
```

- [ ] **Step 5: Run all tests — verify they pass**

```bash
npm test -- --run
```

Expected: all tests pass (previously 69, now 71 with the 2 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/stores/settingsStore.ts src/tests/settingsStore.test.ts
git commit -m "feat: add LocationMode and CustomLocation types, export defaults"
```

---

### Task 2: forwardGeocode

**Files:**
- Modify: `src/lib/services/geocoder.ts`
- Create: `src/tests/geocoder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/geocoder.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { forwardGeocode } from '../lib/services/geocoder';

afterEach(() => vi.restoreAllMocks());

describe('forwardGeocode', () => {
  it('returns mapped results on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: 'Warsaw, Masovian Voivodeship, Poland', lat: '52.23', lon: '21.01' },
        { display_name: 'Warsaw, Indiana, United States', lat: '41.23', lon: '-85.85' },
      ],
    }));
    const results = await forwardGeocode('Warsaw');
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Warsaw, Masovian Voivodeship');
    expect(results[0].lat).toBeCloseTo(52.23);
    expect(results[0].lon).toBeCloseTo(21.01);
  });

  it('returns [] on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const results = await forwardGeocode('nowhere');
    expect(results).toEqual([]);
  });

  it('returns [] on network throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const results = await forwardGeocode('nowhere');
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --run src/tests/geocoder.test.ts
```

Expected: FAIL — `forwardGeocode` is not exported.

- [ ] **Step 3: Add `GeoResult` and `forwardGeocode` to `src/lib/services/geocoder.ts`**

Append after the existing `reverseGeocode` function:

```ts
export interface GeoResult {
  name: string;
  lat: number;
  lon: number;
}

export async function forwardGeocode(query: string): Promise<GeoResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: { display_name: string; lat: string; lon: string }) => ({
      name: r.display_name.split(',').slice(0, 2).join(',').trim(),
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --run src/tests/geocoder.test.ts
```

Expected: 3/3 pass.

- [ ] **Step 5: Run full suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/geocoder.ts src/tests/geocoder.test.ts
git commit -m "feat: add forwardGeocode with Nominatim and geocoder tests"
```

---

### Task 3: i18n keys

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/pl.ts`

No new test file — TypeScript structural typing against `Translations = typeof en` catches any missing Polish keys at compile time.

- [ ] **Step 1: Update `src/lib/i18n/en.ts`**

Change the import line to include `LocationMode`:

```ts
import type { WindUnit, AppAppearance, AppLanguage, TempUnit, LocationMode } from '../types';
```

Add the following keys to the `en` object, after the `now` key:

```ts
location: 'Location',
locationModes: { auto: 'Auto (GPS)', custom: 'Custom' } as Record<LocationMode, string>,
notSet: 'Not set',
change: 'Change',
chooseLocation: 'Choose Location',
back: 'Back',
```

- [ ] **Step 2: Update `src/lib/i18n/pl.ts`**

Change the import line to include `LocationMode`:

```ts
import type { WindUnit, AppAppearance, AppLanguage, TempUnit, LocationMode } from '../types';
```

Add the following keys to the `pl` object, after the `now` key:

```ts
location: 'Lokalizacja',
locationModes: { auto: 'Auto (GPS)', custom: 'Własna' } as Record<LocationMode, string>,
notSet: 'Nie ustawiono',
change: 'Zmień',
chooseLocation: 'Wybierz lokalizację',
back: 'Wstecz',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full suite**

```bash
npm test -- --run
```

Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/pl.ts
git commit -m "feat: add location picker i18n keys"
```

---

### Task 4: LocationPicker component

**Prerequisite:** Tasks 1, 2, and 3 must be complete (types, `forwardGeocode`/`GeoResult`, and i18n keys must all exist — `LocationPicker.svelte` imports from all three).

**Files:**
- Create: `src/lib/components/LocationPicker.svelte`

- [ ] **Step 1: Install maplibre-gl**

```bash
npm install maplibre-gl
```

Verify it appears in `package.json` dependencies.

- [ ] **Step 2: Create `src/lib/components/LocationPicker.svelte`**

```svelte
<!-- src/lib/components/LocationPicker.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { t } from '../i18n';
  import { reverseGeocode, forwardGeocode } from '../services/geocoder';
  import type { GeoResult } from '../services/geocoder';
  import type { CustomLocation } from '../types';

  export let initialLocation: CustomLocation | null;
  export let onConfirm: (loc: CustomLocation) => void;
  export let onClose: () => void;

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map | undefined;
  let mapError = false;

  let pickedLocation: CustomLocation | null = initialLocation ?? null;
  let searchQuery = '';
  let searchResults: GeoResult[] = [];
  let searchAttempted = false;
  let searchTimeout: ReturnType<typeof setTimeout>;

  function formatCoords(lat: number, lon: number): string {
    return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  }

  function onSearchInput() {
    clearTimeout(searchTimeout);
    if (searchQuery.length < 2) { searchResults = []; searchAttempted = false; return; }
    searchTimeout = setTimeout(async () => {
      searchResults = await forwardGeocode(searchQuery);
      searchAttempted = true;
    }, 400);
  }

  function selectResult(result: GeoResult) {
    searchQuery = '';
    searchResults = [];
    pickedLocation = { lat: result.lat, lon: result.lon, name: result.name };
    map?.flyTo({ center: [result.lon, result.lat], zoom: 12 });
  }

  onMount(() => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: initialLocation ? [initialLocation.lon, initialLocation.lat] : [0, 20],
      zoom: initialLocation ? 12 : 2,
    });

    map.on('error', () => { mapError = true; });

    map.on('moveend', async () => {
      if (!map) return;
      const c = map.getCenter();
      const name = await reverseGeocode(c.lat, c.lng);
      pickedLocation = { lat: c.lat, lon: c.lng, name };
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
  });

  onDestroy(() => {
    map?.remove();
  });
</script>

<div class="overlay">
  <!-- Top bar -->
  <div class="top-bar">
    <button class="back-btn" on:click={onClose}>← {$t.back}</button>
    <div class="search-wrap">
      <input
        class="search-input"
        type="text"
        placeholder="🔍 {$t.chooseLocation}…"
        bind:value={searchQuery}
        on:input={onSearchInput}
      />
      {#if searchResults.length > 0}
        <div class="results-dropdown">
          {#each searchResults as result}
            <button class="result-item" on:click={() => selectResult(result)}>
              <span class="result-name">{result.name}</span>
            </button>
          {/each}
        </div>
      {:else if searchAttempted && searchQuery.length >= 2}
        <div class="results-dropdown">
          <div class="result-item no-results">No results</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Map -->
  <div class="map-wrap">
    <div bind:this={mapContainer} class="map"></div>
    <!-- Fixed centre pin -->
    <div class="centre-pin" aria-hidden="true">📍</div>
    {#if mapError}
      <div class="map-error">Map unavailable</div>
    {/if}
  </div>

  <!-- Bottom bar -->
  <div class="bottom-bar">
    <div class="location-info">
      {#if pickedLocation}
        <div class="location-name">{pickedLocation.name}</div>
        <div class="location-coords">{formatCoords(pickedLocation.lat, pickedLocation.lon)}</div>
      {:else}
        <div class="location-name">{$t.notSet}</div>
      {/if}
    </div>
    <button
      class="confirm-btn"
      disabled={mapError || !pickedLocation}
      on:click={() => pickedLocation && onConfirm(pickedLocation)}
    >
      {$t.done}
    </button>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    z-index: 100;
    display: flex; flex-direction: column;
    background: var(--bg);
  }

  .top-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .back-btn {
    flex-shrink: 0;
    background: none; border: none;
    color: var(--blue); font-size: 13px; font-weight: 600;
    cursor: pointer; padding: 4px 0;
  }
  .search-wrap { flex: 1; position: relative; }
  .search-input {
    width: 100%; box-sizing: border-box;
    padding: 7px 10px; border-radius: 8px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); font-size: 13px;
  }
  .results-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 10;
  }
  .result-item {
    display: block; width: 100%; text-align: left;
    padding: 10px 12px; background: none; border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer; color: var(--text); font-size: 13px;
  }
  .result-item:last-child { border-bottom: none; }
  .result-item:hover { background: var(--surface2); }
  .result-item.no-results { color: var(--text-muted); font-style: italic; cursor: default; }
  .result-name { display: block; }

  .map-wrap { flex: 1; position: relative; }
  .map { width: 100%; height: 100%; }

  .centre-pin {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -100%);
    font-size: 32px;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
    pointer-events: none;
    z-index: 1;
  }
  .map-error {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6);
    color: var(--text-muted); font-size: 14px;
  }

  .bottom-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .location-info { flex: 1; min-width: 0; }
  .location-name { font-size: 14px; font-weight: 700; color: var(--text); }
  .location-coords { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .confirm-btn {
    padding: 10px 20px; border-radius: 10px;
    background: var(--blue); color: #fff;
    border: none; font-size: 14px; font-weight: 600;
    cursor: pointer; flex-shrink: 0; margin-left: 12px;
  }
  .confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full suite**

```bash
npm test -- --run
```

Expected: all tests still pass (LocationPicker is a Svelte component — no unit tests needed; behaviour tested via integration).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/LocationPicker.svelte package.json package-lock.json
git commit -m "feat: add LocationPicker component with MapLibre GL and Nominatim search"
```

---

### Task 5: SettingsSheet + App wiring

**Prerequisite:** Tasks 1, 3, and 4 must be complete.

**Files:**
- Modify: `src/lib/components/SettingsSheet.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Update `src/lib/components/SettingsSheet.svelte`**

Change the type import to include the new types (line 5):

```ts
import type { Settings, WindUnit, AppAppearance, AppLanguage, TempUnit, LocationMode, CustomLocation } from '../types';
```

Add the new exported prop after line 10 (`export let onChange`):

```ts
export let onOpenPicker: () => void;
```

Add the `locationModes` array and `onLocationModeChange` helper after the existing arrays (after line 27, `const tempUnits`):

```ts
const locationModes: LocationMode[] = ['auto', 'custom'];

function onLocationModeChange(lm: LocationMode) {
  onChange({ locationMode: lm });
  if (lm === 'custom' && !settings.customLocation) {
    onOpenPicker();
  }
}
```

Insert the Location section as the **first** section in the sheet, before the Wind Threshold section (before line 37, `<div class="section">`):

```svelte
<div class="section">
  <div class="section-label">{$t.location}</div>
  <div class="seg-group">
    {#each locationModes as lm}
      <button class:active={settings.locationMode === lm}
              on:click={() => onLocationModeChange(lm)}>
        {$t.locationModes[lm]}
      </button>
    {/each}
  </div>
  {#if settings.locationMode === 'custom'}
    <button class="location-row" on:click={onOpenPicker}>
      <span class="location-name">
        {settings.customLocation?.name ?? $t.notSet}
      </span>
      <span class="location-change">{$t.change} →</span>
    </button>
  {/if}
</div>
```

Add styles for the new location row at the bottom of `<style>`:

```css
.location-row {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; background: none; border: none;
  padding: 8px 0 0; cursor: pointer; color: var(--text);
}
.location-name { font-size: 13px; font-weight: 600; }
.location-change { font-size: 12px; color: var(--blue); }
```

- [ ] **Step 2: Verify TypeScript compiles after SettingsSheet change**

```bash
npx tsc --noEmit
```

Expected: error that `onOpenPicker` is missing from the call site in `App.svelte`. That is expected — we fix it next.

- [ ] **Step 3: Update `src/App.svelte`**

**3a.** Add the `LocationPicker` import after the other component imports (after line 17):

```ts
import LocationPicker from './lib/components/LocationPicker.svelte';
```

**3b.** Add `showLocationPicker` state after `showSettings` (line 19):

```ts
let showLocationPicker = false;
```

**3c.** Add a reactive statement after the theme reactive block (after line 29):

```ts
// Open picker automatically when in Custom mode with no saved location
$: if ($settingsStore.locationMode === 'custom' && !$settingsStore.customLocation && !showLocationPicker) {
  showLocationPicker = true;
}
```

**3d.** Replace `requestLocation()` (lines 47–50) with:

```ts
function requestLocation() {
  const mode = $settingsStore.locationMode;
  const custom = $settingsStore.customLocation;

  if (mode === 'custom') {
    if (custom) {
      fetchWind(custom.lat, custom.lon);
      locationName.set(custom.name);
    }
    // No custom location yet — picker will open via reactive statement above
    return;
  }

  // Auto mode
  gpsError = false;
  navigator.geolocation.getCurrentPosition(onLocation, () => {
    if (custom) {
      fetchWind(custom.lat, custom.lon);
      locationName.set(custom.name);
    } else {
      gpsError = true;
    }
  });
}
```

**3e.** Update the `<SettingsSheet>` call (lines 143–148) to add `onOpenPicker`:

```svelte
<SettingsSheet
  settings={$settingsStore}
  modelCount={$fetchState.type === 'loaded' ? $fetchState.modelCount : 0}
  onClose={() => showSettings = false}
  onChange={patch => settingsStore.update(s => ({ ...s, ...patch }))}
  onOpenPicker={() => { showSettings = false; showLocationPicker = true; }}
/>
```

**3f.** Add the `<LocationPicker>` block after the `{#if showSettings}` block (after line 149):

```svelte
{#if showLocationPicker}
  <LocationPicker
    initialLocation={$settingsStore.customLocation}
    onConfirm={(loc) => {
      settingsStore.update(s => ({ ...s, customLocation: loc }));
      showLocationPicker = false;
    }}
    onClose={() => {
      showLocationPicker = false;
      if (!$settingsStore.customLocation) {
        settingsStore.update(s => ({ ...s, locationMode: 'auto' }));
      }
    }}
  />
{/if}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Run full suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/SettingsSheet.svelte src/App.svelte
git commit -m "feat: wire LocationPicker into SettingsSheet and App"
```
