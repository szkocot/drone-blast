<!-- src/App.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from './lib/i18n/en';
  import { windGrid, fetchState, hourOffset, fetchWind, locationName } from './lib/stores/windStore';
  import { settingsStore, haversineKm } from './lib/stores/settingsStore';
  import { reverseGeocode } from './lib/services/geocoder';

  import AppHeader       from './lib/components/AppHeader.svelte';
  import SummaryStrip    from './lib/components/SummaryStrip.svelte';
  import HeatmapCanvas   from './lib/components/HeatmapCanvas.svelte';
  import TimeSlider      from './lib/components/TimeSlider.svelte';
  import ThresholdFooter from './lib/components/ThresholdFooter.svelte';
  import SettingsSheet   from './lib/components/SettingsSheet.svelte';
  import ErrorBanner     from './lib/components/ErrorBanner.svelte';
  import DesktopUtilityRail from './lib/components/DesktopUtilityRail.svelte';

  let showSettings = false;
  let gpsError = false;
  let lastFetchLat: number | null = null;
  let lastFetchLon: number | null = null;

  // Apply theme
  $: {
    const ap = $settingsStore.appearance;
    if (ap === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', ap);
  }

  function onLocation(pos: GeolocationPosition) {
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
    fetchWind(lat, lon);
    reverseGeocode(lat, lon).then(name => locationName.set(name));
  }

  function requestLocation() {
    gpsError = false;
    navigator.geolocation.getCurrentPosition(onLocation, () => { gpsError = true; });
  }

  onMount(() => {
    requestLocation();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') requestLocation();
    });
  });
</script>

<div class="app-shell">
  {#if gpsError}
    <!-- GPS denied -->
    <div class="full-screen-msg">
      <span class="icon">📍</span>
      <p>{t.locationRequired}</p>
      <small>{t.locationHelp}</small>
    </div>
  {:else if $fetchState.type === 'loading' || $fetchState.type === 'idle'}
    <!-- Loading -->
    <div class="full-screen-msg">
      <div class="spinner"></div>
      <p>{t.fetchingForecast}</p>
    </div>
  {:else if $fetchState.type === 'failed'}
    <!-- Error -->
    <div class="full-screen-msg">
      <span class="icon">📡</span>
      <p>{$fetchState.message}</p>
      <button on:click={requestLocation}>{t.retry}</button>
    </div>
  {:else if $fetchState.type === 'loaded' && $windGrid}
    <!-- Main UI -->
    <div class="desktop-shell">
      <div class="main-column">
        <AppHeader locationName={$locationName} />

        {#if $fetchState.modelCount < 6}
          <ErrorBanner
            message={t.limitedData($fetchState.modelCount)}
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
          thresholdKmh={$settingsStore.thresholdKmh}
          unit={$settingsStore.unit}
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
</div>

<style>
  .app-shell {
    display: flex; flex-direction: column;
    height: 100%; overflow: hidden;
    background: var(--bg);
  }

  .full-screen-msg {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; padding: 32px; text-align: center;
    color: var(--text-muted);
  }
  .icon  { font-size: 48px; }
  button { padding: 12px 24px; background: var(--blue); color: #fff; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }

  .spinner {
    width: 36px; height: 36px; border: 3px solid var(--border);
    border-top-color: var(--blue); border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
