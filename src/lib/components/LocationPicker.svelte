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
