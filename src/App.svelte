<!-- src/App.svelte -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { t } from './lib/i18n';
  import { windGrid, fetchState, hourOffset, fetchWind, locationName } from './lib/stores/windStore';
  import { settingsStore, haversineKm } from './lib/stores/settingsStore';
  import { forwardGeocode, reverseGeocode, type GeoResult } from './lib/services/geocoder';
  import { kpStore, fetchKp } from './lib/stores/kpStore';
  import { createMapOverlayController } from './lib/stores/mapOverlayStore';
  import { densityForZoom } from './lib/services/mapOverlay';
  import { decideAutoLocationFailure } from './lib/startupLocation';
  import { currentHourIndex } from './lib/windGrid';

  import AppHeader       from './lib/components/AppHeader.svelte';
  import SummaryStrip    from './lib/components/SummaryStrip.svelte';
  import HeatmapCanvas   from './lib/components/HeatmapCanvas.svelte';
  import TimeSlider      from './lib/components/TimeSlider.svelte';
  import ThresholdFooter from './lib/components/ThresholdFooter.svelte';
  import SettingsSheet   from './lib/components/SettingsSheet.svelte';
  import WindMap from './lib/components/WindMap.svelte';
  import ErrorBanner     from './lib/components/ErrorBanner.svelte';
  import DesktopUtilityRail from './lib/components/DesktopUtilityRail.svelte';
  import SelectedHourDetails from './lib/components/SelectedHourDetails.svelte';
  import WeatherStrip from './lib/components/WeatherStrip.svelte';

  let showSettings = false;
  let showWindMap = false;

  let lastFetchLat: number | null = null;
  let lastFetchLon: number | null = null;
  let lastKnownLocationName = '';
  let windMapInstance: MapLibreMap | null = null;
  let latestViewportRequest = 0;
  let searchQuery = '';
  let searchResults: GeoResult[] = [];
  let searchAttempted = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let viewportBounds: { west: number; south: number; east: number; north: number } | null = null;
  let viewportZoom = 0;
  let lastGridSignature = '';
  let latestMarkerRequest = 0;

  const mapOverlay = createMapOverlayController();

  // Tracks the location config key at last fetch — empty until onMount fires
  let _lastFetchedKey = '';

  // Re-fetch when locationMode or customLocation changes after initial mount
  $: {
    const key = $settingsStore.locationMode + '|' + JSON.stringify($settingsStore.customLocation);
    if (_lastFetchedKey && key !== _lastFetchedKey) {
      _lastFetchedKey = key;
      requestLocation(true);
    }
  }

  $: if (showWindMap && viewportBounds) {
    void mapOverlay.loadOverlayForViewport({
      bounds: {
        north: viewportBounds.north,
        south: viewportBounds.south,
        east: viewportBounds.east,
        west: viewportBounds.west,
      },
      zoom: viewportZoom,
      hourIndex: $hourOffset,
    });
  }

  $: if ($windGrid) {
    const signature = `${$windGrid.times[0]?.getTime() ?? 0}:${$windGrid.times.length}`;
    if (signature !== lastGridSignature) {
      lastGridSignature = signature;
      const currentIndex = currentHourIndex($windGrid);
      hourOffset.set(currentIndex);
      mapOverlay.setSelectedHour(currentIndex);
    }
  }

  // Apply theme
  $: {
    const ap = $settingsStore.appearance;
    if (ap === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', ap);
  }

  function onLocation(pos: GeolocationPosition, forceForecastFetch = false) {
    const { latitude: lat, longitude: lon } = pos.coords;
    const radius = $settingsStore.refetchRadiusKm;
    if (
      lastFetchLat !== null &&
      lastFetchLon !== null &&
      haversineKm(lastFetchLat, lastFetchLon, lat, lon) < radius
    ) {
      return; // within radius — skip re-fetch
    }
    lastFetchLat = lat;
    lastFetchLon = lon;
    fetchWind(lat, lon, { force: forceForecastFetch });
    reverseGeocode(lat, lon).then(name => {
      lastKnownLocationName = name;
      locationName.set(name);
    });
  }

  function fetchCustomLocation(lat: number, lon: number, name: string, forceForecastFetch = false) {
    // Custom/fallback fetches must invalidate the GPS radius cache so
    // switching back to Auto or recovering GPS triggers a fresh load.
    lastFetchLat = null;
    lastFetchLon = null;
    fetchWind(lat, lon, { force: forceForecastFetch });
    lastKnownLocationName = name;
    locationName.set(name);
  }

  function currentLocation() {
    if ($settingsStore.locationMode === 'custom' && $settingsStore.customLocation) {
      return $settingsStore.customLocation;
    }
    if (lastFetchLat !== null && lastFetchLon !== null) {
      return {
        lat: lastFetchLat,
        lon: lastFetchLon,
        name: lastKnownLocationName || $locationName || $t.currentLocation,
      };
    }
    if ($settingsStore.customLocation) {
      return $settingsStore.customLocation;
    }
    return { lat: 50.2965, lon: 18.9546, name: 'Chorzów, Poland' };
  }

  function openWindMap(preferredMode: 'auto' | 'custom' | null = null) {
    const current = currentLocation();
    const currentIndex = $windGrid ? currentHourIndex($windGrid) : 0;
    mapOverlay.openAtLocation(current);
    mapOverlay.setMode(preferredMode ?? $settingsStore.locationMode);
    if ($windGrid && ($hourOffset < 0 || $hourOffset >= $windGrid.times.length || $hourOffset === 0)) {
      hourOffset.set(currentIndex);
    }
    mapOverlay.setSelectedHour($windGrid ? currentHourIndex($windGrid) : $hourOffset);
    searchQuery = '';
    searchResults = [];
    searchAttempted = false;
    viewportBounds = null;
    viewportZoom = 0;
    showWindMap = true;
  }

  function closeWindMap() {
    showWindMap = false;
    windMapInstance = null;
    searchQuery = '';
    searchResults = [];
    searchAttempted = false;
  }

  function onWindMapSearchChange(value: string) {
    searchQuery = value;
    if (searchTimeout) clearTimeout(searchTimeout);
    if (value.trim().length < 2) {
      searchResults = [];
      searchAttempted = false;
      return;
    }
    searchTimeout = setTimeout(async () => {
      searchResults = await forwardGeocode(value.trim());
      searchAttempted = true;
    }, 250);
  }

  function onWindMapMarkerSelect(location: { lat: number; lon: number; name?: string }) {
    const fallbackName = location.name ?? $t.selectedSpot;
    mapOverlay.setCustomLocation({ lat: location.lat, lon: location.lon, name: fallbackName });
    const requestId = ++latestMarkerRequest;
    reverseGeocode(location.lat, location.lon).then((name) => {
      if (requestId !== latestMarkerRequest) return;
      mapOverlay.setCustomLocation({ lat: location.lat, lon: location.lon, name });
    });
  }

  function onWindMapSearchSelect(result: GeoResult) {
    searchQuery = result.name;
    searchResults = [];
    searchAttempted = false;
    mapOverlay.setMapCenter(result);
    if ($mapOverlay.mode === 'custom') {
      onWindMapMarkerSelect(result);
    }
    windMapInstance?.flyTo({ center: [result.lon, result.lat], zoom: Math.max(windMapInstance.getZoom(), 9) });
  }

  function onWindMapViewportChange(viewport: {
    center: { lng: number; lat: number };
    zoom: number;
    bounds: { west: number; south: number; east: number; north: number } | null;
  }) {
    viewportBounds = viewport.bounds;
    viewportZoom = viewport.zoom;
    const requestId = ++latestViewportRequest;
    reverseGeocode(viewport.center.lat, viewport.center.lng).then((name) => {
      if (requestId !== latestViewportRequest) return;
      mapOverlay.setMapCenter({ lat: viewport.center.lat, lon: viewport.center.lng, name });
    });
  }

  function commitWindMapSelection() {
    if ($mapOverlay.mode === 'auto') {
      settingsStore.update((s) => ({ ...s, locationMode: 'auto' }));
      closeWindMap();
      return;
    }

    const next = $mapOverlay.pendingCustomLocation ?? {
      lat: $mapOverlay.mapCenter.lat,
      lon: $mapOverlay.mapCenter.lon,
      name: $mapOverlay.mapCenter.name ?? $t.selectedSpot,
    };

    mapOverlay.confirmCustomLocation();
    settingsStore.update((s) => ({
      ...s,
      locationMode: 'custom',
      customLocation: next,
    }));
    closeWindMap();
  }

  function requestLocation(forceForecastFetch = false) {

    const mode = $settingsStore.locationMode;
    _lastFetchedKey = mode + '|' + JSON.stringify($settingsStore.customLocation);
    const custom = $settingsStore.customLocation;

    if (mode === 'custom') {
      if (custom) {
        fetchCustomLocation(custom.lat, custom.lon, custom.name, forceForecastFetch);
      } else {
        settingsStore.update((s) => ({ ...s, locationMode: 'auto' }));
      }
      return;
    }

    // Auto mode

    navigator.geolocation.getCurrentPosition((position) => onLocation(position, forceForecastFetch), () => {
      const fallback = decideAutoLocationFailure(custom);
      if (fallback.type === 'use-custom') {
        fetchCustomLocation(fallback.location.lat, fallback.location.lon, fallback.location.name, forceForecastFetch);
        return;
      }

      openWindMap(fallback.mode);
    }, { timeout: 10000 });
  }

  onMount(() => {
    requestLocation();
    fetchKp();
    _lastFetchedKey = $settingsStore.locationMode + '|' + JSON.stringify($settingsStore.customLocation);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestLocation();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });

  onDestroy(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
  });
</script>

<div class="app-shell">
  {#if $fetchState.type === 'loading' || $fetchState.type === 'idle'}
    <!-- Loading -->
    <div class="full-screen-msg">
      <div class="spinner"></div>
      <p>{$t.fetchingForecast}</p>
    </div>
  {:else if $fetchState.type === 'failed'}
    <!-- Error -->
    <div class="full-screen-msg">
      <span class="icon">📡</span>
      <p>{$fetchState.message}</p>
      <button on:click={() => requestLocation()}>{$t.retry}</button>
    </div>
  {:else if $fetchState.type === 'loaded' && $windGrid}
    <!-- Main UI -->
    <div class="desktop-shell">
      <div class="main-column">
        <AppHeader locationName={$locationName} onOpenMap={openWindMap} />

        {#if $fetchState.modelCount < 6}
          <ErrorBanner
            message={$t.limitedData($fetchState.modelCount)}
            style="warning"
            onRetry={requestLocation}
          />
        {/if}

        <SummaryStrip
          grid={$windGrid}
          hourOffset={$hourOffset}
          thresholdKmh={$settingsStore.thresholdKmh}
          unit={$settingsStore.unit}
        />

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
          tempUnit={$settingsStore.tempUnit}
          windUnit={$settingsStore.unit}
          thresholdKmh={$settingsStore.thresholdKmh}
          kpData={$kpStore}
        />

        <div class="mobile-hour-details">
          <SelectedHourDetails
            grid={$windGrid}
            hourOffset={$hourOffset}
            thresholdKmh={$settingsStore.thresholdKmh}
            windUnit={$settingsStore.unit}
            tempUnit={$settingsStore.tempUnit}
            kpData={$kpStore}
            compact
          />
        </div>

        <TimeSlider
          grid={$windGrid}
          hourOffset={$hourOffset}
          thresholdKmh={$settingsStore.thresholdKmh}
          onChange={v => hourOffset.set(v)}
        />

        <div class="mobile-footer">
          <ThresholdFooter
            thresholdKmh={$settingsStore.thresholdKmh}
            unit={$settingsStore.unit}
            onSettings={() => showSettings = true}
          />
        </div>
      </div>

      <div class="desktop-rail">
        <DesktopUtilityRail
          grid={$windGrid}
          hourOffset={$hourOffset}
          thresholdKmh={$settingsStore.thresholdKmh}
          unit={$settingsStore.unit}
          tempUnit={$settingsStore.tempUnit}
          kpData={$kpStore}
          onSettings={() => showSettings = true}
        />
      </div>
    </div>
  {/if}

  {#if showSettings}
    <SettingsSheet
      settings={$settingsStore}
      modelCount={$fetchState.type === 'loaded' ? $fetchState.modelCount : 0}
      onClose={() => showSettings = false}
      onChange={patch => settingsStore.update(s => ({ ...s, ...patch }))}
    />
  {/if}

  {#if showWindMap}
    <WindMap
      mode={$mapOverlay.mode}
      locationLabel={$mapOverlay.mode === 'custom'
        ? ($mapOverlay.pendingCustomLocation?.name ?? $mapOverlay.mapCenter.name ?? $mapOverlay.activeLocation.name)
        : ($mapOverlay.mapCenter.name ?? $mapOverlay.activeLocation.name)}
      searchValue={searchQuery}
      searchResults={searchResults}
      searchAttempted={searchAttempted}
      selectedHourLabel={$windGrid ? $windGrid.times[$hourOffset]?.toLocaleString($t.dateLocale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) ?? $t.now : $t.now}
      isCurrentHourSelected={$windGrid ? $hourOffset === currentHourIndex($windGrid) : true}
      hourChips={$windGrid
        ? Array.from({ length: 5 }, (_, index) => {
            const offset = Math.min($hourOffset + index, $windGrid.times.length - 1);
            const date = $windGrid.times[offset];
            return {
              id: String(offset),
              label: date.toLocaleTimeString($t.dateLocale, { hour: '2-digit', minute: '2-digit' }),
              sublabel: offset === currentHourIndex($windGrid) ? $t.now : date.toLocaleDateString($t.dateLocale, { weekday: 'short' }),
              active: offset === $hourOffset,
            };
          })
        : []}
      overlaySamples={$mapOverlay.overlayState.type === 'loaded' ? $mapOverlay.overlayState.samples : []}
      overlayBounds={viewportBounds ? { north: viewportBounds.north, south: viewportBounds.south, east: viewportBounds.east, west: viewportBounds.west } : null}
      overlayThresholdKmh={$settingsStore.thresholdKmh}
      overlayDensity={densityForZoom(viewportZoom || 0)}
      overlayStatusLabel={$mapOverlay.overlayState.type === 'failed' ? $mapOverlay.overlayState.message : ''}
      initialCenter={[$mapOverlay.activeLocation.lon, $mapOverlay.activeLocation.lat]}
      initialZoom={$mapOverlay.activeLocation.lat === 0 && $mapOverlay.activeLocation.lon === 0 ? 2 : 9}
      primaryActionLabel={$mapOverlay.mode === 'custom' ? $t.useThisSpot : $t.useGps}
      secondaryActionLabel={$t.close}
      onBack={closeWindMap}
      onSearchChange={onWindMapSearchChange}
      onSearchSelect={onWindMapSearchSelect}
      onModeChange={(mode) => mapOverlay.setMode(mode)}
      selectedMarker={$mapOverlay.mode === 'custom'
        ? ($mapOverlay.pendingCustomLocation ?? $mapOverlay.selectedCustomLocation)
        : null}
      onMapSelect={onWindMapMarkerSelect}
      onHourSelect={(id) => {
        if (id === 'now') {
          const currentIndex = $windGrid ? currentHourIndex($windGrid) : 0;
          hourOffset.set(currentIndex);
          mapOverlay.setSelectedHour(currentIndex);
          return;
        }
        const next = Number(id);
        if (Number.isFinite(next)) {
          hourOffset.set(next);
          mapOverlay.setSelectedHour(next);
        }
      }}
      onPrimaryAction={commitWindMapSelection}
      onSecondaryAction={closeWindMap}
      onViewportChange={onWindMapViewportChange}
      onMapReady={(map) => {
        windMapInstance = map;
      }}
    />
  {/if}
</div>

<style>
  .app-shell {
    display: flex; flex-direction: column;
    height: 100dvh;
    padding-top: var(--safe-top);
    overflow: hidden;
    background: var(--bg);
  }

  .full-screen-msg {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px;
    padding: 32px;
    padding-bottom: calc(32px + var(--safe-bottom));
    text-align: center;
    color: var(--text-muted);
  }
  .icon  { font-size: 48px; }
  button { padding: 12px 24px; background: var(--blue); color: #fff; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }

  .spinner {
    width: 36px; height: 36px; border: 3px solid var(--border);
    border-top-color: var(--blue); border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mobile-hour-details {
    display: none;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (min-width: 1024px) {
    .mobile-hour-details {
      display: none;
    }
  }
</style>
