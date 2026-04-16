<!-- src/lib/components/WindMap.svelte -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { t } from '../i18n';
  import type { GeoResult } from '../services/geocoder';
  import type { OverlayDensity, OverlaySample } from '../types';
  import type { OverlayBounds } from '../services/mapOverlay';
  import MapOverlayCanvas from './MapOverlayCanvas.svelte';

  type WindMapMode = 'auto' | 'custom';

  interface WindMapHourChip {
    id: string;
    label: string;
    sublabel?: string;
    active?: boolean;
    disabled?: boolean;
  }

  interface WindMapViewport {
    center: { lng: number; lat: number };
    zoom: number;
    bounds: { west: number; south: number; east: number; north: number } | null;
  }

  interface WindMapMarker {
    lat: number;
    lon: number;
    name?: string;
  }

  export let mode: WindMapMode = 'auto';
  export let locationLabel = '';
  export let searchValue = '';
  export let searchResults: GeoResult[] = [];
  export let searchAttempted = false;
  export let searchPlaceholder = '';
  export let selectedHourLabel = '';
  export let isCurrentHourSelected = false;
  export let hourChips: WindMapHourChip[] = [];
  export let overlaySamples: OverlaySample[] = [];
  export let overlayBounds: OverlayBounds | null = null;
  export let overlayThresholdKmh = 0;
  export let overlayDensity: OverlayDensity = 'medium';
  export let overlayStatusLabel = '';
  export let mapStyle = 'https://tiles.openfreemap.org/styles/liberty';
  export let initialCenter: [number, number] = [0, 20];
  export let initialZoom = 2;
  export let selectedMarker: WindMapMarker | null = null;
  export let primaryActionLabel = '';
  export let secondaryActionLabel = '';
  export let onBack: () => void = () => {};
  export let onSearchChange: (value: string) => void = () => {};
  export let onSearchSelect: (result: GeoResult) => void = () => {};
  export let onMapSelect: (location: WindMapMarker) => void = () => {};
  export let onModeChange: (nextMode: WindMapMode) => void = () => {};
  export let onHourSelect: (id: string) => void = () => {};
  export let onPrimaryAction: () => void = () => {};
  export let onSecondaryAction: () => void = () => {};
  export let onViewportChange: (viewport: WindMapViewport) => void = () => {};
  export let onMapReady: (map: maplibregl.Map) => void = () => {};

  let mapContainer: HTMLDivElement | undefined;
  let map: maplibregl.Map | undefined;
  let mapError = false;
  let mapReady = false;
  let selectedMarkerScreen: { x: number; y: number } | null = null;

  function emitViewport() {
    if (!map) return;

    const center = map.getCenter();
    const bounds = map.getBounds();

    onViewportChange({
      center: { lng: center.lng, lat: center.lat },
      zoom: map.getZoom(),
      bounds: bounds
        ? {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          }
        : null,
    });
  }

  function updateSelectedMarkerScreen() {
    if (!map || mode !== 'custom' || !selectedMarker) {
      selectedMarkerScreen = null;
      return;
    }

    const projected = map.project([selectedMarker.lon, selectedMarker.lat]);
    selectedMarkerScreen = { x: projected.x, y: projected.y };
  }

  onMount(() => {
    if (!mapContainer) return;

    map = new maplibregl.Map({
      container: mapContainer,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
    });

    map.on('error', () => {
      mapError = true;
    });
    map.on('load', () => {
      mapReady = true;
      onMapReady(map as maplibregl.Map);
      updateSelectedMarkerScreen();
      emitViewport();
    });
    map.on('click', (event) => {
      if (mode !== 'custom') return;
      onMapSelect({ lat: event.lngLat.lat, lon: event.lngLat.lng });
    });
    map.on('move', updateSelectedMarkerScreen);
    map.on('moveend', () => {
      updateSelectedMarkerScreen();
      emitViewport();
    });
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    return () => {
      map?.remove();
      map = undefined;
    };
  });

  onDestroy(() => {
    map?.remove();
  });

  $: {
    map;
    mode;
    selectedMarker;
    updateSelectedMarkerScreen();
  }

  $: primaryLabel = primaryActionLabel || (mode === 'custom' ? $t.confirmCustomLocation : $t.useCurrentView);
  $: secondaryLabel = secondaryActionLabel || $t.cancel;
</script>

<div class="wind-map-shell">
  <header class="top-chrome">
    <div class="title-stack">
      <button class="back-btn" type="button" on:click={onBack}>{$t.back}</button>
      <div class="title-row">
        <span class="title">{$t.appName}</span>
        <span class="subtitle">{locationLabel || selectedHourLabel || $t.chooseLocation}</span>
      </div>
    </div>

    <div class="mode-toggle" role="tablist" aria-label={$t.location}>
      <button
        type="button"
        class:active={mode === 'auto'}
        aria-pressed={mode === 'auto'}
        on:click={() => onModeChange('auto')}
      >
        {$t.locationModes.auto}
      </button>
      <button
        type="button"
        class:active={mode === 'custom'}
        aria-pressed={mode === 'custom'}
        on:click={() => onModeChange('custom')}
      >
        {$t.locationModes.custom}
      </button>
    </div>
  </header>

  <section class="search-row" aria-label="Wind map search">
    <label class="search-shell">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        value={searchValue}
        placeholder={searchPlaceholder || $t.chooseLocation}
        on:input={(event) => onSearchChange((event.currentTarget as HTMLInputElement).value)}
      />
    </label>
    {#if searchResults.length > 0}
      <div class="search-results">
        {#each searchResults as result}
          <button type="button" class="search-result" on:click={() => onSearchSelect(result)}>
            <span class="result-name">{result.name}</span>
            <span class="result-coords">{result.lat.toFixed(2)}°, {result.lon.toFixed(2)}°</span>
          </button>
        {/each}
      </div>
    {:else if searchAttempted && searchValue.trim().length >= 2}
      <div class="search-results">
        <div class="search-empty">{$t.noResults}</div>
      </div>
    {/if}
  </section>

  <section class="hour-strip" aria-label="Forecast hours">
    <button
      type="button"
      class:active={isCurrentHourSelected}
      on:click={() => onHourSelect('now')}
    >
      {$t.now}
    </button>

    {#each hourChips as chip}
      <button
        type="button"
        class:active={chip.active}
        disabled={chip.disabled}
        on:click={() => onHourSelect(chip.id)}
      >
        <span>{chip.label}</span>
        {#if chip.sublabel}
          <small>{chip.sublabel}</small>
        {/if}
      </button>
    {/each}
  </section>

  <main class="map-stage">
    <slot name="map-body">
      <div bind:this={mapContainer} class="map-body" aria-label="Wind map body"></div>
    </slot>

    <div class="overlay-controls">
      <slot name="overlay-controls">
        <div class="overlay-chip">{selectedHourLabel || $t.now}</div>
        <div class="overlay-chip">{mode === 'custom' ? $t.locationModes.custom : $t.locationModes.auto}</div>
        {#if overlayStatusLabel}
          <div class="overlay-chip danger">{overlayStatusLabel}</div>
        {/if}
        {#if mapReady}
          <div class="overlay-chip ok">{$t.mapReady}</div>
        {:else if mapError}
          <div class="overlay-chip danger">{$t.mapError}</div>
        {/if}
      </slot>
    </div>

    <MapOverlayCanvas
      samples={overlaySamples}
      bounds={overlayBounds}
      thresholdKmh={overlayThresholdKmh}
      density={overlayDensity}
    />
    {#if mode === 'custom' && selectedMarkerScreen}
      <div
        class="selected-marker"
        aria-hidden="true"
        style={`left:${selectedMarkerScreen.x}px;top:${selectedMarkerScreen.y}px;`}
      >
        📍
      </div>
    {/if}
  </main>

  <footer class="bottom-sheet">
    <div class="summary">
      <div class="summary-label">{$t.location}</div>
      <div class="summary-value">{locationLabel || $t.notSet}</div>
      <div class="summary-hint">{selectedHourLabel || $t.sliderHint}</div>
    </div>

    <div class="sheet-actions">
      <button type="button" class="ghost" on:click={onSecondaryAction}>{secondaryLabel}</button>
      <button type="button" class="primary" on:click={onPrimaryAction}>{primaryLabel}</button>
    </div>
  </footer>
</div>

<style>
  .wind-map-shell {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at top left, rgba(64, 113, 255, 0.16), transparent 38%),
      radial-gradient(circle at bottom right, rgba(0, 194, 255, 0.08), transparent 42%),
      var(--bg);
  }

  .top-chrome {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: calc(10px + var(--safe-top)) 12px 10px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(14px);
    flex-shrink: 0;
  }

  .title-stack {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .back-btn {
    width: fit-content;
    padding: 0;
    border: 0;
    background: none;
    color: var(--blue);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .title-row {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: var(--text);
  }

  .subtitle {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-toggle {
    display: inline-flex;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface2);
    flex-shrink: 0;
  }

  .mode-toggle button,
  .hour-strip button,
  .sheet-actions button {
    border: 0;
    cursor: pointer;
  }

  .mode-toggle button {
    min-height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .mode-toggle button.active {
    background: var(--blue);
    color: #fff;
  }

  .search-row {
    position: relative;
    padding: 10px 12px 0;
    flex-shrink: 0;
    z-index: 2;
  }

  .search-shell {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
  }

  .search-icon {
    font-size: 16px;
    color: var(--text-muted);
    line-height: 1;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .search-results {
    position: absolute;
    left: 12px;
    right: 12px;
    top: calc(100% + 4px);
    display: grid;
    gap: 2px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
  }

  .search-result,
  .search-empty {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 10px;
    color: var(--text);
    text-align: left;
    background: transparent;
  }

  .search-result:hover {
    background: var(--surface2);
  }

  .result-name {
    font-size: 13px;
    font-weight: 700;
  }

  .result-coords,
  .search-empty {
    font-size: 11px;
    color: var(--text-muted);
  }

  .hour-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 10px 12px 12px;
    flex-shrink: 0;
  }

  .hour-strip button {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    flex: 0 0 auto;
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--surface2);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.1;
  }

  .hour-strip button small {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 600;
  }

  .hour-strip button.active {
    background: var(--blue);
    color: #fff;
  }

  .hour-strip button.active small {
    color: rgba(255, 255, 255, 0.82);
  }

  .hour-strip button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .map-stage {
    position: relative;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(11, 15, 24, 0.1), rgba(11, 15, 24, 0.2));
  }

  .map-body {
    position: absolute;
    inset: 0;
  }

  .selected-marker {
    position: absolute;
    z-index: 14;
    font-size: 32px;
    transform: translate(-50%, -100%);
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
    pointer-events: none;
  }

  .overlay-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: calc(100% - 24px);
    pointer-events: auto;
  }

  .overlay-chip {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 10px;
    border: 1px solid rgba(18, 31, 46, 0.18);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.97);
    color: rgba(18, 31, 46, 0.92);
    font-size: 11px;
    font-weight: 800;
    box-shadow: 0 4px 14px rgba(18, 31, 46, 0.12);
    backdrop-filter: blur(12px);
  }

  .overlay-chip.ok {
    color: #0b8f61;
  }

  .overlay-chip.danger {
    color: #c63d3d;
  }

  :global(html[data-theme='dark']) .overlay-chip {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(20, 28, 40, 0.9);
    color: rgba(245, 248, 252, 0.94);
    box-shadow: none;
  }

  :global(html[data-theme='dark']) .overlay-chip.ok {
    color: var(--green);
  }

  :global(html[data-theme='dark']) .overlay-chip.danger {
    color: var(--red);
  }

  .bottom-sheet {
    display: grid;
    gap: 12px;
    padding: 12px 16px calc(12px + var(--safe-bottom));
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    backdrop-filter: blur(14px);
    flex-shrink: 0;
  }

  .summary {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .summary-label {
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .summary-value {
    font-size: 14px;
    font-weight: 800;
    color: var(--text);
  }

  .summary-hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  .sheet-actions {
    display: flex;
    gap: 10px;
  }

  .sheet-actions button {
    min-height: 44px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 800;
  }

  .sheet-actions .ghost {
    flex: 1;
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
  }

  .sheet-actions .primary {
    flex: 1.2;
    background: var(--blue);
    color: #fff;
  }

  @media (min-width: 960px) {
    .wind-map-shell {
      max-width: 560px;
      margin: 0 auto;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }
  }
</style>
