<!-- src/lib/components/WeatherStrip.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  import { convertTemp } from '../stores/settingsStore';
  import { weatherIcon } from '../utils/weatherIcon';
  import type { WindGrid, TempUnit } from '../types';

  export let grid: WindGrid;
  export let hourOffset: number;
  export let unit: TempUnit;

  $: start = Math.max(0, hourOffset);
  $: indices = Array.from({ length: 24 }, (_, i) => Math.min(start + i, grid.times.length - 1));

  function displayTemp(celsius: number): string {
    return convertTemp(celsius, unit).toFixed(0) + (unit === 'fahrenheit' ? '°F' : '°C');
  }
</script>

<div class="strip">
  {#each indices as idx, i}
    <div class="cell" class:active={i === 0}>
      {#if i === 0}<span class="now-label">{$t.now}</span>{/if}
      <span class="icon">{weatherIcon(grid.weatherCode[idx])}</span>
      <span class="temp">{displayTemp(grid.temperature[idx])}</span>
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 6px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
  }

  .strip::-webkit-scrollbar { display: none; }

  .cell {
    flex: 0 0 34px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 34px;
    padding: 4px 3px;
    border-radius: 6px;
    scroll-snap-align: start;
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

  @media (min-width: 640px) {
    .strip {
      gap: 0;
      overflow-x: visible;
      padding: 4px 0;
    }

    .cell {
      flex: 1 0 0;
      min-width: 0;
      gap: 1px;
      padding: 3px 2px;
      scroll-snap-align: none;
    }
  }
</style>
