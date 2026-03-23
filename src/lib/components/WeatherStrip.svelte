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
