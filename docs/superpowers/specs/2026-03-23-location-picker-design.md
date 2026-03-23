# Location Picker — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Replace the GPS-only location model with an Auto/Custom mode. In Auto mode the app behaves as today (GPS). In Custom mode the user picks a location on a full-screen MapLibre GL map (OpenFreeMap tiles) with a search box. The custom location persists across launches. When GPS is denied in Auto mode the app falls back to the custom location if one is set.

---

## Layout

### Settings Sheet — Location section

A new "Location" section appears at the top of `SettingsSheet.svelte`:

```
[ Auto (GPS) ]  [ Custom ]          ← segmented toggle
  📍 Warsaw, Poland   Change →      ← only shown when Custom is active
```

- When **Auto** is selected: no sub-row.
- When **Custom** is selected: a row shows the saved location name (or "Not set" if none) and acts as a tap target to open the LocationPicker.
- Tapping the Custom button when no location is saved immediately opens LocationPicker.

### LocationPicker overlay

Full-screen overlay rendered at the App level (not inside the sheet). Layout top-to-bottom:

```
┌─────────────────────────────────┐
│ ← Back   [ 🔍 Search city… ]   │  ← top bar (blurred backdrop)
│─────────────────────────────────│
│                                 │
│          MapLibre GL map        │
│              📍                 │  ← pin always at centre
│                                 │
│─────────────────────────────────│
│ Warsaw, Poland     [ Confirm ]  │  ← bottom bar (blurred backdrop)
│ 52.23°N  21.01°E               │
└─────────────────────────────────┘
```

- **Search**: Nominatim forward geocoding. Results shown in a dropdown below the top bar. Selecting a result flies the map to that location and drops the pin.
- **Pan-to-place**: the pin is fixed at the CSS centre of the map. The user pans the map to position the pin over the desired location. Pin coordinates update on every `moveend` event via `map.getCenter()`.
- **Reverse geocode**: after any pin movement, `reverseGeocode(lat, lon)` updates the bottom bar name. Falls back to `lat°N lon°E` on failure.
- **Confirm**: saves `{ lat, lon, name }` to `settings.customLocation`, closes the overlay.
- **Back**: discards changes, closes the overlay.
- **Confirm disabled** if map fails to load or no location is picked yet.

---

## Architecture

**Implementation order:** `types.ts` → `settingsStore.ts` → `geocoder.ts` → `en.ts` + `pl.ts` → `LocationPicker.svelte` → `SettingsSheet.svelte` → `App.svelte`. The `Translations` type is derived from `en.ts` (`typeof en`), so `en.ts` must be updated after `types.ts` is updated.

### 1. `src/lib/types.ts`

Add:

```ts
export type LocationMode = 'auto' | 'custom';

export interface CustomLocation {
  lat: number;
  lon: number;
  name: string;
}
```

Extend `Settings`:

```ts
export interface Settings {
  thresholdKmh: number;
  unit: WindUnit;
  appearance: AppAppearance;
  refetchRadiusKm: number;
  language: AppLanguage;
  tempUnit: TempUnit;
  locationMode: LocationMode;            // NEW
  customLocation: CustomLocation | null; // NEW
}
```

### 2. `src/lib/stores/settingsStore.ts`

Add `LocationMode` and `CustomLocation` to the import from `'../types'`.

Export `defaults()` (change `function defaults()` to `export function defaults()`).

Add to `defaults()`:

```ts
locationMode: 'auto',
customLocation: null,
```

The existing `load()` spreads `defaults()` over stored values, so users without these keys get the defaults automatically.

### 3. `src/lib/services/geocoder.ts`

Add `forwardGeocode` alongside the existing `reverseGeocode`:

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

### 4. `src/lib/components/LocationPicker.svelte` — new file

Props:

```ts
export let initialLocation: CustomLocation | null;
export let onConfirm: (loc: CustomLocation) => void;
export let onClose: () => void;
```

Internal state:

```ts
let pickedLocation: CustomLocation | null = initialLocation ?? null;
let searchQuery = '';
let searchResults: GeoResult[] = [];
let mapError = false;
let map: maplibregl.Map | undefined;
```

Behaviour:

- `onMount`: initialise MapLibre GL map with OpenFreeMap Liberty style (`https://tiles.openfreemap.org/styles/liberty`). If `initialLocation` is set, fly to it and place the pin. Otherwise centre on `[0, 20]` zoom 2. On map `error` event: set `mapError = true`.
- `onDestroy`: call `map?.remove()`.
- Search input: debounced 400 ms, calls `forwardGeocode(query)`, shows results dropdown. Selecting a result: `map.flyTo({ center: [lon, lat], zoom: 12 })`.
- **Pin tracks map centre** (standard centre-pin pattern): listen to `map.on('moveend', () => { const c = map.getCenter(); reverseGeocode(c.lat, c.lng).then(name => { pickedLocation = { lat: c.lat, lon: c.lng, name }; }); })`. The pin is always at CSS centre; the user pans the map to position it — do **not** use `map.on('click')` to place the pin (that would create a lat/lon mismatch with the visible pin position).
- Confirm button: disabled when `mapError || !pickedLocation`. On click: calls `onConfirm(pickedLocation)`.

The pin is a fixed `position: absolute` element at the centre of the map container (CSS `50% 50%`), not a MapLibre marker — simpler to style and always stays centred during pan.

### 5. `src/lib/components/SettingsSheet.svelte`

Add `LocationMode` and `CustomLocation` to the type import from `'../types'`.

Add one new exported prop:

```ts
export let onOpenPicker: () => void;
```

Add `const locationModes: LocationMode[] = ['auto', 'custom']`.

Add `onLocationModeChange` helper:

```ts
function onLocationModeChange(lm: LocationMode) {
  onChange({ locationMode: lm });
  if (lm === 'custom' && !settings.customLocation) {
    onOpenPicker();
  }
}
```

Insert a Location section at the top (before Wind Threshold):

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

### 6. `src/App.svelte`

Import `LocationPicker`.

Add state:

```ts
let showLocationPicker = false;
```

Add a reactive statement so that when the user switches to Custom mode with no saved location (e.g. from a persisted setting on launch), the picker opens automatically. The `!showLocationPicker` guard prevents the statement from re-firing while the picker is already open:

```ts
$: if ($settingsStore.locationMode === 'custom' && !$settingsStore.customLocation && !showLocationPicker) {
  showLocationPicker = true;
}
```

Render `<LocationPicker>` at the top level (outside all other overlays). When the user presses Back with no custom location saved, `onClose` must revert `locationMode` to `'auto'` to prevent the reactive statement from re-opening the picker immediately:

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

Update the `<SettingsSheet>` call to add `onOpenPicker`. All existing props are retained unchanged:

```svelte
<SettingsSheet
  settings={$settingsStore}
  modelCount={$fetchState.type === 'loaded' ? $fetchState.modelCount : 0}
  onClose={() => showSettings = false}
  onChange={(s) => settingsStore.update(v => ({ ...v, ...s }))}
  onOpenPicker={() => { showSettings = false; showLocationPicker = true; }}
/>
```

Update `requestLocation()`. The `gpsError = false` reset moves from the top of the function into the Auto branch only. In Custom mode `lastFetchLat`/`lastFetchLon` are intentionally not updated — the haversine radius guard applies to GPS movement only and does not apply to custom locations:

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

### 7. `src/lib/i18n/en.ts`

Add `LocationMode` to the import from `'../types'` (`CustomLocation` is not needed here).

Add to the `en` object:

```ts
location: 'Location',
locationModes: { auto: 'Auto (GPS)', custom: 'Custom' } as Record<LocationMode, string>,
notSet: 'Not set',
change: 'Change',
chooseLocation: 'Choose Location',
```

### 8. `src/lib/i18n/pl.ts`

Add `LocationMode` to the import from `'../types'` (`CustomLocation` is not needed here).

Add to the `pl` object:

```ts
location: 'Lokalizacja',
locationModes: { auto: 'Auto (GPS)', custom: 'Własna' } as Record<LocationMode, string>,
notSet: 'Nie ustawiono',
change: 'Zmień',
chooseLocation: 'Wybierz lokalizację',
```

---

## Data flow

```
Settings.locationMode === 'auto'
  → navigator.geolocation → onLocation(pos) → fetchWind(lat, lon)
  → on GPS error: customLocation set? → fetchWind(custom.lat, custom.lon) silently
  → on GPS error: no custom → gpsError = true

Settings.locationMode === 'custom'
  → custom set? → fetchWind(custom.lat, custom.lon) directly
  → custom null? → reactive statement opens LocationPicker

LocationPicker
  → search: forwardGeocode(query) → map.flyTo → moveend → reverseGeocode → pickedLocation
  → pan map: map 'moveend' → map.getCenter() → reverseGeocode → pickedLocation
  → Confirm: onConfirm(pickedLocation) → settingsStore.update → showLocationPicker = false
```

---

## npm dependency

```bash
npm install maplibre-gl
```

MapLibre GL CSS must be imported in `LocationPicker.svelte`:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

OpenFreeMap style URL: `https://tiles.openfreemap.org/styles/liberty`

---

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| Auto mode, GPS denied, custom set | Use custom location silently |
| Auto mode, GPS denied, no custom | Show existing GPS error |
| Custom mode, no location saved | Reactive statement opens LocationPicker |
| MapLibre fails to load | `mapError = true`; Confirm disabled; error message shown |
| Nominatim search fails | Show "No results"; user can still tap map |
| Reverse geocode fails | Show raw coords (`52.23°N 21.01°E`) |

---

## Testing

Existing 69 tests must continue to pass. New unit tests:

| What | Where | Cases |
|------|-------|-------|
| `forwardGeocode()` | `src/tests/geocoder.test.ts` (new file) | Returns mapped results on success; returns `[]` on HTTP error; returns `[]` on network throw |
| Settings defaults | `src/tests/settingsStore.test.ts` | Import `defaults` from `settingsStore` (now exported); assert `defaults().locationMode === 'auto'`; assert `defaults().customLocation === null` |
