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
            <div class="day-sep">
              <span class="day-label">{entry.time.toLocaleDateString([], { weekday: 'short' })}</span>
            </div>
          {/if}
          <div class="kp-bar-wrap" class:kp-now={entry === currentKp}>
            <span class="kp-num" style="color: {kpColor(entry.kp)}">{entry.kp.toFixed(0)}</span>
            <div
              class="kp-bar"
              style="height: {Math.max(4, (entry.kp / 9) * 100)}%; background: {kpColor(entry.kp)}; opacity: 0.5"
            ></div>
            {#if entry === currentKp}
              <span class="kp-time kp-now-label">now</span>
            {:else if entry.time.getUTCHours() === 12}
              <span class="kp-time">{entry.time.toLocaleDateString([], { weekday: 'short' })}</span>
            {:else}
              <span class="kp-time"></span>
            {/if}
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
    height: 64px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .kp-bars::-webkit-scrollbar { display: none; }

  .kp-bar-wrap {
    flex: 0 0 18px;
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

  .kp-num { font-size: 9px; font-weight: 700; line-height: 1; }
  .kp-time { font-size: 7px; color: var(--text-muted); line-height: 1; min-height: 9px; }
  .kp-now-label { color: var(--blue); font-weight: 700; }

  .day-sep {
    width: 1px;
    min-width: 1px;
    height: 100%;
    background: var(--border);
    flex-shrink: 0;
    align-self: stretch;
    position: relative;
    overflow: visible;
  }

  .day-label {
    position: absolute;
    bottom: -1px;
    left: 3px;
    font-size: 7px;
    color: var(--text-muted);
    white-space: nowrap;
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
  .gust-val  { font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.45); }

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
